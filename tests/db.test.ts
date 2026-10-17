/**
 * Testes da base de dados (migração, RLS e funções de publicação) num Postgres
 * embutido (PGlite), com uma simulação mínima do ambiente Supabase
 * (papéis anon/authenticated, auth.uid(), auth.users e storage).
 *
 * Executar: npm run test:db
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("../supabase/", import.meta.url);

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
grant usage on schema storage to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated;
`;

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const EDITOR = "00000000-0000-0000-0000-00000000000e";
const NOBODY = "00000000-0000-0000-0000-00000000000f";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

async function main() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(new URL("migrations/", root)).sort()) {
    await db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  }
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
  // Segunda execução do seed não deve duplicar nada.
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));

  await db.exec(`
    insert into auth.users (id, email) values
      ('${ADMIN}', 'admin@example.com'), ('${EDITOR}', 'editor@example.com'), ('${NOBODY}', 'semacesso@example.com');
    update public.profiles set role = 'admin' where id = '${ADMIN}';
    update public.profiles set role = 'editor' where id = '${EDITOR}';
  `);

  /** Executa SQL como um papel/utilizador, tal como o PostgREST faz. */
  async function as<T = Record<string, unknown>>(who: "anon" | string, sql: string, params: unknown[] = []) {
    const role = who === "anon" ? "anon" : "authenticated";
    const sub = who === "anon" ? "" : who;
    return db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}; select set_config('request.jwt.claim.sub', '${sub}', true);`);
      return (await tx.query<T>(sql, params)).rows;
    });
  }
  async function rejects(promise: Promise<unknown>, pattern: RegExp) {
    await assert.rejects(promise, (e: Error) => pattern.test(e.message));
  }

  console.log("Base de dados");

  await test("seed cria rascunho e versão publicada (idempotente)", async () => {
    const v = await db.query<{ n: number }>("select count(*)::int as n from public.site_versions");
    assert.equal(v.rows[0].n, 1);
    const d = await db.query<{ revision: number }>("select revision from public.site_draft");
    assert.equal(d.rows[0].revision, 1);
  });

  await test("trigger cria perfil sem acesso para novos utilizadores", async () => {
    const r = await db.query<{ role: string | null }>(`select role from public.profiles where id = '${NOBODY}'`);
    assert.equal(r.rows[0].role, null);
  });

  await test("visitante anónimo lê apenas o conteúdo publicado", async () => {
    const [row] = await as<{ c: { settings: { siteName: string }; store: { enabled: boolean; url: null } } }>(
      "anon",
      "select public.get_published_site() as c",
    );
    assert.equal(row.c.settings.siteName, "Ponto Radical");
    assert.equal(row.c.store.enabled, false, "loja desactivada por omissão");
    assert.equal(row.c.store.url, null, "sem URL da loja por omissão");
    assert.equal((await as("anon", "select * from public.site_draft")).length, 0);
    assert.equal((await as("anon", "select * from public.site_versions")).length, 0);
    assert.equal((await as("anon", "select * from public.profiles")).length, 0);
  });

  await test("visitante anónimo não consegue escrever conteúdo nem mensagens", async () => {
    await rejects(as("anon", "select public.save_draft('{}'::jsonb, 1)"), /permission denied/);
    await rejects(as("anon", "select public.publish_site(1)"), /permission denied/);
    await rejects(
      as("anon", "insert into public.contact_messages (name,email,subject,message) values ('Ana','a@b.co','Olá','Mensagem de teste')"),
      /row-level security/,
    );
    // Sem política de escrita, o UPDATE directo não afecta nenhuma linha.
    await as("anon", "update public.site_draft set revision = 99");
    await as(EDITOR, "update public.site_draft set revision = 99");
    const d = await db.query<{ revision: number }>("select revision from public.site_draft");
    assert.equal(d.rows[0].revision, 1);
  });

  await test("utilizador autenticado sem papel não tem acesso", async () => {
    assert.equal((await as(NOBODY, "select * from public.site_draft")).length, 0);
    await rejects(as(NOBODY, "select public.save_draft('{}'::jsonb, 1)"), /not_authorized/);
    await rejects(as(NOBODY, "select public.publish_site(1)"), /not_authorized/);
    await rejects(as(NOBODY, `update public.profiles set role = 'admin' where id = '${NOBODY}'`), /not_authorized/);
  });

  await test("editor guarda rascunho com controlo de revisão", async () => {
    const [draft] = await as<{ content: Record<string, unknown> }>(EDITOR, "select content from public.site_draft");
    const changed = { ...draft.content, settings: { siteName: "Ponto Radical (rascunho)", language: "pt-PT" } };
    await rejects(as(EDITOR, "select public.save_draft($1::jsonb, 999)", [JSON.stringify(changed)]), /revision_conflict/);
    const [saved] = await as<{ r: number }>(EDITOR, "select public.save_draft($1::jsonb, 1, 'teste') as r", [JSON.stringify(changed)]);
    assert.equal(saved.r, 2);
  });

  await test("rascunho não é visível publicamente antes de publicar", async () => {
    const [row] = await as<{ c: { settings: { siteName: string } } }>("anon", "select public.get_published_site() as c");
    assert.equal(row.c.settings.siteName, "Ponto Radical");
  });

  await test("publicar torna o rascunho público e cria histórico", async () => {
    await rejects(as(EDITOR, "select public.publish_site(1)"), /revision_conflict/);
    const [pub] = await as<{ id: number }>(EDITOR, "select public.publish_site(2, 'Primeira alteração') as id");
    assert.equal(pub.id, 2);
    const [row] = await as<{ c: { settings: { siteName: string } } }>("anon", "select public.get_published_site() as c");
    assert.equal(row.c.settings.siteName, "Ponto Radical (rascunho)");
    const versions = await as(EDITOR, "select id from public.site_versions");
    assert.equal(versions.length, 2);
  });

  await test("restaurar versão anterior copia-a para o rascunho", async () => {
    const [r] = await as<{ r: number }>(EDITOR, "select public.restore_version_to_draft(1) as r");
    assert.equal(r.r, 3);
    const [draft] = await as<{ n: string }>(EDITOR, "select content->'settings'->>'siteName' as n from public.site_draft");
    assert.equal(draft.n, "Ponto Radical");
    // O website público mantém-se até nova publicação.
    const [row] = await as<{ c: { settings: { siteName: string } } }>("anon", "select public.get_published_site() as c");
    assert.equal(row.c.settings.siteName, "Ponto Radical (rascunho)");
    await as(EDITOR, "select public.publish_site(3, 'Reposição')");
    const [after] = await as<{ c: { settings: { siteName: string } } }>("anon", "select public.get_published_site() as c");
    assert.equal(after.c.settings.siteName, "Ponto Radical");
  });

  await test("editor não pode alterar papéis nem ler auditoria", async () => {
    await rejects(as(EDITOR, `select public.set_user_role('${NOBODY}', 'admin')`), /not_authorized/);
    await rejects(as(EDITOR, `update public.profiles set role = 'admin' where id = '${EDITOR}'`), /not_authorized/);
    assert.equal((await as(EDITOR, "select * from public.audit_log")).length, 0);
  });

  await test("editor pode alterar o próprio nome", async () => {
    await as(EDITOR, `update public.profiles set full_name = 'Editora' where id = '${EDITOR}'`);
    const r = await db.query<{ full_name: string }>(`select full_name from public.profiles where id = '${EDITOR}'`);
    assert.equal(r.rows[0].full_name, "Editora");
  });

  await test("administrador gere papéis com salvaguardas", async () => {
    await as(ADMIN, `select public.set_user_role('${NOBODY}', 'editor')`);
    await rejects(as(ADMIN, `select public.set_user_role('${ADMIN}', 'editor')`), /cannot_demote_self/);
    await as(ADMIN, `select public.set_user_role('${NOBODY}', null)`);
    const r = await db.query<{ role: string | null }>(`select role from public.profiles where id = '${NOBODY}'`);
    assert.equal(r.rows[0].role, null);
  });

  await test("auditoria regista operações e só o administrador a lê", async () => {
    const rows = await as<{ action: string }>(ADMIN, "select action from public.audit_log order by id");
    const actions = rows.map((r) => r.action);
    for (const a of ["draft.save", "site.publish", "draft.restore", "user.role"]) assert.ok(actions.includes(a), a);
  });

  await test("mensagens de contacto: inserção só pelo servidor, leitura pela equipa", async () => {
    await db.exec("insert into public.contact_messages (name,email,subject,message) values ('Ana','ana@example.com','Orçamento','Gostaria de um orçamento.')");
    assert.equal((await as(EDITOR, "select * from public.contact_messages")).length, 1);
    assert.equal((await as(NOBODY, "select * from public.contact_messages")).length, 0);
    await as(EDITOR, "update public.contact_messages set status = 'em_curso'");
    // Editor não elimina (apenas administrador).
    await as(EDITOR, "delete from public.contact_messages");
    assert.equal((await db.query("select * from public.contact_messages")).rows.length, 1);
    await as(ADMIN, "delete from public.contact_messages");
    assert.equal((await db.query("select * from public.contact_messages")).rows.length, 0);
  });

  const BOOKING = `insert into public.booking_requests
    (service_id, service_name, service_snapshot, requested_date, time_slot, people, name, email, phone, notes)
    values ('srv-por-do-sol', 'Passeio ao pôr-do-sol', '{"priceFrom":35000}', '2026-10-24', '17:00', 4, 'Ana Silva', 'ana@example.com', '+244 923 000 000', 'Aniversário')
    returning id, reference`;

  await test("reservas: visitante anónimo não insere nem lê pedidos", async () => {
    await rejects(as("anon", BOOKING), /row-level security/);
    assert.equal((await as("anon", "select * from public.booking_requests")).length, 0);
  });

  await test("reservas: o servidor insere; referência gerada e auditoria do novo pedido", async () => {
    const { rows } = await db.query<{ id: string; reference: string }>(BOOKING);
    assert.match(rows[0].reference, /^[0-9A-F]{8}$/);
    const audit = await db.query<{ action: string; actor_email: string }>(
      "select action, actor_email from public.audit_log where entity = 'booking_requests' and entity_id = $1",
      [rows[0].id],
    );
    assert.deepEqual(audit.rows, [{ action: "booking.create", actor_email: "website" }]);
    await rejects(
      db.query(BOOKING.replace("4, 'Ana Silva'", "0, 'Ana Silva'")),
      /check constraint/,
    );
    await rejects(db.query("update public.booking_requests set status = 'pendente'"), /check constraint/);
  });

  await test("reservas: só a equipa lê; utilizador sem papel não vê nada", async () => {
    assert.equal((await as(EDITOR, "select * from public.booking_requests")).length, 1);
    assert.equal((await as(NOBODY, "select * from public.booking_requests")).length, 0);
    await as(NOBODY, "update public.booking_requests set status = 'confirmado'");
    const r = await db.query<{ status: string }>("select status from public.booking_requests");
    assert.equal(r.rows[0].status, "novo");
  });

  await test("reservas: editor muda o estado (com auditoria) mas não altera os dados do cliente", async () => {
    await as(EDITOR, "update public.booking_requests set status = 'proposta', proposed_date = '2026-10-25', internal_notes = 'Barco ocupado no dia 24'");
    const [row] = (
      await db.query<{ status: string; handled_by: string; proposed_date: string }>(
        "select status, handled_by, proposed_date::text from public.booking_requests",
      )
    ).rows;
    assert.equal(row.status, "proposta");
    assert.equal(row.handled_by, EDITOR);
    assert.equal(row.proposed_date, "2026-10-25");
    const audit = await as<{ details: { from: string; to: string }; actor_email: string }>(
      ADMIN,
      "select details, actor_email from public.audit_log where action = 'booking.status'",
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0].details.from, "novo");
    assert.equal(audit[0].details.to, "proposta");
    assert.equal(audit[0].actor_email, "editor@example.com");
    await rejects(as(EDITOR, "update public.booking_requests set name = 'Outra pessoa'"), /not_authorized/);
    await rejects(as(EDITOR, "update public.booking_requests set people = 40"), /not_authorized/);
    await rejects(as(EDITOR, "update public.booking_requests set service_snapshot = '{}'"), /not_authorized/);
  });

  await test("reservas: pagamento registado com data (preparado para pagamentos futuros)", async () => {
    await as(EDITOR, "update public.booking_requests set status = 'confirmado', quoted_amount = 140000, payment_status = 'pago'");
    const paid = await db.query<{ paid_at: string | null; currency: string }>("select paid_at, currency from public.booking_requests");
    assert.ok(paid.rows[0].paid_at);
    assert.equal(paid.rows[0].currency, "AOA");
    await as(EDITOR, "update public.booking_requests set payment_status = 'pendente'");
    const unpaid = await db.query<{ paid_at: string | null }>("select paid_at from public.booking_requests");
    assert.equal(unpaid.rows[0].paid_at, null);
  });

  await test("reservas: só o administrador elimina (com auditoria)", async () => {
    await as(EDITOR, "delete from public.booking_requests");
    assert.equal((await db.query("select * from public.booking_requests")).rows.length, 1);
    await as(ADMIN, "delete from public.booking_requests");
    assert.equal((await db.query("select * from public.booking_requests")).rows.length, 0);
    const audit = await as(ADMIN, "select * from public.audit_log where action = 'booking.delete'");
    assert.equal(audit.length, 1);
  });

  await test("storage: só a equipa carrega ficheiros no bucket media", async () => {
    const [bucket] = (await db.query<{ public: boolean; allowed_mime_types: string[] }>("select * from storage.buckets where id = 'media'")).rows;
    assert.equal(bucket.public, true);
    assert.ok(bucket.allowed_mime_types.includes("image/webp"));
    assert.ok(!bucket.allowed_mime_types.includes("text/html"));
    await as(EDITOR, "insert into storage.objects (bucket_id, name) values ('media', 'geral/a.jpg')");
    await rejects(as("anon", "insert into storage.objects (bucket_id, name) values ('media', 'geral/b.jpg')"), /row-level security/);
    await rejects(as(NOBODY, "insert into storage.objects (bucket_id, name) values ('media', 'geral/c.jpg')"), /row-level security/);
    await rejects(as(EDITOR, "insert into storage.objects (bucket_id, name) values ('outro', 'x.jpg')"), /row-level security/);
  });

  await test("media: registos visíveis apenas para a equipa", async () => {
    await as(EDITOR, `insert into public.media (path,url,kind,mime_type,size_bytes,created_by) values ('geral/a.jpg','https://x/a.jpg','image','image/jpeg',10,'${EDITOR}')`);
    assert.equal((await as(EDITOR, "select * from public.media")).length, 1);
    assert.equal((await as("anon", "select * from public.media")).length, 0);
    assert.equal((await as(NOBODY, "select * from public.media")).length, 0);
  });

  await test("blog: a equipa escreve; o website só vê artigos publicados", async () => {
    await as(EDITOR, "insert into public.blog_posts (slug, title, category) values ('rascunho-a', 'Rascunho', 'produtos')");
    await as(EDITOR, "insert into public.blog_posts (slug, title, status) values ('publicado-b', 'Publicado', 'publicado')");
    await as(EDITOR, "insert into public.blog_posts (slug, title, status, published_at) values ('futuro-c', 'Futuro', 'publicado', now() + interval '2 days')");
    const pub = await as<{ slug: string; published_at: string | null; created_by: string }>("anon", "select slug, published_at, created_by from public.blog_posts order by slug");
    assert.deepEqual(pub.map((p) => p.slug), ["publicado-b"]);
    assert.ok(pub[0].published_at, "data de publicação preenchida automaticamente");
    assert.equal((await as(EDITOR, "select * from public.blog_posts")).length, 3);
    assert.equal((await as(NOBODY, "select * from public.blog_posts")).length, 1);
    await rejects(as("anon", "insert into public.blog_posts (slug, title) values ('x', 'X')"), /row-level security|permission denied/);
    await rejects(as(NOBODY, "insert into public.blog_posts (slug, title) values ('y', 'Y')"), /row-level security/);
    await rejects(as(EDITOR, "insert into public.blog_posts (slug, title) values ('Mau Endereço', 'Z')"), /check constraint/);
  });

  await test("blog: publicar e eliminar ficam na auditoria", async () => {
    await as(EDITOR, "update public.blog_posts set status = 'publicado' where slug = 'rascunho-a'");
    assert.equal((await as("anon", "select * from public.blog_posts")).length, 2);
    await as(EDITOR, "delete from public.blog_posts where slug = 'futuro-c'");
    const audit = await as<{ action: string }>(ADMIN, "select action from public.audit_log where entity = 'blog_posts' order by id");
    assert.deepEqual(audit.map((a) => a.action), ["blog.create", "blog.create", "blog.create", "blog.status", "blog.delete"]);
  });

  console.log(`\n${passed} testes passaram.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
