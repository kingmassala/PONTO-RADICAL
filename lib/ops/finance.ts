import { round2 } from "./money";
import type { ExpenseCategory, ExpenseStage } from "./labels";

/**
 * Cálculos financeiros de uma obra (AOA, valores sem IVA salvo indicação).
 *
 * Definições usadas em toda a plataforma:
 *  - Custos realizados  = despesas «realizadas» (não rejeitadas) + mão-de-obra (horas × custo/hora) + consumos de materiais.
 *  - Custos comprometidos = despesas «comprometidas» (encomendadas, ainda não facturadas), não rejeitadas.
 *  - Custos previstos   = orçamento revisto → orçamento inicial → soma das despesas «previstas».
 *  - Custo estimado final = máximo entre (realizados + comprometidos) e os previstos.
 *  - Desvio orçamental  = (realizados + comprometidos) − orçamento de referência (revisto ou inicial).
 *  - Lucro bruto estimado = preço contratual − custo estimado final.
 *  - Margem bruta       = lucro bruto ÷ preço contratual (percentagem do PREÇO).
 *  - Markup             = lucro bruto ÷ custo estimado final (percentagem do CUSTO). Não confundir com a margem.
 *  - IVA                = preço contratual × taxa; não entra na margem (é imposto a entregar ao Estado).
 */

export type ExpenseRow = {
  total: number;
  stage: ExpenseStage;
  approval: "pendente" | "aprovada" | "rejeitada";
  category: ExpenseCategory;
  task_id: string | null;
};
export type LabourRow = { user_id: string; task_id: string | null; hours: number; hourly_cost: number | null };
export type MaterialRow = { total: number; task_id: string | null };

export type FinanceInput = {
  contractPrice: number | null;
  vatRate: number;
  budgetInitial: number | null;
  budgetRevised: number | null;
  expenses: ExpenseRow[];
  labour: LabourRow[];
  materials: MaterialRow[];
};

export type FinanceSummary = {
  vatRate: number;
  contractPrice: number | null;
  vatAmount: number | null;
  priceWithVat: number | null;
  budgetInitial: number | null;
  budgetRevised: number | null;
  budgetReference: number | null;
  plannedCost: number;
  actualCost: number;
  committedCost: number;
  costToDate: number;
  forecastCost: number;
  pendingApproval: number;
  labourCost: number;
  labourHoursWithoutRate: number;
  materialsCost: number;
  budgetVariance: number | null;
  budgetVariancePct: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  markup: number | null;
  byCategory: Record<string, number>;
  byTask: Record<string, number>;
  byEmployee: Record<string, { hours: number; cost: number }>;
};

const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

export function computeFinance(input: FinanceInput): FinanceSummary {
  const valid = input.expenses.filter((e) => e.approval !== "rejeitada");
  const byCategory: Record<string, number> = {};
  const byTask: Record<string, number> = {};
  const byEmployee: Record<string, { hours: number; cost: number }> = {};
  const addTask = (task: string | null, value: number) => {
    const key = task ?? "sem_tarefa";
    byTask[key] = round2((byTask[key] ?? 0) + value);
  };

  let realised = 0;
  let committed = 0;
  let plannedFromExpenses = 0;
  let pendingApproval = 0;
  for (const e of valid) {
    const total = n(e.total);
    if (e.stage === "prevista") {
      plannedFromExpenses += total;
      continue;
    }
    if (e.stage === "realizada") realised += total;
    else committed += total;
    if (e.approval === "pendente") pendingApproval += total;
    byCategory[e.category] = round2((byCategory[e.category] ?? 0) + total);
    addTask(e.task_id, total);
  }

  let labourCost = 0;
  let labourHoursWithoutRate = 0;
  for (const l of input.labour) {
    const hours = n(l.hours);
    const rate = l.hourly_cost === null ? null : n(l.hourly_cost);
    const cost = rate === null ? 0 : round2(hours * rate);
    if (rate === null) labourHoursWithoutRate += hours;
    labourCost += cost;
    const emp = (byEmployee[l.user_id] ??= { hours: 0, cost: 0 });
    emp.hours = round2(emp.hours + hours);
    emp.cost = round2(emp.cost + cost);
    addTask(l.task_id, cost);
  }
  if (labourCost > 0) byCategory.mao_de_obra = round2((byCategory.mao_de_obra ?? 0) + labourCost);

  let materialsCost = 0;
  for (const m of input.materials) {
    materialsCost += n(m.total);
    addTask(m.task_id, n(m.total));
  }
  if (materialsCost > 0) byCategory.materiais = round2((byCategory.materiais ?? 0) + materialsCost);

  const actualCost = round2(realised + labourCost + materialsCost);
  const committedCost = round2(committed);
  const costToDate = round2(actualCost + committedCost);
  const budgetReference = input.budgetRevised ?? input.budgetInitial ?? null;
  const plannedCost = round2(budgetReference ?? plannedFromExpenses);
  const forecastCost = round2(Math.max(costToDate, plannedCost));

  const contractPrice = input.contractPrice === null ? null : round2(input.contractPrice);
  const vatAmount = contractPrice === null ? null : round2((contractPrice * input.vatRate) / 100);
  const grossProfit = contractPrice === null ? null : round2(contractPrice - forecastCost);
  const grossMargin = contractPrice && grossProfit !== null ? grossProfit / contractPrice : null;
  const markup = forecastCost > 0 && grossProfit !== null ? grossProfit / forecastCost : null;
  const budgetVariance = budgetReference === null ? null : round2(costToDate - budgetReference);
  const budgetVariancePct = budgetReference ? (budgetVariance ?? 0) / budgetReference : null;

  return {
    vatRate: input.vatRate,
    contractPrice,
    vatAmount,
    priceWithVat: contractPrice === null || vatAmount === null ? null : round2(contractPrice + vatAmount),
    budgetInitial: input.budgetInitial,
    budgetRevised: input.budgetRevised,
    budgetReference,
    plannedCost,
    actualCost,
    committedCost,
    costToDate,
    forecastCost,
    pendingApproval: round2(pendingApproval),
    labourCost: round2(labourCost),
    labourHoursWithoutRate: round2(labourHoursWithoutRate),
    materialsCost: round2(materialsCost),
    budgetVariance,
    budgetVariancePct,
    grossProfit,
    grossMargin,
    markup,
    byCategory,
    byTask,
    byEmployee,
  };
}

/** Totais de um orçamento (itens com custo e preço unitários). */
export function quoteTotals(items: { quantity: number; unit_cost: number; unit_price: number }[], vatRate: number) {
  const cost = round2(items.reduce((s, i) => s + round2(n(i.quantity) * n(i.unit_cost)), 0));
  const price = round2(items.reduce((s, i) => s + round2(n(i.quantity) * n(i.unit_price)), 0));
  const vat = round2((price * vatRate) / 100);
  const profit = round2(price - cost);
  return {
    cost,
    price,
    vat,
    priceWithVat: round2(price + vat),
    profit,
    margin: price > 0 ? profit / price : null,
    markup: cost > 0 ? profit / cost : null,
  };
}

/** Valor de uma despesa com IVA (o total guardado é sem IVA). */
export function withVat(total: number, vatRate: number) {
  return round2(total + (total * vatRate) / 100);
}
