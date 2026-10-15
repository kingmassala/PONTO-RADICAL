"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/env";

export type AuthFormState = { error?: string; message?: string };

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: "O Supabase ainda não está configurado (ver docs/INSTALACAO.md)." };
  const parsed = z
    .object({ email: z.string().trim().email(), password: z.string().min(1) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Indique o email e a palavra-passe." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email ou palavra-passe incorrectos." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile?.role) {
    await supabase.auth.signOut();
    return { error: "Esta conta não tem acesso ao painel. Peça acesso a um administrador." };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return { error: "O Supabase ainda não está configurado." };
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Indique um email válido." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${SITE_URL}/auth/callback?next=/admin/nova-palavra-passe`,
  });
  // Mesma resposta exista ou não a conta (não revela emails registados).
  return { message: "Se o email estiver registado, receberá em breve um link para definir uma nova palavra-passe." };
}

export async function setNewPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { error: "A palavra-passe deve ter pelo menos 10 caracteres." };
  if (password !== confirm) return { error: "As palavras-passe não coincidem." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "O link expirou. Peça um novo link de recuperação." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: `Não foi possível guardar: ${error.message}` };
  redirect("/admin");
}
