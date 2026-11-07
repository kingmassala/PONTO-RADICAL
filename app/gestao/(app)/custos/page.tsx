import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getFinance, getOrders, getSettings, getTasks } from "@/lib/ops/queries";
import { loadExpenses } from "@/lib/ops/loaders";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { EXPENSE_CATEGORY_LABELS, OPEN_ORDER_STATUSES, type ExpenseCategory } from "@/lib/ops/labels";
import { fmtAoa, fmtPct } from "@/lib/ops/money";
import { can } from "@/lib/ops/roles";
import { cx } from "@/lib/cx";
import { ExpenseFormButton, ExpenseTable, Kpi } from "@/components/ops/finance";
import { MaterialFormButton, SupplierFormButton } from "@/components/ops/team";
import { BarChart } from "@/components/ops/charts";
import { Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Custos e orçamentos" };
export const instant = false;

export default async function CustosPage({ searchParams }: PageProps<"/gestao/custos">) {
  const user = await requireOpsPage(["admin", "direcao", "gestor", "financeiro"]);
  const sp = (await searchParams) as { ver?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const supabase = await createClient();
  const [orders, pending, settings, suppliers, materials, quotes, tasks] = await Promise.all([
    getOrders(),
    loadExpenses({ approval: "pendente" }),
    getSettings(),
    supabase.from("ops_suppliers").select("id, name, nif, phone, email").order("name"),
    supabase.from("ops_materials").select("id, code, name, unit, unit_cost, active").order("name"),
    supabase.from("ops_quotes").select("id, version, work_order_id, submitted_at, order:ops_work_orders(number, title), items:ops_quote_items(total_price)").eq("status", "submetido"),
    getTasks(),
  ]);
  const finance = await getFinance(orders.map((o) => o.id));
  const vatDefault = Number(settings?.default_vat_rate ?? 14);
  const openOrders = orders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status));
  const taskOptions = tasks.map((t) => ({ id: t.id, label: `${t.code} · ${t.title}`, work_order_id: t.work_order_id }));
  const totals = [...finance.values()].reduce(
    (acc, f) => ({ actual: acc.actual + f.actualCost, committed: acc.committed + f.committedCost, price: acc.price + (f.contractPrice ?? 0), profit: acc.profit + (f.grossProfit ?? 0) }),
    { actual: 0, committed: 0, price: 0, profit: 0 },
  );
  const byCategory: Record<string, number> = {};
  for (const f of finance.values()) for (const [k, v] of Object.entries(f.byCategory)) byCategory[k] = (byCategory[k] ?? 0) + v;
  const view = sp.ver ?? "resumo";
  const all = view === "despesas" ? await loadExpenses() : [];

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Custos e orçamentos</h1>
          <p className="mt-1 text-sm text-slate-500">Valores em AOA. Margem = lucro ÷ preço; markup = lucro ÷ custo.</p>
        </div>
        <div className="flex gap-2">
          <ExpenseFormButton orders={openOrders.map((o) => ({ id: o.id, label: `${o.number} · ${o.title}` }))} tasks={taskOptions} suppliers={suppliers.data ?? []} vatDefault={vatDefault} />
          <a href={h("/exportar/despesas")} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">
            <Download className="size-4" /> Excel
          </a>
        </div>
      </div>
      <nav className="mb-5 flex gap-1.5">
        {[
          ["resumo", "Resumo e aprovações"],
          ["despesas", "Todas as despesas"],
          ["catalogo", "Materiais e fornecedores"],
        ].map(([k, l]) => (
          <Link key={k} href={h(`/custos?ver=${k}`)} className={cx("rounded-full px-3 py-1.5 text-sm", view === k ? "bg-black text-white" : "bg-white ring-1 ring-slate-200")}>
            {l}
          </Link>
        ))}
      </nav>

      {view === "resumo" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi label="Custos realizados (todas as obras)" value={fmtAoa(totals.actual)} />
            <Kpi label="Custos comprometidos" value={fmtAoa(totals.committed)} />
            <Kpi label="Preços contratuais" value={fmtAoa(totals.price)} />
            <Kpi label="Lucro bruto estimado" value={fmtAoa(totals.profit)} tone={totals.profit < 0 ? "red" : "default"} />
          </div>
          {(quotes.data ?? []).length > 0 && (
            <Card title="Orçamentos a aguardar aprovação">
              <ul className="divide-y divide-slate-100 text-sm">
                {(quotes.data ?? []).map((q) => {
                  const order = q.order as unknown as { number: string; title: string } | null;
                  return (
                    <li key={q.id} className="flex justify-between py-2">
                      <Link href={h(`/obras/${q.work_order_id}?tab=custos`)} className="hover:underline">
                        {order?.number} · {order?.title} (versão {q.version})
                      </Link>
                      <span className="tabular-nums">{fmtAoa((q.items as { total_price: number }[]).reduce((s, i) => s + Number(i.total_price), 0))}</span>
                    </li>
                  );
                })}
              </ul>
              {!can.approveQuotes(user.role) && <p className="text-xs text-slate-500">A aprovação é feita pela Direcção ou pela Administração.</p>}
            </Card>
          )}
          <Card title={`Despesas pendentes de aprovação (${pending.length})`}>
            <ExpenseTable expenses={pending} tasks={taskOptions} suppliers={suppliers.data ?? []} vatDefault={vatDefault} showOrder />
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Custos por categoria">
              <BarChart data={Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: EXPENSE_CATEGORY_LABELS[k as ExpenseCategory] ?? k, value: v }))} format="aoa" />
            </Card>
            <Card title="Rentabilidade por obra">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2">Obra</th>
                      <th className="py-2 text-right">Custo até hoje</th>
                      <th className="py-2 text-right">Preço</th>
                      <th className="py-2 text-right">Margem</th>
                      <th className="py-2 text-right">Desvio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders
                      .filter((o) => (finance.get(o.id)?.costToDate ?? 0) > 0 || finance.get(o.id)?.contractPrice)
                      .map((o) => {
                        const f = finance.get(o.id)!;
                        return (
                          <tr key={o.id}>
                            <td className="py-2">
                              <Link href={h(`/obras/${o.id}?tab=custos`)} className="hover:underline">
                                {o.number}
                              </Link>
                            </td>
                            <td className="py-2 text-right tabular-nums">{fmtAoa(f.costToDate)}</td>
                            <td className="py-2 text-right tabular-nums">{fmtAoa(f.contractPrice)}</td>
                            <td className={cx("py-2 text-right tabular-nums", (f.grossMargin ?? 0) < 0 && "text-red-600")}>{fmtPct(f.grossMargin)}</td>
                            <td className={cx("py-2 text-right tabular-nums", (f.budgetVariance ?? 0) > 0 && "text-red-600")}>{f.budgetVariance === null ? "—" : fmtAoa(f.budgetVariance)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {view === "despesas" && <ExpenseTable expenses={all} tasks={taskOptions} suppliers={suppliers.data ?? []} vatDefault={vatDefault} showOrder />}

      {view === "catalogo" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Catálogo de materiais" actions={<MaterialFormButton />}>
            <ul className="divide-y divide-slate-100 text-sm">
              {(materials.data ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <span className={cx(!m.active && "text-slate-400")}>
                    {m.name} <span className="text-xs text-slate-500">({m.unit}{m.code ? ` · ${m.code}` : ""})</span>
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {fmtAoa(Number(m.unit_cost))}
                    <MaterialFormButton material={{ ...m, unit_cost: Number(m.unit_cost) }} />
                  </span>
                </li>
              ))}
              {(materials.data ?? []).length === 0 && <li className="py-2 text-slate-500">Sem materiais.</li>}
            </ul>
          </Card>
          <Card title="Fornecedores" actions={<SupplierFormButton />}>
            <ul className="divide-y divide-slate-100 text-sm">
              {(suppliers.data ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {s.name}
                    <span className="block text-xs text-slate-500">{[s.nif, s.phone, s.email].filter(Boolean).join(" · ")}</span>
                  </span>
                  <SupplierFormButton supplier={s} />
                </li>
              ))}
              {(suppliers.data ?? []).length === 0 && <li className="py-2 text-slate-500">Sem fornecedores.</li>}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
