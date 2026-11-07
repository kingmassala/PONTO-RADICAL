"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { requireOps } from "../auth";
import { opsDbError, opsError, type OpsResult } from "../errors";
import { temporaryPassword } from "../passwords";
import { opsPath, requestOrigin } from "../server-base";

const MANAGERS = ["admin", "direcao", "gestor"] as const;

/**
 * Dá a um cliente acesso ao portal (área do cliente).
 *  - «password»: palavra-passe temporária mostrada uma vez; tem de ser trocada no primeiro acesso.
 *  - «invite»: convite por email (requer SMTP configurado no Supabase).
 */
export async function createClientAccess(input: unknown): Promise<OpsResult<{ temporaryPassword: string | null }>> {
  try {
    await requireOps([...MANAGERS]);
    if (!isServiceRoleConfigured()) return { ok: false, error: "Defina SUPABASE_SECRET_KEY no servidor para criar contas." };
    const v = z
      .object({
        client_id: z.string().uuid(),
        full_name: z.string().trim().min(2, "Indique o nome").max(120),
        email: z.string().trim().toLowerCase().email("Email inválido"),
        mode: z.enum(["password", "invite"]).default("password"),
      })
      .parse(input);
    const admin = createAdminClient();
    const { data: member } = await admin.from("ops_members").select("user_id").eq("email", v.email).maybeSingle();
    if (member) return { ok: false, error: "Este email pertence a um colaborador da equipa. Use outro email para o acesso do cliente." };

    let userId: string | null = null;
    let temp: string | null = null;
    for (let page = 1; page < 50 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data.users.length) break;
      userId = data.users.find((u) => u.email?.toLowerCase() === v.email)?.id ?? null;
      if (data.users.length < 200) break;
    }
    if (userId) {
      // Conta já existente: não mexe na palavra-passe, só dá acesso ao portal.
    } else if (v.mode === "invite") {
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

    const supabase = await createClient();
    const { error } = await supabase.from("ops_client_users").insert({
      user_id: userId,
      client_id: v.client_id,
      full_name: v.full_name,
      email: v.email,
      must_change_password: Boolean(temp),
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "Esta pessoa já tem acesso ao portal (de este ou de outro cliente)." };
      return { ok: false, error: opsDbError(error.message) };
    }
    refresh();
    return { ok: true, data: { temporaryPassword: temp } };
  } catch (error) {
    return opsError(error);
  }
}

export async function setClientAccessActive(userId: string, active: boolean): Promise<OpsResult> {
  try {
    await requireOps([...MANAGERS]);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ops_client_users")
      .update({ active: z.boolean().parse(active) })
      .eq("user_id", z.string().uuid().parse(userId))
      .select("user_id");
    if (error) return { ok: false, error: opsDbError(error.message) };
    if (!data?.length) return { ok: false, error: "Acesso não encontrado." };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function resetClientAccessPassword(userId: string): Promise<OpsResult<{ temporaryPassword: string }>> {
  try {
    await requireOps([...MANAGERS]);
    if (!isServiceRoleConfigured()) return { ok: false, error: "Defina SUPABASE_SECRET_KEY no servidor." };
    const id = z.string().uuid().parse(userId);
    const supabase = await createClient();
    const { data: access } = await supabase.from("ops_client_users").select("user_id").eq("user_id", id).maybeSingle();
    if (!access) return { ok: false, error: "Acesso não encontrado." };
    const admin = createAdminClient();
    // Nunca repõe palavras-passe de contas da equipa por este caminho.
    const { data: member } = await admin.from("ops_members").select("user_id").eq("user_id", id).maybeSingle();
    if (member) return { ok: false, error: "Esta conta pertence à equipa." };
    const temp = temporaryPassword();
    const { error } = await admin.auth.admin.updateUserById(id, { password: temp });
    if (error) return { ok: false, error: `Não foi possível redefinir: ${error.message}` };
    await admin.from("ops_client_users").update({ must_change_password: true }).eq("user_id", id);
    return { ok: true, data: { temporaryPassword: temp } };
  } catch (error) {
    return opsError(error);
  }
}
