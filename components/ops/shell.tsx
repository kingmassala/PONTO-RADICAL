"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Anchor, BarChart3, Bell, Briefcase, Building2, CalendarDays, ClipboardList, FileText, HardHat, KanbanSquare, LogOut, Menu as MenuIcon, Settings, Ship, UserCircle2, Wallet, X } from "lucide-react";
import { signOutOps } from "@/lib/ops/actions/auth";
import { ROLE_LABELS, type OpsRole } from "@/lib/ops/roles";
import { cx } from "@/lib/cx";
import { useOps } from "./context";

type Item = { href: string; label: string; icon: typeof Ship; roles?: OpsRole[]; badge?: "incidents" | "approvals" };

const NAV: Item[] = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/obras", label: "Obras", icon: ClipboardList },
  { href: "/tarefas", label: "Tarefas", icon: KanbanSquare },
  { href: "/tarefas?tipo=empresa", label: "Tarefas da empresa", icon: Briefcase },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/relatorios", label: "Relatórios diários", icon: FileText },
  { href: "/ocorrencias", label: "Ocorrências", icon: AlertTriangle, badge: "incidents" },
  { href: "/clientes", label: "Clientes", icon: Building2, roles: ["admin", "direcao", "gestor", "supervisor", "financeiro"] },
  { href: "/embarcacoes", label: "Embarcações", icon: Ship, roles: ["admin", "direcao", "gestor", "supervisor", "financeiro"] },
  { href: "/equipa", label: "Técnicos e equipas", icon: HardHat, roles: ["admin", "direcao", "gestor", "supervisor", "financeiro"] },
  { href: "/custos", label: "Custos e orçamentos", icon: Wallet, roles: ["admin", "direcao", "gestor", "financeiro"], badge: "approvals" },
  { href: "/notificacoes", label: "WhatsApp e avisos", icon: Bell, roles: ["admin", "direcao", "gestor", "supervisor"] },
  { href: "/administracao", label: "Administração", icon: Settings, roles: ["admin"] },
];

/** Atalhos do telemóvel, pensados para os técnicos no terreno. */
const MOBILE: { href: string; label: string; icon: typeof Ship }[] = [
  { href: "/tarefas?minhas=1", label: "Tarefas", icon: KanbanSquare },
  { href: "/relatorios?novo=1", label: "Relatório", icon: FileText },
  { href: "/ocorrencias?nova=1", label: "Problema", icon: AlertTriangle },
  { href: "/calendario", label: "Agenda", icon: CalendarDays },
];

export function OpsShell({
  children,
  counts,
}: {
  children: React.ReactNode;
  counts: { incidents: number; approvals: number };
}) {
  const { role, fullName, href } = useOps();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((i) => !i.roles || i.roles.includes(role));
  const current = (h: string) => {
    const full = href(h);
    const base = href("/");
    return h === "/" ? pathname === base || pathname === `${base}/` : pathname === full || pathname.startsWith(`${full}/`);
  };

  const nav = (
    <nav aria-label="Gestão de Obras" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const Icon = item.icon;
        const n = item.badge ? counts[item.badge] : 0;
        return (
          <Link
            key={item.href}
            href={href(item.href)}
            onClick={() => setOpen(false)}
            aria-current={current(item.href) ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              current(item.href) ? "bg-white text-black" : "text-neutral-300 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {n > 0 && <span className="rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link
      href={href("/")}
      onClick={() => setOpen(false)}
      aria-label="Ponto Radical · Gestão de Obras — ir para o Dashboard"
      title="Ir para o Dashboard"
      className="flex h-16 items-center gap-3 border-b border-white/10 px-5 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/ponto-radical-mark-white.svg" alt="" className="size-9" />
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-wide text-white">PONTO RADICAL</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">Gestão de Obras</p>
      </div>
    </Link>
  );

  const footer = (
    <div className="border-t border-white/10 p-4">
      <Link href={href("/conta")} onClick={() => setOpen(false)} className="flex items-center gap-2 text-sm text-white hover:underline">
        <UserCircle2 className="size-4" /> {fullName}
      </Link>
      <p className="mt-0.5 text-xs text-neutral-400">{ROLE_LABELS[role]}</p>
      <form action={signOutOps} className="mt-3">
        <button type="submit" className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white">
          <LogOut className="size-3.5" /> Terminar sessão
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-black lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-black px-4 text-white lg:hidden">
        <Link href={href("/")} className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ponto-radical-mark-white.svg" alt="" className="size-7" />
          <span className="text-sm font-semibold tracking-wide">Gestão de Obras</span>
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2" aria-label="Abrir menu">
          <MenuIcon className="size-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-black">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 p-1 text-neutral-300" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="pb-20 lg:pb-0 lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.href} href={href(m.href)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-slate-600 active:bg-slate-100">
              <Icon className="size-5" aria-hidden />
              {m.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions, back }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  const { href } = useOps();
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={href(back.href)} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-black">
            <Anchor className="size-3" /> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
