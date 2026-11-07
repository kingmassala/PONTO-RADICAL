"use server";

import { randomInt } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { requireOps } from "../auth";
import { opsDbError, opsError, type OpsResult } from "../errors";
import { OPS_ROLES } from "../roles";
import { processOutbox, runScheduler, type ProcessReport, type SchedulerReport } from "../notify";
import { taskMessage } from "../messages";
import { sendTemplate } from "../whatsapp";
import { opsPath, requestOrigin } from "../server-base";

const phone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[\s().-]/g, "") : null))
  .refine((v) => !v || /^\+[1-9][0-9]{7,14}$/.test(v), "Use o formato internacional, por ex. +244923000000");

/** Palavra-passe temporária legível (sem caracteres ambíguos). */
function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const pick = () => alphabet[randomInt(alphabet.length)];
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, pick).join("")).join("-");
}

const memberSchema = z.object({
  full_name: z.string().trim().min(2, "Indique o nome").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  role: z.enum(OPS_ROLES),
  job_title: z.string().trim().max(80).optional().transform((v) => v || null),
  whatsapp_phone: phone,
  whatsapp_consent: z.boolean().default(false),
  mode: z.enum(["password", "invite"]).default("password"),
});

/**
 * Cria a conta de um colaborador.
 *  - «password»: gera uma palavra-passe temporária, mostrada uma única vez ao administrador;
 *    o colaborador tem de a mudar no primeiro acesso.
 *  - «invite»: envia um email de convite (requer SMTP configurado no Supabase).
 * Se o email já existir no Supabase Auth (ex.: administrador do website), reutiliza a conta.
 */
export async function createMember(input: unknown): Promise<OpsResult<{ temporaryPassword: string | null }>> {
  try {
    await requireOps(["admin"]);
    if (!isServiceRoleConfigured()) return { ok: false, error: "Defina SUPABASE_SECRET_KEY no servidor para criar contas." };
    const v = memberSchema.parse(input);
    if (v.whatsapp_consent && !v.whatsapp_phone) return { ok: false, error: "Para registar o consentimento, indique o número WhatsApp." };
    const admin = createAdminClient();

    let userId: string | null = null;
    let temp: string | null = null;
    // Procura uma conta existente com o mesmo email.
    for (let page = 1; page < 50 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data.users.length) break;
      userId = data.users.find((u) => u.email?.toLowerCase() === v.email)?.id ?? null;
      if (data.users.length < 200) break;
    }
    if (!userId) {
      if (v.mode === "invite") {
        const next = await opsPath("/nova-palavra-passe");
        const { data, error } = await admin.auth.admin.inviteUserByEmail(v.email, {
          redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
          data: { full_name: v.full_name },
        });
        if (error) return { ok: false, error: `Não foi possível enviar o convite: ${error.message}` };
        userId = data.user.id;
      } else {
        temp = temporaryPassword();
        const { data, error } = await admin.auth.admin.createUser({ email: v.email, password: temp, email_confirm: true, user_metadata: { full_name: v.full_name } });
        if (error) return { ok: false, error: `Não foi possível criar a conta: ${error.message}` };
        userId = data.user.id;
      }
    }

    const supabase = await createClient();
    const { error } = await supabase.from("ops_members").insert({
      user_id: userId,
      full_name: v.full_name,
      email: v.email,
      role: v.role,
      job_title: v.job_title,
      whatsapp_phone: v.whatsapp_phone,
      whatsapp_consent: v.whatsapp_consent,
      whatsapp_consent_at: v.whatsapp_consent ? new Date().toISOString() : null,
      whatsapp_consent_source: v.whatsapp_consent ? "Registado pela administração" : null,
      must_change_password: Boolean(temp),
    });
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: { temporaryPassword: temp } };
  } catch (error) {
    return opsError(error);
  }
}

export async function updateMember(input: unknown): Promise<OpsResult> {
  try {
    const me = await requireOps(["admin"]);
    const v = z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().trim().min(2).max(120),
        role: z.enum(OPS_ROLES),
        job_title: z.string().trim().max(80).optional().transform((x) => x || null),
        active: z.boolean(),
        whatsapp_phone: phone,
        whatsapp_consent: z.boolean(),
      })
      .parse(input);
    if (v.user_id === me.id && (v.role !== "admin" || !v.active)) return { ok: false, error: "Não pode retirar a si próprio o acesso de administrador." };
    if (v.whatsapp_consent && !v.whatsapp_phone) return { ok: false, error: "Para registar o consentimento, indique o número WhatsApp." };
    const supabase = await createClient();
    const { data: current } = await supabase.from("ops_members").select("whatsapp_consent").eq("user_id", v.user_id).single();
    const consentChanged = current && current.whatsapp_consent !== v.whatsapp_consent;
    const { error } = await supabase
      .from("ops_members")
      .update({
        ...v,
        updated_at: new Date().toISOString(),
        ...(consentChanged ? { whatsapp_consent_at: new Date().toISOString(), whatsapp_consent_source: `Alterado pela administração (${me.fullName})` } : {}),
      })
      .eq("user_id", v.user_id);
    if (error) return { ok: false, error: opsDbError(error.message) };
    // Conta desactivada: bloqueia também o início de sessão.
    if (isServiceRoleConfigured()) {
      await createAdminClient().auth.admin.updateUserById(v.user_id, { ban_duration: v.active ? "none" : "876000h" });
    }
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function resetMemberPassword(userId: string): Promise<OpsResult<{ temporaryPassword: string }>> {
  try {
    await requireOps(["admin"]);
    if (!isServiceRoleConfigured()) return { ok: false, error: "Defina SUPABASE_SECRET_KEY no servidor." };
    const id = z.string().uuid().parse(userId);
    const temp = temporaryPassword();
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, { password: temp });
    if (error) return { ok: false, error: `Não foi possível redefinir: ${error.message}` };
    await admin.from("ops_members").update({ must_change_password: true }).eq("user_id", id);
    return { ok: true, data: { temporaryPassword: temp } };
  } catch (error) {
    return opsError(error);
  }
}

/** O próprio colaborador gere o seu número e consentimento WhatsApp. */
export async function updateMyWhatsapp(input: unknown): Promise<OpsResult> {
  try {
    const me = await requireOps();
    const v = z.object({ whatsapp_phone: phone, whatsapp_consent: z.boolean() }).parse(input);
    if (v.whatsapp_consent && !v.whatsapp_phone) return { ok: false, error: "Indique o número para aceitar receber notificações." };
    if (!isServiceRoleConfigured()) return { ok: false, error: "Servidor sem SUPABASE_SECRET_KEY." };
    const { error } = await createAdminClient()
      .from("ops_members")
      .update({
        whatsapp_phone: v.whatsapp_phone,
        whatsapp_consent: v.whatsapp_consent,
        whatsapp_consent_at: new Date().toISOString(),
        whatsapp_consent_source: v.whatsapp_consent ? "Aceite pelo próprio na plataforma" : "Recusado pelo próprio na plataforma",
      })
      .eq("user_id", me.id);
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

/* ------------------------------ Equipas ------------------------------ */

export async function saveTeam(input: unknown): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor"]);
    const v = z
      .object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(80), leader_id: z.string().uuid().nullable().optional(), members: z.array(z.string().uuid()).max(100) })
      .parse(input);
    const supabase = await createClient();
    const { data, error } = v.id
      ? await supabase.from("ops_teams").update({ name: v.name, leader_id: v.leader_id ?? null }).eq("id", v.id).select("id").single()
      : await supabase.from("ops_teams").insert({ name: v.name, leader_id: v.leader_id ?? null }).select("id").single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    await supabase.from("ops_team_members").delete().eq("team_id", data.id);
    if (v.members.length) await supabase.from("ops_team_members").insert(v.members.map((u) => ({ team_id: data.id, user_id: u })));
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

/* ------------------------------ Definições e WhatsApp ------------------------------ */

export async function saveSettings(input: unknown): Promise<OpsResult> {
  try {
    await requireOps(["admin"]);
    const time = z.string().regex(/^\d{2}:\d{2}$/);
    const v = z
      .object({
        company_name: z.string().trim().min(2).max(120),
        default_vat_rate: z.coerce.number().min(0).max(100),
        daily_reminder_enabled: z.boolean(),
        daily_reminder_time: time,
        weekly_summary_enabled: z.boolean(),
        weekly_summary_dow: z.coerce.number().int().min(0).max(6),
        weekly_summary_time: time,
        task_start_lead_minutes: z.coerce.number().int().min(0).max(10080),
        due_soon_hours: z.coerce.number().int().min(1).max(720),
        whatsapp_enabled: z.boolean(),
        max_messages_per_run: z.coerce.number().int().min(1).max(500),
      })
      .parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_settings").update({ ...v, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function saveTemplate(input: unknown): Promise<OpsResult> {
  try {
    await requireOps(["admin"]);
    const v = z
      .object({
        event: z.string().min(2).max(40),
        template_name: z.string().trim().regex(/^[a-z0-9_]{1,512}$/, "Nome do modelo: só minúsculas, números e _"),
        language: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/, "Código de língua, ex.: pt_PT"),
        enabled: z.boolean(),
      })
      .parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_whatsapp_templates").update({ ...v, updated_at: new Date().toISOString() }).eq("event", v.event);
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

/**
 * Envio de teste real pela Cloud API. Não usa a fila: devolve a resposta da Meta
 * (identificador da mensagem) e regista-a para seguir o estado pelo webhook.
 */
export async function sendTestMessage(input: unknown): Promise<OpsResult<{ messageId: string; httpStatus: number }>> {
  try {
    const me = await requireOps(["admin"]);
    if (!isServiceRoleConfigured()) return { ok: false, error: "Defina SUPABASE_SECRET_KEY no servidor." };
    const v = z
      .object({
        user_id: z.string().uuid(),
        mode: z.enum(["hello_world", "template"]),
      })
      .parse(input);
    const db = createAdminClient();
    const { data: member } = await db.from("ops_members").select("user_id, full_name, whatsapp_phone, whatsapp_consent, active").eq("user_id", v.user_id).single();
    if (!member?.active || !member.whatsapp_phone) return { ok: false, error: "O colaborador não tem número WhatsApp registado ou está inactivo." };
    if (!member.whatsapp_consent) return { ok: false, error: "O colaborador não deu consentimento para receber mensagens WhatsApp." };

    let template = "hello_world";
    let language = "en_US";
    let params: string[] = [];
    let preview = "Hello World (modelo de teste da Meta)";
    if (v.mode === "template") {
      const { data: t } = await db.from("ops_whatsapp_templates").select("template_name, language").eq("event", "tarefa_atribuida").single();
      template = t?.template_name ?? "pr_notificacao_obra";
      language = t?.language ?? "pt_PT";
      const msg = taskMessage({
        event: "tarefa_atribuida",
        orderNumber: "TESTE",
        vessel: "—",
        task: "Mensagem de teste da plataforma",
        responsible: me.fullName,
        when: new Date().toISOString(),
        priority: "media",
        note: "Mensagem de teste. Pode ignorar.",
      });
      params = msg.params;
      preview = msg.preview;
    }
    const result = await sendTemplate({ to: member.whatsapp_phone, template, language, params });
    await db.from("ops_notifications").insert({
      dedupe_key: `teste:${member.user_id}:${Date.now()}`,
      event: "lembrete",
      recipient_id: member.user_id,
      phone: member.whatsapp_phone,
      template_name: template,
      language,
      params,
      preview: `[TESTE] ${preview}`,
      status: result.ok ? "enviada" : "falhada",
      attempts: 1,
      wa_message_id: result.ok ? result.messageId : null,
      last_error: result.ok ? null : result.error,
      api_response: result.response,
      sent_at: result.ok ? new Date().toISOString() : null,
    });
    refresh();
    if (!result.ok) return { ok: false, error: `A Meta recusou o envio (HTTP ${result.httpStatus}): ${result.error}` };
    return { ok: true, data: { messageId: result.messageId, httpStatus: result.httpStatus } };
  } catch (error) {
    return opsError(error);
  }
}

/** Executa já o agendador e a fila (o mesmo que o cron faz de 5 em 5 minutos). */
export async function runAutomationNow(): Promise<OpsResult<{ scheduler: SchedulerReport; outbox: ProcessReport }>> {
  try {
    await requireOps(["admin"]);
    const scheduler = await runScheduler();
    const outbox = await processOutbox();
    refresh();
    return { ok: true, data: { scheduler, outbox } };
  } catch (error) {
    return opsError(error);
  }
}
