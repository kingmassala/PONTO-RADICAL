/**
 * Tarefas (registo, controlo, alertas) e saídas de material para a Promarine:
 * migrações, RLS, numeração, bloqueio das guias e regras partilhadas. PGlite, sem rede.
 *
 * Executar: npm run test:admin-db
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { dueState, isoToLuandaLocal, luandaLocalToIso, normalizePhone, taskAlertText, waMeHref } from "../lib/tasks/rules";
import { deliveryInputSchema, knownRecipients, summarizeItems } from "../lib/deliveries/rules";

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
const YEAR = new Date().getUTCFullYear();

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
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
  console.log("Tarefas e saídas de material");

  await test("telemóveis normalizados para +244 e inválidos recusados", () => {
    assert.equal(normalizePhone("923 456 789"), "+244923456789");
    assert.equal(normalizePhone("00244 923456789"), "+244923456789");
    assert.equal(normalizePhone("244923456789"), "+244923456789");
    assert.equal(normalizePhone("+351 912 345 678"), "+351912345678");
    assert.equal(normalizePhone("12345"), null);
    assert.equal(normalizePhone(""), null);
  });

  await test("prazo em hora de Luanda (UTC+1) ida e volta", () => {
    const iso = luandaLocalToIso("2026-11-12T15:30");
    assert.equal(iso, "2026-11-12T14:30:00.000Z");
    assert.equal(isoToLuandaLocal(iso), "2026-11-12T15:30");
    assert.equal(luandaLocalToIso("ontem"), null);
  });

  await test("situação do prazo: atrasada, a vencer, no prazo, fechada", () => {
    const now = new Date("2026-11-10T10:00:00Z");
    const t = (due: string | null, status = "pendente" as const, remind = 24) => ({ status, due_at: due, remind_before_hours: remind });
    assert.equal(dueState(t("2026-11-10T09:00:00Z"), now), "atrasada");
    assert.equal(dueState(t("2026-11-11T09:00:00Z"), now), "a_vencer");
    assert.equal(dueState(t("2026-11-15T09:00:00Z"), now), "no_prazo");
    assert.equal(dueState(t(null), now), "sem_prazo");
    assert.equal(dueState({ status: "concluida", due_at: "2026-11-01T00:00:00Z", remind_before_hours: 24 }, now), "fechada");
  });

  await test("texto do alerta igual ao modelo e link wa.me", () => {
    const task = { code: "TR-2026-0001", title: "Contar stock de tintas", responsible_name: "Ana", due_at: "2026-11-12T14:30:00Z", priority: "alta" as const };
    const text = taskAlertText(task, "atraso", "https://x/admin/tarefas?t=TR-2026-0001");
    assert.ok(text.startsWith("PONTO RADICAL | Tarefas\nTAREFA EM ATRASO\nTarefa: TR-2026-0001 — Contar stock de tintas\nResponsável: Ana"));
    assert.ok(text.includes("Prioridade: Alta"));
    assert.ok(waMeHref("923456789", text)?.startsWith("https://wa.me/244923456789?text=PONTO%20RADICAL"));
    assert.equal(waMeHref(null, text), null);
  });

  await test("guia: validação dos materiais e total por material sem as anuladas", () => {
    assert.throws(() => deliveryInputSchema.parse({ header: { delivery_date: "2026-11-07", delivered_by: "Rui" }, items: [] }));
    assert.throws(() =>
      deliveryInputSchema.parse({ header: { delivery_date: "2026-11-07", delivered_by: "Rui" }, items: [{ description: "Tinta", quantity: 0 }] }),
    );
    const ok = deliveryInputSchema.parse({ header: { delivery_date: "2026-11-07", delivered_by: "Rui" }, items: [{ description: "Tinta", quantity: "2.5" }] });
    assert.equal(ok.header.recipient, "Promarine");
    assert.equal(ok.items[0].quantity, 2.5);
    const sum = summarizeItems([
      { status: "assinada", items: [{ description: "Tinta", quantity: 2, unit: "l", reference: null, notes: null }] },
      { status: "emitida", items: [{ description: "tinta ", quantity: 3, unit: "l", reference: null, notes: null }] },
      { status: "anulada", items: [{ description: "Tinta", quantity: 100, unit: "l", reference: null, notes: null }] },
    ]);
    assert.deepEqual(sum, [{ description: "Tinta", unit: "l", quantity: 5, deliveries: 2 }]);
  });

  await test("guia para outros clientes: lista de clientes conhecidos com os últimos dados, Promarine sempre incluída", () => {
    const list = knownRecipients([
      { recipient: "Marina Kianda", recipient_details: "NIF 5401234567" },
      { recipient: "marina kianda ", recipient_details: "antigo" },
      { recipient: "João Silva", recipient_details: null },
    ]);
    assert.deepEqual(list, [
      { name: "Marina Kianda", details: "NIF 5401234567" },
      { name: "João Silva", details: null },
      { name: "Promarine", details: null },
    ]);
    const parsed = deliveryInputSchema.parse({
      header: { delivery_date: "2026-11-14", recipient: "Marina Kianda", recipient_details: " NIF 5401234567 ", delivered_by: "Rui" },
      items: [{ description: "Corda", quantity: 10, unit: "m" }],
    });
    assert.equal(parsed.header.recipient_details, "NIF 5401234567");
    assert.throws(() => deliveryInputSchema.parse({ header: { delivery_date: "2026-11-14", recipient: "", delivered_by: "Rui" }, items: [{ description: "Corda", quantity: 1 }] }));
  });

  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const migrations = readdirSync(new URL("migrations/", root)).sort();
  for (const file of migrations) await db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
  await db.exec(`
    insert into auth.users (id, email) values
      ('${ADMIN}', 'admin@example.com'), ('${EDITOR}', 'editor@example.com'), ('${NOBODY}', 'semacesso@example.com');
    update public.profiles set role = 'admin', full_name = 'Admin' where id = '${ADMIN}';
    update public.profiles set role = 'editor', full_name = 'Editor' where id = '${EDITOR}';
  `);

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

  await test("a gestão de obras foi removida (nenhum objecto ops_*) e a remoção é repetível", async () => {
    await db.exec(readFileSync(new URL("migrations/20261111000001_remover_gestao_obras.sql", root), "utf8"));
    const r = await db.query<{ n: number }>(
      "select (select count(*) from pg_tables where schemaname = 'public' and tablename like 'ops\\_%') + (select count(*) from pg_proc where proname like 'ops\\_%')::int as n",
    );
    assert.equal(Number(r.rows[0].n), 0);
  });

  const insertTask = (who: string, extra = "") =>
    as<{ id: string; code: string; created_by: string }>(
      who,
      `insert into public.pr_tasks (title, responsible_name, responsible_phone, due_at${extra ? ", status" : ""})
       values ('Preparar material de pintura', 'Ana Silva', '+244923456789', now() + interval '2 days'${extra ? `, '${extra}'` : ""})
       returning id, code, created_by`,
    );

  let taskId = "";
  await test("tarefas: numeração TR-AAAA-NNNN e autor registado", async () => {
    const [a] = await insertTask(EDITOR);
    const [b] = await insertTask(ADMIN);
    assert.equal(a.code, `TR-${YEAR}-0001`);
    assert.equal(b.code, `TR-${YEAR}-0002`);
    assert.equal(a.created_by, EDITOR);
    taskId = a.id;
  });

  await test("tarefas: só a equipa do painel lê e escreve; apagar só administradores", async () => {
    assert.equal((await as("anon", "select * from public.pr_tasks")).length, 0);
    assert.equal((await as(NOBODY, "select * from public.pr_tasks")).length, 0);
    await rejects(insertTask(NOBODY), /row-level security/);
    await as(EDITOR, `delete from public.pr_tasks where id = '${taskId}'`);
    assert.equal((await as(EDITOR, `select id from public.pr_tasks where id = '${taskId}'`)).length, 1, "editor não apaga");
    assert.equal((await as(ADMIN, "select * from public.pr_tasks")).length, 2);
  });

  await test("tarefas: telemóvel em formato internacional e título obrigatório", async () => {
    await rejects(as(EDITOR, "insert into public.pr_tasks (title, responsible_name, responsible_phone) values ('Tarefa', 'Ana', '923456789')"), /responsible_phone/);
    await rejects(as(EDITOR, "insert into public.pr_tasks (title, responsible_name) values ('ab', 'Ana')"), /check constraint/);
  });

  await test("tarefas: concluir regista a data; reabrir limpa-a; novo prazo volta a permitir alertas", async () => {
    await db.exec(`update public.pr_tasks set reminder_sent_at = now(), overdue_sent_at = now() where id = '${taskId}'`);
    const [done] = await as<{ completed_at: string | null }>(EDITOR, `update public.pr_tasks set status = 'concluida' where id = '${taskId}' returning completed_at`);
    assert.ok(done.completed_at);
    const [open] = await as<{ completed_at: string | null; reminder_sent_at: string | null }>(
      EDITOR,
      `update public.pr_tasks set status = 'em_curso' where id = '${taskId}' returning completed_at, reminder_sent_at`,
    );
    assert.equal(open.completed_at, null);
    assert.ok(open.reminder_sent_at, "mudar o estado não repõe os alertas");
    const [moved] = await as<{ reminder_sent_at: string | null; overdue_sent_at: string | null }>(
      EDITOR,
      `update public.pr_tasks set due_at = now() + interval '5 days' where id = '${taskId}' returning reminder_sent_at, overdue_sent_at`,
    );
    assert.equal(moved.reminder_sent_at, null);
    assert.equal(moved.overdue_sent_at, null);
  });

  await test("tarefas: alertas só são gravados pelo servidor; a equipa lê-os", async () => {
    await rejects(as(EDITOR, `insert into public.pr_task_alerts (task_id, kind, status) values ('${taskId}', 'lembrete', 'enviado')`), /row-level security/);
    await db.exec(`insert into public.pr_task_alerts (task_id, kind, status) values ('${taskId}', 'lembrete', 'sem_configuracao')`);
    assert.equal((await as(EDITOR, "select * from public.pr_task_alerts")).length, 1);
    assert.equal((await as(NOBODY, "select * from public.pr_task_alerts")).length, 0);
  });

  const header = { delivery_date: "2026-11-07", recipient: "Promarine", reference: "OS-2026-0012", delivered_by: "Rui", received_by: null, notes: null };
  const items = [
    { description: "Tinta antivegetativa", reference: "TA-01", quantity: 4, unit: "l", notes: null },
    { description: "Lixa P120", reference: null, quantity: 20, unit: "un", notes: null },
  ];
  let deliveryId = "";

  await test("guia: criada com número GS-AAAA-NNNN e linhas numa só transacção", async () => {
    const [r] = await as<{ d: { id: string; number: string } }>(EDITOR, "select public.pr_create_delivery($1::jsonb, $2::jsonb) as d", [
      JSON.stringify(header),
      JSON.stringify(items),
    ]);
    assert.equal(r.d.number, `GS-${YEAR}-0001`);
    deliveryId = r.d.id;
    const lines = await as<{ description: string; position: number }>(EDITOR, `select description, position from public.pr_material_delivery_items where delivery_id = '${deliveryId}' order by position`);
    assert.deepEqual(lines.map((l) => [l.position, l.description]), [
      [1, "Tinta antivegetativa"],
      [2, "Lixa P120"],
    ]);
    await rejects(as(EDITOR, "select public.pr_create_delivery($1::jsonb, '[]'::jsonb)", [JSON.stringify(header)]), /delivery_no_items/);
    const n = await db.query<{ n: number }>("select count(*)::int as n from public.pr_material_deliveries");
    assert.equal(n.rows[0].n, 1, "a guia sem materiais não ficou gravada");
    await rejects(as(NOBODY, "select public.pr_create_delivery($1::jsonb, $2::jsonb)", [JSON.stringify(header), JSON.stringify(items)]), /not_authorized/);
    await rejects(as("anon", "select public.pr_create_delivery($1::jsonb, $2::jsonb)", [JSON.stringify(header), JSON.stringify(items)]), /permission denied/);
  });

  await test("guia: corrigível enquanto emitida; assinada fica bloqueada e só pode ser anulada com motivo", async () => {
    await as(EDITOR, "select public.pr_replace_delivery_items($1::uuid, $2::jsonb)", [deliveryId, JSON.stringify([{ ...items[0], quantity: 5 }])]);
    const [line] = await as<{ quantity: string }>(EDITOR, `select quantity from public.pr_material_delivery_items where delivery_id = '${deliveryId}'`);
    assert.equal(Number(line.quantity), 5);
    const [signed] = await as<{ signed_at: string | null }>(
      EDITOR,
      `update public.pr_material_deliveries set status = 'assinada', received_by = 'João (Promarine)' where id = '${deliveryId}' returning signed_at`,
    );
    assert.ok(signed.signed_at);
    await rejects(as(EDITOR, `update public.pr_material_delivery_items set quantity = 50 where delivery_id = '${deliveryId}'`), /delivery_locked/);
    await rejects(as(EDITOR, `update public.pr_material_deliveries set delivered_by = 'Outro' where id = '${deliveryId}'`), /delivery_locked/);
    await rejects(as(EDITOR, "select public.pr_replace_delivery_items($1::uuid, $2::jsonb)", [deliveryId, JSON.stringify(items)]), /delivery_locked/);
    await rejects(as(EDITOR, `update public.pr_material_deliveries set status = 'anulada' where id = '${deliveryId}'`), /pr_deliveries_cancel_reason/);
    await as(EDITOR, `update public.pr_material_deliveries set status = 'anulada', cancelled_reason = 'Material devolvido' where id = '${deliveryId}'`);
    await rejects(as(EDITOR, `update public.pr_material_deliveries set status = 'emitida' where id = '${deliveryId}'`), /delivery_locked/);
  });

  await test("guia: apagar só administradores e só guias por assinar; número nunca reutilizado", async () => {
    await as(ADMIN, `delete from public.pr_material_deliveries where id = '${deliveryId}'`);
    assert.equal((await as(ADMIN, `select id from public.pr_material_deliveries where id = '${deliveryId}'`)).length, 1, "anulada não se apaga");
    const [r] = await as<{ d: { id: string; number: string } }>(EDITOR, "select public.pr_create_delivery($1::jsonb, $2::jsonb) as d", [
      JSON.stringify(header),
      JSON.stringify(items),
    ]);
    assert.equal(r.d.number, `GS-${YEAR}-0002`);
    await as(EDITOR, `delete from public.pr_material_deliveries where id = '${r.d.id}'`);
    assert.equal((await as(EDITOR, `select id from public.pr_material_deliveries where id = '${r.d.id}'`)).length, 1, "editor não apaga");
    await as(ADMIN, `delete from public.pr_material_deliveries where id = '${r.d.id}'`);
    assert.equal((await as(ADMIN, `select id from public.pr_material_deliveries where id = '${r.d.id}'`)).length, 0);
    const [again] = await as<{ d: { number: string } }>(EDITOR, "select public.pr_create_delivery($1::jsonb, $2::jsonb) as d", [
      JSON.stringify(header),
      JSON.stringify(items),
    ]);
    assert.equal(again.d.number, `GS-${YEAR}-0003`);
  });

  await test("guia para outro cliente: destinatário e dados do cliente gravados e bloqueados depois de assinada", async () => {
    const h = { ...header, recipient: "Marina Kianda", recipient_details: "NIF 5401234567 · Ilha de Luanda" };
    const [r] = await as<{ d: { id: string } }>(EDITOR, "select public.pr_create_delivery($1::jsonb, $2::jsonb) as d", [JSON.stringify(h), JSON.stringify(items)]);
    const [row] = await as<{ recipient: string; recipient_details: string }>(EDITOR, `select recipient, recipient_details from public.pr_material_deliveries where id = '${r.d.id}'`);
    assert.deepEqual(row, { recipient: "Marina Kianda", recipient_details: "NIF 5401234567 · Ilha de Luanda" });
    await as(EDITOR, `update public.pr_material_deliveries set recipient_details = 'NIF 5401234567' where id = '${r.d.id}'`);
    await as(EDITOR, `update public.pr_material_deliveries set status = 'assinada', received_by = 'Ana (Marina Kianda)' where id = '${r.d.id}'`);
    await rejects(as(EDITOR, `update public.pr_material_deliveries set recipient_details = 'outro' where id = '${r.d.id}'`), /delivery_locked/);
    await rejects(as(EDITOR, `update public.pr_material_deliveries set recipient = 'Outro' where id = '${r.d.id}'`), /delivery_locked/);
  });

  await test("auditoria regista criação de tarefas e guias e as mudanças de estado", async () => {
    const r = await db.query<{ action: string }>("select action from public.audit_log where entity in ('pr_tasks', 'pr_material_deliveries') order by id");
    const actions = r.rows.map((x) => x.action);
    for (const a of ["task.create", "task.update", "delivery.create", "delivery.assinada", "delivery.anulada", "delivery.delete"]) assert.ok(actions.includes(a), a);
  });

  await test("migrações repetíveis (idempotentes)", async () => {
    for (const file of migrations.filter((f) => f >= "20261111")) await db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
    assert.equal((await as(ADMIN, "select * from public.pr_tasks")).length, 2);
  });

  console.log(`\n${passed} testes passaram.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
