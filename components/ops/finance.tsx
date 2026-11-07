"use client";

import { useState } from "react";
import { Check, Plus, Send, Trash2, X } from "lucide-react";
import {
  addConsumption,
  createQuoteVersion,
  decideExpense,
  decideQuote,
  deleteExpense,
  deleteQuoteItem,
  markExpenseRealised,
  saveExpense,
  saveQuoteItem,
  submitQuote,
  updateQuote,
} from "@/lib/ops/actions/finance";
import { saveOrderFinance } from "@/lib/ops/actions/orders";
import type { FinanceSummary } from "@/lib/ops/finance";
import { quoteTotals, withVat } from "@/lib/ops/finance";
import {
  APPROVAL_LABELS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STAGES,
  EXPENSE_STAGE_LABELS,
  QUOTE_STATUS_LABELS,
  type Approval,
  type ExpenseCategory,
  type ExpenseStage,
  type QuoteStatus,
} from "@/lib/ops/labels";
import { fmtAoa, fmtNum, fmtPct } from "@/lib/ops/money";
import { can } from "@/lib/ops/roles";
import { fmtDate, todayLuanda } from "@/lib/ops/time";
import { cx } from "@/lib/cx";
import { useOps } from "./context";
import { Area, Badge, Button, Card, Choice, EmptyState, FormError, Input, Modal } from "./ui";
import { useOpsAction } from "./use-action";

/* ------------------------------ Resumo financeiro ------------------------------ */

export function FinanceSummaryCard({ f, orderId, vatDefault }: { f: FinanceSummary; orderId: string; vatDefault: number }) {
  const { role } = useOps();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    budget_initial: f.budgetInitial?.toString() ?? "",
    budget_revised: f.budgetRevised?.toString() ?? "",
    contract_price: f.contractPrice?.toString() ?? "",
    vat_rate: String(f.contractPrice === null && f.budgetInitial === null ? vatDefault : f.vatRate),
  });
  const { pending, error, run } = useOpsAction();
  const over = (f.budgetVariance ?? 0) > 0;
  const rows: [string, string, string?][] = [
    ["Preço contratual (sem IVA)", fmtAoa(f.contractPrice)],
    ["IVA", fmtAoa(f.vatAmount)],
    ["Preço com IVA", fmtAoa(f.priceWithVat)],
    ["Orçamento inicial (custo)", fmtAoa(f.budgetInitial)],
    ["Orçamento revisto (custo)", fmtAoa(f.budgetRevised)],
    ["Custos previstos", fmtAoa(f.plannedCost)],
    ["Custos realizados", fmtAoa(f.actualCost), `inclui mão-de-obra ${fmtAoa(f.labourCost)} e materiais ${fmtAoa(f.materialsCost)}`],
    ["Custos comprometidos", fmtAoa(f.committedCost)],
    ["Custo estimado final", fmtAoa(f.forecastCost)],
  ];
  return (
    <Card
      title="Finanças da obra"
      description="Valores em kwanzas (AOA), sem IVA salvo indicação."
      actions={
        ["admin", "direcao", "financeiro"].includes(role) ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            Definir valores
          </Button>
        ) : null
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Desvio orçamental" value={f.budgetVariance === null ? "—" : fmtAoa(f.budgetVariance)} sub={f.budgetVariancePct === null ? "Sem orçamento" : fmtPct(f.budgetVariancePct)} tone={over ? "red" : "green"} />
        <Kpi label="Lucro bruto estimado" value={fmtAoa(f.grossProfit)} sub="preço − custo estimado final" tone={(f.grossProfit ?? 0) < 0 ? "red" : "default"} />
        <Kpi label="Margem bruta" value={fmtPct(f.grossMargin)} sub={`markup ${fmtPct(f.markup)} (sobre o custo)`} tone={(f.grossMargin ?? 0) < 0 ? "red" : "default"} />
      </div>
      <dl className="divide-y divide-slate-100 text-sm">
        {rows.map(([k, val, hint]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-slate-600">
              {k}
              {hint && <span className="block text-xs text-slate-400">{hint}</span>}
            </dt>
            <dd className="font-medium tabular-nums">{val}</dd>
          </div>
        ))}
      </dl>
      {f.pendingApproval > 0 && <p className="text-xs text-amber-700">{fmtAoa(f.pendingApproval)} em despesas ainda por aprovar (já incluídas nos custos).</p>}
      {f.labourHoursWithoutRate > 0 && <p className="text-xs text-amber-700">{fmtNum(f.labourHoursWithoutRate)} h registadas por colaboradores sem custo/hora definido (não contabilizadas).</p>}
      <Modal open={open} onClose={() => setOpen(false)} title="Valores contratuais">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const num = (x: string) => (x === "" ? null : Number(x));
            run(() => saveOrderFinance({ work_order_id: orderId, budget_initial: num(v.budget_initial), budget_revised: num(v.budget_revised), contract_price: num(v.contract_price), vat_rate: Number(v.vat_rate) }), () => setOpen(false));
          }}
        >
          <p className="text-sm text-slate-500">Normalmente estes valores vêm do orçamento aprovado. Use isto para obras sem orçamento formal ou para rever o orçamento.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Orçamento inicial (custo)" type="number" min="0" step="0.01" value={v.budget_initial} onChange={(x) => setV({ ...v, budget_initial: x })} />
            <Input label="Orçamento revisto (custo)" type="number" min="0" step="0.01" value={v.budget_revised} onChange={(x) => setV({ ...v, budget_revised: x })} />
            <Input label="Preço contratual (sem IVA)" type="number" min="0" step="0.01" value={v.contract_price} onChange={(x) => setV({ ...v, contract_price: x })} />
            <Input label="IVA (%)" type="number" min="0" max="100" step="0.01" value={v.vat_rate} onChange={(x) => setV({ ...v, vat_rate: x })} />
          </div>
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

export function Kpi({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "red" | "green" | "amber" }) {
  return (
    <div className={cx("rounded-lg border p-3", tone === "red" ? "border-red-200 bg-red-50" : tone === "green" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50")}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/* ------------------------------ Despesas ------------------------------ */

export type ExpenseView = {
  id: string;
  work_order_id: string;
  orderNumber?: string;
  task_id: string | null;
  taskLabel: string | null;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  vat_rate: number;
  stage: ExpenseStage;
  approval: Approval;
  supplier: string | null;
  supplier_id: string | null;
  responsible: string | null;
  rejection_note: string | null;
};

export function ExpenseFormButton({
  orders,
  orderId,
  tasks,
  suppliers,
  vatDefault,
  expense,
}: {
  orders?: { id: string; label: string }[];
  orderId?: string;
  tasks: { id: string; label: string; work_order_id: string | null }[];
  suppliers: { id: string; name: string }[];
  vatDefault: number;
  expense?: ExpenseView;
}) {
  const empty = {
    work_order_id: orderId ?? "",
    task_id: "",
    expense_date: todayLuanda(),
    category: "materiais" as ExpenseCategory,
    description: "",
    quantity: "1",
    unit_price: "",
    vat_rate: String(vatDefault),
    stage: "realizada" as ExpenseStage,
    supplier_id: "",
  };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(
    expense
      ? {
          work_order_id: expense.work_order_id,
          task_id: expense.task_id ?? "",
          expense_date: expense.expense_date,
          category: expense.category,
          description: expense.description,
          quantity: String(expense.quantity),
          unit_price: String(expense.unit_price),
          vat_rate: String(expense.vat_rate),
          stage: expense.stage,
          supplier_id: expense.supplier_id ?? "",
        }
      : empty,
  );
  const { pending, error, run } = useOpsAction();
  const set = (patch: Partial<typeof v>) => setV((c) => ({ ...c, ...patch }));
  const total = (Number(v.quantity) || 0) * (Number(v.unit_price) || 0);
  return (
    <>
      <Button variant={expense ? "ghost" : "primary"} size={expense ? "sm" : "md"} onClick={() => setOpen(true)}>
        {expense ? "Editar" : (
          <>
            <Plus className="size-4" /> Nova despesa
          </>
        )}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={expense ? "Editar despesa" : "Nova despesa"} wide>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => saveExpense({ ...v, id: expense?.id, task_id: v.task_id || null, supplier_id: v.supplier_id || null }),
              () => {
                setOpen(false);
                if (!expense) setV(empty);
              },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {orders && !orderId && (
              <Choice label="Obra" required value={v.work_order_id} placeholder="— Escolher —" onChange={(x) => set({ work_order_id: x, task_id: "" })} options={orders.map((o) => ({ value: o.id, label: o.label }))} />
            )}
            <Choice label="Tarefa (opcional)" value={v.task_id} placeholder="— Obra em geral —" onChange={(x) => set({ task_id: x })} options={tasks.filter((t) => t.work_order_id === v.work_order_id).map((t) => ({ value: t.id, label: t.label }))} />
            <Input label="Data" type="date" required value={v.expense_date} onChange={(x) => set({ expense_date: x })} />
            <Choice label="Categoria" value={v.category} onChange={(x) => set({ category: x })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] }))} />
            <Choice label="Situação" value={v.stage} onChange={(x) => set({ stage: x })} options={EXPENSE_STAGES.map((s) => ({ value: s, label: EXPENSE_STAGE_LABELS[s] }))} />
            <Choice label="Fornecedor" value={v.supplier_id} placeholder="— Nenhum —" onChange={(x) => set({ supplier_id: x })} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <Input label="Descrição" required value={v.description} onChange={(x) => set({ description: x })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Quantidade" type="number" min="0.001" step="0.001" required value={v.quantity} onChange={(x) => set({ quantity: x })} />
            <Input label="Preço unitário (AOA, sem IVA)" type="number" min="0" step="0.01" required value={v.unit_price} onChange={(x) => set({ unit_price: x })} />
            <Input label="IVA (%)" type="number" min="0" max="100" step="0.01" value={v.vat_rate} onChange={(x) => set({ vat_rate: x })} />
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            Total sem IVA: <strong>{fmtAoa(total)}</strong> · com IVA: {fmtAoa(withVat(total, Number(v.vat_rate) || 0))}
          </p>
          <p className="text-xs text-slate-500">Depois de guardar, anexe o comprovativo na lista de despesas. A aprovação é feita pela Direcção ou pelo Financeiro; despesas aprovadas ficam bloqueadas.</p>
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

const APPROVAL_TONE = { pendente: "amber", aprovada: "green", rejeitada: "red" } as const;

export function ExpenseTable({
  expenses,
  tasks,
  suppliers,
  vatDefault,
  showOrder,
  receipts,
}: {
  expenses: ExpenseView[];
  tasks: { id: string; label: string; work_order_id: string | null }[];
  suppliers: { id: string; name: string }[];
  vatDefault: number;
  showOrder?: boolean;
  receipts?: Record<string, React.ReactNode>;
}) {
  const { role } = useOps();
  const { pending, error, run } = useOpsAction();
  const [rejecting, setRejecting] = useState<ExpenseView | null>(null);
  const [note, setNote] = useState("");
  if (!expenses.length) return <EmptyState title="Sem despesas">Registe as despesas para acompanhar custos e rentabilidade.</EmptyState>;
  const total = expenses.filter((e) => e.approval !== "rejeitada" && e.stage !== "prevista").reduce((s, e) => s + e.total, 0);
  return (
    <div className="space-y-2">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Data</th>
              {showOrder && <th className="px-3 py-2">Obra</th>}
              <th className="px-3 py-2">Descrição</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2 text-right">Qtd × preço</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((e) => (
              <tr key={e.id} className={cx(e.approval === "rejeitada" && "text-slate-400 line-through")}>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                {showOrder && <td className="px-3 py-2 font-mono text-xs">{e.orderNumber}</td>}
                <td className="px-3 py-2">
                  {e.description}
                  <span className="block text-xs text-slate-500">
                    {[e.taskLabel, e.supplier, e.responsible].filter(Boolean).join(" · ")}
                  </span>
                  {e.rejection_note && <span className="block text-xs text-red-600 no-underline">Motivo: {e.rejection_note}</span>}
                  {receipts?.[e.id]}
                </td>
                <td className="px-3 py-2">
                  {EXPENSE_CATEGORY_LABELS[e.category]}
                  <span className="block text-xs text-slate-500">{EXPENSE_STAGE_LABELS[e.stage].split(" (")[0]}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtNum(e.quantity)} × {fmtAoa(e.unit_price)}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {fmtAoa(e.total)}
                  <span className="block text-xs font-normal text-slate-500">c/ IVA {fmtAoa(withVat(e.total, e.vat_rate))}</span>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={APPROVAL_TONE[e.approval]}>{APPROVAL_LABELS[e.approval]}</Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {e.approval === "pendente" && can.approveExpenses(role) && (
                      <>
                        <Button size="sm" variant="primary" loading={pending} onClick={() => run(() => decideExpense(e.id, true))} aria-label="Aprovar">
                          <Check className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRejecting(e)} aria-label="Rejeitar">
                          <X className="size-3.5" />
                        </Button>
                      </>
                    )}
                    {e.approval === "aprovada" && e.stage === "comprometida" && can.approveExpenses(role) && (
                      <Button size="sm" onClick={() => run(() => markExpenseRealised(e.id))}>
                        Marcar paga
                      </Button>
                    )}
                    {e.approval !== "aprovada" && can.finance(role) && (
                      <>
                        <ExpenseFormButton expense={e} tasks={tasks} suppliers={suppliers} vatDefault={vatDefault} orderId={e.work_order_id} />
                        <Button size="sm" variant="ghost" aria-label="Eliminar" onClick={() => run(() => deleteExpense(e.id))}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-medium">
              <td className="px-3 py-2" colSpan={showOrder ? 5 : 4}>
                Total (realizadas e comprometidas, não rejeitadas)
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtAoa(total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Rejeitar despesa">
        <Area label="Motivo" value={note} onChange={setNote} />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setRejecting(null)}>Cancelar</Button>
          <Button variant="danger" loading={pending} onClick={() => rejecting && run(() => decideExpense(rejecting.id, false, note), () => setRejecting(null))}>
            Rejeitar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------ Orçamentos ------------------------------ */

export type QuoteView = {
  id: string;
  version: number;
  status: QuoteStatus;
  vat_rate: number;
  notes: string | null;
  valid_until: string | null;
  decision_note: string | null;
  decided_at: string | null;
  items: { id: string; description: string; category: ExpenseCategory; quantity: number; unit_cost: number; unit_price: number }[];
};

export function QuotesPanel({ orderId, quotes }: { orderId: string; quotes: QuoteView[] }) {
  const { role } = useOps();
  const { pending, error, run } = useOpsAction();
  const [decision, setDecision] = useState<{ quote: QuoteView; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const editable = can.finance(role);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Cada versão submetida fica bloqueada. Só a Direcção/Administração aprova; ao aprovar, o orçamento e o preço contratual da obra são actualizados.</p>
        {editable && (
          <Button variant="primary" loading={pending} onClick={() => run(() => createQuoteVersion(orderId))}>
            <Plus className="size-4" /> Nova versão
          </Button>
        )}
      </div>
      <FormError error={error} />
      {quotes.length === 0 && <EmptyState title="Sem orçamentos">Crie a primeira versão do orçamento desta obra.</EmptyState>}
      {quotes.map((q) => {
        const t = quoteTotals(q.items, q.vat_rate);
        return (
          <Card
            key={q.id}
            title={
              <span className="flex items-center gap-2">
                Orçamento versão {q.version}
                <Badge tone={q.status === "aprovado" ? "green" : q.status === "rejeitado" ? "red" : q.status === "submetido" ? "amber" : "slate"}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
              </span>
            }
            description={q.valid_until ? `Válido até ${fmtDate(q.valid_until)}` : undefined}
            actions={
              <div className="flex gap-2">
                {q.status === "rascunho" && editable && (
                  <Button size="sm" variant="primary" loading={pending} onClick={() => run(() => submitQuote(q.id))}>
                    <Send className="size-3.5" /> Submeter para aprovação
                  </Button>
                )}
                {q.status === "submetido" && can.approveQuotes(role) && (
                  <>
                    <Button size="sm" variant="primary" onClick={() => setDecision({ quote: q, approve: true })}>
                      Aprovar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDecision({ quote: q, approve: false })}>
                      Rejeitar
                    </Button>
                  </>
                )}
              </div>
            }
          >
            {q.decision_note && <p className="text-sm text-slate-600">Decisão: {q.decision_note}</p>}
            <QuoteItems quote={q} editable={editable && q.status === "rascunho"} />
            <div className="grid gap-3 sm:grid-cols-4">
              <Kpi label="Custo previsto" value={fmtAoa(t.cost)} />
              <Kpi label="Preço (sem IVA)" value={fmtAoa(t.price)} sub={`com IVA ${fmtAoa(t.priceWithVat)} (${q.vat_rate}%)`} />
              <Kpi label="Lucro bruto" value={fmtAoa(t.profit)} tone={t.profit < 0 ? "red" : "default"} />
              <Kpi label="Margem / markup" value={fmtPct(t.margin)} sub={`markup ${fmtPct(t.markup)}`} />
            </div>
            {editable && q.status === "rascunho" && <QuoteSettings quote={q} />}
          </Card>
        );
      })}
      <Modal open={Boolean(decision)} onClose={() => setDecision(null)} title={decision?.approve ? "Aprovar orçamento" : "Rejeitar orçamento"}>
        <Area label="Nota da decisão (opcional)" value={note} onChange={setNote} />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setDecision(null)}>Cancelar</Button>
          <Button
            variant={decision?.approve ? "primary" : "danger"}
            loading={pending}
            onClick={() => decision && run(() => decideQuote(decision.quote.id, decision.approve, note), () => setDecision(null))}
          >
            Confirmar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function QuoteSettings({ quote }: { quote: QuoteView }) {
  const [v, setV] = useState({ vat_rate: String(quote.vat_rate), valid_until: quote.valid_until ?? "", notes: quote.notes ?? "" });
  const { pending, error, run } = useOpsAction();
  return (
    <form
      className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateQuote({ id: quote.id, ...v }));
      }}
    >
      <Input label="IVA (%)" type="number" min="0" max="100" step="0.01" value={v.vat_rate} onChange={(x) => setV({ ...v, vat_rate: x })} />
      <Input label="Válido até" type="date" value={v.valid_until} onChange={(x) => setV({ ...v, valid_until: x })} />
      <div className="sm:col-span-2">
        <Input label="Notas / condições" value={v.notes} onChange={(x) => setV({ ...v, notes: x })} />
      </div>
      <div className="sm:col-span-4">
        <FormError error={error} />
        <Button type="submit" size="sm" loading={pending}>
          Guardar condições
        </Button>
      </div>
    </form>
  );
}

function QuoteItems({ quote, editable }: { quote: QuoteView; editable: boolean }) {
  const empty = { description: "", category: "materiais" as ExpenseCategory, quantity: "1", unit_cost: "", unit_price: "" };
  const [v, setV] = useState(empty);
  const { pending, error, run } = useOpsAction();
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2">Item</th>
              <th className="py-2">Categoria</th>
              <th className="py-2 text-right">Qtd</th>
              <th className="py-2 text-right">Custo unit.</th>
              <th className="py-2 text-right">Preço unit.</th>
              <th className="py-2 text-right">Total preço</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quote.items.map((i) => (
              <tr key={i.id}>
                <td className="py-2">{i.description}</td>
                <td className="py-2">{EXPENSE_CATEGORY_LABELS[i.category]}</td>
                <td className="py-2 text-right tabular-nums">{fmtNum(i.quantity)}</td>
                <td className="py-2 text-right tabular-nums">{fmtAoa(i.unit_cost)}</td>
                <td className="py-2 text-right tabular-nums">{fmtAoa(i.unit_price)}</td>
                <td className="py-2 text-right font-medium tabular-nums">{fmtAoa(i.quantity * i.unit_price)}</td>
                {editable && (
                  <td className="py-2 text-right">
                    <Button size="sm" variant="ghost" aria-label="Remover item" onClick={() => run(() => deleteQuoteItem(i.id))}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {quote.items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 text-slate-500">
                  Sem itens.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editable && (
        <form
          className="grid items-end gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveQuoteItem({ ...v, quote_id: quote.id }), () => setV(empty));
          }}
        >
          <div className="sm:col-span-2">
            <Input label="Novo item" value={v.description} onChange={(x) => setV({ ...v, description: x })} required />
          </div>
          <Choice label="Categoria" value={v.category} onChange={(x) => setV({ ...v, category: x })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] }))} />
          <Input label="Qtd" type="number" min="0.001" step="0.001" value={v.quantity} onChange={(x) => setV({ ...v, quantity: x })} required />
          <Input label="Custo unit." type="number" min="0" step="0.01" value={v.unit_cost} onChange={(x) => setV({ ...v, unit_cost: x })} required />
          <Input label="Preço unit." type="number" min="0" step="0.01" value={v.unit_price} onChange={(x) => setV({ ...v, unit_price: x })} required />
          <div className="sm:col-span-6">
            <FormError error={error} />
            <Button type="submit" size="sm" variant="primary" loading={pending}>
              <Plus className="size-3.5" /> Acrescentar item
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ------------------------------ Consumos de materiais ------------------------------ */

export function ConsumptionForm({ orderId, tasks, materials }: { orderId: string; tasks: { id: string; label: string }[]; materials: { id: string; name: string; unit: string }[] }) {
  const [v, setV] = useState({ material_id: "", task_id: "", quantity: "", consumed_on: todayLuanda() });
  const { pending, error, run } = useOpsAction();
  const [ok, setOk] = useState(false);
  if (!materials.length) return <p className="text-sm text-slate-500">O catálogo de materiais está vazio. Peça ao gestor ou ao financeiro para o preencher em «Custos e orçamentos».</p>;
  return (
    <form
      className="grid items-end gap-3 sm:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        setOk(false);
        run(() => addConsumption({ ...v, work_order_id: orderId, task_id: v.task_id || null }), () => {
          setV({ ...v, quantity: "" });
          setOk(true);
        });
      }}
    >
      <Choice label="Material" required value={v.material_id} placeholder="— Escolher —" onChange={(x) => setV({ ...v, material_id: x })} options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
      <Choice label="Tarefa" value={v.task_id} placeholder="— Obra em geral —" onChange={(x) => setV({ ...v, task_id: x })} options={tasks.map((t) => ({ value: t.id, label: t.label }))} />
      <Input label="Quantidade" type="number" inputMode="decimal" min="0.001" step="0.001" required value={v.quantity} onChange={(x) => setV({ ...v, quantity: x })} />
      <Input label="Data" type="date" required value={v.consumed_on} onChange={(x) => setV({ ...v, consumed_on: x })} />
      <Button type="submit" variant="primary" loading={pending}>
        Registar consumo
      </Button>
      <div className="sm:col-span-5">
        <FormError error={error} />
        {ok && <p className="text-sm text-emerald-700">Consumo registado.</p>}
      </div>
    </form>
  );
}
