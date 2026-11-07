import type { Metadata } from "next";
import Link from "next/link";
import { requireOpsPage } from "@/lib/ops/auth";
import { getOrders, getTasks, isLate } from "@/lib/ops/queries";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { luandaToIso, todayLuanda } from "@/lib/ops/time";
import { MonthCalendar } from "@/components/ops/tasks";
import { taskHref } from "@/lib/ops/task-href";

export const metadata: Metadata = { title: "Calendário" };
export const instant = false;

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default async function CalendarioPage({ searchParams }: PageProps<"/gestao/calendario">) {
  const user = await requireOpsPage();
  const sp = (await searchParams) as { mes?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : todayLuanda().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
  const from = luandaToIso(`${month}-01`);
  const to = luandaToIso(`${next}-01`);
  const [tasks, orders] = await Promise.all([getTasks({ from, userId: user.role === "tecnico" ? user.id : undefined }), getOrders()]);
  const day = (iso: string) => new Date(new Date(iso).getTime() + 3600_000).toISOString().slice(0, 10);
  const events = [
    ...tasks
      .filter((t) => (t.due_at && t.due_at >= from && t.due_at < to) || (t.start_at && t.start_at >= from && t.start_at < to))
      .map((t) => ({
        date: day((t.due_at && t.due_at < to ? t.due_at : t.start_at)!),
        label: `${t.order?.number?.slice(-4) ?? ""} ${t.code} ${t.title}`.trim(),
        href: taskHref(t),
        tone: (isLate(t) ? "late" : ["concluida", "validada"].includes(t.status) ? "done" : "task") as "late" | "task" | "done",
      })),
    ...orders
      .filter((o) => o.due_date && o.due_date >= `${month}-01` && o.due_date < `${next}-01`)
      .map((o) => ({ date: o.due_date!, label: `Prazo ${o.number}`, href: `/obras/${o.id}`, tone: "order" as const })),
  ];
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendário</h1>
          <p className="mt-1 text-sm text-slate-500">Prazos e inícios de tarefas e prazos das obras (hora de Angola).</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={h(`/calendario?mes=${prev}`)} className="rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200">
            ←
          </Link>
          <p className="w-40 text-center font-medium">
            {MONTHS[m - 1]} {y}
          </p>
          <Link href={h(`/calendario?mes=${next}`)} className="rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200">
            →
          </Link>
        </div>
      </div>
      <MonthCalendar month={month} events={events} />
      <p className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="rounded bg-sky-100 px-1.5">Tarefa</span>
        <span className="rounded bg-red-100 px-1.5">Atrasada</span>
        <span className="rounded bg-emerald-100 px-1.5">Concluída</span>
        <span className="rounded bg-black px-1.5 text-white">Prazo da obra</span>
      </p>
    </>
  );
}
