"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOps } from "../auth";
import { opsDbError, opsError, type OpsResult } from "../errors";
import { VESSEL_TYPES } from "../labels";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const clientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Indique o nome").max(160),
  legal_name: opt(200),
  nif: opt(30),
  phone: opt(40),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email inválido"),
  address: opt(300),
  contact_person: opt(120),
  notes: opt(2000),
});

export async function saveClient(input: unknown): Promise<OpsResult<{ id: string }>> {
  try {
    const user = await requireOps(["admin", "direcao", "gestor"]);
    const { id, ...values } = clientSchema.parse(input);
    const supabase = await createClient();
    const query = id
      ? supabase.from("ops_clients").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).select("id").single()
      : supabase.from("ops_clients").insert({ ...values, created_by: user.id }).select("id").single();
    const { data, error } = await query;
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return opsError(error);
  }
}

const vesselSchema = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string().uuid("Escolha o proprietário"),
  name: z.string().trim().min(1, "Indique o nome").max(120),
  vessel_type: z.enum(VESSEL_TYPES),
  registration: opt(40),
  manufacturer: opt(80),
  model: opt(80),
  hull_type: opt(60),
  length_m: z.coerce.number().positive().max(400).optional().nullable().catch(null),
  propulsion: opt(200),
  location: opt(200),
  notes: opt(2000),
});

export async function saveVessel(input: unknown): Promise<OpsResult<{ id: string }>> {
  try {
    const user = await requireOps(["admin", "direcao", "gestor"]);
    const { id, ...values } = vesselSchema.parse(input);
    const supabase = await createClient();
    const query = id
      ? supabase.from("ops_vessels").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).select("id").single()
      : supabase.from("ops_vessels").insert({ ...values, created_by: user.id }).select("id").single();
    const { data, error } = await query;
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return opsError(error);
  }
}

export async function setArchived(kind: "client" | "vessel", id: string, archived: boolean): Promise<OpsResult> {
  try {
    await requireOps(["admin", "direcao", "gestor"]);
    const supabase = await createClient();
    const { error } = await supabase
      .from(kind === "client" ? "ops_clients" : "ops_vessels")
      .update({ archived, updated_at: new Date().toISOString() })
      .eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}

const supplierSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(160), nif: opt(30), phone: opt(40), email: opt(254), notes: opt(1000) });

export async function saveSupplier(input: unknown): Promise<OpsResult<{ id: string }>> {
  try {
    await requireOps(["admin", "direcao", "gestor", "financeiro"]);
    const { id, ...values } = supplierSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = id
      ? await supabase.from("ops_suppliers").update(values).eq("id", id).select("id").single()
      : await supabase.from("ops_suppliers").insert(values).select("id").single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return opsError(error);
  }
}

const materialSchema = z.object({
  id: z.string().uuid().optional(),
  code: opt(40),
  name: z.string().trim().min(2).max(160),
  unit: z.string().trim().min(1).max(20),
  unit_cost: z.coerce.number().min(0).max(1e12),
  active: z.boolean().default(true),
});

export async function saveMaterial(input: unknown): Promise<OpsResult<{ id: string }>> {
  try {
    await requireOps(["admin", "direcao", "gestor", "financeiro"]);
    const { id, ...values } = materialSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = id
      ? await supabase.from("ops_materials").update(values).eq("id", id).select("id").single()
      : await supabase.from("ops_materials").insert(values).select("id").single();
    if (error) return { ok: false, error: opsDbError(error.message) };
    refresh();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return opsError(error);
  }
}
