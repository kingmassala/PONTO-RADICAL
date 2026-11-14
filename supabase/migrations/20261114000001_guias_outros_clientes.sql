-- =====================================================================
-- Guias de saída de material para qualquer cliente (não só a Promarine).
-- Aditiva e idempotente: dados do destinatário (NIF, morada, contacto) e
-- funções/trigger actualizados para os incluir.
-- =====================================================================

alter table public.pr_material_deliveries
  add column if not exists recipient_details text
  check (recipient_details is null or char_length(recipient_details) <= 500);

create index if not exists pr_deliveries_recipient_idx on public.pr_material_deliveries (lower(recipient));

-- Guia assinada: o conteúdo (incluindo os dados do destinatário) fica fixo.
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
    if old.status = 'assinada' and (new.status <> 'anulada'
        or (new.delivery_date, new.recipient, new.recipient_details, new.reference, new.delivered_by, new.received_by, new.notes)
           is distinct from (old.delivery_date, old.recipient, old.recipient_details, old.reference, old.delivered_by, old.received_by, old.notes)) then
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
  insert into public.pr_material_deliveries (delivery_date, recipient, recipient_details, reference, delivered_by, received_by, notes)
  values (
    coalesce(nullif(p_header->>'delivery_date', '')::date, (now() at time zone 'Africa/Luanda')::date),
    coalesce(nullif(trim(p_header->>'recipient'), ''), 'Promarine'),
    nullif(trim(p_header->>'recipient_details'), ''),
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
revoke all on function public.pr_create_delivery(jsonb, jsonb) from public, anon;
grant execute on function public.pr_create_delivery(jsonb, jsonb) to authenticated;
