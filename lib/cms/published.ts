import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { siteDocumentSchema, type SiteDocument } from "./schema";
import { SEED_CONTENT } from "./seed-content";

export const PUBLISHED_TAG = "published-site";

/**
 * Conteúdo publicado do website. Fica em cache e é invalidado imediatamente
 * quando se publica no painel (updateTag). O cacheLife curto é uma rede de
 * segurança para ambientes com várias instâncias.
 */
export async function getPublishedSite(): Promise<{ doc: SiteDocument; source: "database" | "seed" }> {
  "use cache";
  cacheTag(PUBLISHED_TAG);
  // stale ≥ 5 min mantém a página no «static shell»; a publicação invalida de imediato.
  cacheLife({ stale: 300, revalidate: 60, expire: 86400 });

  if (!isSupabaseConfigured()) {
    return { doc: SEED_CONTENT, source: "seed" };
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_published_site");
  if (error) {
    throw new Error(`Não foi possível carregar o conteúdo publicado: ${error.message}`);
  }
  if (!data) {
    // Base de dados configurada mas ainda sem nenhuma publicação.
    return { doc: SEED_CONTENT, source: "seed" };
  }

  const parsed = siteDocumentSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("O conteúdo publicado não é válido. Restaure uma versão anterior no painel.");
  }
  return { doc: parsed.data, source: "database" };
}
