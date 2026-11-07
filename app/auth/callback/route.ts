import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Destino dos links de email (recuperação de palavra-passe e convites). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/admin";
  // Só permite redireccionar dentro do painel ou da Gestão de Obras (no subdomínio, sem o prefixo /gestao).
  const host = (request.headers.get("host") ?? "").split(":")[0];
  const onGestao = host.startsWith("gestao.") || (process.env.NEXT_PUBLIC_GESTAO_HOST ?? "") === host;
  const internal = nextParam.startsWith("/") && !nextParam.startsWith("//");
  const next = internal && (nextParam.startsWith("/admin") || nextParam.startsWith("/gestao") || onGestao) ? nextParam : onGestao ? "/" : "/admin";
  const failure = onGestao ? "/entrar?erro=link-invalido" : nextParam.startsWith("/gestao") ? "/gestao/entrar?erro=link-invalido" : "/admin/login?erro=link-invalido";

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  return NextResponse.redirect(new URL(ok ? next : failure, origin));
}
