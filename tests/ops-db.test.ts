/**
 * Testes da base de dados da Gestão de Obras (migração ops_*, RLS por perfil,
 * numeração, integridade financeira, fila de notificações) num Postgres embutido
 * (PGlite) com uma simulação mínima do Supabase. Sem rede.
 *
 * Executar: npm run test:ops-db
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

const U = {
  admin: "00000000-0000-0000-0000-0000000000a1",
  direcao: "00000000-0000-0000-0000-0000000000d1",
  gestor: "00000000-0000-0000-0000-0000000000b1",
  supervisor: "00000000-0000-0000-0000-0000000000c1",
  tec1: "00000000-0000-0000-0000-0000000000e1",
  tec2: "00000000-0000-0000-0000-0000000000e2",
  financeiro: "00000000-0000-0000-0000-0000000000f1",
  inactive: "00000000-0000-0000-0000-0000000000f9",
  outsider: "00000000-0000-0000-0000-0000000000ff",
  cliente1: "00000000-0000-0000-0000-0000000001c1",
  cliente2: "00000000-0000-0000-0000-0000000001c2",
};

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
  // As migrações da gestão têm de poder ser executadas outra vez sem erros (pela mesma ordem).
  for (const file of ["20261107000001_gestao_obras.sql", "20261108000001_tarefas_empresa.sql", "20261109000001_portal_cliente.sql", "20261110000001_despesas_gerais.sql"]) {
    await db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  }

  const users = Object.entries(U).map(([k, id]) => `('${id}', '${k}@example.com')`).join(", ");
  await db.exec(`insert into auth.users (id, email) values ${users};
    insert into public.ops_members (user_id, full_name, email, role, active) values
      ('${U.admin}', 'Administrador', 'admin@example.com', 'admin', true),
      ('${U.direcao}', 'Direcção', 'direcao@example.com', 'direcao', true),
      ('${U.gestor}', 'Gestor de Obras', 'gestor@example.com', 'gestor', true),
      ('${U.supervisor}', 'Supervisor', 'supervisor@example.com', 'supervisor', true),
      ('${U.tec1}', 'Técnico João', 'tec1@example.com', 'tecnico', true),
      ('${U.tec2}', 'Técnico Ana', 'tec2@example.com', 'tecnico', true),
      ('${U.financeiro}', 'Financeiro', 'financeiro@example.com', 'financeiro', true),
      ('${U.inactive}', 'Inactivo', 'inactivo@example.com', 'gestor', false);`);

  async function as<T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) {
    return db.transaction(async (tx) => {
      await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${who}', true);`);
      return (await tx.query<T>(sql, params)).rows;
    });
  }
  async function rejects(promise: Promise<unknown>, pattern: RegExp) {
    await assert.rejects(promise, (e: Error) => pattern.test(e.message), `esperava erro ${pattern}`);
  }

  console.log("Gestão de Obras — base de dados");

  let clientId = "";
  let vesselId = "";
  let orderId = "";
  const taskIds: string[] = [];
  let companyTaskId = "";
  let otherClientId = "";

  await test("clientes e embarcações com código automático e sem duplicações", async () => {
    const [c] = await as<{ id: string; code: string }>(U.gestor,
      "insert into public.ops_clients (name, nif) values ('Pescas do Atlântico, Lda', '5417000000') returning id, code");
    clientId = c.id;
    assert.equal(c.code, "CL-0001");
    await rejects(as(U.gestor, "insert into public.ops_clients (name, nif) values ('Outro', '5417000000')"), /duplicate|unique/);
    const [v] = await as<{ id: string; code: string }>(U.gestor,
      "insert into public.ops_vessels (client_id, name, vessel_type, registration) values ($1, 'Kianda', 'pesca', 'LDA-1234') returning id, code", [clientId]);
    vesselId = v.id;
    assert.equal(v.code, "EMB-0001");
    await rejects(as(U.gestor, "insert into public.ops_vessels (client_id, name, registration) values ($1, 'Outra', 'lda-1234')", [clientId]), /duplicate|unique/);
  });

  await test("técnico e financeiro não criam clientes nem obras", async () => {
    await rejects(as(U.tec1, "insert into public.ops_clients (name) values ('X')"), /row-level security/);
    await rejects(as(U.financeiro, "insert into public.ops_work_orders (client_id, vessel_id, intervention_type, title) values ($1, $2, 'x', 'Teste')", [clientId, vesselId]), /row-level security/);
  });

  await test("utilizador inactivo ou sem perfil não acede a nada", async () => {
    assert.equal((await as(U.inactive, "select * from public.ops_clients")).length, 0);
    assert.equal((await as(U.outsider, "select * from public.ops_clients")).length, 0);
    await rejects(as(U.inactive, "insert into public.ops_clients (name) values ('X')"), /row-level security/);
  });

  await test("obra com número OS-AAAA-0001 e embarcação do mesmo cliente", async () => {
    const [o] = await as<{ id: string; number: string }>(U.gestor,
      `insert into public.ops_work_orders (client_id, vessel_id, intervention_type, title, manager_id, start_date, due_date, priority)
       values ($1, $2, 'reparacao_casco', 'Reparação e soldadura do casco', $3, current_date, current_date + 10, 'alta') returning id, number`,
      [clientId, vesselId, U.gestor]);
    orderId = o.id;
    assert.match(o.number, /^OS-\d{4}-0001$/);
    const [c2] = await as<{ id: string }>(U.gestor, "insert into public.ops_clients (name) values ('Turismo Mussulo') returning id");
    await rejects(as(U.gestor,
      "insert into public.ops_work_orders (client_id, vessel_id, intervention_type, title) values ($1, $2, 'x', 'Errada')", [c2.id, vesselId]),
      /vessel_client_mismatch/);
  });

  await test("cinco tarefas com códigos sequenciais e responsáveis", async () => {
    const plan = [
      ["Diagnóstico do casco", 4, U.tec1],
      ["Remoção de pintura", 8, U.tec1],
      ["Soldadura das chapas", 16, U.tec2],
      ["Tratamento anticorrosivo", 6, U.tec2],
      ["Pintura final", 6, U.tec1],
    ] as const;
    for (const [i, [title, hours, who]] of plan.entries()) {
      const [t] = await as<{ id: string; code: string }>(U.gestor,
        `insert into public.ops_tasks (work_order_id, title, planned_hours, responsible_id, start_at, due_at, sort_order)
         values ($1, $2, $3, $4, now() + ($5 || ' days')::interval, now() + ($6 || ' days')::interval, $7) returning id, code`,
        [orderId, title, hours, who, String(i), String(i + 1), i]);
      taskIds.push(t.id);
      assert.equal(t.code, `T0${i + 1}`);
      await as(U.gestor, "insert into public.ops_task_assignees (task_id, user_id) values ($1, $2)", [t.id, who]);
    }
  });

  await test("técnico vê só as suas tarefas e a obra onde trabalha", async () => {
    const mine = await as<{ id: string }>(U.tec1, "select id from public.ops_tasks");
    assert.equal(mine.length, 3);
    assert.equal((await as(U.tec1, "select * from public.ops_work_orders")).length, 1);
    assert.equal((await as(U.supervisor, "select * from public.ops_tasks")).length, 5);
  });

  await test("técnico actualiza o progresso das suas tarefas por função própria, não de outras", async () => {
    await as(U.tec1, "select public.ops_tech_update_task($1, 'em_curso', 50, 'Casco inspeccionado')", [taskIds[0]]);
    await rejects(as(U.tec1, "select public.ops_tech_update_task($1, 'em_curso', 10, null)", [taskIds[2]]), /not_authorized/);
    await rejects(as(U.tec1, "select public.ops_tech_update_task($1, 'validada', 100, null)", [taskIds[0]]), /not_authorized/);
    // Escrita directa na tabela é bloqueada para técnicos.
    const upd = await as<{ id: string }>(U.tec1, "update public.ops_tasks set planned_hours = 99 where id = $1 returning id", [taskIds[0]]);
    assert.equal(upd.length, 0);
    await as(U.tec2, "select public.ops_tech_update_task($1, 'concluida', 0, null)", [taskIds[2]]);
    const [t] = await as<{ progress: number; completed_at: string | null }>(U.gestor, "select progress, completed_at from public.ops_tasks where id = $1", [taskIds[2]]);
    assert.equal(t.progress, 100, "concluída = 100%");
    assert.ok(t.completed_at);
  });

  await test("progresso da obra ponderado pelas horas previstas", async () => {
    // T01: 4h × 50%, T03: 16h × 100%, restantes 0% → (2 + 16) / 40 = 45%
    const [p] = await as<{ progress: number; tasks_total: number; tasks_done: number }>(U.gestor,
      "select progress, tasks_total, tasks_done from public.ops_work_order_progress where work_order_id = $1", [orderId]);
    assert.equal(p.tasks_total, 5);
    assert.equal(p.tasks_done, 1);
    assert.equal(p.progress, 45);
  });

  await test("validação de tarefas reservada à supervisão", async () => {
    await rejects(as(U.tec2, "select public.ops_validate_task($1)", [taskIds[2]]), /not_authorized/);
    await rejects(as(U.supervisor, "select public.ops_validate_task($1)", [taskIds[1]]), /task_not_completed/);
    await as(U.supervisor, "select public.ops_validate_task($1)", [taskIds[2]]);
    const [t] = await as<{ status: string; validated_by: string }>(U.gestor, "select status, validated_by from public.ops_tasks where id = $1", [taskIds[2]]);
    assert.equal(t.status, "validada");
    assert.equal(t.validated_by, U.supervisor);
  });

  await test("tarefas atrasadas são identificadas", async () => {
    await as(U.gestor, "update public.ops_tasks set start_at = now() - interval '3 days', due_at = now() - interval '1 day' where id = $1", [taskIds[1]]);
    const [p] = await as<{ tasks_late: number }>(U.gestor, "select tasks_late from public.ops_work_order_progress where work_order_id = $1", [orderId]);
    assert.equal(p.tasks_late, 1);
  });

  await test("técnico regista horas só nas suas tarefas", async () => {
    await as(U.tec1, "insert into public.ops_time_entries (task_id, user_id, work_date, hours) values ($1, $2, current_date, 3.5)", [taskIds[0], U.tec1]);
    await rejects(as(U.tec1, "insert into public.ops_time_entries (task_id, user_id, work_date, hours) values ($1, $2, current_date, 2)", [taskIds[2], U.tec1]), /row-level security/);
    await rejects(as(U.tec1, "insert into public.ops_time_entries (task_id, user_id, work_date, hours) values ($1, $2, current_date, 2)", [taskIds[0], U.tec2]), /row-level security/);
    const [h] = await as<{ used_hours: string }>(U.gestor, "select used_hours from public.ops_task_hours where task_id = $1", [taskIds[0]]);
    assert.equal(Number(h.used_hours), 3.5);
  });

  await test("técnico não vê informação financeira", async () => {
    await as(U.admin, "insert into public.ops_member_rates (user_id, hourly_cost) values ($1, 2500)", [U.tec1]);
    for (const table of ["ops_work_order_finance", "ops_expenses", "ops_quotes", "ops_quote_items", "ops_member_rates"]) {
      assert.equal((await as(U.tec1, `select * from public.${table}`)).length, 0, table);
    }
    await rejects(as(U.tec1,
      "insert into public.ops_expenses (work_order_id, expense_date, category, description, quantity, unit_price) values ($1, current_date, 'materiais', 'Chapa', 1, 1000)", [orderId]),
      /row-level security/);
    assert.equal((await as(U.supervisor, "select * from public.ops_member_rates")).length, 0, "supervisor também não");
  });

  let quoteId = "";
  await test("orçamento: só a Direcção aprova e os valores contratuais actualizam-se", async () => {
    const [q] = await as<{ id: string }>(U.gestor, "insert into public.ops_quotes (work_order_id, version) values ($1, 1) returning id", [orderId]);
    quoteId = q.id;
    await as(U.gestor, `insert into public.ops_quote_items (quote_id, description, category, quantity, unit_cost, unit_price) values
      ($1, 'Chapa de alumínio 5mm', 'materiais', 4, 75000, 105000),
      ($1, 'Mão-de-obra de soldadura', 'mao_de_obra', 40, 2500, 6000)`, [quoteId]);
    await as(U.gestor, "update public.ops_quotes set status = 'submetido', submitted_at = now() where id = $1", [quoteId]);
    await rejects(as(U.gestor, "insert into public.ops_quote_items (quote_id, description, quantity, unit_cost, unit_price) values ($1, 'Extra', 1, 1, 1)", [quoteId]), /quote_locked/);
    await rejects(as(U.gestor, "select public.ops_decide_quote($1, true, null)", [quoteId]), /not_authorized/);
    await rejects(as(U.financeiro, "select public.ops_decide_quote($1, true, null)", [quoteId]), /not_authorized/);
    await as(U.direcao, "select public.ops_decide_quote($1, true, 'Aprovado')", [quoteId]);
    const [f] = await as<{ budget_initial: string; contract_price: string }>(U.financeiro,
      "select budget_initial, contract_price from public.ops_work_order_finance where work_order_id = $1", [orderId]);
    assert.equal(Number(f.budget_initial), 4 * 75000 + 40 * 2500);
    assert.equal(Number(f.contract_price), 4 * 105000 + 40 * 6000);
    const [o] = await as<{ status: string }>(U.gestor, "select status from public.ops_work_orders where id = $1", [orderId]);
    assert.equal(o.status, "aprovada");
  });

  await test("despesas: total calculado, aprovação reservada e registos aprovados bloqueados", async () => {
    const [e] = await as<{ id: string; total: string; approval: string }>(U.gestor,
      `insert into public.ops_expenses (work_order_id, task_id, expense_date, category, description, quantity, unit_price, approval)
       values ($1, $2, current_date, 'materiais', 'Eléctrodos de soldadura', 3, 12500.5, 'aprovada') returning id, total, approval`, [orderId, taskIds[2]]);
    assert.equal(Number(e.total), 37501.5);
    assert.equal(e.approval, "pendente", "o gestor não aprova a própria despesa");
    await rejects(as(U.gestor, "update public.ops_expenses set approval = 'aprovada' where id = $1", [e.id]), /not_authorized/);
    await as(U.financeiro, "update public.ops_expenses set approval = 'aprovada' where id = $1", [e.id]);
    await rejects(as(U.financeiro, "update public.ops_expenses set unit_price = 1 where id = $1", [e.id]), /expense_locked/);
    await rejects(as(U.admin, "delete from public.ops_expenses where id = $1", [e.id]), /expense_locked/);
    const [a] = await as<{ approved_by: string }>(U.financeiro, "select approved_by from public.ops_expenses where id = $1", [e.id]);
    assert.equal(a.approved_by, U.financeiro);
  });

  await test("consumo de materiais usa sempre o custo do catálogo", async () => {
    const [m] = await as<{ id: string }>(U.gestor, "insert into public.ops_materials (name, unit, unit_cost) values ('Tinta epóxi', 'L', 8000) returning id");
    const [c] = await as<{ unit_cost: string; total: string }>(U.tec1,
      `insert into public.ops_material_consumptions (work_order_id, task_id, material_id, quantity, unit_cost, consumed_on, user_id)
       values ($1, $2, $3, 2.5, 1, current_date, $4) returning unit_cost, total`, [orderId, taskIds[0], m.id, U.tec1]);
    assert.equal(Number(c.unit_cost), 8000);
    assert.equal(Number(c.total), 20000);
  });

  await test("relatório diário: técnico submete, supervisor valida, técnico não se auto-valida", async () => {
    const [r] = await as<{ id: string; status: string }>(U.tec1,
      `insert into public.ops_daily_reports (report_date, work_order_id, user_id, activities, hours, status)
       values (current_date, $1, $2, 'Remoção de tinta no costado de bombordo', 7, 'validado') returning id, status`, [orderId, U.tec1]);
    assert.equal(r.status, "submetido");
    await rejects(as(U.tec1, "update public.ops_daily_reports set status = 'validado' where id = $1", [r.id]), /not_authorized/);
    await rejects(as(U.tec1,
      "insert into public.ops_daily_reports (report_date, work_order_id, user_id, activities) values (current_date, $1, $2, 'Duplicado')", [orderId, U.tec1]),
      /duplicate|unique/);
    await as(U.supervisor, "update public.ops_daily_reports set status = 'correccao', review_note = 'Indicar materiais' where id = $1", [r.id]);
    await as(U.tec1, "update public.ops_daily_reports set status = 'submetido', materials_used = 'Lixa 80' where id = $1", [r.id]);
    await as(U.supervisor, "update public.ops_daily_reports set status = 'validado' where id = $1", [r.id]);
    await rejects(as(U.tec1, "update public.ops_daily_reports set activities = 'alterado' where id = $1", [r.id]), /report_locked/);
    assert.equal((await as(U.tec2, "select * from public.ops_daily_reports")).length, 0, "outros técnicos não vêem");
  });

  await test("ocorrência crítica associada à obra e visível para a gestão", async () => {
    await as(U.tec2,
      `insert into public.ops_incidents (work_order_id, task_id, reporter_id, category, description, urgency)
       values ($1, $2, $3, 'meteorologia', 'Ventos fortes impedem a soldadura no exterior', 'critico')`, [orderId, taskIds[2], U.tec2]);
    const rows = await as<{ urgency: string }>(U.direcao, "select urgency from public.ops_incidents where work_order_id = $1", [orderId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].urgency, "critico");
    assert.equal((await as(U.tec1, "select * from public.ops_incidents")).length, 0);
    await rejects(as(U.tec1,
      "insert into public.ops_incidents (work_order_id, reporter_id, category, description) values ($1, $2, 'outro', 'Em nome de outro')", [orderId, U.tec2]),
      /row-level security/);
  });

  await test("auditoria regista quem alterou o quê, e só a Direcção/Administração lê tudo", async () => {
    const rows = await as<{ table_name: string; action: string; actor_name: string }>(U.admin,
      "select table_name, action, actor_name from public.ops_activity where work_order_id = $1", [orderId]);
    assert.ok(rows.some((r) => r.table_name === "ops_tasks" && r.action === "update"));
    assert.ok(rows.some((r) => r.table_name === "ops_expenses" && r.actor_name === "Financeiro"));
    assert.equal((await as(U.tec1, "select * from public.ops_activity")).length, 0);
  });

  await test("fila de notificações: sem duplicados e reclamação exclusiva", async () => {
    await db.exec(`insert into public.ops_notifications (dedupe_key, event, recipient_id, phone, template_name, language, preview)
      values ('task_assigned:1', 'tarefa_atribuida', '${U.tec1}', '+244900000000', 'pr_notificacao_obra', 'pt_PT', 'teste')`);
    await assert.rejects(db.exec(`insert into public.ops_notifications (dedupe_key, event, phone, template_name, language, preview)
      values ('task_assigned:1', 'tarefa_atribuida', '+244900000000', 'pr_notificacao_obra', 'pt_PT', 'teste')`));
    const first = await db.query<{ id: string }>("select id from public.ops_claim_notifications(10)");
    const second = await db.query<{ id: string }>("select id from public.ops_claim_notifications(10)");
    assert.equal(first.rows.length, 1);
    assert.equal(second.rows.length, 0, "a mesma mensagem não é reclamada duas vezes");
    await rejects(as(U.admin, "select * from public.ops_claim_notifications(10)"), /permission denied/);
    assert.equal((await as(U.tec2, "select * from public.ops_notifications")).length, 0);
    assert.equal((await as(U.tec1, "select * from public.ops_notifications")).length, 1, "o destinatário vê as suas");
  });

  await test("telefone WhatsApp em formato internacional", async () => {
    await rejects(as(U.admin, "update public.ops_members set whatsapp_phone = '923000000' where user_id = $1", [U.tec1]), /check constraint/);
    await as(U.admin, "update public.ops_members set whatsapp_phone = '+244923000000', whatsapp_consent = true where user_id = $1", [U.tec1]);
  });

  await test("tarefas da empresa: numeração TE-AAAA-NNNN, área obrigatória e âmbito único", async () => {
    const [t] = await as<{ id: string; code: string; created_by: string }>(U.direcao,
      `insert into public.ops_tasks (area, title, responsible_id, priority, due_at, created_by)
       values ('financeiro', 'Pagar a segurança social', $1, 'alta', now() + interval '2 days', $2) returning id, code, created_by`,
      [U.financeiro, U.admin]);
    assert.match(t.code, /^TE-\d{4}-0001$/);
    assert.equal(t.created_by, U.direcao, "o autor é sempre quem cria");
    companyTaskId = t.id;
    await as(U.direcao, "insert into public.ops_task_assignees (task_id, user_id) values ($1, $2)", [t.id, U.financeiro]);
    const [g] = await as<{ code: string }>(U.gestor,
      "insert into public.ops_tasks (area, title) values ('compras', 'Encomendar tinta antivegetativa') returning code");
    assert.match(g.code, /^TE-\d{4}-0002$/, "o gestor cria e vê a tarefa que criou");
    await rejects(as(U.gestor, "insert into public.ops_tasks (title) values ('Sem âmbito')"), /ops_tasks_scope_check/);
    await rejects(as(U.gestor, "insert into public.ops_tasks (work_order_id, area, title) values ($1, 'compras', 'Os dois')", [orderId]), /ops_tasks_scope_check/);
    await rejects(as(U.gestor, "insert into public.ops_tasks (area, title) values ('xpto', 'Área inválida')"), /ops_tasks_area_check/);
    await rejects(as(U.supervisor, "insert into public.ops_tasks (area, title) values ('outro', 'Supervisor')"), /row-level security/);
    await rejects(as(U.direcao, "update public.ops_tasks set work_order_id = $1 where id = $2", [orderId, t.id]), /task_scope_change|ops_tasks_scope_check/);
  });

  await test("tarefas da empresa: só Direcção, Administração, autor e atribuídos as vêem", async () => {
    const seen = async (who: string) => (await as(who, "select id from public.ops_tasks where id = $1", [companyTaskId])).length;
    assert.equal(await seen(U.financeiro), 1, "responsável");
    assert.equal(await seen(U.admin), 1);
    assert.equal(await seen(U.direcao), 1);
    assert.equal(await seen(U.gestor), 0, "gestor que não a criou");
    assert.equal(await seen(U.supervisor), 0);
    assert.equal(await seen(U.tec2), 0);
    const orderTasks = await as(U.supervisor, "select id from public.ops_tasks where work_order_id = $1", [orderId]);
    assert.ok(orderTasks.length >= 5, "as tarefas das obras continuam visíveis para a supervisão");
  });

  await test("tarefas da empresa: o responsável actualiza o estado; quem não a vê não lhe toca", async () => {
    await as(U.financeiro, "select public.ops_tech_update_task($1, 'em_curso', 50, 'Guias pedidas')", [companyTaskId]);
    const [row] = await as<{ status: string; progress: number }>(U.direcao, "select status, progress from public.ops_tasks where id = $1", [companyTaskId]);
    assert.deepEqual(row, { status: "em_curso", progress: 50 });
    await rejects(as(U.financeiro, "select public.ops_tech_update_task($1, 'cancelada', 0, null)", [companyTaskId]), /not_authorized/);
    await rejects(as(U.supervisor, "select public.ops_tech_update_task($1, 'concluida', 100, null)", [companyTaskId]), /not_authorized/);
    await rejects(as(U.supervisor, "select public.ops_validate_task($1)", [companyTaskId]), /not_authorized/);
    const upd = await as(U.gestor, "update public.ops_tasks set title = 'Alterado' where id = $1 returning id", [companyTaskId]);
    assert.equal(upd.length, 0, "gestor sem acesso não altera");
    await as(U.financeiro, "insert into public.ops_time_entries (task_id, user_id, work_date, hours) values ($1, $2, current_date, 1.5)", [companyTaskId, U.financeiro]);
    await rejects(as(U.tec2, "insert into public.ops_time_entries (task_id, user_id, work_date, hours) values ($1, $2, current_date, 1)", [companyTaskId, U.tec2]), /row-level security/);
  });

  await test("despesas gerais da empresa: sem obra, mesmas regras de aprovação e invisíveis para técnicos", async () => {
    const [e] = await as<{ id: string; total: string; approval: string }>(U.gestor,
      `insert into public.ops_expenses (expense_date, category, description, quantity, unit_price, approval)
       values (current_date, 'alimentacao', 'Almoço da equipa', 6, 2500, 'aprovada') returning id, total, approval`);
    assert.equal(Number(e.total), 15000);
    assert.equal(e.approval, "pendente", "o gestor não aprova");
    await as(U.financeiro, `insert into public.ops_expenses (expense_date, category, description, quantity, unit_price) values (current_date, 'limpeza_higiene', 'Detergente e lixívia', 1, 8000)`);
    await rejects(as(U.gestor, "insert into public.ops_expenses (expense_date, category, description, quantity, unit_price, task_id) values (current_date, 'outros', 'Tarefa de obra', 1, 1, $1)", [taskIds[0]]), /expense_task_other_scope/);
    await as(U.gestor, "insert into public.ops_expenses (expense_date, category, description, quantity, unit_price, task_id) values (current_date, 'escritorio', 'Papel', 1, 3000, $1)", [companyTaskId]);
    await as(U.financeiro, "update public.ops_expenses set approval = 'aprovada' where id = $1", [e.id]);
    await rejects(as(U.financeiro, "update public.ops_expenses set unit_price = 1 where id = $1", [e.id]), /expense_locked/);
    assert.equal((await as(U.tec1, "select id from public.ops_expenses where work_order_id is null")).length, 0);
    assert.equal((await as(U.supervisor, "select id from public.ops_expenses where work_order_id is null")).length, 0);
    assert.equal((await as(U.direcao, "select id from public.ops_expenses where work_order_id is null")).length, 3);
  });

  await test("portal do cliente: contas de cliente geridas pela gestão e separadas da equipa", async () => {
    await as(U.gestor, "insert into public.ops_client_users (user_id, client_id, full_name, email) values ($1, $2, 'Armador Kianda', 'CLIENTE1@example.com')", [U.cliente1, clientId]);
    const [other] = await as<{ id: string }>(U.gestor, "insert into public.ops_clients (name) values ('Outro Armador') returning id");
    otherClientId = other.id;
    await as(U.admin, "insert into public.ops_client_users (user_id, client_id, full_name, email) values ($1, $2, 'Outro Armador', 'cliente2@example.com')", [U.cliente2, other.id]);
    const [row] = await as<{ email: string }>(U.cliente1, "select email from public.ops_client_users where user_id = $1", [U.cliente1]);
    assert.equal(row.email, "cliente1@example.com");
    await rejects(as(U.admin, "insert into public.ops_client_users (user_id, client_id, full_name, email) values ($1, $2, 'Técnico', 'x@example.com')", [U.tec1, clientId]), /client_user_is_member/);
    await rejects(as(U.tec1, "insert into public.ops_client_users (user_id, client_id, full_name, email) values ($1, $2, 'X', 'x@example.com')", [U.outsider, clientId]), /row-level security/);
    await rejects(as(U.supervisor, "update public.ops_client_users set active = false where user_id = $1 returning user_id", [U.cliente1]).then((r) => { if (r.length) throw new Error("alterou"); throw new Error("row-level security"); }), /row-level security/);
  });

  await test("portal do cliente: sem acesso directo às tabelas internas", async () => {
    for (const t of ["ops_work_orders", "ops_tasks", "ops_attachments", "ops_expenses", "ops_quotes", "ops_work_order_finance", "ops_daily_reports", "ops_members", "ops_clients", "ops_vessels"]) {
      assert.equal((await as(U.cliente1, `select * from public.${t}`)).length, 0, `${t} não pode ser lida pelo cliente`);
    }
    await rejects(as(U.cliente1, "insert into public.ops_attachments (entity_type, entity_id, work_order_id, path, mime_type, size_bytes, uploaded_by) values ('work_order', $1, $1, 'x/y.jpg', 'image/jpeg', 10, $2)", [orderId, U.cliente1]), /row-level security/);
    await rejects(as(U.cliente1, "select public.ops_share_attachment(gen_random_uuid(), true)"), /not_authorized/);
  });

  await test("portal do cliente: vê só as suas embarcações e obras, com progresso e sem dados internos", async () => {
    const [{ data }] = await as<{ data: { vessels: { id: string }[]; orders: { id: string; number: string; progress: number }[] } }>(U.cliente1, "select public.ops_portal_overview() as data");
    assert.deepEqual(data.vessels.map((v) => v.id), [vesselId]);
    assert.ok(data.orders.some((o) => o.id === orderId));
    assert.ok(data.orders.every((o) => typeof o.progress === "number"));
    const [{ data: other }] = await as<{ data: { vessels: unknown[]; orders: unknown[] } }>(U.cliente2, "select public.ops_portal_overview() as data");
    assert.equal(other.vessels.length, 0);
    assert.equal(other.orders.length, 0);
    const [{ data: denied }] = await as<{ data: unknown }>(U.cliente2, "select public.ops_portal_order($1) as data", [orderId]);
    assert.equal(denied, null, "não abre obras de outro cliente");
    const [{ data: mine }] = await as<{ data: { order: Record<string, unknown>; tasks: Record<string, unknown>[] } }>(U.cliente1, "select public.ops_portal_order($1) as data", [orderId]);
    assert.ok(mine.tasks.length >= 5);
    assert.deepEqual(Object.keys(mine.tasks[0]).sort(), ["code", "completed_at", "due_at", "id", "parent_id", "progress", "start_at", "status", "title"]);
    for (const k of ["manager_id", "priority", "location", "created_by"]) assert.ok(!(k in mine.order), `a obra não expõe ${k}`);
    const [{ data: staff }] = await as<{ data: unknown }>(U.gestor, "select public.ops_portal_overview() as data");
    assert.equal(staff, null, "contas da equipa não são clientes");
  });

  await test("portal do cliente: só vê as fotografias que a equipa partilhar", async () => {
    const ins = (path: string, entity: string, entityId: string, mime = "image/jpeg") =>
      as<{ id: string }>(U.gestor, "insert into public.ops_attachments (entity_type, entity_id, work_order_id, path, mime_type, size_bytes, uploaded_by, caption) values ($1, $2, $3, $4, $5, 1000, $6, 'Chapas novas') returning id", [entity, entityId, orderId, path, mime, U.gestor]);
    const [photo] = await ins("task/a.jpg", "task", taskIds[2]);
    const [pdf] = await ins("work_order/b.pdf", "work_order", orderId, "application/pdf");
    const [receipt] = await ins("expense/c.jpg", "expense", orderId);
    const photos = async (who = U.cliente1) => (await as<{ data: { photos: { id: string; task: string | null; path: string }[] } | null }>(who, "select public.ops_portal_order($1) as data", [orderId]))[0].data?.photos ?? [];
    assert.equal((await photos()).length, 0, "nada é partilhado por omissão");
    await rejects(as(U.tec1, "select public.ops_share_attachment($1, true)", [photo.id]), /not_authorized/);
    await rejects(as(U.gestor, "select public.ops_share_attachment($1, true)", [pdf.id]), /attachment_not_shareable/);
    await rejects(as(U.gestor, "select public.ops_share_attachment($1, true)", [receipt.id]), /attachment_not_shareable/);
    await as(U.supervisor, "select public.ops_share_attachment($1, true)", [photo.id]);
    const shared = await photos();
    assert.equal(shared.length, 1);
    assert.match(shared[0].task ?? "", /^T03 · /);
    const [{ data: vesselPhotos }] = await as<{ data: unknown[] }>(U.cliente1, "select public.ops_portal_vessel_photos($1) as data", [vesselId]);
    assert.equal(vesselPhotos.length, 1);
    const [{ data: noVessel }] = await as<{ data: unknown }>(U.cliente2, "select public.ops_portal_vessel_photos($1) as data", [vesselId]);
    assert.equal(noVessel, null);
    await as(U.gestor, "select public.ops_share_attachment($1, false)", [photo.id]);
    assert.equal((await photos()).length, 0, "deixa de aparecer quando se retira a partilha");
    await as(U.gestor, "select public.ops_share_attachment($1, true)", [photo.id]);
  });

  await test("portal do cliente: conta desactivada ou cliente arquivado perde o acesso", async () => {
    await as(U.admin, "update public.ops_client_users set active = false where user_id = $1", [U.cliente2]);
    const [{ data }] = await as<{ data: unknown }>(U.cliente2, "select public.ops_portal_me() as data");
    assert.equal(data, null);
    await as(U.admin, "update public.ops_clients set archived = true where id = $1", [otherClientId]);
    await as(U.admin, "update public.ops_client_users set active = true where user_id = $1", [U.cliente2]);
    const [{ data: archived }] = await as<{ data: unknown }>(U.cliente2, "select public.ops_portal_overview() as data");
    assert.equal(archived, null);
    const [{ data: me }] = await as<{ data: { client: { name: string } } }>(U.cliente1, "select public.ops_portal_me() as data");
    assert.equal(me.client.name, "Pescas do Atlântico, Lda");
  });

  await test("só a Administração gere utilizadores e papéis", async () => {
    const upd = await as<{ user_id: string }>(U.gestor, "update public.ops_members set role = 'admin' where user_id = $1 returning user_id", [U.gestor]);
    assert.equal(upd.length, 0);
    await as(U.admin, "update public.ops_members set active = false where user_id = $1", [U.tec2]);
    assert.equal((await as(U.tec2, "select * from public.ops_tasks")).length, 0, "conta desactivada perde o acesso");
  });

  console.log(`\n${passed} testes passaram.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
