import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isServiceRoleConfigured(): boolean {
  return Boolean(SUPABASE_URL && SECRET_KEY);
}

/**
 * Cliente com a chave secreta (ignora RLS). Usar APENAS no servidor e apenas
 * para operações que não podem ser feitas com a sessão do utilizador:
 * gravar pedidos de contacto e convidar utilizadores.
 */
export function createAdminClient() {
  if (!isServiceRoleConfigured()) {
    throw new Error("SUPABASE_SECRET_KEY não está configurada.");
  }
  return createSupabaseClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
