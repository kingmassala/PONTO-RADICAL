import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { addDays, BOOKING_STATUS_LABELS, BOOKING_STATUSES, formatLongDate, todayIso, weekdayOf, type BookingStatus } from "@/lib/booking/rules";
import { BookingRow, type Booking } from "@/components/admin/bookings";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState, Notice } from "@/components/admin/ui";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Reservas" };

const FILTERS = ["todas", ...BOOKING_STATUSES] as const;
type Filter = (typeof FILTERS)[number];
const COLUMNS =
  "id, reference, service_id, service_name, service_snapshot, requested_date, time_slot, people, name, email, phone, notes, status, proposed_date, proposed_slot, internal_notes, quoted_amount, payment_status, created_at";
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const CHIP: Record<BookingStatus, string> = {
  novo: "bg-sky-100 text-sky-800",
  confirmado: "bg-emerald-100 text-emerald-800",
  proposta: "bg-amber-100 text-amber-900",
  recusado: "bg-red-50 text-red-700 line-through",
  concluido: "bg-slate-100 text-slate-600",
  cancelado: "bg-slate-100 text-slate-500 line-through",
};

const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

export default async function BookingsPage({ searchParams }: PageProps<"/admin/reservas">) {
  const user = await requireStaffPage();
  const params = (await searchParams) as { estado?: string; vista?: string; mes?: string };
  const filter: Filter = FILTERS.includes(params.estado as Filter) ? (params.estado as Filter) : "todas";
  const view = params.vista === "agenda" ? "agenda" : "lista";
  const today = todayIso();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes ?? "") ? params.mes! : today.slice(0, 7);

  const href = (patch: Partial<{ estado: Filter; vista: string; mes: string }>) => {
    const q = new URLSearchParams();
    const estado = patch.estado ?? filter;
    const vista = patch.vista ?? view;
    if (estado !== "todas") q.set("estado", estado);
    if (vista === "agenda") {
      q.set("vista", "agenda");
      q.set("mes", patch.mes ?? month);
    }
    const s = q.toString();
    return `/admin/reservas${s ? `?${s}` : ""}`;
  };

  const supabase = await createClient();
  const counts = await Promise.all(
    BOOKING_STATUSES.map((s) => supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", s)),
  );
  const countOf = Object.fromEntries(BOOKING_STATUSES.map((s, i) => [s, counts[i].count ?? 0])) as Record<BookingStatus, number>;
  const total = Object.values(countOf).reduce((a, b) => a + b, 0);

  let query = supabase.from("booking_requests").select(COLUMNS);
  if (filter !== "todas") query = query.eq("status", filter);
  const monthStart = `${month}-01`;
  const monthEnd = addDays(`${shiftMonth(month, 1)}-01`, -1);
  if (view === "agenda") {
    query = query.gte("requested_date", monthStart).lte("requested_date", monthEnd).order("requested_date").order("time_slot");
  } else {
    query = query.order("created_at", { ascending: false }).limit(200);
  }
  const { data, error } = await query;
  const bookings = (data ?? []) as Booking[];

  return (
    <>
      <PageHeader
        title="Reservas"
        description="Pedidos de reserva enviados pelo website. Confirme, proponha outra data ou recuse; o pagamento é tratado depois da confirmação."
        actions={
          <div className="inline-flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
            <Link
              href={href({ vista: "lista" })}
              aria-current={view === "lista" ? "page" : undefined}
              className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", view === "lista" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}
            >
              <List className="size-4" /> Caixa de entrada
            </Link>
            <Link
              href={href({ vista: "agenda" })}
              aria-current={view === "agenda" ? "page" : undefined}
              className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", view === "agenda" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}
            >
              <CalendarDays className="size-4" /> Agenda
            </Link>
          </div>
        }
      />
      {!isServiceRoleConfigured() && (
        <div className="mb-6">
          <Notice tone="warning" title="Os pedidos de reserva ainda não estão activos.">
            Defina a variável SUPABASE_SECRET_KEY no servidor (ver docs/INSTALACAO.md) para que os pedidos do website sejam gravados.
          </Notice>
        </div>
      )}

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar por estado">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={href({ estado: f })}
            aria-current={filter === f ? "page" : undefined}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm",
              filter === f ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {f === "todas" ? "Todas" : BOOKING_STATUS_LABELS[f]}
            <span className={cx("rounded-full px-1.5 text-xs", filter === f ? "bg-white/20" : f === "novo" && countOf.novo > 0 ? "bg-orange-500 text-white" : "bg-slate-100")}>
              {f === "todas" ? total : countOf[f]}
            </span>
          </Link>
        ))}
      </nav>

      {error && <Notice tone="error">{error.message}</Notice>}

      {view === "agenda" && (
        <section className="mb-8 rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <Link href={href({ mes: shiftMonth(month, -1) })} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Mês anterior">
              <ChevronLeft className="size-4" />
            </Link>
            <h2 className="text-sm font-semibold">
              {MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
              {month !== today.slice(0, 7) && (
                <Link href={href({ mes: today.slice(0, 7) })} className="ml-3 text-xs font-normal text-sky-700 hover:underline">
                  Hoje
                </Link>
              )}
            </h2>
            <Link href={href({ mes: shiftMonth(month, 1) })} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Mês seguinte">
              <ChevronRight className="size-4" />
            </Link>
          </header>
          <MonthGrid month={month} today={today} bookings={bookings} />
        </section>
      )}

      {bookings.length === 0 ? (
        <EmptyState title={view === "agenda" ? "Sem pedidos neste mês" : "Sem pedidos de reserva"}>
          Os pedidos enviados pelo website a partir da secção «Experiências» aparecem aqui.
        </EmptyState>
      ) : view === "agenda" ? (
        <div className="space-y-8">
          {groupByDate(bookings).map(([date, list]) => (
            <section key={date}>
              <h3 className={cx("mb-3 text-sm font-semibold first-letter:uppercase", date === today ? "text-orange-600" : "text-slate-700")}>
                {formatLongDate(date)}
                {date === today && " · hoje"}
              </h3>
              <ul className="space-y-3">
                {list.map((b) => (
                  <BookingRow key={b.id} booking={b} canDelete={user.role === "admin"} defaultOpen={false} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <BookingRow key={b.id} booking={b} canDelete={user.role === "admin"} />
          ))}
        </ul>
      )}
    </>
  );
}

function groupByDate(bookings: Booking[]): [string, Booking[]][] {
  const map = new Map<string, Booking[]>();
  for (const b of bookings) map.set(b.requested_date, [...(map.get(b.requested_date) ?? []), b]);
  return [...map.entries()];
}

function MonthGrid({ month, today, bookings }: { month: string; today: string; bookings: Booking[] }) {
  const first = `${month}-01`;
  const offset = (weekdayOf(first) + 6) % 7;
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array.from({ length: offset }, () => null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const byDate = new Map(groupByDate(bookings));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[42rem] grid-cols-7">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="border-b border-slate-100 px-2 py-1.5 text-xs font-medium text-slate-500">
            {d}
          </div>
        ))}
        {cells.map((iso, i) => {
          const list = iso ? (byDate.get(iso) ?? []) : [];
          return (
            <div key={iso ?? `e${i}`} className={cx("min-h-24 border-b border-r border-slate-100 p-1.5", !iso && "bg-slate-50/60", iso && iso < today && "bg-slate-50/40")}>
              {iso && (
                <>
                  <p className={cx("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs", iso === today ? "bg-orange-500 font-semibold text-white" : "text-slate-500")}>
                    {Number(iso.slice(8))}
                  </p>
                  <ul className="space-y-1">
                    {list.slice(0, 4).map((b) => (
                      <li key={b.id}>
                        <a
                          href={`#reserva-${b.id}`}
                          title={`${b.time_slot} · ${b.service_name} · ${b.people} pax · ${b.name} (${BOOKING_STATUS_LABELS[b.status]})`}
                          className={cx("block truncate rounded px-1.5 py-0.5 text-[0.7rem] font-medium hover:ring-1 hover:ring-slate-300", CHIP[b.status])}
                        >
                          {b.time_slot} {b.service_name}
                        </a>
                      </li>
                    ))}
                    {list.length > 4 && <li className="px-1.5 text-[0.7rem] text-slate-500">+{list.length - 4}</li>}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
