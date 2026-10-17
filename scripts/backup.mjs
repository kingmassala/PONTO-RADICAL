// Backup completo (só leitura) da base de dados Supabase e dos ficheiros do Storage.
//
// Uso:  node --env-file=.env.local scripts/backup.mjs --out="/caminho/para/a/pasta"
//
// Gera, dentro de --out:
//   database/restore-data.sql  dados de public, auth.users/identities e storage.buckets em INSERT
//                              (upsert por chave primária), para repor numa base com as migrações aplicadas
//   database/data.json         os mesmos dados em JSON (legível)
//   database/schema.json       colunas, políticas RLS, funções, triggers e buckets (para comparar/recriar)
//   storage/<bucket>/...       todos os ficheiros do Storage
//   manifest.json              contagens, tamanhos e SHA-256 de tudo
//
// Nada é alterado na base de dados: tudo corre numa transacção READ ONLY.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const outArg = process.argv.find((a) => a.startsWith("--out="));
if (!outArg) {
  console.error('Indique a pasta de destino: --out="/caminho/para/a/pasta"');
  process.exit(1);
}
const OUT = outArg.slice("--out=".length);
const { SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_DB_URL || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Faltam SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY em .env.local.");
  process.exit(1);
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const files = [];
function save(rel, content) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  writeFileSync(path, buf);
  files.push({ path: rel, bytes: buf.length, sha256: sha256(buf) });
}

// Todos os valores chegam como texto, tal como o Postgres os escreve (sem conversões de fuso/precisão).
const client = new pg.Client({
  connectionString: SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
  types: { getTypeParser: () => (value) => value },
});
await client.connect();

/** Tabelas a exportar, pela ordem de reposição (dependências primeiro). */
const TABLES = [
  ["auth", "users"],
  ["auth", "identities"],
  ["storage", "buckets"],
  ["public", "profiles"],
  ["public", "media"],
  ["public", "site_versions"],
  ["public", "site_state"],
  ["public", "site_draft"],
  ["public", "contact_messages"],
  ["public", "booking_requests"],
  ["public", "audit_log"],
];

const quoteIdent = (s) => `"${String(s).replace(/"/g, '""')}"`;
const literal = (v) => (v === null ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const data = {};
const schema = {};
const sql = [
  "-- Ponto Radical — dados para reposição (gerado por scripts/backup.mjs).",
  "-- Aplicar numa base com as migrações de supabase/migrations já aplicadas.",
  "-- Os triggers ficam desligados durante a carga para não duplicar perfis nem registos de auditoria.",
  "begin;",
  "set local session_replication_role = replica;",
  "",
];

try {
  await client.query("begin transaction isolation level repeatable read read only");

  // Garante que não há tabelas novas em public que não estejam na lista.
  const { rows: publicTables } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1",
  );
  const known = new Set(TABLES.filter(([s]) => s === "public").map(([, t]) => t));
  for (const { table_name } of publicTables) if (!known.has(table_name)) TABLES.push(["public", table_name]);

  for (const [schemaName, table] of TABLES) {
    const { rows: cols } = await client.query(
      `select column_name, data_type, udt_name, is_generated, is_identity, identity_generation
         from information_schema.columns where table_schema = $1 and table_name = $2 order by ordinal_position`,
      [schemaName, table],
    );
    if (cols.length === 0) continue;
    const { rows: pk } = await client.query(
      `select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
        where i.indrelid = $1::regclass and i.indisprimary`,
      [`${schemaName}.${table}`],
    );
    const insertable = cols.filter((c) => c.is_generated !== "ALWAYS");
    const names = insertable.map((c) => c.column_name);
    const { rows } = await client.query(`select ${names.map(quoteIdent).join(", ")} from ${schemaName}.${quoteIdent(table)}`);
    const key = `${schemaName}.${table}`;
    schema[key] = { columns: cols, primaryKey: pk.map((r) => r.attname) };

    const isJson = new Set(insertable.filter((c) => c.udt_name === "json" || c.udt_name === "jsonb").map((c) => c.column_name));
    data[key] = rows.map((r) => Object.fromEntries(names.map((n) => [n, isJson.has(n) && r[n] !== null ? JSON.parse(r[n]) : r[n]])));

    if (rows.length === 0) continue;
    const overriding = insertable.some((c) => c.identity_generation === "ALWAYS") ? " overriding system value" : "";
    const pkCols = pk.map((r) => r.attname);
    const updateCols = names.filter((n) => !pkCols.includes(n));
    const conflict =
      pkCols.length === 0
        ? ""
        : updateCols.length === 0
          ? ` on conflict (${pkCols.map(quoteIdent).join(", ")}) do nothing`
          : ` on conflict (${pkCols.map(quoteIdent).join(", ")}) do update set ${updateCols.map((n) => `${quoteIdent(n)} = excluded.${quoteIdent(n)}`).join(", ")}`;
    sql.push(`-- ${key}: ${rows.length} linha(s)`);
    for (const r of rows) {
      sql.push(
        `insert into ${schemaName}.${quoteIdent(table)} (${names.map(quoteIdent).join(", ")})${overriding} values (${names.map((n) => literal(r[n])).join(", ")})${conflict};`,
      );
    }
    // Acerta as sequências das colunas identity para continuarem depois do maior id.
    for (const c of insertable.filter((c) => c.is_identity === "YES")) {
      sql.push(
        `select setval(pg_get_serial_sequence('${schemaName}.${table}', '${c.column_name}'), greatest((select max(${quoteIdent(c.column_name)}) from ${schemaName}.${quoteIdent(table)}), 1));`,
      );
    }
    sql.push("");
  }

  // Metadados dos ficheiros do Storage (referência; os ficheiros são repostos pela API).
  const { rows: objects } = await client.query(
    "select bucket_id, name, metadata->>'mimetype' as mimetype, (metadata->>'size')::text as size, created_at from storage.objects order by bucket_id, name",
  );
  data["storage.objects"] = objects;

  // Estrutura para comparação/recriação.
  schema.policies = (await client.query("select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname in ('public','storage') order by 1,2,3")).rows;
  schema.functions = (
    await client.query(
      "select p.proname as name, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1",
    )
  ).rows;
  schema.triggers = (
    await client.query(
      "select c.relname as table, t.tgname as name, pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ('public','auth') order by 1,2",
    )
  ).rows;
  schema.types = (
    await client.query(
      "select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' group by 1",
    )
  ).rows;
  schema.serverVersion = (await client.query("show server_version")).rows[0].server_version;

  await client.query("commit");
} finally {
  await client.end();
}

sql.push("commit;", "");
save("database/restore-data.sql", sql.join("\n"));
save("database/data.json", JSON.stringify(data, null, 1));
save("database/schema.json", JSON.stringify(schema, null, 1));

// Ficheiros do Storage.
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
let storageBytes = 0;
for (const obj of data["storage.objects"]) {
  const { data: blob, error } = await supabase.storage.from(obj.bucket_id).download(obj.name);
  if (error) throw new Error(`Falha ao descarregar ${obj.bucket_id}/${obj.name}: ${error.message}`);
  const buf = Buffer.from(await blob.arrayBuffer());
  storageBytes += buf.length;
  save(`storage/${obj.bucket_id}/${obj.name}`, buf);
}

const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
const manifest = {
  project: "Ponto Radical",
  createdAt: new Date().toISOString(),
  supabaseUrl: NEXT_PUBLIC_SUPABASE_URL,
  serverVersion: schema.serverVersion,
  counts,
  storage: { files: data["storage.objects"].length, bytes: storageBytes },
  files,
};
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({ out: OUT, counts, storage: manifest.storage }, null, 1));
