"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOps } from "../auth";
import { opsDbError, opsError, type OpsResult } from "../errors";
import { INCIDENT_CATEGORIES, URGENCIES } from "../labels";
import { notifyCriticalIncident, processOutbox } from "../notify";

/* ------------------------------ Relatórios diários ------------------------------ */

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const reportSchema = z.object({
  id: z.string().uuid().optional(),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  work_order_id: z.string().uuid("Escolha a obra"),
  location: text(200),
  activities: z.string().trim().min(3, "Descreva as actividades executadas").max(5000),
  hours: z.coerce.number().min(0).max(24),
  materials_used: text(2000),
  tasks_done: text(2000),
  tasks_pending: text(2000),
  difficulties: text(2000),
  notes: text(2000),
});

export async function saveDailyReport(input: unknown): Promise<OpsResult<{ id: string }>> {
  try {
    const user = await requireOps();
    const { id, ...values } = reportSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = id
      ? await supabase.from("ops_daily_reports").update({ ...values, status: "submetido" }).eq("id", id).eq("user_id", user.id).select("id").single()
      : await supabase.from("ops_daily_reports").insert({ ...values, user_id: user.id }).select("id").single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return opsError(error);
  }
}

export async function reviewDailyReport(id: string, decision: "validado" | "correccao", note?: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor", "supervisor"]);
    if (decision === "correccao" && !note?.trim()) return { ok: false, error: "Indique o que deve ser corrigido." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("ops_daily_reports")
      .update({ status: decision, review_note: note?.trim() || null })
      .eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

/* ------------------------------ Ocorrências ------------------------------ */

const incidentSchema = z.object({
  work_order_id: z.string().uuid("Escolha a obra"),
  task_id: z.string().uuid().nullable().optional(),
  occurred_at: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v).toISOString() : new Date().toISOString())),
  location: text(200),
  category: z.enum(INCIDENT_CATEGORIES),
  description: z.string().trim().min(5, "Descreva o que aconteceu").max(3000),
  impact: text(1000),
  urgency: z.enum(URGENCIES),
  proposed_measures: text(2000),
});

export async function reportIncident(input: unknown): Promise<OpsResult<{ id: string }>> {
  try {
    const user = await requireOps();
    const values = incidentSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase.from("ops_incidents").insert({ ...values, reporter_id: user.id }).select("id").single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    if (values.urgency === "critico" && (await notifyCriticalIncident(data.id))) {
      after(async () => {
        try {
          await processOutbox(20);
        } catch (e) {
          console.error("[gestao] envio imediato falhou:", e);
        }
      });
    }
    refresh();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return opsError(error);
  }
}

export async function updateIncident(input: unknown): Promise<OpsResult> {
  try {
    await requireOps();
    const v = z
      .object({
        id: z.string().uuid(),
        status: z.enum(["aberta", "em_analise", "resolvida", "encerrada"]),
        owner_id: z.string().uuid().nullable().optional(),
        resolution_note: text(2000),
        urgency: z.enum(URGENCIES).optional(),
      })
      .parse(input);
    const supabase = await createClient();
    const { id, ...patch } = v;
    const { data, error } = await supabase
      .from("ops_incidents")
      .update({ ...patch, resolved_at: ["resolvida", "encerrada"].includes(v.status) ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if (error) return { ok: false, error: opsDbError(error.message) };
    if (!data?.length) return { ok: false, error: "O seu perfil não pode alterar esta ocorrência." };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

/** Cria uma tarefa correctiva a partir da ocorrência e associa-a. */
export async function createCorrectiveTask(incidentId: string): Promise<OpsResult<{ taskId: string }>> {
  try {
    const user = await requireOps(["admin", "direcao", "gestor", "supervisor"]);
    const supabase = await createClient();
    const { data: inc, error: iErr } = await supabase
      .from("ops_incidents")
      .select("id, work_order_id, description, urgency, owner_id, corrective_task_id")
      .eq("id", z.string().uuid().parse(incidentId))
      .single();
    if (iErr || !inc) return { ok: false, error: "Ocorrência não encontrada." };
    if (inc.corrective_task_id) return { ok: true, data: { taskId: inc.corrective_task_id } };
    const { data: task, error } = await supabase
      .from("ops_tasks")
      .insert({
        work_order_id: inc.work_order_id,
        title: `Correctiva: ${inc.description.slice(0, 150)}`,
        description: inc.description,
        priority: inc.urgency === "critico" ? "urgente" : inc.urgency === "alto" ? "alta" : "media",
        responsible_id: inc.owner_id,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    if (inc.owner_id) await supabase.from("ops_task_assignees").insert({ task_id: task.id, user_id: inc.owner_id });
    await supabase.from("ops_incidents").update({ corrective_task_id: task.id, status: "em_analise" }).eq("id", inc.id);
    refresh();
    return { ok: true, data: { taskId: task.id } };
  } catch (error) {
    return opsError(error);
  }
}
