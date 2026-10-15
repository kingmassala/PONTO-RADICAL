"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/supabase/env";
import { errorResult, friendlyDbError, type ActionResult } from "@/lib/cms/errors";

async function audit(action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  const supabase = await createClient();
  await supabase.rpc("write_audit", { p_action: action, p_entity: entity, p_entity_id: entityId, p_details: details });
}

/* ---------------------------- Mensagens ---------------------------- */

const STATUSES = ["novo", "em_curso", "respondido", "arquivado"] as const;

export async function updateMessage(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireStaff();
    const values = z.object({ status: z.enum(STATUSES), notes: z.string().max(2000).optional() }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("contact_messages")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    await audit("message.update", "contact_messages", id, { status: values.status });
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("contact_messages").delete().eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    await audit("message.delete", "contact_messages", id);
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

/* --------------------------- Utilizadores --------------------------- */

const roleSchema = z.enum(["admin", "editor"]).nullable();

export async function inviteUser(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
    const values = z
      .object({ email: z.string().trim().toLowerCase().email("Email inválido."), role: z.enum(["admin", "editor"]) })
      .parse(input);
    if (!isServiceRoleConfigured()) {
      return { ok: false, error: "Defina SUPABASE_SECRET_KEY no servidor para poder convidar utilizadores." };
    }
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(values.email, {
      redirectTo: `${SITE_URL}/auth/callback?next=/admin/nova-palavra-passe`,
    });
    if (error) return { ok: false, error: `Não foi possível enviar o convite: ${error.message}` };

    // O perfil é criado pelo trigger; atribuímos o papel com a sessão do administrador.
    const supabase = await createClient();
    const { error: roleError } = await supabase.rpc("set_user_role", { p_user_id: data.user.id, p_role: values.role });
    if (roleError) return { ok: false, error: friendlyDbError(roleError.message) };
    await audit("user.invite", "profiles", data.user.id, { email: values.email, role: values.role });
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function setUserRole(userId: string, role: "admin" | "editor" | null): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_user_role", {
      p_user_id: z.string().uuid().parse(userId),
      p_role: roleSchema.parse(role),
    });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

/* ---------------------------- Conta própria ---------------------------- */

export async function updateOwnName(name: string): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: z.string().trim().max(120).parse(name) || null })
      .eq("id", user.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function changeOwnPassword(password: string): Promise<ActionResult> {
  try {
    await requireStaff();
    const value = z.string().min(10, "A palavra-passe deve ter pelo menos 10 caracteres.").max(128).parse(password);
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: value });
    if (error) return { ok: false, error: `Não foi possível alterar a palavra-passe: ${error.message}` };
    await audit("user.password", "profiles", "self");
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}
