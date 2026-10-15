// Gera supabase/seed.sql a partir de lib/cms/seed-content.ts (fonte única do conteúdo inicial).
import { writeFileSync } from "node:fs";
import { siteDocumentSchema } from "../lib/cms/schema";
import { SEED_CONTENT } from "../lib/cms/seed-content";

const doc = siteDocumentSchema.parse(SEED_CONTENT);
const json = JSON.stringify(doc).replace(/'/g, "''");

const sql = `-- Conteúdo inicial do website Ponto Radical.
-- Gerado por: npm run db:seed-sql (não editar à mão).
-- Seguro para executar mais de uma vez: só insere se ainda não existir conteúdo.

do $$
declare
  v_version_id bigint;
begin
  if not exists (select 1 from public.site_draft where id = 1) then
    insert into public.site_draft (id, content, revision) values (1, '${json}'::jsonb, 1);
  end if;

  if not exists (select 1 from public.site_state where id = 1 and published_version_id is not null) then
    insert into public.site_versions (content, note, published_by_email)
    values ((select content from public.site_draft where id = 1), 'Conteúdo inicial', 'sistema')
    returning id into v_version_id;

    insert into public.site_state (id, published_version_id) values (1, v_version_id)
    on conflict (id) do update set published_version_id = excluded.published_version_id;
  end if;
end $$;
`;
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log("supabase/seed.sql gerado.");
