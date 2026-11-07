"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOps } from "../auth";
import { opsDbError, opsError, type OpsResult } from "../errors";
import { INTERVENTION_TYPES, ORDER_STATUSES, PRIORITIES } from "../labels";

const orderSchema = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string().uuid("Escolha o cliente"),
  vessel_id: z.string().uuid("Escolha a embarcação"),
  intervention_type: z.enum(INTERVENTION_TYPES),
  title: z.string().trim().min(3, "Descreva a obra em poucas palavras").max(200),
  description: z.string().trim().max(5000).optional().transform((v) => v || null),
  location: z.string().trim().max(200).optional().transform((v) => v || null),
  manager_id: z.string().uuid().nullable().optional(),
  team_id: z.string().uuid().nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("").transform(() => null)),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("").transform(() => null)),
  priority: z.enum(PRIORITIES),
  status: z.enum(ORDER_STATUSES).optional(),
});

export async function saveOrder(input: unknown): Promise<OpsResult<{ id: string; number: string }>> {
  try {
    const user = await requireOps(["admin", "direcao", "gestor", "supervisor"]);
    const { id, ...values } = orderSchema.parse(input);
    if (values.start_date && values.due_date && values.due_date < values.start_date) {
      return { ok: false, error: "O prazo de conclusão não pode ser anterior à data de início." };
    }
    const supabase = await createClient();
    if (!id && !["admin", "direcao", "gestor"].includes(user.role)) return { ok: false, error: "O seu perfil não pode criar obras." };
    const { data, error } = id
      ? await supabase.from("ops_work_orders").update(values).eq("id", id).select("id, number").single()
      : await supabase.from("ops_work_orders").insert({ ...values, status: values.status ?? "em_avaliacao", created_by: user.id }).select("id, number").single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data };
  } catch (error) {
    return opsError(error);
  }
}

export async function setOrderStatus(id: string, status: string): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor", "supervisor"]);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_work_orders").update({ status: z.enum(ORDER_STATUSES).parse(status) }).eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

export async function deleteOrder(id: string): Promise<OpsResult> {
  try {
    await requireOps(["admin"]);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_work_orders").delete().eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: opsDbError(error.message) };
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

/** Valores contratuais definidos manualmente (sem orçamento aprovado). */
export async function saveOrderFinance(input: unknown): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "financeiro"]);
    const v = z
      .object({
        work_order_id: z.string().uuid(),
        budget_initial: z.coerce.number().min(0).nullable(),
        budget_revised: z.coerce.number().min(0).nullable(),
        contract_price: z.coerce.number().min(0).nullable(),
        vat_rate: z.coerce.number().min(0).max(100),
      })
      .parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("ops_work_order_finance").upsert({ ...v, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}
