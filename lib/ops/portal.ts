import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { OrderStatus, TaskStatus } from "./labels";
import { opsPath } from "./server-base";

/**
 * Portal do cliente. O cliente não lê tabelas: só as funções ops_portal_* da base de dados,
 * que devolvem campos seguros das embarcações do seu cliente e as fotografias partilhadas.
 */

export type PortalUser = { id: string; fullName: string; email: string; mustChangePassword: boolean; client: { id: string; name: string; code: string } };

export type PortalVessel = { id: string; code: string; name: string; vessel_type: string; registration: string | null; manufacturer: string | null; model: string | null; length_m: number | null };
export type PortalOrderSummary = {
  id: string;
  number: string;
  title: string;
  status: OrderStatus;
  vessel_id: string;
  intervention_type: string;
  start_date: string | null;
  due_date: string | null;
  closed_at: string | null;
  progress: number;
  tasks_total: number;
  tasks_done: number;
  photos: number;
};
export type PortalTask = { id: string; code: string; title: string; status: TaskStatus; progress: number; parent_id: string | null; start_at: string | null; due_at: string | null; completed_at: string | null };
export type PortalPhoto = { id: string; url: string | null; mime_type: string; caption: string | null; created_at: string; task?: string | null; order_number?: string | null; entity_type?: string };
export type PortalOrder = {
  order: Omit<PortalOrderSummary, "vessel_id" | "tasks_total" | "tasks_done" | "photos"> & { description: string | null; vessel: { id: string; code: string; name: string } | null };
  tasks: PortalTask[];
  photos: PortalPhoto[];
};

/** Conta de cliente activa da sessão actual, ou null. */
export const getPortalUser = cache(async (): Promise<PortalUser | null> => {
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("ops_portal_me");
  if (!data) return null;
  const me = data as { full_name: string; email: string; must_change_password: boolean; client: PortalUser["client"] };
  return { id: user.id, fullName: me.full_name, email: me.email, mustChangePassword: me.must_change_password, client: me.client };
});

export async function requirePortalPage(): Promise<PortalUser> {
  const user = await getPortalUser();
  if (!user) redirect(await opsPath("/entrar"));
  return user;
}

/** Links temporários (1 hora) para fotografias que a base de dados confirmou serem partilhadas. */
async function sign<T extends { path: string }>(rows: T[]): Promise<(Omit<T, "path"> & { url: string | null })[]> {
  if (!rows.length || !isServiceRoleConfigured()) return rows.map((r) => ({ ...r, path: undefined, url: null }));
  const { data } = await createAdminClient().storage.from("ops").createSignedUrls(rows.map((r) => r.path), 3600);
  const byPath = new Map((data ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map(({ path, ...r }) => ({ ...r, url: byPath.get(path) ?? null }));
}

export async function getPortalOverview(): Promise<{ vessels: PortalVessel[]; orders: PortalOrderSummary[] }> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ops_portal_overview");
  return (data as { vessels: PortalVessel[]; orders: PortalOrderSummary[] } | null) ?? { vessels: [], orders: [] };
}

export async function getPortalOrder(id: string): Promise<PortalOrder | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ops_portal_order", { p_order: id });
  if (!data) return null;
  const raw = data as Omit<PortalOrder, "photos"> & { photos: (Omit<PortalPhoto, "url"> & { path: string })[] };
  return { ...raw, photos: await sign(raw.photos) };
}

export async function getPortalVesselPhotos(id: string): Promise<PortalPhoto[] | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ops_portal_vessel_photos", { p_vessel: id });
  if (!data) return null;
  return sign(data as (Omit<PortalPhoto, "url"> & { path: string })[]);
}
