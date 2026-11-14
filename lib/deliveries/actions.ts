"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorResult, friendlyDbError, type ActionResult } from "@/lib/cms/errors";
import { deliveryInputSchema } from "./rules";

export async function createDelivery(input: unknown): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    await requireStaff();
    const v = deliveryInputSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("pr_create_delivery", { p_header: v.header, p_items: v.items });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, data: data as { id: string; number: string } };
  } catch (error) {
    return errorResult(error);
  }
}

/** Corrige uma guia ainda por assinar (cabeçalho e linhas). */
export async function updateDelivery(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireStaff();
    const v = deliveryInputSchema.parse(input);
    const deliveryId = z.string().uuid().parse(id);
    const supabase = await createClient();
    const { data, error } = await supabase.from("pr_material_deliveries").update(v.header).eq("id", deliveryId).eq("status", "emitida").select("id");
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data?.length) return { ok: false, error: "Só é possível corrigir guias ainda por assinar." };
    const { error: itemsError } = await supabase.rpc("pr_replace_delivery_items", { p_delivery: deliveryId, p_items: v.items });
    if (itemsError) return { ok: false, error: friendlyDbError(itemsError.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

/** Marca a guia como assinada pelos dois lados (o original em papel fica arquivado). */
export async function markDeliverySigned(id: string, receivedBy: unknown): Promise<ActionResult> {
  try {
    await requireStaff();
    const name = z.string().trim().min(2, "Indique quem recebeu do lado do cliente.").max(120).parse(receivedBy);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pr_material_deliveries")
      .update({ status: "assinada", received_by: name })
      .eq("id", z.string().uuid().parse(id))
      .eq("status", "emitida")
      .select("id");
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data?.length) return { ok: false, error: "A guia já não está por assinar." };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function cancelDelivery(id: string, reason: unknown): Promise<ActionResult> {
  try {
    await requireStaff();
    const why = z.string().trim().min(3, "Indique o motivo da anulação.").max(500).parse(reason);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pr_material_deliveries")
      .update({ status: "anulada", cancelled_reason: why })
      .eq("id", z.string().uuid().parse(id))
      .neq("status", "anulada")
      .select("id");
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data?.length) return { ok: false, error: "A guia já estava anulada." };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

/** Só administradores, e só guias nunca assinadas (criadas por engano). */
export async function deleteDelivery(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.from("pr_material_deliveries").delete().eq("id", z.string().uuid().parse(id)).select("id");
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data?.length) return { ok: false, error: "Só é possível apagar guias por assinar. Anule-a em vez disso." };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}
