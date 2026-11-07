import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOpsPage } from "@/lib/ops/auth";
import { getOrders, getProgressMap } from "@/lib/ops/queries";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { INTERVENTION_LABELS, ORDER_STATUSES, ORDER_STATUS_LABELS, OPEN_ORDER_STATUSES, type InterventionType, type OrderStatus } from "@/lib/ops/labels";
import { can } from "@/lib/ops/roles";
import { fmtDate, todayLuanda } from "@/lib/ops/time";
import { OrderStatusBadge, PriorityBadge } from "@/components/ops/order-badges";
import { EmptyState } from "@/components/admin/ui";
import { cx } from "@/lib/cx";

export const metadata: Metadata = { title: "Obras" };
export const instant = false;

export default async function ObrasPage({ searchParams }: PageProps<"/gestao/obras">) {
  const user = await requireOpsPage();
  const sp = (await searchParams) as { estado?: string; q?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const filter = sp.estado === "todas" ? undefined : sp.estado && ORDER_STATUSES.includes(sp.estado as OrderStatus) ? [sp.estado] : sp.estado === "fechadas" ? ["concluida", "entregue", "cancelada"] : OPEN_ORDER_STATUSES;
  let orders = await getOrders({ status: filter });
  const q = (sp.q ?? "").trim().toLowerCase();
  if (q) orders = orders.filter((o) => [o.number, o.title, o.client?.name, o.vessel?.name, o.vessel?.code].some((x) => x?.toLowerCase().includes(q)));
  const progress = await getProgressMap(orders.map((o) => o.id));
  const today = todayLuanda();
  const tabs = [
    { key: undefined, label: "Em aberto" },
    { key: "em_execucao", label: "Em execução" },
    { key: "aguarda_aprovacao", label: "A aguardar aprovação" },
    { key: "fechadas", label: "Fechadas" },
    { key: "todas", label: "Todas" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Obras</h1>
          <p className="mt-1 text-sm text-slate-500">Ordens de serviço de reparação, manutenção e recuperação naval.</p>
        </div>
        {can.plan(user.role) && (
          <Link href={h("/obras/nova")} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            <Plus className="size-4" /> Nova obra
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar">
          {tabs.map((t) => (
            <Link
              key={t.label}
              href={h(`/obras${t.key ? `?estado=${t.key}` : ""}`)}
              className={cx("rounded-full px-3 py-1.5 text-sm", sp.estado === t.key ? "bg-black text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action={h("/obras")}>
          {sp.estado && <input type="hidden" name="estado" value={sp.estado} />}
          <input name="q" defaultValue={sp.q} placeholder="Procurar OS, cliente, embarcação…" className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState title="Sem obras">{can.plan(user.role) ? "Crie a primeira ordem de serviço." : "Não tem obras atribuídas."}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Obra</th>
                <th className="px-4 py-3">Cliente / embarcação</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Progresso</th>
                <th className="px-4 py-3">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => {
                const p = progress.get(o.id);
                const late = o.due_date && o.due_date < today && !["concluida", "entregue", "cancelada"].includes(o.status);
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={h(`/obras/${o.id}`)} className="font-medium hover:underline">
                        <span className="font-mono text-xs text-slate-500">{o.number}</span>
                        <span className="block">{o.title}</span>
                      </Link>
                      <span className="text-xs text-slate-500">{INTERVENTION_LABELS[o.intervention_type as InterventionType] ?? o.intervention_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p>{o.client?.name}</p>
                      <p className="text-xs text-slate-500">
                        {o.vessel?.code} · {o.vessel?.name}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={o.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div className={cx("h-full", p?.tasks_late ? "bg-red-600" : "bg-black")} style={{ width: `${p?.progress ?? 0}%` }} />
                        </div>
                        <span className="text-xs tabular-nums">{p?.progress ?? 0}%</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {p?.tasks_done ?? 0}/{p?.tasks_total ?? 0} tarefas{p?.tasks_late ? ` · ${p.tasks_late} atrasada(s)` : ""}
                      </p>
                    </td>
                    <td className={cx("px-4 py-3", late && "font-semibold text-red-600")}>
                      {fmtDate(o.due_date)}
                      {late && <span className="block text-xs">Atrasada</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">{ORDER_STATUSES.length} estados possíveis: {ORDER_STATUSES.map((s) => ORDER_STATUS_LABELS[s]).join(" · ")}.</p>
    </>
  );
}
