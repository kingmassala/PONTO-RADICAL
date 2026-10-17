"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorResult, friendlyDbError, type ActionResult } from "@/lib/cms/errors";
import { sanitizeRichText, stripHtml } from "@/lib/cms/sanitize";
import { TRANSLATED_LOCALES } from "@/lib/i18n/config";
import { BLOG_TAG } from "./queries";
import { blogPostInputSchema, rowFromInput, slugify, type BlogPostInput } from "./schema";

const idSchema = z.string().uuid();

function dbError(message: string | undefined): string {
  if (message?.includes("blog_posts_slug_key") || message?.includes("duplicate key")) {
    return "Já existe um artigo com este endereço. Escolha outro.";
  }
  return friendlyDbError(message);
}

/** Limpa o HTML do texto (e das traduções) e remove HTML dos campos simples. */
function clean(input: BlogPostInput): BlogPostInput {
  const translations = structuredClone(input.translations);
  for (const l of TRANSLATED_LOCALES) {
    translations[l].title = stripHtml(translations[l].title);
    translations[l].excerpt = stripHtml(translations[l].excerpt);
    translations[l].body = sanitizeRichText(translations[l].body);
  }
  return {
    ...input,
    title: stripHtml(input.title),
    excerpt: stripHtml(input.excerpt),
    authorName: stripHtml(input.authorName),
    body: sanitizeRichText(input.body),
    translations,
  };
}

/** Cria um artigo em rascunho a partir do título e devolve o id (para abrir o editor). */
export async function createPost(title: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireStaff();
    const name = stripHtml(String(title ?? "")).trim().slice(0, 200);
    if (!name) return { ok: false, error: "Indique o título do artigo." };
    const supabase = await createClient();
    const base = slugify(name) || "artigo";
    // Garante um endereço único acrescentando -2, -3… se for preciso.
    const { data: taken } = await supabase.from("blog_posts").select("slug").like("slug", `${base}%`);
    const used = new Set((taken ?? []).map((r) => r.slug as string));
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({ title: name, slug, category: "noticias", status: "rascunho" })
      .select("id")
      .single();
    if (error) return { ok: false, error: dbError(error.message) };
    refresh();
    return { ok: true, data: { id: data.id as string } };
  } catch (error) {
    return errorResult(error);
  }
}

/** Grava o artigo (não muda o estado: um artigo publicado continua publicado, com as alterações). */
export async function savePost(id: string, value: unknown): Promise<ActionResult<null>> {
  try {
    await requireStaff();
    const input = clean(blogPostInputSchema.parse(value));
    const supabase = await createClient();
    const { error } = await supabase.from("blog_posts").update(rowFromInput(input)).eq("id", idSchema.parse(id));
    if (error) return { ok: false, error: dbError(error.message) };
    updateTag(BLOG_TAG);
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

/** Publica ou passa a rascunho (retira do website). */
export async function setPostStatus(id: string, status: "rascunho" | "publicado"): Promise<ActionResult<null>> {
  try {
    await requireStaff();
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase.from("blog_posts").select("title").eq("id", idSchema.parse(id)).single();
    if (readError) return { ok: false, error: dbError(readError.message) };
    if (status === "publicado" && !(current.title as string)?.trim()) return { ok: false, error: "O artigo precisa de um título." };
    const { error } = await supabase
      .from("blog_posts")
      .update({ status: z.enum(["rascunho", "publicado"]).parse(status) })
      .eq("id", id);
    if (error) return { ok: false, error: dbError(error.message) };
    updateTag(BLOG_TAG);
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deletePost(id: string): Promise<ActionResult<null>> {
  try {
    await requireStaff();
    const supabase = await createClient();
    const { error } = await supabase.from("blog_posts").delete().eq("id", idSchema.parse(id));
    if (error) return { ok: false, error: dbError(error.message) };
    updateTag(BLOG_TAG);
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}
