// Insere o conteúdo inicial na base de dados (apenas se ainda não existir).
// Uso: npm run db:seed
import { createClient } from "@supabase/supabase-js";
import { siteDocumentSchema } from "../lib/cms/schema";
import { SEED_CONTENT } from "../lib/cms/seed-content";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local.");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const content = siteDocumentSchema.parse(SEED_CONTENT);

  const { data: draft } = await supabase.from("site_draft").select("id").eq("id", 1).maybeSingle();
  if (draft) {
    console.log("O rascunho já existe — nada a fazer.");
  } else {
    const { error } = await supabase.from("site_draft").insert({ id: 1, content, revision: 1 });
    if (error) throw error;
    console.log("✓ Rascunho criado.");
  }

  const { data: state } = await supabase.from("site_state").select("published_version_id").eq("id", 1).maybeSingle();
  if (state?.published_version_id) {
    console.log("Já existe uma versão publicada — nada a fazer.");
    return;
  }
  const { data: version, error: vError } = await supabase
    .from("site_versions")
    .insert({ content, note: "Conteúdo inicial", published_by_email: "sistema" })
    .select("id")
    .single();
  if (vError) throw vError;
  const { error: sError } = await supabase.from("site_state").upsert({ id: 1, published_version_id: version.id });
  if (sError) throw sError;
  console.log(`✓ Versão inicial publicada (n.º ${version.id}).`);
}

main().catch((e) => {
  console.error("Erro:", e.message ?? e);
  process.exit(1);
});
