"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOps } from "../auth";
import { opsDbError, opsError, type OpsResult } from "../errors";
import { EXPENSE_CATEGORIES, EXPENSE_STAGES } from "../labels";
import { notifyApproval, processOutbox } from "../notify";

function flushSoon() {
  after(async () => {
    try {
      await processOutbox(10);
    } catch (error) {
      console.error("[gestao] envio imediato falhou:", error);
    }
  });
}

const expenseSchema = z.object({
  id: z.string().uuid().optional(),
  // null = despesa geral da empresa (almoço, limpeza, escritório…), fora das obras.
  work_order_id: z.string().uuid("Escolha a obra").nullable().optional().transform((v) => v || null),
  task_id: z.string().uuid().nullable().optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(2, "Descreva a despesa").max(300),
  quantity: z.coerce.number().positive("Quantidade inválida").max(1e9),
  unit_price: z.coerce.number().min(0, "Preço inválido").max(1e12),
  vat_rate: z.coerce.number().min(0).max(100),
  stage: z.enum(EXPENSE_STAGES),
  supplier_id: z.string().uuid().nullable().optional(),
  responsible_id: z.string().uuid().nullable().optional(),
});

export async function saveExpense(input: unknown): Promise<OpsResult<{ id: string }>> {
  try {
    const user = await requireOps(["admin", "direcao", "gestor", "financeiro"]);
    const { id, ...values } = expenseSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = id
      ? await supabase.from("ops_expenses").update(values).eq("id", id).select("id, approval").single()
      : await supabase
          .from("ops_expenses")
          .insert({ ...values, responsible_id: values.responsible_id ?? user.id, created_by: user.id })
          .select("id, approval")
          .single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    if (!id && data.approval === "pendente" && user.role === "gestor") {
      if (await notifyApproval("despesa", values.work_order_id, data.id, values.description)) flushSoon();
    }
    refresh();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return opsError(error);
  }
}

export async function decideExpense(id: string, approve: boolean, note?: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "financeiro"]);
    const supabase = await createClient();
    const { error } = await supabase
      .from("ops_expenses")
      .update({ approval: approve ? "aprovada" : "rejeitada", rejection_note: approve ? null : note?.trim() || null })
      .eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

/** Uma despesa comprometida aprovada pode passar a realizada (facturada/paga) sem mudar valores. */
export async function markExpenseRealised(id: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "financeiro"]);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_expenses").update({ stage: "realizada" }).eq("id", z.string().uuid().parse(id)).eq("stage", "comprometida");
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function deleteExpense(id: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor", "financeiro"]);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_expenses").delete().eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

/* ------------------------------ Orçamentos ------------------------------ */

/** Cria uma nova versão (copia os itens da versão anterior, se existir). */
export async function createQuoteVersion(workOrderId: string): Promise<OpsResult<{ id: string }>> {
  try {
    const user = await requireOps(["admin", "direcao", "gestor", "financeiro"]);
    const supabase = await createClient();
    const orderId = z.string().uuid().parse(workOrderId);
    const { data: last } = await supabase
      .from("ops_quotes")
      .select("id, version, vat_rate, items:ops_quote_items(description, category, quantity, unit_cost, unit_price, sort_order)")
      .eq("work_order_id", orderId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: settings } = await supabase.from("ops_settings").select("default_vat_rate").eq("id", 1).single();
    const { data, error } = await supabase
      .from("ops_quotes")
      .insert({ work_order_id: orderId, version: (last?.version ?? 0) + 1, vat_rate: last?.vat_rate ?? settings?.default_vat_rate ?? 14, created_by: user.id })
      .select("id")
      .single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    const items = (last?.items ?? []) as Record<string, unknown>[];
    if (items.length) {
      const { error: iErr } = await supabase.from("ops_quote_items").insert(items.map((i) => ({ ...i, quote_id: data.id })));
      if (iErr) return { ok: false, error: opsDbError(iErr.message) };
    }
    refresh();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return opsError(error);
  }
}

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  quote_id: z.string().uuid(),
  description: z.string().trim().min(2, "Descreva o item").max(300),
  category: z.enum(EXPENSE_CATEGORIES),
  quantity: z.coerce.number().positive().max(1e9),
  unit_cost: z.coerce.number().min(0).max(1e12),
  unit_price: z.coerce.number().min(0).max(1e12),
});

export async function saveQuoteItem(input: unknown): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor", "financeiro"]);
    const { id, ...values } = itemSchema.parse(input);
    const supabase = await createClient();
    const { error } = id ? await supabase.from("ops_quote_items").update(values).eq("id", id) : await supabase.from("ops_quote_items").insert(values);
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function deleteQuoteItem(id: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor", "financeiro"]);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_quote_items").delete().eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function updateQuote(input: unknown): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor", "financeiro"]);
    const v = z
      .object({
        id: z.string().uuid(),
        vat_rate: z.coerce.number().min(0).max(100),
        notes: z.string().trim().max(2000).optional().transform((x) => x || null),
        valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("").transform(() => null)),
      })
      .parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_quotes").update(v).eq("id", v.id);
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function submitQuote(id: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor", "financeiro"]);
    const supabase = await createClient();
    const quoteId = z.string().uuid().parse(id);
    const { count } = await supabase.from("ops_quote_items").select("id", { count: "exact", head: true }).eq("quote_id", quoteId);
    if (!count) return { ok: false, error: "Acrescente pelo menos um item antes de submeter." };
    const { data, error } = await supabase
      .from("ops_quotes")
      .update({ status: "submetido", submitted_at: new Date().toISOString() })
      .eq("id", quoteId)
      .select("work_order_id, version")
      .single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    await supabase.from("ops_work_orders").update({ status: "aguarda_aprovacao" }).eq("id", data.work_order_id).in("status", ["em_avaliacao", "aguarda_orcamento"]);
    if (await notifyApproval("orcamento", data.work_order_id, quoteId, `Orçamento versão ${data.version}`)) flushSoon();
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function decideQuote(id: string, approve: boolean, note?: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("ops_decide_quote", { p_quote: z.string().uuid().parse(id), p_approve: approve, p_note: note ?? null });
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

/* ------------------------------ Consumos e custos/hora ------------------------------ */

export async function addConsumption(input: unknown): Promise<OpsResult> {
  try {
    const user = await requireOps();
    const v = z
      .object({
        work_order_id: z.string().uuid(),
        task_id: z.string().uuid().nullable().optional(),
        material_id: z.string().uuid("Escolha o material"),
        quantity: z.coerce.number().positive("Quantidade inválida").max(1e9),
        consumed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input);
    const supabase = await createClient();
    // O custo unitário é imposto pela base de dados a partir do catálogo.
    const { error } = await supabase.from("ops_material_consumptions").insert({ ...v, unit_cost: 0, user_id: user.id });
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function setHourlyCost(userId: string, hourlyCost: number): Promise<OpsResult> {
  try {
    await requireOps(["admin", "financeiro"]);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_member_rates").upsert({
      user_id: z.string().uuid().parse(userId),
      hourly_cost: z.coerce.number().min(0).max(1e9).parse(hourlyCost),
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}
