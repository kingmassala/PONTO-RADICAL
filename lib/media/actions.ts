"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDraft } from "@/lib/cms/draft";
import { errorResult, friendlyDbError, type ActionResult } from "@/lib/cms/errors";
import { sanitizeDocument } from "@/lib/cms/sanitize";
import { siteDocumentSchema } from "@/lib/cms/schema";
import {
  buildPath,
  detectImageType,
  detectVideoType,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  readDimensions,
  safeFolder,
  svgIsSafe,
  VIDEO_MAX_BYTES,
  VIDEO_TYPES,
} from "./files";
import type { MediaItem } from "./types";

const BUCKET = "media";

const SELECT = "id, path, url, kind, mime_type, size_bytes, width, height, alt, folder, original_name, created_at";

type Row = {
  id: string;
  path: string;
  url: string;
  kind: "image" | "video";
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt: string;
  folder: string;
  original_name: string | null;
  created_at: string;
};

function toItem(row: Row): MediaItem {
  return {
    id: row.id,
    url: row.url,
    kind: row.kind,
    mimeType: row.mime_type,
    size: row.size_bytes,
    width: row.width,
    height: row.height,
    alt: row.alt,
    folder: row.folder,
    originalName: row.original_name,
    createdAt: row.created_at,
  };
}

async function audit(action: string, entityId: string, details: Record<string, unknown>) {
  const supabase = await createClient();
  await supabase.rpc("write_audit", { p_action: action, p_entity: "media", p_entity_id: entityId, p_details: details });
}

export async function listMedia(): Promise<ActionResult<MediaItem[]>> {
  try {
    await requireStaff();
    const supabase = await createClient();
    const { data, error } = await supabase.from("media").select(SELECT).order("created_at", { ascending: false }).limit(500);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    return { ok: true, data: (data as Row[]).map(toItem) };
  } catch (error) {
    return errorResult(error);
  }
}

/** Valida e envia uma imagem. Devolve o registo criado. */
async function storeImage(file: File, folder: string) {
  if (!(file instanceof File) || file.size === 0) throw new Error("Seleccione um ficheiro.");
  if (file.size > IMAGE_MAX_BYTES) throw new Error("A imagem excede 10 MB. Reduza o tamanho antes de a carregar.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageType(bytes);
  if (!mime) throw new Error("Formato não suportado. Use JPG, PNG, WebP ou SVG.");
  if (mime === "image/svg+xml" && !svgIsSafe(new TextDecoder().decode(bytes))) {
    throw new Error("Este SVG contém código ou referências externas e foi rejeitado por segurança.");
  }

  const { width, height } = readDimensions(bytes);
  const path = buildPath(folder, IMAGE_TYPES[mime]);
  const supabase = await createClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Falha no envio: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl, mime, size: file.size, width, height };
}

export async function uploadImage(formData: FormData): Promise<ActionResult<MediaItem>> {
  try {
    const user = await requireStaff();
    const file = formData.get("file") as File;
    const folder = safeFolder(formData.get("folder"));
    const alt = z.string().trim().max(250).parse(formData.get("alt") ?? "");
    const stored = await storeImage(file, folder);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("media")
      .insert({
        path: stored.path,
        url: stored.url,
        kind: "image",
        mime_type: stored.mime,
        size_bytes: stored.size,
        width: stored.width,
        height: stored.height,
        alt,
        folder,
        original_name: file.name.slice(0, 200),
        created_by: user.id,
      })
      .select(SELECT)
      .single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([stored.path]);
      return { ok: false, error: friendlyDbError(error.message) };
    }
    await audit("media.upload", data.id, { name: file.name, folder });
    refresh();
    return { ok: true, data: toItem(data as Row) };
  } catch (error) {
    return errorResult(error);
  }
}

const videoRequest = z.object({
  name: z.string().max(200),
  size: z.number().int().positive().max(VIDEO_MAX_BYTES, "O vídeo excede 50 MB. Comprima-o antes de o carregar."),
  type: z.enum(Object.keys(VIDEO_TYPES) as [keyof typeof VIDEO_TYPES], { message: "Use vídeos MP4 ou WebM." }),
  folder: z.string().max(60).optional(),
});

/** Os vídeos são enviados directamente do browser para o Storage através de um URL assinado. */
export async function createVideoUpload(input: unknown): Promise<ActionResult<{ path: string; token: string }>> {
  try {
    await requireStaff();
    const req = videoRequest.parse(input);
    const path = buildPath(safeFolder(req.folder ?? "videos"), VIDEO_TYPES[req.type]);
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return { ok: false, error: `Não foi possível preparar o envio: ${error.message}` };
    return { ok: true, data: { path, token: data.token } };
  } catch (error) {
    return errorResult(error);
  }
}

export async function finalizeVideoUpload(input: unknown): Promise<ActionResult<MediaItem>> {
  try {
    const user = await requireStaff();
    const req = videoRequest.extend({ path: z.string().max(300), alt: z.string().max(250).optional() }).parse(input);
    const supabase = await createClient();
    const { data: info, error: infoError } = await supabase.storage.from(BUCKET).info(req.path);
    if (infoError || !info) return { ok: false, error: "O ficheiro não foi encontrado no armazenamento." };

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(req.path);
    // Confirma o tipo real a partir dos primeiros bytes do ficheiro enviado.
    const head = await fetch(pub.publicUrl, { headers: { Range: "bytes=0-63" } });
    const bytes = new Uint8Array(await head.arrayBuffer());
    if (!detectVideoType(bytes)) {
      await supabase.storage.from(BUCKET).remove([req.path]);
      return { ok: false, error: "O ficheiro enviado não é um vídeo MP4/WebM válido." };
    }

    const { data, error } = await supabase
      .from("media")
      .insert({
        path: req.path,
        url: pub.publicUrl,
        kind: "video",
        mime_type: req.type,
        size_bytes: info.size ?? req.size,
        alt: req.alt ?? "",
        folder: safeFolder(req.folder ?? "videos"),
        original_name: req.name,
        created_by: user.id,
      })
      .select(SELECT)
      .single();
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    await audit("media.upload", data.id, { name: req.name, kind: "video" });
    refresh();
    return { ok: true, data: toItem(data as Row) };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateMediaDetails(id: string, input: unknown): Promise<ActionResult<null>> {
  try {
    await requireStaff();
    const values = z.object({ alt: z.string().trim().max(250), folder: z.string().max(60) }).parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("media")
      .update({ alt: values.alt, folder: safeFolder(values.folder), updated_at: new Date().toISOString() })
      .eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

/**
 * Substitui uma imagem: carrega o novo ficheiro, actualiza o registo e todas
 * as referências no rascunho. O ficheiro antigo é mantido para que o website
 * publicado e as versões anteriores continuem a funcionar até nova publicação.
 */
export async function replaceImage(id: string, formData: FormData): Promise<ActionResult<MediaItem>> {
  try {
    await requireStaff();
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase
      .from("media")
      .select(SELECT)
      .eq("id", z.string().uuid().parse(id))
      .single();
    if (readError || !current) return { ok: false, error: "Ficheiro não encontrado." };
    if (current.kind !== "image") return { ok: false, error: "Só é possível substituir imagens." };

    const file = formData.get("file") as File;
    const stored = await storeImage(file, current.folder);

    const { data, error } = await supabase
      .from("media")
      .update({
        path: stored.path,
        url: stored.url,
        mime_type: stored.mime,
        size_bytes: stored.size,
        width: stored.width,
        height: stored.height,
        original_name: file.name.slice(0, 200),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) return { ok: false, error: friendlyDbError(error.message) };

    // Actualiza as referências no rascunho.
    const draft = await getDraft();
    const json = JSON.stringify(draft.doc).split(JSON.stringify(current.url).slice(1, -1)).join(JSON.stringify(stored.url).slice(1, -1));
    if (json !== JSON.stringify(draft.doc)) {
      const next = sanitizeDocument(siteDocumentSchema.parse(JSON.parse(json)));
      const { error: saveError } = await supabase.rpc("save_draft", {
        p_content: next,
        p_expected_revision: draft.revision,
        p_summary: "Substituição de imagem",
      });
      if (saveError) return { ok: false, error: friendlyDbError(saveError.message) };
    }
    await audit("media.replace", id, { from: current.path, to: stored.path });
    refresh();
    return { ok: true, data: toItem(data as Row) };
  } catch (error) {
    return errorResult(error);
  }
}

/** Indica onde um ficheiro está a ser usado (rascunho e versão publicada). */
async function findUsage(url: string, id: string) {
  const supabase = await createClient();
  const draft = await getDraft();
  const { data: published } = await supabase.rpc("get_published_site");
  const inDraft = JSON.stringify(draft.doc).includes(url) || JSON.stringify(draft.doc).includes(id);
  const inPublished = published ? JSON.stringify(published).includes(url) || JSON.stringify(published).includes(id) : false;
  return { inDraft, inPublished };
}

export async function deleteMedia(id: string): Promise<ActionResult<null>> {
  try {
    await requireStaff();
    const supabase = await createClient();
    const { data: item } = await supabase.from("media").select(SELECT).eq("id", z.string().uuid().parse(id)).single();
    if (!item) return { ok: false, error: "Ficheiro não encontrado." };

    const usage = await findUsage(item.url, item.id);
    if (usage.inDraft || usage.inPublished) {
      const where = [usage.inDraft && "no rascunho", usage.inPublished && "no website publicado"].filter(Boolean).join(" e ");
      return {
        ok: false,
        error: `Este ficheiro está a ser usado ${where}. Substitua-o nas secções onde aparece e publique antes de o eliminar.`,
      };
    }

    const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.path]);
    if (storageError) return { ok: false, error: `Não foi possível remover o ficheiro: ${storageError.message}` };
    const { error } = await supabase.from("media").delete().eq("id", id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    await audit("media.delete", id, { path: item.path });
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}
