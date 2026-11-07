-- =====================================================================
-- Ponto Radical — Gestão de Obras Navais (área empresarial /gestao)
--
-- Módulo independente do CMS: tabelas com prefixo ops_, papéis próprios
-- (ops_members) e Row Level Security por perfil. Partilha apenas o
-- Supabase Auth com o resto do projecto. Migração aditiva: não altera
-- nenhuma tabela existente. Seguro para executar mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.ops_role as enum ('admin', 'direcao', 'gestor', 'supervisor', 'tecnico', 'financeiro');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_order_status as enum (
    'em_avaliacao', 'aguarda_orcamento', 'aguarda_aprovacao', 'aprovada', 'planeada',
    'em_execucao', 'suspensa', 'concluida', 'entregue', 'cancelada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_priority as enum ('baixa', 'media', 'alta', 'urgente');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_task_status as enum ('por_iniciar', 'em_curso', 'suspensa', 'concluida', 'validada', 'cancelada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_expense_category as enum (
    'materiais', 'mao_de_obra', 'equipamentos', 'transportes', 'combustivel', 'alimentacao', 'alojamento',
    'servicos_externos', 'subcontratacoes', 'consumiveis', 'imprevistos', 'outros');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_expense_stage as enum ('prevista', 'comprometida', 'realizada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_approval as enum ('pendente', 'aprovada', 'rejeitada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_quote_status as enum ('rascunho', 'submetido', 'aprovado', 'rejeitado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_report_status as enum ('submetido', 'validado', 'correccao');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_incident_category as enum (
    'meteorologia', 'falta_materiais', 'transporte', 'atraso_cliente', 'acesso', 'seguranca',
    'falha_equipamento', 'alteracao', 'coordenacao', 'acidente', 'outro');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_urgency as enum ('baixo', 'medio', 'alto', 'critico');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_incident_status as enum ('aberta', 'em_analise', 'resolvida', 'encerrada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ops_notification_status as enum ('agendada', 'em_envio', 'enviada', 'entregue', 'lida', 'falhada', 'cancelada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Membros (colaboradores) e permissões
-- ---------------------------------------------------------------------
create table if not exists public.ops_members (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  full_name             text not null check (char_length(full_name) between 2 and 120),
  email                 text not null,
  role                  public.ops_role not null default 'tecnico',
  job_title             text,
  active                boolean not null default true,
  must_change_password  boolean not null default false,
  whatsapp_phone        text check (whatsapp_phone is null or whatsapp_phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_consent      boolean not null default false,
  whatsapp_consent_at   timestamptz,
  whatsapp_consent_source text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists ops_members_email_idx on public.ops_members (lower(email));

-- Custo horário (informação financeira, separada para a RLS).
create table if not exists public.ops_member_rates (
  user_id      uuid primary key references public.ops_members (user_id) on delete cascade,
  hourly_cost  numeric(14, 2) not null default 0 check (hourly_cost >= 0),
  updated_at   timestamptz not null default now()
);

create or replace function public.ops_my_role()
returns public.ops_role language sql stable security definer set search_path = public as $$
  select role from public.ops_members where user_id = auth.uid() and active;
$$;

create or replace function public.ops_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ops_members where user_id = auth.uid() and active);
$$;

create or replace function public.ops_has_role(variadic p_roles public.ops_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ops_members where user_id = auth.uid() and active and role = any (p_roles));
$$;

-- Gestão operacional (planeia, atribui, valida).
create or replace function public.ops_can_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select public.ops_has_role('admin', 'direcao', 'gestor', 'supervisor');
$$;

-- Acesso a informação financeira.
create or replace function public.ops_can_finance()
returns boolean language sql stable security definer set search_path = public as $$
  select public.ops_has_role('admin', 'direcao', 'gestor', 'financeiro');
$$;

-- ---------------------------------------------------------------------
-- Numeração sequencial sem duplicações (CL-0001, EMB-0001, OS-2026-0001)
-- ---------------------------------------------------------------------
create table if not exists public.ops_counters (
  key    text primary key,
  value  integer not null
);

create or replace function public.ops_next_number(p_key text)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  insert into public.ops_counters (key, value) values (p_key, 1)
  on conflict (key) do update set value = ops_counters.value + 1
  returning value into v;
  return v;
end;
$$;
revoke all on function public.ops_next_number(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Clientes, embarcações, fornecedores, equipas, materiais
-- ---------------------------------------------------------------------
create table if not exists public.ops_clients (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null check (char_length(name) between 2 and 160),
  legal_name      text,
  nif             text,
  phone           text,
  email           text,
  address         text,
  contact_person  text,
  notes           text,
  archived        boolean not null default false,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists ops_clients_nif_idx on public.ops_clients (nif) where nif is not null and nif <> '';
create index if not exists ops_clients_name_idx on public.ops_clients (lower(name));

create table if not exists public.ops_vessels (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  client_id       uuid not null references public.ops_clients (id) on delete restrict,
  name            text not null check (char_length(name) between 1 and 120),
  vessel_type     text not null default 'recreio'
                  check (vessel_type in ('pesca', 'turistica', 'recreio', 'lancha', 'transporte', 'apoio_maritimo', 'outra')),
  registration    text,
  manufacturer    text,
  model           text,
  hull_type       text,
  length_m        numeric(6, 2) check (length_m is null or length_m > 0),
  propulsion      text,
  location        text,
  notes           text,
  archived        boolean not null default false,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists ops_vessels_registration_idx on public.ops_vessels (upper(registration))
  where registration is not null and registration <> '';
create index if not exists ops_vessels_client_idx on public.ops_vessels (client_id);

create table if not exists public.ops_suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  nif         text,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.ops_teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  leader_id   uuid references public.ops_members (user_id) on delete set null,
  created_at  timestamptz not null default now()
);
create table if not exists public.ops_team_members (
  team_id  uuid not null references public.ops_teams (id) on delete cascade,
  user_id  uuid not null references public.ops_members (user_id) on delete cascade,
  primary key (team_id, user_id)
);

create table if not exists public.ops_materials (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,
  name        text not null,
  unit        text not null default 'un',
  unit_cost   numeric(14, 2) not null default 0 check (unit_cost >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Obras (ordens de serviço)
-- ---------------------------------------------------------------------
create table if not exists public.ops_work_orders (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,
  client_id          uuid not null references public.ops_clients (id) on delete restrict,
  vessel_id          uuid not null references public.ops_vessels (id) on delete restrict,
  intervention_type  text not null,
  title              text not null check (char_length(title) between 3 and 200),
  description        text,
  location           text,
  manager_id         uuid references public.ops_members (user_id) on delete set null,
  team_id            uuid references public.ops_teams (id) on delete set null,
  start_date         date,
  due_date           date,
  priority           public.ops_priority not null default 'media',
  status             public.ops_order_status not null default 'em_avaliacao',
  closed_at          timestamptz,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index if not exists ops_work_orders_status_idx on public.ops_work_orders (status);
create index if not exists ops_work_orders_vessel_idx on public.ops_work_orders (vessel_id);
create index if not exists ops_work_orders_client_idx on public.ops_work_orders (client_id);

-- Valores contratuais (só perfis com acesso financeiro).
create table if not exists public.ops_work_order_finance (
  work_order_id    uuid primary key references public.ops_work_orders (id) on delete cascade,
  budget_initial   numeric(14, 2) check (budget_initial is null or budget_initial >= 0),
  budget_revised   numeric(14, 2) check (budget_revised is null or budget_revised >= 0),
  contract_price   numeric(14, 2) check (contract_price is null or contract_price >= 0),
  vat_rate         numeric(5, 2) not null default 14 check (vat_rate between 0 and 100),
  updated_at       timestamptz not null default now()
);

create or replace function public.ops_set_order_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare y text := to_char(timezone('Africa/Luanda', now()), 'YYYY');
begin
  if new.number is null or new.number = '' then
    new.number := 'OS-' || y || '-' || lpad(public.ops_next_number('os-' || y)::text, 4, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists ops_work_orders_number on public.ops_work_orders;
create trigger ops_work_orders_number before insert on public.ops_work_orders
  for each row execute function public.ops_set_order_number();

create or replace function public.ops_set_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.code is null or new.code = '' then
    new.code := tg_argv[0] || '-' || lpad(public.ops_next_number(tg_argv[1])::text, 4, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists ops_clients_code on public.ops_clients;
create trigger ops_clients_code before insert on public.ops_clients
  for each row execute function public.ops_set_code('CL', 'cliente');
drop trigger if exists ops_vessels_code on public.ops_vessels;
create trigger ops_vessels_code before insert on public.ops_vessels
  for each row execute function public.ops_set_code('EMB', 'embarcacao');

-- A embarcação tem de pertencer ao cliente da obra.
create or replace function public.ops_check_order_vessel()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.ops_vessels where id = new.vessel_id and client_id = new.client_id) then
    raise exception 'vessel_client_mismatch';
  end if;
  if new.status in ('concluida', 'entregue', 'cancelada') and new.closed_at is null then
    new.closed_at := now();
  elsif new.status not in ('concluida', 'entregue', 'cancelada') then
    new.closed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists ops_work_orders_check on public.ops_work_orders;
create trigger ops_work_orders_check before insert or update on public.ops_work_orders
  for each row execute function public.ops_check_order_vessel();

-- ---------------------------------------------------------------------
-- Tarefas e subtarefas
-- ---------------------------------------------------------------------
create table if not exists public.ops_tasks (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  work_order_id   uuid not null references public.ops_work_orders (id) on delete cascade,
  parent_id       uuid references public.ops_tasks (id) on delete cascade,
  title           text not null check (char_length(title) between 2 and 200),
  description     text,
  responsible_id  uuid references public.ops_members (user_id) on delete set null,
  priority        public.ops_priority not null default 'media',
  start_at        timestamptz,
  due_at          timestamptz,
  planned_hours   numeric(8, 2) not null default 0 check (planned_hours >= 0),
  status          public.ops_task_status not null default 'por_iniciar',
  progress        integer not null default 0 check (progress between 0 and 100),
  notes           text,
  sort_order      integer not null default 0,
  completed_at    timestamptz,
  validated_by    uuid references auth.users (id) on delete set null,
  validated_at    timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (work_order_id, code),
  check (due_at is null or start_at is null or due_at >= start_at)
);
create index if not exists ops_tasks_order_idx on public.ops_tasks (work_order_id, sort_order);
create index if not exists ops_tasks_due_idx on public.ops_tasks (due_at) where status not in ('concluida', 'validada', 'cancelada');
create index if not exists ops_tasks_responsible_idx on public.ops_tasks (responsible_id);

create table if not exists public.ops_task_assignees (
  task_id      uuid not null references public.ops_tasks (id) on delete cascade,
  user_id      uuid not null references public.ops_members (user_id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists ops_task_assignees_user_idx on public.ops_task_assignees (user_id);

create table if not exists public.ops_task_dependencies (
  task_id     uuid not null references public.ops_tasks (id) on delete cascade,
  depends_on  uuid not null references public.ops_tasks (id) on delete cascade,
  primary key (task_id, depends_on),
  check (task_id <> depends_on)
);

create or replace function public.ops_task_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if tg_op = 'INSERT' and (new.code is null or new.code = '') then
    v_count := public.ops_next_number('tarefa-' || new.work_order_id::text);
    new.code := 'T' || lpad(v_count::text, 2, '0');
  end if;
  if new.parent_id is not null and not exists (
    select 1 from public.ops_tasks where id = new.parent_id and work_order_id = new.work_order_id) then
    raise exception 'parent_other_order';
  end if;
  if new.status in ('concluida', 'validada') then
    new.progress := 100;
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  if new.status <> 'validada' then
    new.validated_by := null;
    new.validated_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists ops_tasks_before on public.ops_tasks;
create trigger ops_tasks_before before insert or update on public.ops_tasks
  for each row execute function public.ops_task_before();

create or replace function public.ops_is_task_member(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ops_tasks t where t.id = p_task and t.responsible_id = auth.uid())
      or exists (select 1 from public.ops_task_assignees a where a.task_id = p_task and a.user_id = auth.uid());
$$;

create or replace function public.ops_task_visible(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ops_is_member() and (
    public.ops_my_role() <> 'tecnico' or public.ops_is_task_member(p_task));
$$;

create or replace function public.ops_order_visible(p_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ops_is_member() and (
    public.ops_my_role() <> 'tecnico'
    or exists (select 1 from public.ops_work_orders o where o.id = p_order and o.manager_id = auth.uid())
    or exists (
      select 1 from public.ops_tasks t
      left join public.ops_task_assignees a on a.task_id = t.id
      where t.work_order_id = p_order and (t.responsible_id = auth.uid() or a.user_id = auth.uid())));
$$;

-- Registo de horas.
create table if not exists public.ops_time_entries (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.ops_tasks (id) on delete cascade,
  user_id     uuid not null references public.ops_members (user_id) on delete restrict,
  work_date   date not null,
  hours       numeric(5, 2) not null check (hours > 0 and hours <= 24),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists ops_time_entries_task_idx on public.ops_time_entries (task_id);
create index if not exists ops_time_entries_user_idx on public.ops_time_entries (user_id, work_date);

-- Técnico: actualiza só o estado/progresso das suas tarefas.
create or replace function public.ops_tech_update_task(p_task uuid, p_status public.ops_task_status, p_progress integer, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ops_is_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not (public.ops_can_manage() or public.ops_is_task_member(p_task)) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status in ('validada', 'cancelada') and not public.ops_can_manage() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.ops_tasks
     set status = p_status,
         progress = greatest(0, least(100, coalesce(p_progress, progress))),
         notes = case when coalesce(p_note, '') = '' then notes
                      else coalesce(notes || E'\n', '') || to_char(timezone('Africa/Luanda', now()), 'DD/MM HH24:MI') || ' — ' || p_note end
   where id = p_task;
  if not found then
    raise exception 'task_not_found';
  end if;
end;
$$;

-- Validação da tarefa (supervisão).
create or replace function public.ops_validate_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ops_can_manage() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.ops_tasks set status = 'validada' where id = p_task and status in ('concluida', 'validada');
  if not found then
    raise exception 'task_not_completed';
  end if;
  update public.ops_tasks set validated_by = auth.uid(), validated_at = now() where id = p_task;
end;
$$;

-- ---------------------------------------------------------------------
-- Finanças: orçamentos, despesas, consumos
-- ---------------------------------------------------------------------
create table if not exists public.ops_quotes (
  id              uuid primary key default gen_random_uuid(),
  work_order_id   uuid not null references public.ops_work_orders (id) on delete cascade,
  version         integer not null,
  status          public.ops_quote_status not null default 'rascunho',
  notes           text,
  vat_rate        numeric(5, 2) not null default 14 check (vat_rate between 0 and 100),
  valid_until     date,
  created_by      uuid references auth.users (id) on delete set null,
  submitted_at    timestamptz,
  decided_by      uuid references auth.users (id) on delete set null,
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz not null default now(),
  unique (work_order_id, version)
);

create table if not exists public.ops_quote_items (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.ops_quotes (id) on delete cascade,
  description  text not null,
  category     public.ops_expense_category not null default 'materiais',
  quantity     numeric(12, 3) not null default 1 check (quantity > 0),
  unit_cost    numeric(14, 2) not null default 0 check (unit_cost >= 0),
  unit_price   numeric(14, 2) not null default 0 check (unit_price >= 0),
  total_cost   numeric(16, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  total_price  numeric(16, 2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order   integer not null default 0
);

-- Itens de orçamentos submetidos ou decididos ficam bloqueados.
create or replace function public.ops_quote_items_lock()
returns trigger language plpgsql set search_path = public as $$
declare v_status public.ops_quote_status;
begin
  select status into v_status from public.ops_quotes where id = coalesce(new.quote_id, old.quote_id);
  if v_status is distinct from 'rascunho' then
    raise exception 'quote_locked';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists ops_quote_items_lock on public.ops_quote_items;
create trigger ops_quote_items_lock before insert or update or delete on public.ops_quote_items
  for each row execute function public.ops_quote_items_lock();

-- Decisão de orçamento (Direcção/Administração): actualiza os valores contratuais na mesma transacção.
create or replace function public.ops_decide_quote(p_quote uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_quote public.ops_quotes%rowtype; v_cost numeric; v_price numeric;
begin
  if not public.ops_has_role('admin', 'direcao') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_quote from public.ops_quotes where id = p_quote for update;
  if not found then raise exception 'quote_not_found'; end if;
  if v_quote.status <> 'submetido' then raise exception 'quote_not_submitted'; end if;

  update public.ops_quotes
     set status = case when p_approve then 'aprovado'::public.ops_quote_status else 'rejeitado'::public.ops_quote_status end,
         decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), '')
   where id = p_quote;

  if p_approve then
    select coalesce(sum(total_cost), 0), coalesce(sum(total_price), 0) into v_cost, v_price
      from public.ops_quote_items where quote_id = p_quote;
    insert into public.ops_work_order_finance (work_order_id, budget_initial, budget_revised, contract_price, vat_rate)
    values (v_quote.work_order_id, v_cost, v_cost, v_price, v_quote.vat_rate)
    on conflict (work_order_id) do update
      set budget_initial = coalesce(ops_work_order_finance.budget_initial, excluded.budget_initial),
          budget_revised = excluded.budget_revised,
          contract_price = excluded.contract_price,
          vat_rate = excluded.vat_rate,
          updated_at = now();
    update public.ops_work_orders set status = 'aprovada'
     where id = v_quote.work_order_id and status in ('em_avaliacao', 'aguarda_orcamento', 'aguarda_aprovacao');
  end if;
end;
$$;

create table if not exists public.ops_expenses (
  id               uuid primary key default gen_random_uuid(),
  work_order_id    uuid not null references public.ops_work_orders (id) on delete restrict,
  task_id          uuid references public.ops_tasks (id) on delete set null,
  expense_date     date not null,
  category         public.ops_expense_category not null,
  description      text not null check (char_length(description) between 2 and 300),
  quantity         numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price       numeric(14, 2) not null check (unit_price >= 0),
  total            numeric(16, 2) generated always as (round(quantity * unit_price, 2)) stored,
  vat_rate         numeric(5, 2) not null default 14 check (vat_rate between 0 and 100),
  stage            public.ops_expense_stage not null default 'realizada',
  supplier_id      uuid references public.ops_suppliers (id) on delete set null,
  responsible_id   uuid references public.ops_members (user_id) on delete set null,
  approval         public.ops_approval not null default 'pendente',
  approved_by      uuid references auth.users (id) on delete set null,
  approved_at      timestamptz,
  rejection_note   text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ops_expenses_order_idx on public.ops_expenses (work_order_id, expense_date);
create index if not exists ops_expenses_task_idx on public.ops_expenses (task_id);

-- Integridade financeira: só Direcção/Financeiro/Administração aprovam; aprovadas ficam bloqueadas.
create or replace function public.ops_expenses_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.approval = 'aprovada' then raise exception 'expense_locked'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.approval <> 'pendente' and not public.ops_has_role('admin', 'direcao', 'financeiro') then
      new.approval := 'pendente';
    end if;
  else
    if old.approval = 'aprovada' and (
      new.quantity is distinct from old.quantity or new.unit_price is distinct from old.unit_price
      or new.vat_rate is distinct from old.vat_rate or new.work_order_id is distinct from old.work_order_id
      or new.category is distinct from old.category or new.approval is distinct from old.approval) then
      -- A única mudança permitida numa despesa aprovada é a passagem de comprometida a realizada.
      raise exception 'expense_locked';
    end if;
    if new.approval is distinct from old.approval and not public.ops_has_role('admin', 'direcao', 'financeiro') then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
  end if;
  if new.approval = 'aprovada' and (tg_op = 'INSERT' or old.approval <> 'aprovada') then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists ops_expenses_guard on public.ops_expenses;
create trigger ops_expenses_guard before insert or update or delete on public.ops_expenses
  for each row execute function public.ops_expenses_guard();

create table if not exists public.ops_material_consumptions (
  id               uuid primary key default gen_random_uuid(),
  work_order_id    uuid not null references public.ops_work_orders (id) on delete restrict,
  task_id          uuid references public.ops_tasks (id) on delete set null,
  material_id      uuid not null references public.ops_materials (id) on delete restrict,
  quantity         numeric(12, 3) not null check (quantity > 0),
  unit_cost        numeric(14, 2) not null check (unit_cost >= 0),
  total            numeric(16, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  consumed_on      date not null,
  user_id          uuid references public.ops_members (user_id) on delete set null,
  daily_report_id  uuid,
  created_at       timestamptz not null default now()
);
create index if not exists ops_material_consumptions_order_idx on public.ops_material_consumptions (work_order_id);

-- O custo unitário vem sempre do catálogo (o técnico não o define).
create or replace function public.ops_consumption_cost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select unit_cost into new.unit_cost from public.ops_materials where id = new.material_id;
  if new.unit_cost is null then raise exception 'material_not_found'; end if;
  return new;
end;
$$;
drop trigger if exists ops_consumption_cost on public.ops_material_consumptions;
create trigger ops_consumption_cost before insert on public.ops_material_consumptions
  for each row execute function public.ops_consumption_cost();

-- ---------------------------------------------------------------------
-- Relatórios diários e ocorrências
-- ---------------------------------------------------------------------
create table if not exists public.ops_daily_reports (
  id               uuid primary key default gen_random_uuid(),
  report_date      date not null,
  work_order_id    uuid not null references public.ops_work_orders (id) on delete cascade,
  user_id          uuid not null references public.ops_members (user_id) on delete restrict,
  location         text,
  activities       text not null check (char_length(activities) >= 3),
  hours            numeric(5, 2) not null default 0 check (hours between 0 and 24),
  materials_used   text,
  tasks_done       text,
  tasks_pending    text,
  difficulties     text,
  notes            text,
  status           public.ops_report_status not null default 'submetido',
  reviewer_id      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (work_order_id, user_id, report_date)
);
create index if not exists ops_daily_reports_date_idx on public.ops_daily_reports (report_date desc);

create or replace function public.ops_reports_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'submetido';
    new.reviewer_id := null;
    new.reviewed_at := null;
    new.review_note := null;
  end if;
  if tg_op = 'UPDATE' then
    if (new.status is distinct from old.status or new.review_note is distinct from old.review_note) and not public.ops_can_manage() then
      -- O autor só pode reenviar após pedido de correcção.
      if not (old.status = 'correccao' and new.status = 'submetido' and old.user_id = auth.uid()) then
        raise exception 'not_authorized' using errcode = '42501';
      end if;
    end if;
    if old.status = 'validado' and not public.ops_can_manage() then
      raise exception 'report_locked';
    end if;
    if new.status is distinct from old.status and new.status in ('validado', 'correccao') then
      new.reviewer_id := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists ops_reports_guard on public.ops_daily_reports;
create trigger ops_reports_guard before insert or update on public.ops_daily_reports
  for each row execute function public.ops_reports_guard();

create table if not exists public.ops_incidents (
  id                  uuid primary key default gen_random_uuid(),
  occurred_at         timestamptz not null default now(),
  work_order_id       uuid not null references public.ops_work_orders (id) on delete cascade,
  task_id             uuid references public.ops_tasks (id) on delete set null,
  reporter_id         uuid not null references public.ops_members (user_id) on delete restrict,
  location            text,
  category            public.ops_incident_category not null,
  description         text not null check (char_length(description) >= 5),
  impact              text,
  urgency             public.ops_urgency not null default 'medio',
  proposed_measures   text,
  owner_id            uuid references public.ops_members (user_id) on delete set null,
  status              public.ops_incident_status not null default 'aberta',
  corrective_task_id  uuid references public.ops_tasks (id) on delete set null,
  resolution_note     text,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists ops_incidents_order_idx on public.ops_incidents (work_order_id, occurred_at desc);
create index if not exists ops_incidents_open_idx on public.ops_incidents (urgency) where status in ('aberta', 'em_analise');

-- ---------------------------------------------------------------------
-- Documentos e fotografias (Storage privado «ops»)
-- ---------------------------------------------------------------------
create table if not exists public.ops_attachments (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null check (entity_type in ('work_order', 'vessel', 'client', 'task', 'expense', 'report', 'incident')),
  entity_id      uuid not null,
  work_order_id  uuid references public.ops_work_orders (id) on delete cascade,
  path           text not null unique,
  mime_type      text not null,
  size_bytes     bigint not null,
  caption        text,
  uploaded_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists ops_attachments_entity_idx on public.ops_attachments (entity_type, entity_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ops', 'ops', false, 15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ops_objects_insert on storage.objects;
create policy ops_objects_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'ops' and public.ops_is_member());
-- Leitura e remoção só pelo servidor (URLs assinados após verificar a permissão na tabela ops_attachments).

-- ---------------------------------------------------------------------
-- Notificações WhatsApp: modelos, lembretes, fila e eventos
-- ---------------------------------------------------------------------
create table if not exists public.ops_settings (
  id                     smallint primary key default 1 check (id = 1),
  company_name           text not null default 'Ponto Radical',
  default_vat_rate       numeric(5, 2) not null default 14 check (default_vat_rate between 0 and 100),
  timezone               text not null default 'Africa/Luanda',
  daily_reminder_enabled boolean not null default true,
  daily_reminder_time    time not null default '07:30',
  weekly_summary_enabled boolean not null default true,
  weekly_summary_dow     smallint not null default 1 check (weekly_summary_dow between 0 and 6),
  weekly_summary_time    time not null default '08:00',
  task_start_lead_minutes integer not null default 60 check (task_start_lead_minutes between 0 and 10080),
  due_soon_hours         integer not null default 24 check (due_soon_hours between 1 and 720),
  whatsapp_enabled       boolean not null default false,
  max_messages_per_run   integer not null default 40 check (max_messages_per_run between 1 and 500),
  updated_at             timestamptz not null default now()
);
insert into public.ops_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.ops_whatsapp_templates (
  event          text primary key,
  template_name  text not null,
  language       text not null default 'pt_PT',
  enabled        boolean not null default true,
  updated_at     timestamptz not null default now()
);
insert into public.ops_whatsapp_templates (event, template_name) values
  ('tarefa_atribuida', 'pr_notificacao_obra'),
  ('tarefa_inicio', 'pr_notificacao_obra'),
  ('prazo_proximo', 'pr_notificacao_obra'),
  ('tarefa_atrasada', 'pr_notificacao_obra'),
  ('alteracao_horario', 'pr_notificacao_obra'),
  ('tarefa_cancelada', 'pr_notificacao_obra'),
  ('ocorrencia_critica', 'pr_notificacao_obra'),
  ('pedido_aprovacao', 'pr_notificacao_obra'),
  ('lembrete', 'pr_notificacao_obra'),
  ('lembrete_diario', 'pr_resumo_obras'),
  ('resumo_semanal', 'pr_resumo_obras')
on conflict (event) do nothing;

create table if not exists public.ops_reminders (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid references public.ops_tasks (id) on delete cascade,
  work_order_id      uuid references public.ops_work_orders (id) on delete cascade,
  title              text not null,
  message            text,
  recipients         uuid[] not null check (cardinality(recipients) between 1 and 50),
  send_at            timestamptz not null,
  lead_minutes       integer not null default 0 check (lead_minutes between 0 and 10080),
  repeat             text not null default 'nenhuma' check (repeat in ('nenhuma', 'diaria', 'semanal')),
  repeat_until       timestamptz,
  cancel_when_done   boolean not null default true,
  status             text not null default 'activo' check (status in ('activo', 'cancelado', 'concluido')),
  last_fired_at      timestamptz,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists ops_reminders_due_idx on public.ops_reminders (send_at) where status = 'activo';

create table if not exists public.ops_notifications (
  id                 uuid primary key default gen_random_uuid(),
  dedupe_key         text not null unique,
  event              text not null,
  recipient_id       uuid references public.ops_members (user_id) on delete set null,
  phone              text not null,
  template_name      text not null,
  language           text not null,
  params             jsonb not null default '[]'::jsonb,
  preview            text not null,
  work_order_id      uuid references public.ops_work_orders (id) on delete set null,
  task_id            uuid references public.ops_tasks (id) on delete set null,
  status             public.ops_notification_status not null default 'agendada',
  scheduled_for      timestamptz not null default now(),
  attempts           integer not null default 0,
  next_attempt_at    timestamptz not null default now(),
  locked_at          timestamptz,
  wa_message_id      text unique,
  last_error         text,
  api_response       jsonb,
  sent_at            timestamptz,
  delivered_at       timestamptz,
  read_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists ops_notifications_queue_idx on public.ops_notifications (next_attempt_at) where status = 'agendada';

create table if not exists public.ops_whatsapp_events (
  id           bigint generated always as identity primary key,
  received_at  timestamptz not null default now(),
  kind         text not null,
  wa_message_id text,
  status       text,
  from_phone   text,
  payload      jsonb not null
);

-- Reclama mensagens prontas a enviar sem duplicar trabalho entre execuções simultâneas (só servidor).
create or replace function public.ops_claim_notifications(p_limit integer)
returns setof public.ops_notifications language plpgsql security definer set search_path = public as $$
begin
  -- Mensagens presas «em envio» há mais de 10 minutos voltam à fila.
  update public.ops_notifications set status = 'agendada', locked_at = null
   where status = 'em_envio' and locked_at < now() - interval '10 minutes';
  return query
  update public.ops_notifications n set status = 'em_envio', locked_at = now(), attempts = n.attempts + 1
   where n.id in (
     select id from public.ops_notifications
      where status = 'agendada' and scheduled_for <= now() and next_attempt_at <= now()
      order by scheduled_for
      limit greatest(1, p_limit)
      for update skip locked)
  returning n.*;
end;
$$;
revoke all on function public.ops_claim_notifications(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Auditoria e linha temporal
-- ---------------------------------------------------------------------
create table if not exists public.ops_activity (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  actor_id       uuid,
  actor_name     text,
  table_name     text not null,
  record_id      text,
  work_order_id  uuid,
  action         text not null,
  changes        jsonb not null default '{}'::jsonb
);
create index if not exists ops_activity_order_idx on public.ops_activity (work_order_id, created_at desc);
create index if not exists ops_activity_created_idx on public.ops_activity (created_at desc);

create or replace function public.ops_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_order uuid;
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at', 'locked_at') and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_array(v_old -> v_key, v_new -> v_key));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return new; end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new - 'created_at' - 'updated_at';
  else
    v_changes := v_old;
  end if;

  v_order := case
    when tg_table_name = 'ops_work_orders' then (v_row ->> 'id')::uuid
    when v_row ? 'work_order_id' then nullif(v_row ->> 'work_order_id', '')::uuid
    when tg_table_name = 'ops_work_order_finance' then (v_row ->> 'work_order_id')::uuid
    else null end;

  insert into public.ops_activity (actor_id, actor_name, table_name, record_id, work_order_id, action, changes)
  values (auth.uid(), (select full_name from public.ops_members where user_id = auth.uid()), tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'work_order_id', v_row ->> 'user_id'), v_order, lower(tg_op), v_changes);
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['ops_members', 'ops_clients', 'ops_vessels', 'ops_work_orders', 'ops_work_order_finance',
    'ops_tasks', 'ops_expenses', 'ops_quotes', 'ops_daily_reports', 'ops_incidents', 'ops_reminders',
    'ops_material_consumptions', 'ops_member_rates', 'ops_settings', 'ops_whatsapp_templates'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.ops_audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Vistas de cálculo (respeitam a RLS de quem consulta)
-- ---------------------------------------------------------------------
create or replace view public.ops_task_hours with (security_invoker = on) as
  select t.id as task_id, t.work_order_id, coalesce(sum(e.hours), 0)::numeric(10, 2) as used_hours
    from public.ops_tasks t left join public.ops_time_entries e on e.task_id = t.id
   group by t.id;

-- Progresso da obra ponderado pelas horas previstas das tarefas principais (peso 1 quando não há horas).
create or replace view public.ops_work_order_progress with (security_invoker = on) as
  select o.id as work_order_id,
         count(t.id) filter (where t.status <> 'cancelada') as tasks_total,
         count(t.id) filter (where t.status in ('concluida', 'validada')) as tasks_done,
         count(t.id) filter (where t.status not in ('concluida', 'validada', 'cancelada') and t.due_at < now()) as tasks_late,
         case when count(t.id) filter (where t.status <> 'cancelada') = 0 then 0
              else round(
                sum(t.progress * case when t.planned_hours > 0 then t.planned_hours else 1 end) filter (where t.status <> 'cancelada')
                / nullif(sum(case when t.planned_hours > 0 then t.planned_hours else 1 end) filter (where t.status <> 'cancelada'), 0))
         end::integer as progress
    from public.ops_work_orders o
    left join public.ops_tasks t on t.work_order_id = o.id and t.parent_id is null
   group by o.id;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ops_members', 'ops_member_rates', 'ops_counters', 'ops_clients', 'ops_vessels', 'ops_suppliers',
    'ops_teams', 'ops_team_members', 'ops_materials', 'ops_work_orders', 'ops_work_order_finance', 'ops_tasks',
    'ops_task_assignees', 'ops_task_dependencies', 'ops_time_entries', 'ops_quotes', 'ops_quote_items', 'ops_expenses',
    'ops_material_consumptions', 'ops_daily_reports', 'ops_incidents', 'ops_attachments', 'ops_settings',
    'ops_whatsapp_templates', 'ops_reminders', 'ops_notifications', 'ops_whatsapp_events', 'ops_activity'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Remove políticas anteriores deste módulo (permite re-executar a migração).
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename like 'ops\_%' loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Membros: todos os membros vêem a equipa; só a Administração altera.
create policy ops_members_read on public.ops_members for select to authenticated using (public.ops_is_member() or user_id = auth.uid());
create policy ops_members_admin on public.ops_members for all to authenticated
  using (public.ops_has_role('admin')) with check (public.ops_has_role('admin'));
create policy ops_rates_read on public.ops_member_rates for select to authenticated using (public.ops_can_finance());
create policy ops_rates_write on public.ops_member_rates for all to authenticated
  using (public.ops_has_role('admin', 'financeiro')) with check (public.ops_has_role('admin', 'financeiro'));

-- Clientes, embarcações e catálogos.
create policy ops_clients_read on public.ops_clients for select to authenticated using (public.ops_is_member());
create policy ops_clients_write on public.ops_clients for insert to authenticated with check (public.ops_has_role('admin', 'direcao', 'gestor'));
create policy ops_clients_update on public.ops_clients for update to authenticated
  using (public.ops_has_role('admin', 'direcao', 'gestor')) with check (public.ops_has_role('admin', 'direcao', 'gestor'));
create policy ops_clients_delete on public.ops_clients for delete to authenticated using (public.ops_has_role('admin'));

create policy ops_vessels_read on public.ops_vessels for select to authenticated using (public.ops_is_member());
create policy ops_vessels_write on public.ops_vessels for insert to authenticated with check (public.ops_has_role('admin', 'direcao', 'gestor'));
create policy ops_vessels_update on public.ops_vessels for update to authenticated
  using (public.ops_has_role('admin', 'direcao', 'gestor')) with check (public.ops_has_role('admin', 'direcao', 'gestor'));
create policy ops_vessels_delete on public.ops_vessels for delete to authenticated using (public.ops_has_role('admin'));

create policy ops_suppliers_read on public.ops_suppliers for select to authenticated using (public.ops_is_member());
create policy ops_suppliers_write on public.ops_suppliers for all to authenticated using (public.ops_can_finance()) with check (public.ops_can_finance());
create policy ops_teams_read on public.ops_teams for select to authenticated using (public.ops_is_member());
create policy ops_teams_write on public.ops_teams for all to authenticated
  using (public.ops_has_role('admin', 'direcao', 'gestor')) with check (public.ops_has_role('admin', 'direcao', 'gestor'));
create policy ops_team_members_read on public.ops_team_members for select to authenticated using (public.ops_is_member());
create policy ops_team_members_write on public.ops_team_members for all to authenticated
  using (public.ops_has_role('admin', 'direcao', 'gestor')) with check (public.ops_has_role('admin', 'direcao', 'gestor'));
create policy ops_materials_read on public.ops_materials for select to authenticated using (public.ops_is_member());
create policy ops_materials_write on public.ops_materials for all to authenticated
  using (public.ops_has_role('admin', 'direcao', 'gestor', 'financeiro')) with check (public.ops_has_role('admin', 'direcao', 'gestor', 'financeiro'));

-- Obras.
create policy ops_orders_read on public.ops_work_orders for select to authenticated using (public.ops_order_visible(id));
create policy ops_orders_insert on public.ops_work_orders for insert to authenticated with check (public.ops_has_role('admin', 'direcao', 'gestor'));
create policy ops_orders_update on public.ops_work_orders for update to authenticated
  using (public.ops_has_role('admin', 'direcao', 'gestor', 'supervisor')) with check (public.ops_has_role('admin', 'direcao', 'gestor', 'supervisor'));
create policy ops_orders_delete on public.ops_work_orders for delete to authenticated using (public.ops_has_role('admin'));
create policy ops_finance_read on public.ops_work_order_finance for select to authenticated using (public.ops_can_finance());
create policy ops_finance_write on public.ops_work_order_finance for all to authenticated
  using (public.ops_has_role('admin', 'direcao', 'financeiro')) with check (public.ops_has_role('admin', 'direcao', 'financeiro'));

-- Tarefas: técnicos vêem as suas; alteram estado só através de ops_tech_update_task.
create policy ops_tasks_read on public.ops_tasks for select to authenticated using (public.ops_task_visible(id));
create policy ops_tasks_insert on public.ops_tasks for insert to authenticated with check (public.ops_can_manage());
create policy ops_tasks_update on public.ops_tasks for update to authenticated using (public.ops_can_manage()) with check (public.ops_can_manage());
create policy ops_tasks_delete on public.ops_tasks for delete to authenticated using (public.ops_has_role('admin', 'direcao', 'gestor'));
create policy ops_assignees_read on public.ops_task_assignees for select to authenticated using (public.ops_task_visible(task_id));
create policy ops_assignees_write on public.ops_task_assignees for all to authenticated using (public.ops_can_manage()) with check (public.ops_can_manage());
create policy ops_deps_read on public.ops_task_dependencies for select to authenticated using (public.ops_task_visible(task_id));
create policy ops_deps_write on public.ops_task_dependencies for all to authenticated using (public.ops_can_manage()) with check (public.ops_can_manage());

create policy ops_time_read on public.ops_time_entries for select to authenticated
  using (user_id = auth.uid() or public.ops_has_role('admin', 'direcao', 'gestor', 'supervisor', 'financeiro'));
create policy ops_time_insert on public.ops_time_entries for insert to authenticated
  with check (public.ops_is_member() and (
    (user_id = auth.uid() and public.ops_task_visible(task_id)) or public.ops_can_manage()));
create policy ops_time_delete on public.ops_time_entries for delete to authenticated
  using ((user_id = auth.uid() and created_at > now() - interval '48 hours') or public.ops_can_manage());

-- Finanças.
create policy ops_quotes_read on public.ops_quotes for select to authenticated using (public.ops_can_finance());
create policy ops_quotes_insert on public.ops_quotes for insert to authenticated with check (public.ops_can_finance());
create policy ops_quotes_update on public.ops_quotes for update to authenticated
  using (public.ops_can_finance() and status = 'rascunho')
  with check (public.ops_can_finance() and status in ('rascunho', 'submetido'));
create policy ops_quote_items_read on public.ops_quote_items for select to authenticated using (public.ops_can_finance());
create policy ops_quote_items_write on public.ops_quote_items for all to authenticated using (public.ops_can_finance()) with check (public.ops_can_finance());

create policy ops_expenses_read on public.ops_expenses for select to authenticated using (public.ops_can_finance());
create policy ops_expenses_insert on public.ops_expenses for insert to authenticated with check (public.ops_can_finance());
create policy ops_expenses_update on public.ops_expenses for update to authenticated using (public.ops_can_finance()) with check (public.ops_can_finance());
create policy ops_expenses_delete on public.ops_expenses for delete to authenticated using (public.ops_can_finance());

create policy ops_consumptions_read on public.ops_material_consumptions for select to authenticated
  using (public.ops_can_finance() or user_id = auth.uid());
create policy ops_consumptions_insert on public.ops_material_consumptions for insert to authenticated
  with check (public.ops_is_member() and public.ops_order_visible(work_order_id) and (user_id = auth.uid() or public.ops_can_manage()));

-- Relatórios diários.
create policy ops_reports_read on public.ops_daily_reports for select to authenticated
  using (user_id = auth.uid() or public.ops_has_role('admin', 'direcao', 'gestor', 'supervisor'));
create policy ops_reports_insert on public.ops_daily_reports for insert to authenticated
  with check (user_id = auth.uid() and public.ops_order_visible(work_order_id));
create policy ops_reports_update on public.ops_daily_reports for update to authenticated
  using (user_id = auth.uid() or public.ops_can_manage()) with check (user_id = auth.uid() or public.ops_can_manage());

-- Ocorrências: qualquer membro reporta; técnicos vêem as suas.
create policy ops_incidents_read on public.ops_incidents for select to authenticated
  using (reporter_id = auth.uid() or owner_id = auth.uid() or public.ops_has_role('admin', 'direcao', 'gestor', 'supervisor'));
create policy ops_incidents_insert on public.ops_incidents for insert to authenticated
  with check (reporter_id = auth.uid() and public.ops_order_visible(work_order_id));
create policy ops_incidents_update on public.ops_incidents for update to authenticated
  using (public.ops_can_manage() or owner_id = auth.uid()) with check (public.ops_can_manage() or owner_id = auth.uid());

-- Anexos: visíveis conforme a entidade.
create policy ops_attachments_read on public.ops_attachments for select to authenticated using (
  public.ops_is_member() and (
    uploaded_by = auth.uid()
    or (entity_type = 'expense' and public.ops_can_finance())
    or (entity_type in ('client', 'vessel'))
    or (entity_type in ('work_order', 'task', 'report', 'incident') and public.ops_order_visible(work_order_id))));
create policy ops_attachments_insert on public.ops_attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and public.ops_is_member());
create policy ops_attachments_delete on public.ops_attachments for delete to authenticated
  using (uploaded_by = auth.uid() or public.ops_has_role('admin', 'gestor'));

-- Definições e notificações.
create policy ops_settings_read on public.ops_settings for select to authenticated using (public.ops_is_member());
create policy ops_settings_write on public.ops_settings for update to authenticated using (public.ops_has_role('admin')) with check (public.ops_has_role('admin'));
create policy ops_templates_read on public.ops_whatsapp_templates for select to authenticated using (public.ops_has_role('admin', 'direcao', 'gestor'));
create policy ops_templates_write on public.ops_whatsapp_templates for all to authenticated using (public.ops_has_role('admin')) with check (public.ops_has_role('admin'));
create policy ops_reminders_read on public.ops_reminders for select to authenticated using (public.ops_can_manage() or auth.uid() = any (recipients));
create policy ops_reminders_write on public.ops_reminders for all to authenticated using (public.ops_can_manage()) with check (public.ops_can_manage());
create policy ops_notifications_read on public.ops_notifications for select to authenticated
  using (public.ops_has_role('admin', 'direcao', 'gestor') or recipient_id = auth.uid());
create policy ops_wa_events_read on public.ops_whatsapp_events for select to authenticated using (public.ops_has_role('admin'));
create policy ops_activity_read on public.ops_activity for select to authenticated
  using (public.ops_has_role('admin', 'direcao') or (work_order_id is not null and public.ops_can_manage() and public.ops_order_visible(work_order_id)));

-- Permissões de execução das funções.
revoke all on function public.ops_tech_update_task(uuid, public.ops_task_status, integer, text) from public, anon;
revoke all on function public.ops_validate_task(uuid) from public, anon;
revoke all on function public.ops_decide_quote(uuid, boolean, text) from public, anon;
grant execute on function public.ops_tech_update_task(uuid, public.ops_task_status, integer, text) to authenticated;
grant execute on function public.ops_validate_task(uuid) to authenticated;
grant execute on function public.ops_decide_quote(uuid, boolean, text) to authenticated;
