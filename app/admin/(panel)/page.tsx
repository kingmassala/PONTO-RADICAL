import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarCheck, CheckCircle2, Clock, Images, Inbox, LayoutList, Sailboat, ShoppingBag, Users } from "lucide-react";
import { getStaffUser } from "@/lib/auth";
import { getDraft, getPublishedState } from "@/lib/cms/draft";
import { checkDocument, hasStoreFallback, isStoreActive } from "@/lib/cms/validate";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { formatLongDate, todayIso } from "@/lib/booking/rules";
import { BRAND_TAGLINE } from "@/lib/brand";
import { BrandMark } from "@/components/admin/brand";

export const metadata: Metadata = { title: "Visão Geral" };

export default async function OverviewPage({ searchParams }: PageProps<"/admin">) {
  const [{ erro }, user, draft, published] = await Promise.all([
    searchParams as Promise<{ erro?: string }>,
    getStaffUser(),
    getDraft(),
    getPublishedState(),
  ]);
  const supabase = await createClient();
  const today = todayIso();
  const [media, unread, versions, newBookings, upcoming] = await Promise.all([
    supabase.from("media").select("id", { count: "exact", head: true }),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "novo"),
    supabase.from("site_versions").select("id, note, published_at, published_by_email").order("id", { ascending: false }).limit(5),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "novo"),
    supabase
      .from("booking_requests")
      .select("id, reference, service_name, requested_date, time_slot, people, name, phone")
      .eq("status", "confirmado")
      .gte("requested_date", today)
      .order("requested_date")
      .order("time_slot")
      .limit(6),
  ]);
  const doc = draft.doc;
  const issues = checkDocument(doc);

  const stats = [
    { label: "Secções visíveis", value: `${doc.sections.filter((s) => s.visible).length}/${doc.sections.length}`, href: "/admin/seccoes", icon: LayoutList },
    { label: "Marcas visíveis", value: `${doc.brands.filter((b) => b.visible).length}/${doc.brands.length}`, href: "/admin/marcas", icon: BadgeCheck },
    { label: "Serviços visíveis", value: `${doc.services.filter((s) => s.visible).length}/${doc.services.length}`, href: "/admin/servicos", icon: Sailboat },
    { label: "Pedidos de reserva novos", value: String(newBookings.count ?? 0), href: "/admin/reservas?estado=novo", icon: CalendarCheck },
    { label: "Mensagens novas", value: String(unread.count ?? 0), href: "/admin/mensagens", icon: Inbox },
    { label: "Ficheiros multimédia", value: String(media.count ?? 0), href: "/admin/multimedia", icon: Images },
  ];

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-black px-6 py-7 text-white sm:px-8">
        <BrandMark className="pointer-events-none absolute -right-10 -top-12 size-56 text-white/[0.07]" />
        <div className="relative flex items-center gap-5">
          <BrandMark className="hidden size-14 shrink-0 sm:block" />
          <div>
            <p className="pr-logo-type text-[0.65rem] text-white/55">{BRAND_TAGLINE}</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Olá{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}.</h1>
            <p className="mt-1 text-sm text-white/70">Faça alterações, guarde no rascunho, pré-visualize e publique quando estiver pronto.</p>
          </div>
        </div>
      </div>

      {erro === "sem-permissao" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Essa área está reservada a administradores.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-sky-300">
            <s.icon className="size-5 text-slate-400 group-hover:text-sky-600" />
            <p className="mt-4 text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold">Próximas reservas confirmadas</h2>
          <Link href="/admin/reservas?vista=agenda" className="text-xs text-sky-700 hover:underline">
            Ver agenda
          </Link>
        </header>
        {(upcoming.data ?? []).length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">
            Sem reservas confirmadas nos próximos dias.
            {(newBookings.count ?? 0) > 0 && (
              <>
                {" "}
                <Link href="/admin/reservas?estado=novo" className="text-sky-700 hover:underline">
                  Há {newBookings.count} pedido(s) por tratar.
                </Link>
              </>
            )}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(upcoming.data ?? []).map((b) => (
              <li key={b.id}>
                <Link href={`/admin/reservas?vista=agenda&mes=${b.requested_date.slice(0, 7)}#reserva-${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-sm hover:bg-slate-50">
                  <span className={`w-48 font-medium first-letter:uppercase ${b.requested_date === today ? "text-orange-600" : "text-slate-800"}`}>
                    {b.requested_date === today ? "Hoje" : formatLongDate(b.requested_date).replace(/ de \d{4}$/, "")}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Clock className="size-3.5" /> {b.time_slot}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-800">{b.service_name}</span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Users className="size-3.5" /> {b.people}
                  </span>
                  <span className="text-slate-500">{b.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <header className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold">Verificação do rascunho</h2>
          </header>
          <div className="p-6">
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" /> Tudo em ordem. Os links e as secções estão válidos.
              </p>
            ) : (
              <ul className="space-y-3">
                {issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${issue.level === "error" ? "text-red-600" : "text-amber-500"}`} />
                    <span className="flex-1 text-slate-700">{issue.message}</span>
                    <Link href={issue.href} className="shrink-0 text-sky-700 hover:underline">
                      Corrigir
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold">Últimas publicações</h2>
            <Link href="/admin/publicacoes" className="text-xs text-sky-700 hover:underline">
              Ver histórico
            </Link>
          </header>
          <ul className="divide-y divide-slate-100">
            {(versions.data ?? []).map((v) => (
              <li key={v.id} className="px-6 py-3 text-sm">
                <p className="font-medium text-slate-800">
                  Versão n.º {v.id}
                  {published?.versionId === v.id && <span className="ml-2 text-xs font-normal text-emerald-700">· online</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(v.published_at)}
                  {v.published_by_email ? ` · ${v.published_by_email}` : ""}
                </p>
                {v.note && <p className="mt-1 text-xs text-slate-600">{v.note}</p>}
              </li>
            ))}
            {(versions.data ?? []).length === 0 && <li className="px-6 py-6 text-sm text-slate-500">Ainda não existem publicações.</li>}
          </ul>
        </section>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ShoppingBag className="size-6 text-slate-400" />
          <div>
            <p className="text-sm font-semibold">Loja Online (Quicksell)</p>
            <p className="text-sm text-slate-500">
              {isStoreActive(doc)
                ? `Activa no rascunho · ${doc.store.url}`
                : hasStoreFallback(doc)
                  ? "Sem link da Quicksell · os botões da loja encaminham para os contactos."
                  : "Desactivada · os botões da loja estão ocultos no website."}
            </p>
          </div>
        </div>
        <Link href="/admin/loja" className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline">
          Configurar <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
