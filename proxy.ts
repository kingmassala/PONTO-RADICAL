import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/recuperar"];
// Gestão de Obras: páginas sem sessão (o resto exige sessão; o perfil é verificado no servidor e na RLS).
const PUBLIC_OPS_PAGES = ["/entrar", "/recuperar", "/manifest.webmanifest", "/sw.js"];

function isGestaoHost(host: string | null) {
  const name = (host ?? "").split(":")[0].toLowerCase();
  const configured = (process.env.NEXT_PUBLIC_GESTAO_HOST ?? "").toLowerCase();
  return name.startsWith("gestao.") || (configured !== "" && name === configured);
}

/**
 * Renova a sessão do Supabase e faz a verificação optimista de acesso ao /admin.
 * A autorização efectiva é feita no servidor (páginas, Server Actions e RLS).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some((p) => path.startsWith(p));
  const onGestaoHost = isGestaoHost(request.headers.get("host"));
  // Caminho dentro da área de gestão (no subdomínio não tem o prefixo /gestao).
  const opsPath = onGestaoHost ? (path.startsWith("/gestao") ? path.slice(7) || "/" : path) : path.startsWith("/gestao") ? path.slice(7) || "/" : null;
  const opsBase = onGestaoHost ? "" : "/gestao";
  const isOps = opsPath !== null && !path.startsWith("/api") && !path.startsWith("/auth") && !path.startsWith("/_next");
  const isPublicOps = isOps && PUBLIC_OPS_PAGES.some((p) => opsPath === p || opsPath.startsWith(`${p}/`));

  if (!url || !key) {
    if (path.startsWith("/admin") && !isPublicAdminPath) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (isOps && !isPublicOps) return NextResponse.redirect(new URL(`${opsBase}/entrar`, request.url));
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (path.startsWith("/admin") && !isPublicAdminPath && !signedIn) {
    const login = new URL("/admin/login", request.url);
    return NextResponse.redirect(login);
  }
  if (isOps && !isPublicOps && !signedIn) {
    return NextResponse.redirect(new URL(`${opsBase}/entrar`, request.url));
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/auth/:path*",
    "/gestao/:path*",
    "/gestao",
    // Subdomínio da gestão: todas as páginas (excepto recursos estáticos), para renovar a sessão.
    { source: "/((?!_next/static|_next/image|api/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)", has: [{ type: "host", value: "gestao\\..*" }] },
  ],
};
