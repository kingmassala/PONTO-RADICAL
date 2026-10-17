"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  Languages,
  ExternalLink,
  FileText,
  History,
  Images,
  Inbox,
  LayoutDashboard,
  LayoutList,
  LogOut,
  Menu as MenuIcon,
  MousePointerClick,
  Palette,
  Sailboat,
  Phone,
  Search,
  Settings,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { signOut } from "@/lib/auth-actions";
import { cx } from "./ui";

const NAV = [
  { href: "/admin", label: "Visão Geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/conteudos", label: "Conteúdos", icon: FileText },
  { href: "/admin/seccoes", label: "Secções", icon: LayoutList },
  { href: "/admin/marcas", label: "Marcas", icon: BadgeCheck },
  { href: "/admin/servicos", label: "Serviços", icon: Sailboat },
  { href: "/admin/reservas", label: "Reservas", icon: CalendarCheck, badge: "bookings" as const },
  { href: "/admin/multimedia", label: "Biblioteca Multimédia", icon: Images },
  { href: "/admin/aparencia", label: "Aparência", icon: Palette },
  { href: "/admin/menu", label: "Menu e Botões", icon: MousePointerClick },
  { href: "/admin/contactos", label: "Contactos", icon: Phone },
  { href: "/admin/loja", label: "Loja Online", icon: ShoppingBag },
  { href: "/admin/traducoes", label: "Traduções", icon: Languages },
  { href: "/admin/seo", label: "SEO", icon: Search },
  { href: "/admin/publicacoes", label: "Publicações e Histórico", icon: History },
  { href: "/admin/mensagens", label: "Mensagens", icon: Inbox, badge: "messages" as const },
  { href: "/admin/utilizadores", label: "Utilizadores", icon: Users, adminOnly: true },
  { href: "/admin/definicoes", label: "Definições", icon: Settings },
];

export function Sidebar({
  user,
  unreadMessages,
  newBookings = 0,
}: {
  user: { email: string; fullName: string | null; role: "admin" | "editor" };
  unreadMessages: number;
  newBookings?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Painel" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {NAV.filter((item) => !item.adminOnly || user.role === "admin").map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.badge === "messages" && unreadMessages > 0 && (
              <span className="rounded-full bg-orange-500 px-1.5 text-xs font-semibold text-white">{unreadMessages}</span>
            )}
            {item.badge === "bookings" && newBookings > 0 && (
              <span className="rounded-full bg-orange-500 px-1.5 text-xs font-semibold text-white" aria-label={`${newBookings} pedidos novos`}>
                {newBookings}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-4">
      <a href="/" target="_blank" rel="noopener noreferrer" className="mb-3 flex items-center gap-2 text-xs text-slate-400 hover:text-white">
        <ExternalLink className="size-3.5" /> Abrir website público
      </a>
      <p className="truncate text-sm text-white">{user.fullName || user.email}</p>
      <p className="text-xs text-slate-400">{user.role === "admin" ? "Administrador" : "Editor"}</p>
      <form action={signOut} className="mt-3">
        <button type="submit" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <LogOut className="size-3.5" /> Terminar sessão
        </button>
      </form>
    </div>
  );

  const brand = (
    <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white">PR</span>
      <div>
        <p className="text-sm font-semibold text-white">Ponto Radical</p>
        <p className="text-xs text-slate-400">Painel de administração</p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#0B1B26] lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#0B1B26] px-4 lg:hidden">
        <span className="text-sm font-semibold text-white">Ponto Radical · Painel</span>
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-white" aria-label="Abrir menu do painel">
          <MenuIcon className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[#0B1B26]">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-4 p-1 text-slate-300" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
