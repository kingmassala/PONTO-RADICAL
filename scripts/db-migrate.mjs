// Aplica as migrações (supabase/migrations) e o conteúdo inicial (supabase/seed.sql)
// na base de dados indicada em SUPABASE_DB_URL. Seguro para executar mais de uma vez.
// Uso: npm run db:migrate
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Defina SUPABASE_DB_URL em .env.local (Supabase → Connect → Session pooler).");
  process.exit(1);
}

const dir = new URL("../supabase/", import.meta.url);
const files = [
  ...readdirSync(new URL("migrations/", dir)).sort().map((f) => `migrations/${f}`),
  "seed.sql",
];

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  for (const file of files) {
    await client.query(readFileSync(new URL(file, dir), "utf8"));
    console.log(`✓ ${file}`);
  }
  await client.query("commit");
  const { rows } = await client.query(
    "select (select count(*) from public.site_versions)::int as versions, (select revision from public.site_draft where id = 1) as revision",
  );
  console.log(`Base de dados pronta: ${rows[0].versions} versão(ões) publicada(s), rascunho na revisão ${rows[0].revision}.`);
} catch (error) {
  await client.query("rollback");
  console.error("Erro — nenhuma alteração foi aplicada:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
