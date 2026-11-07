import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { OpsRole } from "./roles";
import { getPortalUser } from "./portal";
import { opsPath } from "./server-base";

export type OpsUser = {
  id: string;
  email: string;
  fullName: string;
  role: OpsRole;
  jobTitle: string | null;
  mustChangePassword: boolean;
};

/** Colaborador autenticado e activo na Gestão de Obras, ou null. Verificado no servidor. */
export const getOpsUser = cache(async (): Promise<OpsUser | null> => {
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("ops_members")
    .select("full_name, email, role, job_title, active, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.active) return null;
  return {
    id: user.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as OpsRole,
    jobTitle: data.job_title,
    mustChangePassword: data.must_change_password,
  };
});

/** Para páginas: exige sessão (e, opcionalmente, um dos perfis indicados). */
export async function requireOpsPage(roles?: OpsRole[]): Promise<OpsUser> {
  const user = await getOpsUser();
  if (!user) {
    // Contas de cliente vão para o portal do cliente.
    if (await getPortalUser()) redirect(await opsPath("/cliente"));
    redirect(await opsPath("/entrar"));
  }
  if (roles && !roles.includes(user.role)) redirect(await opsPath("/?erro=sem-permissao"));
  return user;
}

export class OpsAuthError extends Error {}

/** Para Server Actions: lança erro em vez de redireccionar. */
export async function requireOps(roles?: OpsRole[]): Promise<OpsUser> {
  const user = await getOpsUser();
  if (!user) throw new OpsAuthError("Sessão expirada. Inicie sessão novamente.");
  if (roles && !roles.includes(user.role)) throw new OpsAuthError("O seu perfil não tem permissão para esta operação.");
  return user;
}
