import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import type { NotificationEvent, Priority } from "./labels";
import { MAX_SEND_ATTEMPTS, retryDelayMinutes, summaryMessage, taskMessage } from "./messages";
import type { OpsRole } from "./roles";
import { addDaysIso, luandaToIso, todayLuanda } from "./time";
import { sendTemplate, whatsappConfig } from "./whatsapp";

/**
 * Fila de notificações WhatsApp.
 * Todas as mensagens passam pela tabela ops_notifications (chave de deduplicação única),
 * são enviadas pelo processador e actualizadas pelos webhooks da Meta.
 * Só recebem mensagens colaboradores activos com telefone e consentimento registados.
 */

type Admin = SupabaseClient;

export type Settings = {
  whatsapp_enabled: boolean;
  task_start_lead_minutes: number;
  due_soon_hours: number;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  weekly_summary_enabled: boolean;
  weekly_summary_dow: number;
  weekly_summary_time: string;
  max_messages_per_run: number;
};

type Recipient = { user_id: string; full_name: string; whatsapp_phone: string };
type QueueItem = {
  dedupe_key: string;
  event: NotificationEvent;
  recipient: Recipient;
  params: string[];
  preview: string;
  work_order_id?: string | null;
  task_id?: string | null;
  scheduled_for?: string;
};

function admin(): Admin | null {
  return isServiceRoleConfigured() ? createAdminClient() : null;
}

async function getSettings(db: Admin): Promise<Settings> {
  const { data } = await db.from("ops_settings").select("*").eq("id", 1).single();
  return data as Settings;
}

async function getTemplates(db: Admin) {
  const { data } = await db.from("ops_whatsapp_templates").select("event, template_name, language, enabled");
  return new Map((data ?? []).map((t) => [t.event as string, t as { template_name: string; language: string; enabled: boolean }]));
}

async function recipientsByIds(db: Admin, ids: (string | null | undefined)[]): Promise<Recipient[]> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (!unique.length) return [];
  const { data } = await db
    .from("ops_members")
    .select("user_id, full_name, whatsapp_phone")
    .in("user_id", unique)
    .eq("active", true)
    .eq("whatsapp_consent", true)
    .not("whatsapp_phone", "is", null);
  return (data ?? []) as Recipient[];
}

async function recipientsByRoles(db: Admin, roles: OpsRole[]): Promise<Recipient[]> {
  const { data } = await db
    .from("ops_members")
    .select("user_id, full_name, whatsapp_phone")
    .in("role", roles)
    .eq("active", true)
    .eq("whatsapp_consent", true)
    .not("whatsapp_phone", "is", null);
  return (data ?? []) as Recipient[];
}

/** Insere na fila, ignorando duplicados (mesma chave = mesma mensagem). */
async function enqueue(db: Admin, items: QueueItem[]): Promise<number> {
  if (!items.length) return 0;
  const templates = await getTemplates(db);
  const rows = items
    .map((i) => {
      const t = templates.get(i.event);
      if (!t?.enabled) return null;
      return {
        dedupe_key: i.dedupe_key,
        event: i.event,
        recipient_id: i.recipient.user_id,
        phone: i.recipient.whatsapp_phone,
        template_name: t.template_name,
        language: t.language,
        params: i.params,
        preview: i.preview,
        work_order_id: i.work_order_id ?? null,
        task_id: i.task_id ?? null,
        scheduled_for: i.scheduled_for ?? new Date().toISOString(),
        next_attempt_at: i.scheduled_for ?? new Date().toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (!rows.length) return 0;
  const { data, error } = await db.from("ops_notifications").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
  if (error) console.error("[gestao] erro ao enfileirar notificações:", error.message);
  return data?.length ?? 0;
}

type TaskContext = {
  id: string;
  title: string;
  code: string;
  start_at: string | null;
  due_at: string | null;
  priority: Priority;
  status: string;
  responsible_id: string | null;
  work_order_id: string;
  order: { number: string; manager_id: string | null; vessel: { name: string; code: string } | null } | null;
  responsible: { full_name: string } | null;
  assignees: { user_id: string }[];
};

async function loadTasks(db: Admin, ids: string[]): Promise<TaskContext[]> {
  if (!ids.length) return [];
  const { data } = await db
    .from("ops_tasks")
    .select(
      "id, title, code, start_at, due_at, priority, status, responsible_id, work_order_id, order:ops_work_orders(number, manager_id, vessel:ops_vessels(name, code)), responsible:ops_members!ops_tasks_responsible_id_fkey(full_name), assignees:ops_task_assignees(user_id)",
    )
    .in("id", ids);
  return (data ?? []) as unknown as TaskContext[];
}

function taskItems(t: TaskContext, event: NotificationEvent, recipients: Recipient[], keySuffix: string, note?: string, when?: string | null): QueueItem[] {
  const msg = taskMessage({
    event,
    orderNumber: t.order?.number ?? "—",
    vessel: t.order?.vessel ? `${t.order.vessel.code} · ${t.order.vessel.name}` : "—",
    task: `${t.code} · ${t.title}`,
    responsible: t.responsible?.full_name ?? "—",
    when: when === undefined ? t.start_at ?? t.due_at : when,
    priority: t.priority,
    note,
  });
  return recipients.map((r) => ({
    dedupe_key: `${event}:${t.id}:${r.user_id}:${keySuffix}`,
    event,
    recipient: r,
    params: msg.params,
    preview: msg.preview,
    work_order_id: t.work_order_id,
    task_id: t.id,
  }));
}

/**
 * Notificações imediatas de tarefas (atribuição, alteração de horário, cancelamento).
 * `userIds`: destinatários; por omissão responsável + técnicos atribuídos.
 */
export async function notifyTask(event: NotificationEvent, taskId: string, opts: { userIds?: string[]; note?: string; key?: string } = {}) {
  const db = admin();
  if (!db) return 0;
  const settings = await getSettings(db);
  if (!settings.whatsapp_enabled) return 0;
  const [t] = await loadTasks(db, [taskId]);
  if (!t) return 0;
  const ids = opts.userIds ?? [t.responsible_id, ...t.assignees.map((a) => a.user_id)];
  const recipients = await recipientsByIds(db, ids);
  const suffix = opts.key ?? `${t.start_at ?? ""}|${t.due_at ?? ""}|${Date.now()}`;
  return enqueue(db, taskItems(t, event, recipients, suffix, opts.note));
}

/** Ocorrência crítica → Administração, Direcção, Gestores e o gestor da obra. */
export async function notifyCriticalIncident(incidentId: string) {
  const db = admin();
  if (!db) return 0;
  const settings = await getSettings(db);
  if (!settings.whatsapp_enabled) return 0;
  const { data: inc } = await db
    .from("ops_incidents")
    .select("id, description, occurred_at, urgency, work_order_id, task_id, owner_id, order:ops_work_orders(number, manager_id, vessel:ops_vessels(name, code)), reporter:ops_members!ops_incidents_reporter_id_fkey(full_name)")
    .eq("id", incidentId)
    .single();
  if (!inc) return 0;
  const order = inc.order as unknown as TaskContext["order"];
  const recipients = [
    ...(await recipientsByRoles(db, ["admin", "direcao", "gestor", "supervisor"])),
    ...(await recipientsByIds(db, [order?.manager_id, inc.owner_id as string | null])),
  ].filter((r, i, all) => all.findIndex((x) => x.user_id === r.user_id) === i);
  const msg = taskMessage({
    event: "ocorrencia_critica",
    orderNumber: order?.number ?? "—",
    vessel: order?.vessel ? `${order.vessel.code} · ${order.vessel.name}` : "—",
    task: inc.description.slice(0, 120),
    responsible: (inc.reporter as unknown as { full_name: string } | null)?.full_name ?? "—",
    when: inc.occurred_at,
    priority: "urgente",
    note: "Urgência: Crítica",
  });
  return enqueue(
    db,
    recipients.map((r) => ({
      dedupe_key: `ocorrencia_critica:${inc.id}:${r.user_id}`,
      event: "ocorrencia_critica" as const,
      recipient: r,
      params: msg.params,
      preview: msg.preview,
      work_order_id: inc.work_order_id,
      task_id: inc.task_id,
    })),
  );
}

/** Pedido de aprovação (orçamento → Direcção; despesa → Financeiro/Direcção). */
export async function notifyApproval(kind: "orcamento" | "despesa", workOrderId: string, refId: string, description: string) {
  const db = admin();
  if (!db) return 0;
  const settings = await getSettings(db);
  if (!settings.whatsapp_enabled) return 0;
  const { data: order } = await db.from("ops_work_orders").select("number, vessel:ops_vessels(name, code)").eq("id", workOrderId).single();
  const roles: OpsRole[] = kind === "orcamento" ? ["admin", "direcao"] : ["direcao", "financeiro"];
  const recipients = await recipientsByRoles(db, roles);
  const vessel = order?.vessel as unknown as { name: string; code: string } | null;
  const msg = taskMessage({
    event: "pedido_aprovacao",
    orderNumber: order?.number ?? "—",
    vessel: vessel ? `${vessel.code} · ${vessel.name}` : "—",
    task: description,
    responsible: "—",
    when: new Date().toISOString(),
    priority: "alta",
    note: kind === "orcamento" ? "Orçamento a aguardar aprovação." : "Despesa a aguardar aprovação.",
  });
  return enqueue(
    db,
    recipients.map((r) => ({
      dedupe_key: `pedido_aprovacao:${kind}:${refId}:${r.user_id}`,
      event: "pedido_aprovacao" as const,
      recipient: r,
      params: msg.params,
      preview: msg.preview,
      work_order_id: workOrderId,
    })),
  );
}

/* ---------------------------------------------------------------- */
/* Processador da fila                                               */
/* ---------------------------------------------------------------- */

export type ProcessReport = { claimed: number; sent: number; failed: number; retried: number; cancelled: number; skipped?: string };

export async function processOutbox(limitOverride?: number): Promise<ProcessReport> {
  const report: ProcessReport = { claimed: 0, sent: 0, failed: 0, retried: 0, cancelled: 0 };
  const db = admin();
  if (!db) return { ...report, skipped: "SUPABASE_SECRET_KEY não configurada" };
  const settings = await getSettings(db);
  if (!settings.whatsapp_enabled) return { ...report, skipped: "WhatsApp desactivado nas definições" };
  if (!whatsappConfig().canSend) return { ...report, skipped: "Credenciais WhatsApp em falta" };

  const { data: claimed, error } = await db.rpc("ops_claim_notifications", { p_limit: limitOverride ?? settings.max_messages_per_run });
  if (error) throw new Error(`Falha ao reclamar a fila: ${error.message}`);
  const rows = (claimed ?? []) as {
    id: string;
    event: NotificationEvent;
    phone: string;
    template_name: string;
    language: string;
    params: string[];
    attempts: number;
    task_id: string | null;
    scheduled_for: string;
  }[];
  report.claimed = rows.length;

  const taskStatus = new Map<string, string>();
  const taskIds = [...new Set(rows.map((r) => r.task_id).filter(Boolean) as string[])];
  if (taskIds.length) {
    const { data } = await db.from("ops_tasks").select("id, status").in("id", taskIds);
    for (const t of data ?? []) taskStatus.set(t.id, t.status);
  }

  for (const row of rows) {
    // Avisos de tarefas que entretanto ficaram concluídas/canceladas deixam de fazer sentido.
    const status = row.task_id ? taskStatus.get(row.task_id) : undefined;
    const obsolete =
      ["tarefa_inicio", "prazo_proximo", "tarefa_atrasada", "lembrete"].includes(row.event) &&
      (status === undefined && row.task_id ? true : ["concluida", "validada", "cancelada"].includes(status ?? ""));
    const expired = Date.now() - new Date(row.scheduled_for).getTime() > 24 * 3600 * 1000 && row.event !== "pedido_aprovacao";
    if (obsolete || expired) {
      await db.from("ops_notifications").update({ status: "cancelada", last_error: obsolete ? "Tarefa já concluída ou cancelada" : "Expirada (mais de 24 h em fila)", locked_at: null }).eq("id", row.id);
      report.cancelled++;
      continue;
    }

    const result = await sendTemplate({ to: row.phone, template: row.template_name, language: row.language, params: row.params ?? [] });
    if (result.ok) {
      await db
        .from("ops_notifications")
        .update({ status: "enviada", wa_message_id: result.messageId, api_response: result.response, sent_at: new Date().toISOString(), last_error: null, locked_at: null })
        .eq("id", row.id);
      report.sent++;
    } else if (result.retryable && row.attempts < MAX_SEND_ATTEMPTS) {
      await db
        .from("ops_notifications")
        .update({
          status: "agendada",
          last_error: result.error,
          api_response: result.response,
          next_attempt_at: new Date(Date.now() + retryDelayMinutes(row.attempts) * 60_000).toISOString(),
          locked_at: null,
        })
        .eq("id", row.id);
      report.retried++;
    } else {
      await db.from("ops_notifications").update({ status: "falhada", last_error: result.error, api_response: result.response, locked_at: null }).eq("id", row.id);
      report.failed++;
    }
  }
  return report;
}

/* ---------------------------------------------------------------- */
/* Agendador (corre no servidor, sem depender de browsers abertos)   */
/* ---------------------------------------------------------------- */

export type SchedulerReport = { enqueued: number; reminders: number; details: Record<string, number>; skipped?: string };

function luandaParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Luanda", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dow, time: `${get("hour")}:${get("minute")}` };
}

function isoWeek(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function runScheduler(now = new Date()): Promise<SchedulerReport> {
  const report: SchedulerReport = { enqueued: 0, reminders: 0, details: {} };
  const db = admin();
  if (!db) return { ...report, skipped: "SUPABASE_SECRET_KEY não configurada" };
  const settings = await getSettings(db);
  if (!settings.whatsapp_enabled) return { ...report, skipped: "WhatsApp desactivado nas definições" };
  const add = (k: string, n: number) => {
    report.details[k] = (report.details[k] ?? 0) + n;
    report.enqueued += n;
  };
  const nowIso = now.toISOString();
  const today = todayLuanda(now);
  const open = "(por_iniciar,em_curso,suspensa)";

  // 1) Tarefas a começar dentro da antecedência configurada.
  const startLimit = new Date(now.getTime() + settings.task_start_lead_minutes * 60_000).toISOString();
  const { data: starting } = await db.from("ops_tasks").select("id").eq("status", "por_iniciar").gt("start_at", nowIso).lte("start_at", startLimit).limit(200);
  for (const t of await loadTasks(db, (starting ?? []).map((r) => r.id))) {
    const r = await recipientsByIds(db, [t.responsible_id, ...t.assignees.map((a) => a.user_id)]);
    add("tarefa_inicio", await enqueue(db, taskItems(t, "tarefa_inicio", r, t.start_at ?? "", undefined, t.start_at)));
  }

  // 2) Prazos a terminar nas próximas horas.
  const dueLimit = new Date(now.getTime() + settings.due_soon_hours * 3600_000).toISOString();
  const { data: dueSoon } = await db.from("ops_tasks").select("id").filter("status", "in", open).gt("due_at", nowIso).lte("due_at", dueLimit).limit(200);
  for (const t of await loadTasks(db, (dueSoon ?? []).map((r) => r.id))) {
    const r = await recipientsByIds(db, [t.responsible_id, ...t.assignees.map((a) => a.user_id)]);
    add("prazo_proximo", await enqueue(db, taskItems(t, "prazo_proximo", r, t.due_at ?? "", undefined, t.due_at)));
  }

  // 3) Tarefas atrasadas: um aviso por dia ao responsável e ao gestor da obra.
  const { data: late } = await db.from("ops_tasks").select("id").filter("status", "in", open).lt("due_at", nowIso).limit(200);
  for (const t of await loadTasks(db, (late ?? []).map((r) => r.id))) {
    const r = await recipientsByIds(db, [t.responsible_id, t.order?.manager_id, ...t.assignees.map((a) => a.user_id)]);
    add("tarefa_atrasada", await enqueue(db, taskItems(t, "tarefa_atrasada", r, today, "Prazo ultrapassado.", t.due_at)));
  }

  // 4) Lembretes configurados pelos utilizadores.
  const { data: reminders } = await db.from("ops_reminders").select("*").eq("status", "activo").lte("send_at", new Date(now.getTime() + 7 * 24 * 3600_000).toISOString()).limit(200);
  for (const rem of reminders ?? []) {
    const fireAt = new Date(new Date(rem.send_at).getTime() - rem.lead_minutes * 60_000);
    if (fireAt > now) continue;
    const [task] = rem.task_id ? await loadTasks(db, [rem.task_id]) : [];
    if (rem.cancel_when_done && task && ["concluida", "validada", "cancelada"].includes(task.status)) {
      await db.from("ops_reminders").update({ status: "cancelado" }).eq("id", rem.id);
      continue;
    }
    const recipients = await recipientsByIds(db, rem.recipients);
    let order = task?.order ?? null;
    if (!order && rem.work_order_id) {
      const { data } = await db.from("ops_work_orders").select("number, manager_id, vessel:ops_vessels(name, code)").eq("id", rem.work_order_id).single();
      order = data as unknown as TaskContext["order"];
    }
    const msg = taskMessage({
      event: "lembrete",
      orderNumber: order?.number ?? "—",
      vessel: order?.vessel ? `${order.vessel.code} · ${order.vessel.name}` : "—",
      task: task ? `${task.code} · ${task.title}` : rem.title,
      responsible: task?.responsible?.full_name ?? "—",
      when: rem.send_at,
      priority: task?.priority ?? null,
      note: rem.message ? `${rem.title}: ${rem.message}` : rem.title,
    });
    add(
      "lembrete",
      await enqueue(
        db,
        recipients.map((r) => ({
          dedupe_key: `lembrete:${rem.id}:${rem.send_at}:${r.user_id}`,
          event: "lembrete" as const,
          recipient: r,
          params: msg.params,
          preview: msg.preview,
          work_order_id: rem.work_order_id ?? task?.work_order_id ?? null,
          task_id: rem.task_id,
        })),
      ),
    );
    report.reminders++;
    // Repetição: próxima ocorrência ou fim.
    const step = rem.repeat === "diaria" ? 1 : rem.repeat === "semanal" ? 7 : 0;
    const next = step ? new Date(new Date(rem.send_at).getTime() + step * 24 * 3600_000) : null;
    if (next && (!rem.repeat_until || next <= new Date(rem.repeat_until))) {
      await db.from("ops_reminders").update({ send_at: next.toISOString(), last_fired_at: nowIso }).eq("id", rem.id);
    } else {
      await db.from("ops_reminders").update({ status: "concluido", last_fired_at: nowIso }).eq("id", rem.id);
    }
  }

  const { dow, time } = luandaParts(now);

  // 5) Lembrete diário a cada colaborador com tarefas abertas (uma vez por dia, depois da hora definida).
  if (settings.daily_reminder_enabled && time >= settings.daily_reminder_time.slice(0, 5)) {
    const endOfDay = luandaToIso(addDaysIso(today, 1));
    const { data: members } = await db.from("ops_members").select("user_id, full_name, whatsapp_phone").eq("active", true).eq("whatsapp_consent", true).not("whatsapp_phone", "is", null);
    for (const m of (members ?? []) as Recipient[]) {
      const { data: mine } = await db
        .from("ops_tasks")
        .select("id, due_at, start_at, ops_task_assignees!inner(user_id)")
        .filter("status", "in", open)
        .eq("ops_task_assignees.user_id", m.user_id);
      const tasks = mine ?? [];
      if (!tasks.length) continue;
      const lateCount = tasks.filter((t) => t.due_at && t.due_at < nowIso).length;
      const todayCount = tasks.filter((t) => (t.start_at && t.start_at < endOfDay) || (t.due_at && t.due_at < endOfDay)).length;
      const msg = summaryMessage({
        event: "lembrete_diario",
        name: m.full_name,
        summary: `Tem ${tasks.length} tarefa(s) em aberto: ${todayCount} para hoje e ${lateCount} atrasada(s).`,
        date: today,
      });
      add("lembrete_diario", await enqueue(db, [{ dedupe_key: `lembrete_diario:${m.user_id}:${today}`, event: "lembrete_diario", recipient: m, ...msg }]));
    }
  }

  // 6) Resumo semanal para Administração, Direcção e Gestores.
  if (settings.weekly_summary_enabled && dow === settings.weekly_summary_dow && time >= settings.weekly_summary_time.slice(0, 5)) {
    const week = isoWeek(today);
    const [{ count: active }, { count: lateTasks }, { count: critical }] = await Promise.all([
      db.from("ops_work_orders").select("id", { count: "exact", head: true }).in("status", ["aprovada", "planeada", "em_execucao", "suspensa"]),
      db.from("ops_tasks").select("id", { count: "exact", head: true }).filter("status", "in", open).lt("due_at", nowIso),
      db.from("ops_incidents").select("id", { count: "exact", head: true }).eq("urgency", "critico").in("status", ["aberta", "em_analise"]),
    ]);
    const summary = `Obras activas: ${active ?? 0}. Tarefas atrasadas: ${lateTasks ?? 0}. Ocorrências críticas abertas: ${critical ?? 0}.`;
    for (const m of await recipientsByRoles(db, ["admin", "direcao", "gestor"])) {
      const msg = summaryMessage({ event: "resumo_semanal", name: m.full_name, summary, date: today });
      add("resumo_semanal", await enqueue(db, [{ dedupe_key: `resumo_semanal:${m.user_id}:${week}`, event: "resumo_semanal", recipient: m, ...msg }]));
    }
  }

  return report;
}
