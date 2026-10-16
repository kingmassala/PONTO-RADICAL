-- =====================================================================
-- Ponto Radical — Pedidos de reserva (experiências e passeios)
-- Os serviços vivem no documento do CMS; aqui ficam os pedidos dos clientes.
-- Inserção só pelo servidor (chave secreta); leitura e tratamento pela equipa.
-- =====================================================================

create table if not exists public.booking_requests (
  id                uuid primary key default gen_random_uuid(),
  -- Referência curta para o cliente citar (ex.: no WhatsApp).
  reference         text not null unique
                    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),

  -- Cópia do serviço no momento do pedido (o serviço pode mudar ou ser eliminado depois).
  service_id        text not null check (char_length(service_id) <= 64),
  service_name      text not null check (char_length(service_name) between 1 and 120),
  service_snapshot  jsonb not null default '{}'::jsonb,

  requested_date    date not null,
  time_slot         text not null check (char_length(time_slot) between 1 and 40),
  people            integer not null check (people between 1 and 500),

  name              text not null check (char_length(name) between 2 and 120),
  email             text not null check (char_length(email) <= 254),
  phone             text not null check (char_length(phone) between 6 and 40),
  notes             text check (char_length(notes) <= 2000),

  status            text not null default 'novo'
                    check (status in ('novo', 'confirmado', 'proposta', 'recusado', 'concluido', 'cancelado')),
  -- Quando a equipa propõe outra data/hora (estado «proposta»).
  proposed_date     date,
  proposed_slot     text check (char_length(proposed_slot) <= 40),
  internal_notes    text check (char_length(internal_notes) <= 4000),

  -- Preparado para pagamentos futuros (hoje o pagamento é feito após confirmação, fora do website).
  quoted_amount     numeric(14, 2) check (quoted_amount >= 0),
  currency          text not null default 'AOA' check (currency ~ '^[A-Z]{3}$'),
  payment_status    text not null default 'pendente'
                    check (payment_status in ('pendente', 'pago', 'reembolsado', 'nao_aplicavel')),
  payment_method    text check (char_length(payment_method) <= 60),
  payment_reference text check (char_length(payment_reference) <= 120),
  paid_at           timestamptz,

  ip_hash           text,
  user_agent        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  handled_by        uuid references auth.users (id) on delete set null
);
create index if not exists booking_requests_date_idx on public.booking_requests (requested_date, time_slot);
create index if not exists booking_requests_status_idx on public.booking_requests (status, created_at desc);
create index if not exists booking_requests_ip_idx on public.booking_requests (ip_hash, created_at desc);

-- Mantém datas de actualização e impede a equipa de alterar o que o cliente enviou.
create or replace function public.booking_requests_before_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.reference is distinct from old.reference
    or new.service_id is distinct from old.service_id
    or new.service_name is distinct from old.service_name
    or new.service_snapshot is distinct from old.service_snapshot
    or new.requested_date is distinct from old.requested_date
    or new.time_slot is distinct from old.time_slot
    or new.people is distinct from old.people
    or new.name is distinct from old.name
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.notes is distinct from old.notes
    or new.ip_hash is distinct from old.ip_hash
    or new.user_agent is distinct from old.user_agent
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  new.updated_at := now();
  if new.payment_status = 'pago' and old.payment_status is distinct from 'pago' then
    new.paid_at := coalesce(new.paid_at, now());
  elsif new.payment_status <> 'pago' then
    new.paid_at := null;
  end if;
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    new.handled_by := coalesce(auth.uid(), old.handled_by);
  end if;
  return new;
end;
$$;
drop trigger if exists booking_requests_update on public.booking_requests;
create trigger booking_requests_update before update on public.booking_requests
  for each row execute function public.booking_requests_before_update();

-- Auditoria automática: novos pedidos, mudanças de estado e eliminações.
create or replace function public.booking_requests_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := (select email from public.profiles where id = auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, details)
    values (null, 'website', 'booking.create', 'booking_requests', new.id::text,
      jsonb_build_object('reference', new.reference, 'service', new.service_name, 'date', new.requested_date));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, details)
      values (auth.uid(), v_email, 'booking.status', 'booking_requests', new.id::text,
        jsonb_build_object('reference', new.reference, 'from', old.status, 'to', new.status));
    end if;
    return new;
  else
    insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, details)
    values (auth.uid(), v_email, 'booking.delete', 'booking_requests', old.id::text,
      jsonb_build_object('reference', old.reference, 'service', old.service_name));
    return old;
  end if;
end;
$$;
drop trigger if exists booking_requests_audit on public.booking_requests;
create trigger booking_requests_audit after insert or update or delete on public.booking_requests
  for each row execute function public.booking_requests_audit();
revoke all on function public.booking_requests_audit() from public, anon, authenticated;

-- Row Level Security: sem política de inserção (só o servidor, com a chave secreta, insere).
alter table public.booking_requests enable row level security;

drop policy if exists booking_select on public.booking_requests;
create policy booking_select on public.booking_requests
  for select to authenticated using (public.is_staff());
drop policy if exists booking_update on public.booking_requests;
create policy booking_update on public.booking_requests
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists booking_delete on public.booking_requests;
create policy booking_delete on public.booking_requests
  for delete to authenticated using (public.is_admin());
