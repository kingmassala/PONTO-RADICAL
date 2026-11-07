-- =====================================================================
-- Gestão de Obras — portal do cliente
-- Aditiva e idempotente.
--
-- • ops_client_users: contas de acesso de clientes (separadas da equipa).
-- • ops_attachments.client_visible: só as fotografias que a equipa partilha
--   explicitamente aparecem ao cliente (por omissão nada é partilhado).
-- • O cliente NÃO tem acesso directo às tabelas (as políticas existentes exigem
--   ser membro da equipa). Lê apenas através das funções ops_portal_*, que
--   devolvem só campos seguros (sem custos, notas internas, horas ou nomes da
--   equipa) e só das embarcações do seu cliente.
-- =====================================================================

create table if not exists public.ops_client_users (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  client_id             uuid not null references public.ops_clients (id) on delete cascade,
  full_name             text not null check (char_length(full_name) between 2 and 120),
  email                 text not null,
  active                boolean not null default true,
  must_change_password  boolean not null default false,
  last_seen_at          timestamptz,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists ops_client_users_client_idx on public.ops_client_users (client_id);
alter table public.ops_client_users enable row level security;

-- Uma conta é da equipa ou de um cliente, nunca das duas.
create or replace function public.ops_client_user_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.ops_members where user_id = new.user_id) then
    raise exception 'client_user_is_member';
  end if;
  new.email := lower(trim(new.email));
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists ops_client_users_guard on public.ops_client_users;
create trigger ops_client_users_guard before insert or update on public.ops_client_users
  for each row execute function public.ops_client_user_guard();

create or replace function public.ops_member_not_client()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.ops_client_users where user_id = new.user_id) then
    raise exception 'member_is_client_user';
  end if;
  return new;
end;
$$;
drop trigger if exists ops_members_not_client on public.ops_members;
create trigger ops_members_not_client before insert on public.ops_members
  for each row execute function public.ops_member_not_client();

drop policy if exists ops_client_users_read on public.ops_client_users;
create policy ops_client_users_read on public.ops_client_users for select to authenticated
  using (user_id = auth.uid() or public.ops_has_role('admin', 'direcao', 'gestor', 'supervisor'));
drop policy if exists ops_client_users_write on public.ops_client_users;
create policy ops_client_users_write on public.ops_client_users for all to authenticated
  using (public.ops_has_role('admin', 'direcao', 'gestor')) with check (public.ops_has_role('admin', 'direcao', 'gestor'));

-- Fotografias partilhadas com o cliente.
alter table public.ops_attachments add column if not exists client_visible boolean not null default false;
alter table public.ops_attachments add column if not exists shared_at timestamptz;
alter table public.ops_attachments add column if not exists shared_by uuid references auth.users (id) on delete set null;
create index if not exists ops_attachments_client_idx on public.ops_attachments (work_order_id, created_at) where client_visible;

-- Partilhar / deixar de partilhar (só fotografias de obra, tarefa, relatório e embarcação).
create or replace function public.ops_share_attachment(p_attachment uuid, p_visible boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a public.ops_attachments;
begin
  if not public.ops_has_role('admin', 'direcao', 'gestor', 'supervisor') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into a from public.ops_attachments where id = p_attachment;
  if not found then
    raise exception 'attachment_not_found';
  end if;
  if p_visible and (a.entity_type not in ('work_order', 'task', 'report', 'vessel') or a.mime_type not like 'image/%') then
    raise exception 'attachment_not_shareable';
  end if;
  if a.entity_type = 'task' and not public.ops_task_visible(a.entity_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_visible and a.entity_type = 'task' and exists (select 1 from public.ops_tasks where id = a.entity_id and work_order_id is null) then
    raise exception 'attachment_not_shareable';
  end if;
  update public.ops_attachments
     set client_visible = p_visible,
         shared_at = case when p_visible then now() else null end,
         shared_by = case when p_visible then auth.uid() else null end
   where id = p_attachment;
end;
$$;

-- Cliente da sessão actual (null se não for uma conta de cliente activa).
create or replace function public.ops_portal_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select cu.client_id from public.ops_client_users cu
  join public.ops_clients c on c.id = cu.client_id
  where cu.user_id = auth.uid() and cu.active and not c.archived;
$$;

create or replace function public.ops_portal_me()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'full_name', cu.full_name,
    'email', cu.email,
    'must_change_password', cu.must_change_password,
    'client', jsonb_build_object('id', c.id, 'name', c.name, 'code', c.code))
  from public.ops_client_users cu
  join public.ops_clients c on c.id = cu.client_id
  where cu.user_id = auth.uid() and cu.active and not c.archived;
$$;

-- Embarcações e obras do cliente, com progresso.
create or replace function public.ops_portal_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_client uuid := public.ops_portal_client_id();
begin
  if v_client is null then
    return null;
  end if;
  return jsonb_build_object(
    'vessels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'code', v.code, 'name', v.name, 'vessel_type', v.vessel_type,
        'registration', v.registration, 'manufacturer', v.manufacturer, 'model', v.model, 'length_m', v.length_m)
        order by v.name)
      from public.ops_vessels v where v.client_id = v_client and not v.archived), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'number', o.number, 'title', o.title, 'status', o.status, 'vessel_id', o.vessel_id,
        'intervention_type', o.intervention_type, 'start_date', o.start_date, 'due_date', o.due_date,
        'closed_at', o.closed_at, 'progress', coalesce(p.progress, 0),
        'tasks_total', coalesce(p.tasks_total, 0), 'tasks_done', coalesce(p.tasks_done, 0),
        'photos', (select count(*) from public.ops_attachments a where a.work_order_id = o.id and a.client_visible))
        order by o.created_at desc)
      from public.ops_work_orders o
      left join public.ops_work_order_progress p on p.work_order_id = o.id
      where o.client_id = v_client and o.status <> 'cancelada'), '[]'::jsonb));
end;
$$;

-- Ficha de uma obra: tarefas e fotografias partilhadas. Devolve null se não for do cliente.
create or replace function public.ops_portal_order(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_client uuid := public.ops_portal_client_id();
  o public.ops_work_orders;
begin
  if v_client is null then
    return null;
  end if;
  select * into o from public.ops_work_orders where id = p_order and client_id = v_client and status <> 'cancelada';
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id, 'number', o.number, 'title', o.title, 'status', o.status, 'description', o.description,
      'intervention_type', o.intervention_type, 'start_date', o.start_date, 'due_date', o.due_date, 'closed_at', o.closed_at,
      'progress', coalesce((select progress from public.ops_work_order_progress where work_order_id = o.id), 0),
      'vessel', (select jsonb_build_object('id', v.id, 'code', v.code, 'name', v.name) from public.ops_vessels v where v.id = o.vessel_id)),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'code', t.code, 'title', t.title, 'status', t.status, 'progress', t.progress, 'parent_id', t.parent_id,
        'start_at', t.start_at, 'due_at', t.due_at, 'completed_at', t.completed_at)
        order by t.sort_order, t.created_at)
      from public.ops_tasks t where t.work_order_id = o.id and t.status <> 'cancelada'), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'path', a.path, 'mime_type', a.mime_type, 'caption', a.caption, 'created_at', a.created_at,
        'entity_type', a.entity_type,
        'task', (select t.code || ' · ' || t.title from public.ops_tasks t where a.entity_type = 'task' and t.id = a.entity_id))
        order by a.created_at desc)
      from public.ops_attachments a where a.work_order_id = o.id and a.client_visible), '[]'::jsonb));
end;
$$;

-- Fotografias partilhadas de uma embarcação (da própria embarcação e das suas obras).
create or replace function public.ops_portal_vessel_photos(p_vessel uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_client uuid := public.ops_portal_client_id();
begin
  if v_client is null or not exists (select 1 from public.ops_vessels where id = p_vessel and client_id = v_client) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'path', a.path, 'mime_type', a.mime_type, 'caption', a.caption, 'created_at', a.created_at,
      'order_number', o.number)
      order by a.created_at desc)
    from public.ops_attachments a
    left join public.ops_work_orders o on o.id = a.work_order_id
    where a.client_visible and (
      (a.entity_type = 'vessel' and a.entity_id = p_vessel)
      or (o.vessel_id = p_vessel and o.client_id = v_client and o.status <> 'cancelada'))), '[]'::jsonb);
end;
$$;

create or replace function public.ops_portal_touch()
returns void language sql security definer set search_path = public as $$
  update public.ops_client_users set last_seen_at = now() where user_id = auth.uid() and active;
$$;

-- O próprio cliente deixa de ter a troca obrigatória depois de definir a palavra-passe.
create or replace function public.ops_portal_password_changed()
returns void language sql security definer set search_path = public as $$
  update public.ops_client_users set must_change_password = false where user_id = auth.uid();
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'ops_share_attachment(uuid, boolean)', 'ops_portal_client_id()', 'ops_portal_me()', 'ops_portal_overview()',
    'ops_portal_order(uuid)', 'ops_portal_vessel_photos(uuid)', 'ops_portal_touch()', 'ops_portal_password_changed()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Auditoria das contas de cliente.
drop trigger if exists ops_client_users_audit on public.ops_client_users;
create trigger ops_client_users_audit after insert or update or delete on public.ops_client_users
  for each row execute function public.ops_audit();
