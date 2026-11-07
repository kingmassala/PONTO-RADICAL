import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export type Attachment = {
  id: string;
  entity_type: string;
  entity_id: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  created_at: string;
  uploaded_by: string | null;
  client_visible: boolean;
  url: string | null;
};

/**
 * Lê os anexos visíveis para o utilizador (RLS) e gera links temporários (1 hora).
 * O bucket «ops» é privado: sem estes links, ninguém acede aos ficheiros.
 */
export async function listAttachments(filter: { entity_type?: string | string[]; entity_id?: string; work_order_id?: string }): Promise<Attachment[]> {
  const supabase = await createClient();
  let q = supabase.from("ops_attachments").select("id, entity_type, entity_id, path, mime_type, size_bytes, caption, created_at, uploaded_by, client_visible").order("created_at", { ascending: false }).limit(200);
  if (Array.isArray(filter.entity_type)) q = q.in("entity_type", filter.entity_type);
  else if (filter.entity_type) q = q.eq("entity_type", filter.entity_type);
  if (filter.entity_id) q = q.eq("entity_id", filter.entity_id);
  if (filter.work_order_id) q = q.eq("work_order_id", filter.work_order_id);
  const { data } = await q;
  const rows = data ?? [];
  if (!rows.length || !isServiceRoleConfigured()) return rows.map((r) => ({ ...r, path: undefined, url: null }));
  const { data: signed } = await createAdminClient()
    .storage.from("ops")
    .createSignedUrls(rows.map((r) => r.path), 3600);
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map(({ path, ...r }) => ({ ...r, url: byPath.get(path) ?? null }));
}
