"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorResult, friendlyDbError, type ActionResult } from "@/lib/cms/errors";
import { sendTaskAlert, TASK_COLUMNS, type AlertOutcome } from "./alerts";
import { luandaLocalToIso, normalizePhone, TASK_AREAS, TASK_PRIORITIES, TASK_STATUSES, type Task } from "./rules";

const taskSchema = z.object({
  title: z.string().trim().min(3, "O título tem de ter pelo menos 3 caracteres.").max(160),
  description: z.string().trim().max(4000).default(""),
  area: z.enum(TASK_AREAS).default("geral"),
  priority: z.enum(TASK_PRIORITIES).default("media"),
  status: z.enum(TASK_STATUSES).default("pendente"),
  responsibleName: z.string().trim().min(2, "Indique o responsável.").max(120),
  responsiblePhone: z.string().trim().max(30).default(""),
  dueLocal: z.string().trim().default(""),
  remindBeforeHours: z.coerce.number().int().min(0).max(720).default(24),
  notes: z.string().trim().max(4000).default(""),
  notify: z.boolean().default(true),
});

function toRow(v: z.infer<typeof taskSchema>) {
  const phone = v.responsiblePhone ? normalizePhone(v.responsiblePhone) : null;
  if (v.responsiblePhone && !phone) throw new z.ZodError([{ code: "custom", path: ["responsiblePhone"], message: "Telemóvel inválido (ex.: 923 456 789 ou +244 923 456 789).", input: v.responsiblePhone }]);
  const due = v.dueLocal ? luandaLocalToIso(v.dueLocal) : null;
  if (v.dueLocal && !due) throw new z.ZodError([{ code: "custom", path: ["dueLocal"], message: "Prazo inválido.", input: v.dueLocal }]);
  return {
    title: v.title,
    description: v.description || null,
    area: v.area,
    priority: v.priority,
    status: v.status,
    responsible_name: v.responsibleName,
    responsible_phone: phone,
    due_at: due,
    remind_before_hours: v.remindBeforeHours,
    notes: v.notes || null,
  };
}

export async function createTask(input: unknown): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireStaff();
    const v = taskSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase.from("pr_tasks").insert(toRow(v)).select(TASK_COLUMNS).single();
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    const task = data as Task;
    // Aviso ao responsável depois da resposta (não atrasa o painel).
    if (v.notify && task.responsible_phone) after(() => sendTaskAlert(task, "atribuida", user.id).then(() => undefined));
    refresh();
    return { ok: true, data: { code: task.code } };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateTask(id: string, input: unknown): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const v = taskSchema.parse(input);
    const supabase = await createClient();
    const taskId = z.string().uuid().parse(id);
    const { data: before } = await supabase.from("pr_tasks").select("responsible_phone, responsible_name").eq("id", taskId).maybeSingle();
    const { data, error } = await supabase.from("pr_tasks").update(toRow(v)).eq("id", taskId).select(TASK_COLUMNS).maybeSingle();
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data) return { ok: false, error: "A tarefa já não existe." };
    const task = data as Task;
    const reassigned = before && (before.responsible_phone !== task.responsible_phone || before.responsible_name !== task.responsible_name);
    if (v.notify && reassigned && task.responsible_phone && (task.status === "pendente" || task.status === "em_curso")) {
      after(() => sendTaskAlert(task, "atribuida", user.id).then(() => undefined));
    }
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function setTaskStatus(id: string, status: unknown): Promise<ActionResult> {
  try {
    await requireStaff();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pr_tasks")
      .update({ status: z.enum(TASK_STATUSES).parse(status) })
      .eq("id", z.string().uuid().parse(id))
      .select("id");
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data?.length) return { ok: false, error: "A tarefa já não existe." };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.from("pr_tasks").delete().eq("id", z.string().uuid().parse(id)).select("id");
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data?.length) return { ok: false, error: "A tarefa já não existe ou não tem permissão para a apagar." };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

/** Envia agora o alerta ao responsável (botão «Avisar por WhatsApp»). */
export async function sendTaskAlertNow(id: string): Promise<ActionResult<AlertOutcome>> {
  try {
    const user = await requireStaff();
    const supabase = await createClient();
    const { data, error } = await supabase.from("pr_tasks").select(TASK_COLUMNS).eq("id", z.string().uuid().parse(id)).maybeSingle();
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data) return { ok: false, error: "A tarefa já não existe." };
    const task = data as Task;
    const kind = task.due_at && new Date(task.due_at) < new Date() ? "atraso" : "atribuida";
    const outcome = await sendTaskAlert(task, kind, user.id);
    refresh();
    return { ok: true, data: outcome };
  } catch (error) {
    return errorResult(error);
  }
}
