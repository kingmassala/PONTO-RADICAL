"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOps } from "../auth";
import { opsDbError, opsError, type OpsResult } from "../errors";
import { COMPANY_AREAS, PRIORITIES, TASK_STATUSES } from "../labels";
import { notifyTask, processOutbox } from "../notify";
import { can } from "../roles";

const isoOrNull = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v).toISOString() : null));

const taskSchema = z.object({
  id: z.string().uuid().optional(),
  // Tarefa de uma obra (work_order_id) ou da gestão da empresa (area).
  work_order_id: z.string().uuid().nullable().optional().transform((v) => v || null),
  area: z.enum(COMPANY_AREAS).nullable().optional().transform((v) => v || null),
  parent_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2, "Indique a designação").max(200),
  description: z.string().trim().max(5000).optional().transform((v) => v || null),
  responsible_id: z.string().uuid().nullable().optional(),
  assignees: z.array(z.string().uuid()).max(20).default([]),
  depends_on: z.array(z.string().uuid()).max(20).default([]),
  priority: z.enum(PRIORITIES),
  start_at: isoOrNull,
  due_at: isoOrNull,
  planned_hours: z.coerce.number().min(0).max(10000).default(0),
  status: z.enum(TASK_STATUSES).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  sort_order: z.coerce.number().int().optional(),
});

/** Envia já a fila depois de responder ao utilizador (o cron trata das repetições). */
function flushSoon() {
  after(async () => {
    try {
      await processOutbox(10);
    } catch (error) {
      console.error("[gestao] envio imediato falhou:", error);
    }
  });
}

export async function saveTask(input: unknown): Promise<OpsResult<{ id: string }>> {
  try {
    const user = await requireOps(["admin", "direcao", "gestor", "supervisor"]);
    const { id, assignees, depends_on, ...parsed } = taskSchema.parse(input);
    if (!parsed.work_order_id === !parsed.area) {
      return { ok: false, error: "Escolha uma obra ou, para tarefas da empresa, uma área." };
    }
    if (!parsed.work_order_id && !can.plan(user.role)) {
      return { ok: false, error: "Só a Administração, a Direcção e os Gestores criam tarefas da empresa." };
    }
    // O âmbito (obra ou empresa) não muda depois de criada.
    const { work_order_id, area, ...rest } = parsed;
    const values = id ? { ...rest, area } : { ...rest, work_order_id, area };
    if (values.start_at && values.due_at && values.due_at < values.start_at) {
      return { ok: false, error: "O prazo não pode ser anterior ao início." };
    }
    const supabase = await createClient();
    const people = [...new Set([...(values.responsible_id ? [values.responsible_id] : []), ...assignees])];

    let before: { start_at: string | null; due_at: string | null; status: string } | null = null;
    let previousPeople: string[] = [];
    if (id) {
      const { data } = await supabase.from("ops_tasks").select("start_at, due_at, status, assignees:ops_task_assignees(user_id)").eq("id", id).single();
      if (data) {
        before = { start_at: data.start_at, due_at: data.due_at, status: data.status };
        previousPeople = (data.assignees as { user_id: string }[]).map((a) => a.user_id);
      }
    }

    const { data, error } = id
      ? await supabase.from("ops_tasks").update(values).eq("id", id).select("id").single()
      : await supabase.from("ops_tasks").insert({ ...values, created_by: user.id }).select("id").single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    const taskId = data.id as string;

    // Atribuições: o responsável é sempre também atribuído.
    const toRemove = previousPeople.filter((p) => !people.includes(p));
    const toAdd = people.filter((p) => !previousPeople.includes(p));
    if (toRemove.length) await supabase.from("ops_task_assignees").delete().eq("task_id", taskId).in("user_id", toRemove);
    if (toAdd.length) {
      const { error: aErr } = await supabase.from("ops_task_assignees").insert(toAdd.map((u) => ({ task_id: taskId, user_id: u })));
      if (aErr) return { ok: false, error: opsDbError(aErr.message) };
    }
    await supabase.from("ops_task_dependencies").delete().eq("task_id", taskId);
    const deps = depends_on.filter((d) => d !== taskId);
    if (deps.length) await supabase.from("ops_task_dependencies").insert(deps.map((d) => ({ task_id: taskId, depends_on: d })));

    // Notificações.
    let queued = 0;
    if (toAdd.length) queued += await notifyTask("tarefa_atribuida", taskId, { userIds: toAdd, key: `atribuida` });
    const remaining = people.filter((p) => !toAdd.includes(p));
    if (before && remaining.length && (before.start_at !== values.start_at || before.due_at !== values.due_at)) {
      queued += await notifyTask("alteracao_horario", taskId, {
        userIds: remaining,
        key: `${values.start_at}|${values.due_at}`,
        note: "O horário desta tarefa foi alterado.",
      });
    }
    if (before && before.status !== "cancelada" && values.status === "cancelada") {
      queued += await notifyTask("tarefa_cancelada", taskId, { key: "cancelada", note: "Esta tarefa foi cancelada." });
    }
    if (queued) flushSoon();
    refresh();
    return { ok: true, data: { id: taskId } };
  } catch (error) {
    return opsError(error);
  }
}

/** Mudança rápida de estado (Kanban, lista, telemóvel). Técnicos só nas suas tarefas. */
export async function updateTaskProgress(input: unknown): Promise<OpsResult> {
  try {
    await requireOps();
    const v = z
      .object({
        task_id: z.string().uuid(),
        status: z.enum(TASK_STATUSES),
        progress: z.coerce.number().int().min(0).max(100).optional(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input);
    const supabase = await createClient();
    const { data: before } = await supabase.from("ops_tasks").select("status").eq("id", v.task_id).maybeSingle();
    const { error } = await supabase.rpc("ops_tech_update_task", {
      p_task: v.task_id,
      p_status: v.status,
      p_progress: v.progress ?? null,
      p_note: v.note ?? null,
    });
    if (error) return { ok: false, error: opsDbError(error.message) };
    if (before && before.status !== "cancelada" && v.status === "cancelada") {
      if (await notifyTask("tarefa_cancelada", v.task_id, { key: "cancelada", note: "Esta tarefa foi cancelada." })) flushSoon();
    }
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function validateTask(taskId: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor", "supervisor"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("ops_validate_task", { p_task: z.string().uuid().parse(taskId) });
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function deleteTask(taskId: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor"]);
    const supabase = await createClient();
    const { data, error } = await supabase.from("ops_tasks").delete().eq("id", z.string().uuid().parse(taskId)).select("id");
    if (error) return { ok: false, error: opsDbError(error.message) };
    if (!data?.length) return { ok: false, error: "Não tem permissão para eliminar esta tarefa." };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function logTime(input: unknown): Promise<OpsResult> {
  try {
    const user = await requireOps();
    const v = z
      .object({
        task_id: z.string().uuid(),
        user_id: z.string().uuid().optional(),
        work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        hours: z.coerce.number().positive("Indique as horas").max(24),
        note: z.string().trim().max(500).optional().transform((x) => x || null),
      })
      .parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_time_entries").insert({ ...v, user_id: v.user_id ?? user.id });
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function deleteTimeEntry(id: string): Promise<OpsResult> {
  try {
    await requireOps();
    const supabase = await createClient();
    const { data, error } = await supabase.from("ops_time_entries").delete().eq("id", z.string().uuid().parse(id)).select("id");
    if (error) return { ok: false, error: opsDbError(error.message) };
    if (!data?.length) return { ok: false, error: "Só pode remover os seus registos das últimas 48 horas." };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

const reminderSchema = z.object({
  task_id: z.string().uuid().nullable().optional(),
  work_order_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(120),
  message: z.string().trim().max(300).optional().transform((v) => v || null),
  recipients: z.array(z.string().uuid()).min(1, "Escolha pelo menos um destinatário").max(50),
  send_at: z.string().min(10).transform((v) => new Date(v).toISOString()),
  lead_minutes: z.coerce.number().int().min(0).max(10080).default(0),
  repeat: z.enum(["nenhuma", "diaria", "semanal"]).default("nenhuma"),
  repeat_until: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(v).toISOString() : null)),
  cancel_when_done: z.boolean().default(true),
});

export async function saveReminder(input: unknown): Promise<OpsResult> {
  try {
    const user = await requireOps(["admin", "direcao", "gestor", "supervisor"]);
    const v = reminderSchema.parse(input);
    if (!v.task_id && !v.work_order_id) return { ok: false, error: "Associe o lembrete a uma obra ou tarefa." };
    const supabase = await createClient();
    const { error } = await supabase.from("ops_reminders").insert({ ...v, created_by: user.id });
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function cancelReminder(id: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor", "supervisor"]);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_reminders").update({ status: "cancelado" }).eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}
