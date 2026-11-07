-- =====================================================================
-- Painel /admin — Tarefas (registo, controlo e alertas) e
-- Saídas de material fornecido à Promarine (guias de entrega).
-- Aditiva e idempotente. Acesso: equipa do painel (is_staff); apagar só administradores.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Numeração anual: TR-2026-0001 (tarefas), GS-2026-0001 (guias de saída)
-- ---------------------------------------------------------------------
create table if not exists public.pr_counters (
  prefix  text not null,
  year    integer not null,
  value   integer not null default 0,
  primary key (prefix, year)
);
alter table public.pr_counters enable row level security;
revoke all on public.pr_counters from anon, authenticated;

create or replace function public.pr_next_code(p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from (now() at time zone 'Africa/Luanda'))::integer;
  v_value integer;
begin
  insert into public.pr_counters (prefix, year, value) values (p_prefix, v_year, 1)
  on conflict (prefix, year) do update set value = public.pr_counters.value + 1
  returning value into v_value;
  return format('%s-%s-%s', p_prefix, v_year, lpad(v_value::text, 4, '0'));
end;
$$;
revoke all on function public.pr_next_code(text) from public, anon, authenticated;

-- Auditoria directa (também funciona quando quem altera é o agendador do servidor).
create or replace function public.pr_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function public.pr_audit(text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------
create table if not exists public.pr_tasks (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  title               text not null check (char_length(title) between 3 and 160),
  description         text check (description is null or char_length(description) <= 4000),
  area                text not null default 'geral'
                      check (area in ('geral', 'loja', 'armazem', 'compras', 'fornecimentos', 'financeiro', 'marketing', 'experiencias', 'manutencao', 'administrativo')),
  priority            text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'urgente')),
  status              text not null default 'pendente' check (status in ('pendente', 'em_curso', 'concluida', 'cancelada')),
  responsible_name    text not null check (char_length(responsible_name) between 2 and 120),
  responsible_phone   text check (responsible_phone is null or responsible_phone ~ '^\+[1-9][0-9]{7,14}$'),
  due_at              timestamptz,
  remind_before_hours integer not null default 24 check (remind_before_hours between 0 and 720),
  notes               text check (notes is null or char_length(notes) <= 4000),
  completed_at        timestamptz,
  reminder_sent_at    timestamptz,
  overdue_sent_at     timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists pr_tasks_open_idx on public.pr_tasks (due_at) where status in ('pendente', 'em_curso');
alter table public.pr_tasks enable row level security;

create or replace function public.pr_tasks_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.code := public.pr_next_code('TR');
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    new.reminder_sent_at := null;
    new.overdue_sent_at := null;
  else
    new.code := old.code;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- Novo prazo ou novo responsável: os alertas voltam a ser enviados.
    if new.due_at is distinct from old.due_at or new.responsible_phone is distinct from old.responsible_phone
       or new.remind_before_hours is distinct from old.remind_before_hours then
      new.reminder_sent_at := null;
      new.overdue_sent_at := null;
    end if;
  end if;
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status <> 'concluida') then
    new.completed_at := now();
  elsif new.status <> 'concluida' then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists pr_tasks_before on public.pr_tasks;
create trigger pr_tasks_before before insert or update on public.pr_tasks
  for each row execute function public.pr_tasks_before();

create or replace function public.pr_tasks_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.pr_audit('task.create', 'pr_tasks', new.id::text, jsonb_build_object('code', new.code, 'title', new.title, 'responsible', new.responsible_name));
  elsif tg_op = 'DELETE' then
    perform public.pr_audit('task.delete', 'pr_tasks', old.id::text, jsonb_build_object('code', old.code, 'title', old.title));
  elsif new.status is distinct from old.status or new.responsible_name is distinct from old.responsible_name or new.due_at is distinct from old.due_at then
    perform public.pr_audit('task.update', 'pr_tasks', new.id::text, jsonb_build_object(
      'code', new.code, 'status', new.status, 'responsible', new.responsible_name, 'due_at', new.due_at));
  end if;
  return null;
end;
$$;
drop trigger if exists pr_tasks_audit on public.pr_tasks;
create trigger pr_tasks_audit after insert or update or delete on public.pr_tasks
  for each row execute function public.pr_tasks_audit();

-- Registo dos alertas enviados (WhatsApp).
create table if not exists public.pr_task_alerts (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.pr_tasks (id) on delete cascade,
  kind        text not null check (kind in ('atribuida', 'lembrete', 'atraso', 'teste')),
  phone       text,
  status      text not null check (status in ('enviado', 'falhou', 'sem_configuracao', 'sem_telefone')),
  message_id  text,
  error       text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists pr_task_alerts_task_idx on public.pr_task_alerts (task_id, created_at desc);
alter table public.pr_task_alerts enable row level security;

drop policy if exists pr_tasks_read on public.pr_tasks;
create policy pr_tasks_read on public.pr_tasks for select to authenticated using (public.is_staff());
drop policy if exists pr_tasks_insert on public.pr_tasks;
create policy pr_tasks_insert on public.pr_tasks for insert to authenticated with check (public.is_staff());
drop policy if exists pr_tasks_update on public.pr_tasks;
create policy pr_tasks_update on public.pr_tasks for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists pr_tasks_delete on public.pr_tasks;
create policy pr_tasks_delete on public.pr_tasks for delete to authenticated using (public.is_admin());

drop policy if exists pr_task_alerts_read on public.pr_task_alerts;
create policy pr_task_alerts_read on public.pr_task_alerts for select to authenticated using (public.is_staff());
-- Os alertas são gravados pelo servidor (chave de serviço); a equipa só os lê.

-- ---------------------------------------------------------------------
-- Saídas de material para a Promarine (guias de entrega)
-- ---------------------------------------------------------------------
create table if not exists public.pr_material_deliveries (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  delivery_date    date not null default ((now() at time zone 'Africa/Luanda')::date),
  recipient        text not null default 'Promarine' check (char_length(recipient) between 2 and 120),
  reference        text check (reference is null or char_length(reference) <= 160),
  delivered_by     text not null check (char_length(delivered_by) between 2 and 120),
  received_by      text check (received_by is null or char_length(received_by) <= 120),
  notes            text check (notes is null or char_length(notes) <= 2000),
  status           text not null default 'emitida' check (status in ('emitida', 'assinada', 'anulada')),
  signed_at        timestamptz,
  cancelled_reason text check (cancelled_reason is null or char_length(cancelled_reason) <= 500),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint pr_deliveries_cancel_reason check (status <> 'anulada' or cancelled_reason is not null)
);
create index if not exists pr_deliveries_date_idx on public.pr_material_deliveries (delivery_date desc);
alter table public.pr_material_deliveries enable row level security;

create table if not exists public.pr_material_delivery_items (
  id           uuid primary key default gen_random_uuid(),
  delivery_id  uuid not null references public.pr_material_deliveries (id) on delete cascade,
  position     integer not null default 0,
  description  text not null check (char_length(description) between 2 and 200),
  reference    text check (reference is null or char_length(reference) <= 80),
  quantity     numeric(12, 3) not null check (quantity > 0),
  unit         text not null default 'un' check (char_length(unit) between 1 and 20),
  notes        text check (notes is null or char_length(notes) <= 300)
);
create index if not exists pr_delivery_items_delivery_idx on public.pr_material_delivery_items (delivery_id, position);
alter table public.pr_material_delivery_items enable row level security;

create or replace function public.pr_deliveries_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.number := public.pr_next_code('GS');
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    if new.status <> 'emitida' then
      raise exception 'delivery_bad_status';
    end if;
  else
    new.number := old.number;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if old.status = 'anulada' then
      raise exception 'delivery_locked';
    end if;
    -- Guia assinada: só pode ser anulada (com motivo); o conteúdo fica fixo.
    if old.status = 'assinada' and (new.status <> 'anulada'
        or (new.delivery_date, new.recipient, new.reference, new.delivered_by, new.received_by, new.notes)
           is distinct from (old.delivery_date, old.recipient, old.reference, old.delivered_by, old.received_by, old.notes)) then
      raise exception 'delivery_locked';
    end if;
    if new.status = 'assinada' and old.status <> 'assinada' then
      new.signed_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists pr_deliveries_before on public.pr_material_deliveries;
create trigger pr_deliveries_before before insert or update on public.pr_material_deliveries
  for each row execute function public.pr_deliveries_before();

-- Linhas só se alteram enquanto a guia está «emitida».
create or replace function public.pr_delivery_items_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.pr_material_deliveries
   where id = case when tg_op = 'DELETE' then old.delivery_id else new.delivery_id end;
  if v_status is not null and v_status <> 'emitida' then
    raise exception 'delivery_locked';
  end if;
  if tg_op = 'UPDATE' and new.delivery_id <> old.delivery_id then
    raise exception 'delivery_locked';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists pr_delivery_items_guard on public.pr_material_delivery_items;
create trigger pr_delivery_items_guard before insert or update or delete on public.pr_material_delivery_items
  for each row execute function public.pr_delivery_items_guard();

create or replace function public.pr_deliveries_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.pr_audit('delivery.create', 'pr_material_deliveries', new.id::text, jsonb_build_object('number', new.number, 'recipient', new.recipient));
  elsif tg_op = 'DELETE' then
    perform public.pr_audit('delivery.delete', 'pr_material_deliveries', old.id::text, jsonb_build_object('number', old.number));
  elsif new.status is distinct from old.status then
    perform public.pr_audit('delivery.' || new.status, 'pr_material_deliveries', new.id::text,
      jsonb_build_object('number', new.number, 'reason', new.cancelled_reason));
  end if;
  return null;
end;
$$;
drop trigger if exists pr_deliveries_audit on public.pr_material_deliveries;
create trigger pr_deliveries_audit after insert or update or delete on public.pr_material_deliveries
  for each row execute function public.pr_deliveries_audit();

drop policy if exists pr_deliveries_read on public.pr_material_deliveries;
create policy pr_deliveries_read on public.pr_material_deliveries for select to authenticated using (public.is_staff());
drop policy if exists pr_deliveries_insert on public.pr_material_deliveries;
create policy pr_deliveries_insert on public.pr_material_deliveries for insert to authenticated with check (public.is_staff());
drop policy if exists pr_deliveries_update on public.pr_material_deliveries;
create policy pr_deliveries_update on public.pr_material_deliveries for update to authenticated using (public.is_staff()) with check (public.is_staff());
-- Guias não se apagam (anulam-se); só um administrador pode apagar uma guia emitida por engano e nunca assinada.
drop policy if exists pr_deliveries_delete on public.pr_material_deliveries;
create policy pr_deliveries_delete on public.pr_material_deliveries for delete to authenticated using (public.is_admin() and status = 'emitida');

drop policy if exists pr_delivery_items_read on public.pr_material_delivery_items;
create policy pr_delivery_items_read on public.pr_material_delivery_items for select to authenticated using (public.is_staff());
drop policy if exists pr_delivery_items_write on public.pr_material_delivery_items;
create policy pr_delivery_items_write on public.pr_material_delivery_items for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Cria uma guia com as suas linhas numa só transacção.
create or replace function public.pr_create_delivery(p_header jsonb, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  d public.pr_material_deliveries;
  it jsonb;
  i integer := 0;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'delivery_no_items';
  end if;
  insert into public.pr_material_deliveries (delivery_date, recipient, reference, delivered_by, received_by, notes)
  values (
    coalesce(nullif(p_header->>'delivery_date', '')::date, (now() at time zone 'Africa/Luanda')::date),
    coalesce(nullif(trim(p_header->>'recipient'), ''), 'Promarine'),
    nullif(trim(p_header->>'reference'), ''),
    trim(p_header->>'delivered_by'),
    nullif(trim(p_header->>'received_by'), ''),
    nullif(trim(p_header->>'notes'), ''))
  returning * into d;
  for it in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    insert into public.pr_material_delivery_items (delivery_id, position, description, reference, quantity, unit, notes)
    values (d.id, i, trim(it->>'description'), nullif(trim(it->>'reference'), ''), (it->>'quantity')::numeric,
            coalesce(nullif(trim(it->>'unit'), ''), 'un'), nullif(trim(it->>'notes'), ''));
  end loop;
  return jsonb_build_object('id', d.id, 'number', d.number);
end;
$$;

-- Substitui as linhas de uma guia ainda «emitida».
create or replace function public.pr_replace_delivery_items(p_delivery uuid, p_items jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  it jsonb;
  i integer := 0;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'delivery_no_items';
  end if;
  if not exists (select 1 from public.pr_material_deliveries where id = p_delivery and status = 'emitida') then
    raise exception 'delivery_locked';
  end if;
  delete from public.pr_material_delivery_items where delivery_id = p_delivery;
  for it in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    insert into public.pr_material_delivery_items (delivery_id, position, description, reference, quantity, unit, notes)
    values (p_delivery, i, trim(it->>'description'), nullif(trim(it->>'reference'), ''), (it->>'quantity')::numeric,
            coalesce(nullif(trim(it->>'unit'), ''), 'un'), nullif(trim(it->>'notes'), ''));
  end loop;
end;
$$;

revoke all on function public.pr_create_delivery(jsonb, jsonb) from public, anon;
revoke all on function public.pr_replace_delivery_items(uuid, jsonb) from public, anon;
grant execute on function public.pr_create_delivery(jsonb, jsonb) to authenticated;
grant execute on function public.pr_replace_delivery_items(uuid, jsonb) to authenticated;
