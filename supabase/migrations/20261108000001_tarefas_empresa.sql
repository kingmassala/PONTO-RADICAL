-- =====================================================================
-- Gestão de Obras — tarefas de gestão da empresa (sem obra associada)
-- Aditiva e idempotente. Uma tarefa pertence a uma obra OU a uma área da
-- empresa (administração, finanças, compras…). Numeração TE-AAAA-NNNN.
--
-- Visibilidade das tarefas da empresa: Administração, Direcção, quem a
-- criou, o responsável e as pessoas atribuídas. Criam/alteram:
-- Administração, Direcção e Gestores (só as que podem ver).
-- =====================================================================

alter table public.ops_tasks alter column work_order_id drop not null;
alter table public.ops_tasks add column if not exists area text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ops_tasks_area_check') then
    alter table public.ops_tasks add constraint ops_tasks_area_check check (
      area is null or area in ('administracao', 'financeiro', 'comercial', 'recursos_humanos', 'compras',
        'logistica', 'instalacoes', 'legal', 'marketing', 'informatica', 'outro'));
  end if;
  -- Exactamente um âmbito: obra ou área da empresa.
  if not exists (select 1 from pg_constraint where conname = 'ops_tasks_scope_check') then
    alter table public.ops_tasks add constraint ops_tasks_scope_check check ((work_order_id is null) = (area is not null));
  end if;
end $$;

create unique index if not exists ops_tasks_company_code_idx on public.ops_tasks (code) where work_order_id is null;
create index if not exists ops_tasks_company_idx on public.ops_tasks (area, due_at) where work_order_id is null;

create or replace function public.ops_task_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_year text;
begin
  if tg_op = 'INSERT' and (new.code is null or new.code = '') then
    if new.work_order_id is null then
      v_year := to_char(timezone('Africa/Luanda', now()), 'YYYY');
      new.code := 'TE-' || v_year || '-' || lpad(public.ops_next_number('tarefa-empresa-' || v_year)::text, 4, '0');
    else
      v_count := public.ops_next_number('tarefa-' || new.work_order_id::text);
      new.code := 'T' || lpad(v_count::text, 2, '0');
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  if tg_op = 'UPDATE' and new.work_order_id is distinct from old.work_order_id then
    raise exception 'task_scope_change';
  end if;
  if new.parent_id is not null and not exists (
    select 1 from public.ops_tasks where id = new.parent_id and work_order_id is not distinct from new.work_order_id) then
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

-- Quem pode ver uma tarefa. A versão por colunas serve a política de leitura de ops_tasks
-- (num INSERT … RETURNING a linha nova ainda não é visível a uma subconsulta).
create or replace function public.ops_task_row_visible(p_task uuid, p_order uuid, p_created_by uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ops_is_member() and (
    case when p_order is null then
      public.ops_has_role('admin', 'direcao') or p_created_by = auth.uid() or public.ops_is_task_member(p_task)
    else
      public.ops_my_role() <> 'tecnico' or public.ops_is_task_member(p_task)
    end);
$$;

create or replace function public.ops_task_visible(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ops_tasks t
    where t.id = p_task and public.ops_task_row_visible(t.id, t.work_order_id, t.created_by));
$$;

-- Quem pode planear/alterar uma tarefa (não só o estado).
create or replace function public.ops_can_edit_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ops_tasks t
    where t.id = p_task and (
      case when t.work_order_id is null then
        public.ops_has_role('admin', 'direcao', 'gestor') and public.ops_task_visible(t.id)
      else
        public.ops_can_manage()
      end));
$$;

create or replace function public.ops_tech_update_task(p_task uuid, p_status public.ops_task_status, p_progress integer, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ops_is_member() or not public.ops_task_visible(p_task) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not (public.ops_can_edit_task(p_task) or public.ops_is_task_member(p_task)) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status in ('validada', 'cancelada') and not public.ops_can_edit_task(p_task) then
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

create or replace function public.ops_validate_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ops_can_edit_task(p_task) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.ops_tasks set status = 'validada' where id = p_task and status in ('concluida', 'validada');
  if not found then
    raise exception 'task_not_completed';
  end if;
  update public.ops_tasks set validated_by = auth.uid(), validated_at = now() where id = p_task;
end;
$$;

revoke all on function public.ops_can_edit_task(uuid) from public, anon;
revoke all on function public.ops_task_row_visible(uuid, uuid, uuid) from public, anon;
grant execute on function public.ops_task_row_visible(uuid, uuid, uuid) to authenticated;
grant execute on function public.ops_can_edit_task(uuid) to authenticated;

-- Políticas das tarefas e tabelas dependentes.
drop policy if exists ops_tasks_read on public.ops_tasks;
create policy ops_tasks_read on public.ops_tasks for select to authenticated
  using (public.ops_task_row_visible(id, work_order_id, created_by));
drop policy if exists ops_tasks_insert on public.ops_tasks;
create policy ops_tasks_insert on public.ops_tasks for insert to authenticated with check (
  (work_order_id is not null and public.ops_can_manage())
  or (work_order_id is null and public.ops_has_role('admin', 'direcao', 'gestor')));
drop policy if exists ops_tasks_update on public.ops_tasks;
create policy ops_tasks_update on public.ops_tasks for update to authenticated
  using (public.ops_can_edit_task(id))
  with check ((work_order_id is not null and public.ops_can_manage())
    or (work_order_id is null and public.ops_has_role('admin', 'direcao', 'gestor')));
drop policy if exists ops_tasks_delete on public.ops_tasks;
create policy ops_tasks_delete on public.ops_tasks for delete to authenticated
  using (public.ops_has_role('admin', 'direcao', 'gestor') and public.ops_task_visible(id));

drop policy if exists ops_assignees_write on public.ops_task_assignees;
create policy ops_assignees_write on public.ops_task_assignees for all to authenticated
  using (public.ops_can_edit_task(task_id)) with check (public.ops_can_edit_task(task_id));
drop policy if exists ops_deps_write on public.ops_task_dependencies;
create policy ops_deps_write on public.ops_task_dependencies for all to authenticated
  using (public.ops_can_edit_task(task_id)) with check (public.ops_can_edit_task(task_id));

drop policy if exists ops_time_insert on public.ops_time_entries;
create policy ops_time_insert on public.ops_time_entries for insert to authenticated
  with check (public.ops_is_member() and (
    (user_id = auth.uid() and public.ops_task_visible(task_id)) or public.ops_can_edit_task(task_id)));

drop policy if exists ops_attachments_read on public.ops_attachments;
create policy ops_attachments_read on public.ops_attachments for select to authenticated using (
  public.ops_is_member() and (
    uploaded_by = auth.uid()
    or (entity_type = 'expense' and public.ops_can_finance())
    or (entity_type in ('client', 'vessel'))
    or (entity_type = 'task' and (public.ops_task_visible(entity_id)
        or (work_order_id is not null and public.ops_order_visible(work_order_id))))
    or (entity_type in ('work_order', 'report', 'incident') and public.ops_order_visible(work_order_id))));

drop policy if exists ops_notifications_read on public.ops_notifications;
create policy ops_notifications_read on public.ops_notifications for select to authenticated using (
  public.ops_has_role('admin', 'direcao') or recipient_id = auth.uid()
  or (public.ops_has_role('gestor') and (task_id is null or public.ops_task_visible(task_id))));

drop policy if exists ops_reminders_write on public.ops_reminders;
create policy ops_reminders_write on public.ops_reminders for all to authenticated
  using (public.ops_can_manage() and (task_id is null or public.ops_task_visible(task_id)))
  with check (public.ops_can_manage() and (task_id is null or public.ops_task_visible(task_id)));

-- Modelo WhatsApp próprio (não menciona obra nem embarcação).
insert into public.ops_whatsapp_templates (event, template_name) values ('tarefa_empresa', 'pr_tarefa_empresa')
on conflict (event) do nothing;
