import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type Role = "admin" | "editor";

export type StaffUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
};

/** Utilizador autenticado com acesso ao painel, ou null. Verificado no servidor. */
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  // Garante que a verificação acontece sempre no pedido (nunca durante o build).
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  // getUser() valida o token junto do Supabase Auth (não confia só no cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.role) return null;

  return { id: user.id, email: profile.email, fullName: profile.full_name, role: profile.role as Role };
});

/** Para páginas: redirecciona para o login se não houver sessão válida. */
export async function requireStaffPage(): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireAdminPage(): Promise<StaffUser> {
  const user = await requireStaffPage();
  if (user.role !== "admin") redirect("/admin?erro=sem-permissao");
  return user;
}

export class AuthError extends Error {}

/** Para Server Actions: lança erro em vez de redireccionar. */
export async function requireStaff(): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) throw new AuthError("Sessão expirada ou sem permissões. Inicie sessão novamente.");
  return user;
}

export async function requireAdmin(): Promise<StaffUser> {
  const user = await requireStaff();
  if (user.role !== "admin") throw new AuthError("Esta operação está reservada a administradores.");
  return user;
}
