import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Delivery } from "./rules";

export const DELIVERY_SELECT =
  "id, number, delivery_date, recipient, reference, delivered_by, received_by, notes, status, signed_at, cancelled_reason, created_at, items:pr_material_delivery_items(id, position, description, reference, quantity, unit, notes)";

function normalize(row: Record<string, unknown>): Delivery {
  const d = row as unknown as Delivery;
  return {
    ...d,
    items: [...(d.items ?? [])].map((it) => ({ ...it, quantity: Number(it.quantity) })).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  };
}

export async function listDeliveries(limit = 500) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pr_material_deliveries").select(DELIVERY_SELECT).order("delivery_date", { ascending: false }).order("number", { ascending: false }).limit(limit);
  return { deliveries: (data ?? []).map((r) => normalize(r as Record<string, unknown>)), error: error?.message ?? null };
}

export async function getDelivery(id: string): Promise<Delivery | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("pr_material_deliveries").select(DELIVERY_SELECT).eq("id", id).maybeSingle();
  return data ? normalize(data as Record<string, unknown>) : null;
}
