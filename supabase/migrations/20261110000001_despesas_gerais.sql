-- =====================================================================
-- Gestão de Obras — despesas gerais da empresa (sem obra associada)
-- Aditiva e idempotente. Ex.: almoço da equipa, material de limpeza,
-- material de escritório, água/luz/comunicações. Mesmas regras de aprovação
-- e bloqueio das despesas das obras; não entram na rentabilidade das obras.
-- =====================================================================

alter type public.ops_expense_category add value if not exists 'limpeza_higiene';
alter type public.ops_expense_category add value if not exists 'escritorio';
alter type public.ops_expense_category add value if not exists 'agua_luz_comunicacoes';
alter type public.ops_expense_category add value if not exists 'manutencao_instalacoes';

alter table public.ops_expenses alter column work_order_id drop not null;
create index if not exists ops_expenses_general_idx on public.ops_expenses (expense_date) where work_order_id is null;

-- A tarefa associada (opcional) tem de ser da mesma obra; numa despesa geral, só tarefas da empresa.
create or replace function public.ops_expenses_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.task_id is not null and not exists (
    select 1 from public.ops_tasks t where t.id = new.task_id and t.work_order_id is not distinct from new.work_order_id) then
    raise exception 'expense_task_other_scope';
  end if;
  return new;
end;
$$;
drop trigger if exists ops_expenses_scope on public.ops_expenses;
create trigger ops_expenses_scope before insert or update of task_id, work_order_id on public.ops_expenses
  for each row execute function public.ops_expenses_scope();
