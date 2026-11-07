/**
 * Testes da lógica da Gestão de Obras: cálculos financeiros, mensagens WhatsApp,
 * exportação CSV, subdomínio e assinatura dos webhooks.
 *
 * Executar: npm run test:ops
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { computeFinance, quoteTotals, withVat } from "../lib/ops/finance";
import { retryDelayMinutes, summaryMessage, taskMessage } from "../lib/ops/messages";
import { toCsv } from "../lib/ops/csv";
import { isGestaoHost, joinBase } from "../lib/ops/base";
import { luandaToIso, fmtDate, fmtTime } from "../lib/ops/time";
import { sanitizeParam, verifyWebhookSignature } from "../lib/ops/whatsapp";
import { can } from "../lib/ops/roles";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Gestão de Obras — lógica");

test("custos realizados, comprometidos e mão-de-obra", () => {
  const f = computeFinance({
    contractPrice: 1_000_000,
    vatRate: 14,
    budgetInitial: 700_000,
    budgetRevised: 750_000,
    expenses: [
      { total: 200_000, stage: "realizada", approval: "aprovada", category: "materiais", task_id: "t1" },
      { total: 50_000, stage: "realizada", approval: "pendente", category: "transportes", task_id: null },
      { total: 100_000, stage: "comprometida", approval: "aprovada", category: "subcontratacoes", task_id: "t2" },
      { total: 999_999, stage: "realizada", approval: "rejeitada", category: "outros", task_id: null },
      { total: 300_000, stage: "prevista", approval: "pendente", category: "materiais", task_id: null },
    ],
    labour: [
      { user_id: "u1", task_id: "t1", hours: 10, hourly_cost: 2_500 },
      { user_id: "u2", task_id: "t2", hours: 4, hourly_cost: null },
    ],
    materials: [{ total: 20_000, task_id: "t1" }],
  });
  assert.equal(f.actualCost, 200_000 + 50_000 + 25_000 + 20_000, "realizados = despesas realizadas + mão-de-obra + materiais");
  assert.equal(f.committedCost, 100_000);
  assert.equal(f.costToDate, 395_000);
  assert.equal(f.labourHoursWithoutRate, 4, "horas sem custo/hora são assinaladas e não contadas");
  assert.equal(f.pendingApproval, 50_000);
  assert.equal(f.plannedCost, 750_000, "previsto = orçamento revisto");
  assert.equal(f.forecastCost, 750_000, "custo final estimado = max(custo até hoje, previsto)");
  assert.equal(f.budgetVariance, 395_000 - 750_000);
  assert.equal(f.vatAmount, 140_000);
  assert.equal(f.priceWithVat, 1_140_000);
  assert.equal(f.grossProfit, 250_000);
  assert.equal(f.grossMargin, 0.25, "margem = lucro / preço");
  assert.equal(Math.round((f.markup ?? 0) * 10000) / 10000, Math.round((250_000 / 750_000) * 10000) / 10000, "markup = lucro / custo");
  assert.notEqual(f.grossMargin, f.markup, "margem ≠ markup");
  assert.equal(f.byTask.t1, 200_000 + 25_000 + 20_000);
  assert.deepEqual(f.byEmployee.u1, { hours: 10, cost: 25_000 });
});

test("sem orçamento: previsto vem das despesas previstas e desvio fica indefinido", () => {
  const f = computeFinance({ contractPrice: null, vatRate: 14, budgetInitial: null, budgetRevised: null, expenses: [{ total: 80, stage: "prevista", approval: "pendente", category: "outros", task_id: null }], labour: [], materials: [] });
  assert.equal(f.plannedCost, 80);
  assert.equal(f.budgetVariance, null);
  assert.equal(f.grossMargin, null);
  assert.equal(f.vatAmount, null);
});

test("custo acima do orçamento: custo final estimado sobe e o desvio é positivo", () => {
  const f = computeFinance({ contractPrice: 100, vatRate: 0, budgetInitial: 60, budgetRevised: null, expenses: [{ total: 90, stage: "realizada", approval: "aprovada", category: "materiais", task_id: null }], labour: [], materials: [] });
  assert.equal(f.forecastCost, 90);
  assert.equal(f.budgetVariance, 30);
  assert.equal(f.budgetVariancePct, 0.5);
  assert.equal(f.grossProfit, 10);
});

test("arredondamento monetário a cêntimos", () => {
  const f = computeFinance({ contractPrice: 0.1 + 0.2, vatRate: 14, budgetInitial: null, budgetRevised: null, expenses: [], labour: [{ user_id: "u", task_id: null, hours: 0.25, hourly_cost: 1333.33 }], materials: [] });
  assert.equal(f.contractPrice, 0.3);
  assert.equal(f.labourCost, 333.33);
  assert.equal(withVat(100, 14), 114);
  assert.equal(withVat(33.33, 14), 38);
});

test("totais de orçamento: preço, IVA, lucro, margem e markup", () => {
  const t = quoteTotals(
    [
      { quantity: 4, unit_cost: 75_000, unit_price: 105_000 },
      { quantity: 40, unit_cost: 2_500, unit_price: 6_000 },
    ],
    14,
  );
  assert.equal(t.cost, 400_000);
  assert.equal(t.price, 660_000);
  assert.equal(t.vat, 92_400);
  assert.equal(t.priceWithVat, 752_400);
  assert.equal(t.profit, 260_000);
  assert.equal(Math.round(t.margin! * 1e4), Math.round((260_000 / 660_000) * 1e4));
  assert.equal(t.markup, 0.65);
});

test("mensagem de tarefa segue o modelo pr_notificacao_obra (9 parâmetros, hora de Luanda)", () => {
  const when = luandaToIso("2026-11-09", "08:00");
  const m = taskMessage({ event: "tarefa_atribuida", orderNumber: "OS-2026-0001", vessel: "PR-001", task: "Reparação e soldadura do casco", responsible: "Técnico João", when, priority: "alta" });
  assert.equal(m.params.length, 9);
  assert.deepEqual(m.params.slice(0, 8), ["NOVA TAREFA ATRIBUÍDA", "OS-2026-0001", "PR-001", "Reparação e soldadura do casco", "Técnico João", "09/11/2026", "08h00", "Alta"]);
  assert.ok(m.preview.startsWith("PONTO RADICAL | Gestão de Obras\nNOVA TAREFA ATRIBUÍDA\nObra: OS-2026-0001"));
  assert.ok(m.preview.endsWith("Consulte a plataforma para confirmar ou actualizar o estado da tarefa."));
  const s = summaryMessage({ event: "resumo_semanal", name: "Ana Paula", summary: "Obras activas: 3.", date: "2026-11-09" });
  assert.deepEqual(s.params, ["RESUMO SEMANAL", "Ana", "Obras activas: 3.", "09/11/2026"]);
});

test("parâmetros WhatsApp sem quebras de linha nem espaços excessivos (regra da Meta)", () => {
  assert.equal(sanitizeParam("linha 1\nlinha 2\t fim     x"), "linha 1 linha 2 fim x");
  assert.equal(sanitizeParam("   "), "—");
  assert.equal(sanitizeParam("a".repeat(2000)).length, 900);
});

test("repetição com espera exponencial limitada", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(retryDelayMinutes), [2, 4, 8, 16, 32, 60]);
});

test("assinatura de webhook da Meta (HMAC-SHA256 com o segredo da app)", () => {
  process.env.WHATSAPP_APP_SECRET = "segredo-de-teste";
  const body = JSON.stringify({ entry: [] });
  const sig = "sha256=" + createHmac("sha256", "segredo-de-teste").update(body).digest("hex");
  assert.equal(verifyWebhookSignature(body, sig), true);
  assert.equal(verifyWebhookSignature(body + " ", sig), false);
  assert.equal(verifyWebhookSignature(body, "sha256=" + "0".repeat(64)), false);
  assert.equal(verifyWebhookSignature(body, null), false);
});

test("CSV para Excel: separador ;, decimais com vírgula, aspas e protecção contra fórmulas", () => {
  const csv = toCsv(["A", "B"], [["texto; com separador", 1234.5], ["=HYPERLINK(1)", null]]);
  assert.ok(csv.startsWith("﻿A;B\r\n"));
  assert.ok(csv.includes('"texto; com separador";1234,5'));
  assert.ok(csv.includes("'=HYPERLINK(1);"));
});

test("subdomínio da gestão e caminhos", () => {
  assert.equal(isGestaoHost("gestao.pontoradical.com"), true);
  assert.equal(isGestaoHost("gestao.localhost:3000"), true);
  assert.equal(isGestaoHost("ponto-radical.vercel.app"), false);
  assert.equal(joinBase("", "/obras"), "/obras");
  assert.equal(joinBase("/gestao", "/obras"), "/gestao/obras");
  assert.equal(joinBase("/gestao", "/"), "/gestao");
});

test("hora de Angola (UTC+1)", () => {
  const iso = luandaToIso("2026-11-09", "08:00");
  assert.equal(iso, "2026-11-09T07:00:00.000Z");
  assert.equal(fmtTime(iso), "08h00");
  assert.equal(fmtDate("2026-11-09"), "09/11/2026");
});

test("matriz de permissões da interface coincide com a base de dados", () => {
  assert.equal(can.finance("tecnico"), false);
  assert.equal(can.finance("supervisor"), false);
  assert.equal(can.finance("gestor"), true);
  assert.equal(can.approveExpenses("gestor"), false);
  assert.equal(can.approveQuotes("financeiro"), false);
  assert.equal(can.approveQuotes("direcao"), true);
  assert.equal(can.manage("tecnico"), false);
  assert.equal(can.admin("direcao"), false);
});

console.log(`\n${passed} testes passaram.`);
