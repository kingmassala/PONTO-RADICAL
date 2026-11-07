import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Loader2, LogOut } from "lucide-react";
import { requirePortalPage } from "@/lib/ops/portal";
import { getOpsBase, opsPath } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { createClient } from "@/lib/supabase/server";
import { signOutOps } from "@/lib/ops/actions/auth";

export const metadata = { title: { default: "Área do cliente", template: "%s · Área do cliente · Ponto Radical" } };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-400">
          <Loader2 className="size-6 animate-spin" aria-label="A carregar" />
        </div>
      }
    >
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const user = await requirePortalPage();
  if (user.mustChangePassword) redirect(await opsPath("/nova-palavra-passe?obrigatoria=1"));
  const base = await getOpsBase();
  const supabase = await createClient();
  await supabase.rpc("ops_portal_touch");
  return (
    <>
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href={joinBase(base, "/cliente")} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ponto-radical-mark-white.svg" alt="" className="size-8" />
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-wide">PONTO RADICAL</span>
              <span className="block text-[11px] uppercase tracking-[0.18em] text-neutral-400">Área do cliente</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-right">
            <span className="hidden text-xs leading-tight sm:block">
              <span className="block text-white">{user.fullName}</span>
              <span className="block text-neutral-400">{user.client.name}</span>
            </span>
            <form action={signOutOps}>
              <button type="submit" className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white">
                <LogOut className="size-3.5" aria-hidden /> Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-500">
        Informação actualizada pela equipa da Ponto Radical. Para dúvidas sobre a sua obra, contacte o gestor responsável.
      </footer>
    </>
  );
}
