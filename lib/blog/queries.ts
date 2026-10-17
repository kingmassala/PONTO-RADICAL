import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { postFromRow, type BlogPost } from "./schema";

/** Etiqueta da cache dos artigos publicados (invalidada pelas acções do painel). */
export const BLOG_TAG = "blog-posts";

/**
 * Artigos publicados, do mais recente para o mais antigo. Ficam em cache e são
 * invalidados de imediato quando um artigo é gravado ou publicado no painel;
 * o revalidate curto faz aparecer os artigos agendados para uma data futura.
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  "use cache";
  cacheTag(BLOG_TAG);
  cacheLife({ stale: 300, revalidate: 60, expire: 86400 });

  if (!isSupabaseConfigured()) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "publicado")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(300);
  if (error) {
    // Sem a tabela (migração ainda não aplicada) o website continua a funcionar, só sem artigos.
    console.error(`Blog: não foi possível ler os artigos: ${error.message}`);
    return [];
  }
  return (data ?? []).flatMap((row) => {
    try {
      return [postFromRow(row)];
    } catch {
      return [];
    }
  });
}

export async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  return (await getPublishedPosts()).find((p) => p.slug === slug) ?? null;
}

/* ------------------------------- Painel ------------------------------- */

/** Todos os artigos (rascunhos incluídos), para o painel. Requer sessão de equipa (RLS). */
export async function getAllPostsForPanel(): Promise<BlogPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`Não foi possível ler os artigos: ${error.message}`);
  return (data ?? []).map(postFromRow);
}

export async function getPostForPanel(id: string): Promise<BlogPost | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Não foi possível ler o artigo: ${error.message}`);
  return data ? postFromRow(data) : null;
}
