// Verifica um backup feito com scripts/backup.mjs SEM tocar em nenhuma base de dados real:
// cria um Postgres em memória (PGlite), aplica as migrações, carrega restore-data.sql e
// compara as contagens com o manifest; confirma também o SHA-256 de todos os ficheiros.
//
// Uso:  node scripts/verify-backup.mjs --dir="/caminho/para/o/backup"
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const dirArg = process.argv.find((a) => a.startsWith("--dir="));
if (!dirArg) {
  console.error('Indique a pasta do backup: --dir="/caminho/para/o/backup"');
  process.exit(1);
}
const DIR = dirArg.slice("--dir=".length);
const manifest = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(DIR, "database/schema.json"), "utf8"));
let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};

// 1. Integridade dos ficheiros.
for (const f of manifest.files) {
  const hash = createHash("sha256").update(readFileSync(join(DIR, f.path))).digest("hex");
  if (hash !== f.sha256) fail(`SHA-256 diferente: ${f.path}`);
}
console.log(`✓ ${manifest.files.length} ficheiros verificados (SHA-256)`);

// 2. Ambiente mínimo do Supabase, com as tabelas auth/storage tal como estão no backup.
const pgType = (c) => (c.data_type === "USER-DEFINED" || c.data_type === "ARRAY" ? "text" : c.data_type);
const stubTable = (key) =>
  `create table ${key} (${schema[key].columns
    .filter((c) => c.is_generated !== "ALWAYS")
    .map((c) => `"${c.column_name}" ${pgType(c)}`)
    .join(", ")}, primary key (${schema[key].primaryKey.map((k) => `"${k}"`).join(", ")}));`;

const db = new PGlite();
await db.exec(`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema storage;
${stubTable("auth.users")}
${schema["auth.identities"] ? stubTable("auth.identities") : ""}
${stubTable("storage.buckets")}
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
`);
const migrations = new URL("../supabase/migrations/", import.meta.url);
for (const file of readdirSync(migrations).sort()) await db.exec(readFileSync(new URL(file, migrations), "utf8"));
console.log("✓ migrações aplicadas numa base vazia (em memória)");

// 3. Reposição e comparação.
await db.exec(readFileSync(join(DIR, "database/restore-data.sql"), "utf8"));
for (const [key, expected] of Object.entries(manifest.counts)) {
  if (key === "storage.objects") continue; // repostos pela API do Storage, não por SQL
  const { rows } = await db.query(`select count(*)::int as n from ${key}`);
  if (rows[0].n !== expected) fail(`${key}: ${rows[0].n} linha(s) repostas, esperadas ${expected}`);
  else console.log(`  ✓ ${key}: ${expected}`);
}
const { rows: draft } = await db.query("select revision, jsonb_array_length(content->'brands') as brands from public.site_draft where id = 1");
console.log(`✓ rascunho reposto: revisão ${draft[0]?.revision}, ${draft[0]?.brands} marcas`);

if (failures) {
  console.error(`\n${failures} problema(s) encontrados.`);
  process.exit(1);
}
console.log("\nBackup válido: os dados repõem-se sem erros e os ficheiros estão íntegros.");
