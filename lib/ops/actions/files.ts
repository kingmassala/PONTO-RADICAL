"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { detectImageType } from "@/lib/media/files";
import { requireOps } from "../auth";
import { opsDbError, opsError, type OpsResult } from "../errors";

const MAX_BYTES = 10 * 1024 * 1024; // limite do corpo das Server Actions (next.config: 11 MB)
const ENTITY = z.enum(["work_order", "vessel", "client", "task", "expense", "report", "incident"]);

function detect(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length > 4 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF") return { mime: "application/pdf", ext: "pdf" };
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" && /heic|heix|mif1/.test(String.fromCharCode(...bytes.slice(8, 12)))) {
    return { mime: "image/heic", ext: "heic" };
  }
  const img = detectImageType(bytes);
  if (img === "image/jpeg") return { mime: img, ext: "jpg" };
  if (img === "image/png") return { mime: img, ext: "png" };
  if (img === "image/webp") return { mime: img, ext: "webp" };
  return null; // SVG e outros formatos não são aceites nesta área.
}

export async function uploadAttachment(formData: FormData): Promise<OpsResult<{ id: string }>> {
  try {
    const user = await requireOps();
    const meta = z
      .object({
        entity_type: ENTITY,
        entity_id: z.string().uuid(),
        work_order_id: z.string().uuid().nullable(),
        caption: z.string().trim().max(200).optional().transform((v) => v || null),
      })
      .parse({
        entity_type: formData.get("entity_type"),
        entity_id: formData.get("entity_id"),
        work_order_id: formData.get("work_order_id") || null,
        caption: formData.get("caption") ?? undefined,
      });
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha um ficheiro." };
    if (file.size > MAX_BYTES) return { ok: false, error: "O ficheiro excede 10 MB. As fotografias são reduzidas automaticamente; para PDF, comprima o documento." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = detect(bytes);
    if (!kind) return { ok: false, error: "Formato não suportado. Use fotografias (JPG, PNG, WebP, HEIC) ou PDF." };

    const supabase = await createClient();
    const path = `${meta.entity_type}/${meta.entity_id}/${crypto.randomUUID()}.${kind.ext}`;
    const { error: upErr } = await supabase.storage.from("ops").upload(path, bytes, { contentType: kind.mime, upsert: false });
    if (upErr) return { ok: false, error: `Falha no envio: ${upErr.message}` };
    const { data, error } = await supabase
      .from("ops_attachments")
      .insert({ ...meta, path, mime_type: kind.mime, size_bytes: file.size, uploaded_by: user.id })
      .select("id")
      .single();
    if (error) {
      if (isServiceRoleConfigured()) await createAdminClient().storage.from("ops").remove([path]);
      return { ok: false, error: opsDbError(error.message) };
    }
    refresh();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return opsError(error);
  }
}

export async function deleteAttachment(id: string): Promise<OpsResult> {
  try {
    await requireOps();
    const supabase = await createClient();
    const { data, error } = await supabase.from("ops_attachments").delete().eq("id", z.string().uuid().parse(id)).select("path");
    if (error) return { ok: false, error: opsDbError(error.message) };
    if (!data?.length) return { ok: false, error: "Só pode remover ficheiros que carregou." };
    if (isServiceRoleConfigured()) await createAdminClient().storage.from("ops").remove(data.map((d) => d.path));
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return opsError(error);
  }
}
