import "server-only";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/supabase/env";
import { sendTemplate, whatsappConfig } from "@/lib/whatsapp";
import { normalizePhone, taskAlertParams, type Task, type TaskAlertKind } from "./rules";

/** Modelo aprovado na Meta (ver docs/TAREFAS-E-SAIDAS.md). */
export const TASK_TEMPLATE = { name: "pr_alerta_tarefa", language: "pt_PT" } as const;

export const TASK_COLUMNS =
  "id, code, title, description, area, priority, status, responsible_name, responsible_phone, due_at, remind_before_hours, notes, completed_at, reminder_sent_at, overdue_sent_at, created_at, updated_at";

export function taskLink(code: string): string {
  return `${SITE_URL}/admin/tarefas?t=${encodeURIComponent(code)}`;
}

export type AlertOutcome = { status: "enviado" | "falhou" | "sem_configuracao" | "sem_telefone"; error?: string };

/**
 * Envia um alerta de tarefa por WhatsApp (Cloud API oficial) e regista o resultado em pr_task_alerts.
 * Sem credenciais da Meta, regista «sem_configuracao» — o painel oferece então o envio manual (wa.me).
 */
export async function sendTaskAlert(task: Task, kind: TaskAlertKind, actorId: string | null = null): Promise<AlertOutcome> {
  if (!isServiceRoleConfigured()) return { status: "sem_configuracao", error: "SUPABASE_SECRET_KEY não configurada." };
  const db = createAdminClient();
  const phone = normalizePhone(task.responsible_phone);
  let outcome: AlertOutcome;
  let messageId: string | null = null;
  if (!phone) {
    outcome = { status: "sem_telefone", error: "A tarefa não tem telemóvel do responsável." };
  } else if (!whatsappConfig().canSend) {
    outcome = { status: "sem_configuracao", error: "WhatsApp não configurado (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)." };
  } else {
    const r = await sendTemplate({ to: phone, template: TASK_TEMPLATE.name, language: TASK_TEMPLATE.language, params: taskAlertParams(task, kind, taskLink(task.code)) });
    if (r.ok) {
      outcome = { status: "enviado" };
      messageId = r.messageId;
    } else {
      outcome = { status: "falhou", error: r.error };
    }
  }
  await db.from("pr_task_alerts").insert({
    task_id: task.id,
    kind,
    phone,
    status: outcome.status,
    message_id: messageId,
    error: outcome.error ?? null,
    created_by: actorId,
  });
  return outcome;
}

/**
 * Alertas automáticos (agendador diário): lembrete antes do prazo e aviso de atraso, uma vez por prazo.
 * A marcação é atómica (só quem a consegue gravar envia), por isso duas execuções seguidas não duplicam.
 */
export async function runTaskAlerts(now: Date = new Date()) {
  const db = createAdminClient();
  const { data, error } = await db.from("pr_tasks").select(TASK_COLUMNS).in("status", ["pendente", "em_curso"]).not("due_at", "is", null);
  if (error) throw new Error(error.message);
  const result = { lembrete: 0, atraso: 0, falhas: 0 };
  for (const task of (data ?? []) as Task[]) {
    const due = new Date(task.due_at!).getTime();
    let kind: "lembrete" | "atraso" | null = null;
    let column: "reminder_sent_at" | "overdue_sent_at" | null = null;
    if (due < now.getTime() && !task.overdue_sent_at) {
      kind = "atraso";
      column = "overdue_sent_at";
    } else if (due >= now.getTime() && task.remind_before_hours > 0 && !task.reminder_sent_at && due - now.getTime() <= task.remind_before_hours * 3_600_000) {
      kind = "lembrete";
      column = "reminder_sent_at";
    }
    if (!kind || !column) continue;
    const { data: claimed } = await db.from("pr_tasks").update({ [column]: now.toISOString() }).eq("id", task.id).is(column, null).select("id");
    if (!claimed?.length) continue;
    const r = await sendTaskAlert(task, kind);
    if (r.status === "enviado") result[kind]++;
    else result.falhas++;
  }
  return result;
}
