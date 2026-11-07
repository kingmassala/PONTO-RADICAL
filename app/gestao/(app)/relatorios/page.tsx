import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { requireOpsPage } from "@/lib/ops/auth";
import { getMembers, getOrders } from "@/lib/ops/queries";
import { loadReports } from "@/lib/ops/loaders";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { ACTIVE_ORDER_STATUSES, REPORT_STATUS_LABELS } from "@/lib/ops/labels";
import { can } from "@/lib/ops/roles";
import { addDaysIso, todayLuanda } from "@/lib/ops/time";
import { ReportFormButton, ReportList } from "@/components/ops/field";

export const metadata: Metadata = { title: "Relatórios diários" };
export const instant = false;

export default async function RelatoriosPage({ searchParams }: PageProps<"/gestao/relatorios">) {
  const user = await requireOpsPage();
  const sp = (await searchParams) as { de?: string; ate?: string; tecnico?: string; obra?: string; estado?: string; novo?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const today = todayLuanda();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.de ?? "") ? sp.de! : addDaysIso(today, -30);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.ate ?? "") ? sp.ate! : today;
  const [reports, orders, members, activeOrders] = await Promise.all([
    loadReports({ from, to, userId: sp.tecnico || undefined, orderId: sp.obra || undefined, status: sp.estado || undefined }),
    getOrders(),
    getMembers(),
    getOrders({ status: [...ACTIVE_ORDER_STATUSES, "em_avaliacao"] }),
  ]);
  const orderOptions = activeOrders.map((o) => ({ id: o.id, label: `${o.number} · ${o.title}` }));
  const query = new URLSearchParams(Object.entries({ de: from, ate: to, tecnico: sp.tecnico, obra: sp.obra, estado: sp.estado }).filter(([, v]) => v) as [string, string][]).toString();
  const totalHours = reports.reduce((s, r) => s + r.hours, 0);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatórios diários</h1>
          <p className="mt-1 text-sm text-slate-500">
            {reports.length} relatório(s) · {totalHours.toLocaleString("pt-PT")} h no período
            {user.role === "tecnico" ? " (apenas os seus)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReportFormButton orders={orderOptions} openInitially={sp.novo === "1"} />
          <a href={h(`/exportar/relatorios?${query}`)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">
            <Download className="size-4" /> Excel
          </a>
          <Link href={h(`/relatorios/imprimir?${query}`)} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">
            <Printer className="size-4" /> PDF
          </Link>
        </div>
      </div>
      <form action={h("/relatorios")} className="mb-5 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-6">
        <label className="text-xs text-slate-500">
          De
          <input type="date" name="de" defaultValue={from} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-slate-500">
          Até
          <input type="date" name="ate" defaultValue={to} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        {can.readReports(user.role) && (
          <label className="text-xs text-slate-500">
            Técnico
            <select name="tecnico" defaultValue={sp.tecnico ?? ""} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs text-slate-500">
          Obra
          <select name="obra" defaultValue={sp.obra ?? ""} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Todas</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.number}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Estado
          <select name="estado" defaultValue={sp.estado ?? ""} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            {Object.entries(REPORT_STATUS_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="self-end rounded-lg bg-black px-3 py-2 text-sm text-white">
          Aplicar
        </button>
      </form>
      <ReportList reports={reports} orders={orderOptions} />
    </>
  );
}
