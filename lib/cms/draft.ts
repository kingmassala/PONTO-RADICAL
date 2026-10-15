import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { siteDocumentSchema, type SiteDocument } from "./schema";

export type DraftState = {
  doc: SiteDocument;
  revision: number;
  updatedAt: string;
};

export type PublishedState = {
  versionId: number;
  doc: SiteDocument;
  publishedAt: string;
} | null;

/** Lê o rascunho (requer sessão de equipa; RLS garante o acesso). */
export const getDraft = cache(async (): Promise<DraftState> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_draft")
    .select("content, revision, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível ler o rascunho: ${error.message}`);
  if (!data) throw new Error("O rascunho não existe. Execute o seed inicial (ver docs/INSTALACAO.md).");
  return {
    doc: siteDocumentSchema.parse(data.content),
    revision: data.revision,
    updatedAt: data.updated_at,
  };
});

export const getPublishedState = cache(async (): Promise<PublishedState> => {
  const supabase = await createClient();
  const { data: state } = await supabase
    .from("site_state")
    .select("published_version_id")
    .eq("id", 1)
    .maybeSingle();
  if (!state?.published_version_id) return null;
  const { data } = await supabase
    .from("site_versions")
    .select("id, content, published_at")
    .eq("id", state.published_version_id)
    .maybeSingle();
  if (!data) return null;
  return { versionId: data.id, doc: siteDocumentSchema.parse(data.content), publishedAt: data.published_at };
});

/** Serialização estável para comparar documentos. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function documentsEqual(a: SiteDocument, b: SiteDocument): boolean {
  return stableStringify(a) === stableStringify(b);
}
