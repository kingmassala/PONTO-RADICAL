"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { opsPath, requestOrigin } from "../server-base";

export type OpsAuthState = { error?: string; message?: string };

export async function signInOps(_prev: OpsAuthState, formData: FormData): Promise<OpsAuthState> {
  if (!isSupabaseConfigured()) return { error: "O servidor ainda não está configurado." };
  const parsed = z
    .object({ email: z.string().trim().email(), password: z.string().min(1) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Indique o email e a palavra-passe." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email ou palavra-passe incorrectos." };

  const { data: member } = await supabase.from("ops_members").select("active").eq("user_id", data.user.id).maybeSingle();
  if (!member) {
    const { data: client } = await supabase.rpc("ops_portal_me");
    if (client) redirect(await opsPath("/cliente"));
  }
  if (!member?.active) {
    await supabase.auth.signOut();
    return { error: member ? "Esta conta está desactivada. Contacte a administração." : "Esta conta não tem acesso à Gestão de Obras." };
  }
  redirect(await opsPath("/"));
}

export async function signOutOps() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(await opsPath("/entrar"));
}

export async function requestOpsReset(_prev: OpsAuthState, formData: FormData): Promise<OpsAuthState> {
  if (!isSupabaseConfigured()) return { error: "O servidor ainda não está configurado." };
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Indique um email válido." };
  const supabase = await createClient();
  const next = await opsPath("/nova-palavra-passe");
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
  });
  return { message: "Se o email estiver registado, receberá um link para definir uma nova palavra-passe." };
}

export async function setOpsPassword(_prev: OpsAuthState, formData: FormData): Promise<OpsAuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { error: "A palavra-passe deve ter pelo menos 10 caracteres." };
  if (password !== confirm) return { error: "As palavras-passe não coincidem." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "A sessão expirou. Peça um novo link de recuperação." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: `Não foi possível guardar: ${error.message}` };
  if (isServiceRoleConfigured()) {
    await createAdminClient().from("ops_members").update({ must_change_password: false }).eq("user_id", user.id);
  }
  await supabase.rpc("ops_portal_password_changed");
  redirect(await opsPath("/"));
}
