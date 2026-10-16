import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

/** Cliente com a sessão do utilizador (cookies). Sujeito a RLS. */
export async function createClient() {
  // O cliente valida a expiração do token com Date.now(): tem de correr sempre no pedido,
  // nunca durante a pré-renderização (Cache Components).
  await connection();
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de um Server Component: o proxy trata da renovação da sessão.
        }
      },
    },
  });
}
