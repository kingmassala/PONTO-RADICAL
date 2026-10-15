-- =====================================================================
-- Ponto Radical — CMS schema
-- Tabelas, funções, Row Level Security e armazenamento de ficheiros.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Perfis e papéis
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'editor');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  -- null = conta sem acesso ao painel
  role        public.app_role,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Cria automaticamente o perfil (sem acesso) quando um utilizador é criado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role is not null);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- Conteúdo do website: rascunho, versões publicadas e estado
-- ---------------------------------------------------------------------
create table if not exists public.site_draft (
  id          smallint primary key default 1 check (id = 1),
  content     jsonb not null,
  revision    integer not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

create table if not exists public.site_versions (
  id                 bigint generated always as identity primary key,
  content            jsonb not null,
  note               text,
  published_at       timestamptz not null default now(),
  published_by       uuid references auth.users (id) on delete set null,
  published_by_email text,
  restored_from      bigint references public.site_versions (id) on delete set null
);

create table if not exists public.site_state (
  id                    smallint primary key default 1 check (id = 1),
  published_version_id  bigint references public.site_versions (id)
);

-- ---------------------------------------------------------------------
-- Biblioteca multimédia
-- ---------------------------------------------------------------------
create table if not exists public.media (
  id             uuid primary key default gen_random_uuid(),
  path           text not null unique,
  url            text not null,
  kind           text not null check (kind in ('image', 'video')),
  mime_type      text not null,
  size_bytes     bigint not null,
  width          integer,
  height         integer,
  alt            text not null default '',
  folder         text not null default 'geral',
  original_name  text,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id) on delete set null,
  updated_at     timestamptz not null default now()
);
create index if not exists media_folder_idx on public.media (folder, created_at desc);

-- ---------------------------------------------------------------------
-- Pedidos de contacto
-- ---------------------------------------------------------------------
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  email       text not null check (char_length(email) <= 254),
  phone       text check (char_length(phone) <= 40),
  subject     text not null check (char_length(subject) between 2 and 160),
  message     text not null check (char_length(message) between 10 and 5000),
  status      text not null default 'novo'
              check (status in ('novo', 'em_curso', 'respondido', 'arquivado')),
  notes       text,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_ip_idx on public.contact_messages (ip_hash, created_at desc);

-- ---------------------------------------------------------------------
-- Registo de auditoria
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  actor_email  text,
  action       text not null,
  entity       text,
  entity_id    text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, details)
  values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Funções de conteúdo (transaccionais)
-- ---------------------------------------------------------------------

-- Conteúdo publicado: única leitura pública permitida.
create or replace function public.get_published_site()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select v.content
  from public.site_state s
  join public.site_versions v on v.id = s.published_version_id
  where s.id = 1;
$$;

-- Guarda o rascunho com controlo de concorrência optimista.
create or replace function public.save_draft(p_content jsonb, p_expected_revision integer, p_summary text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision integer;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_content) <> 'object' then
    raise exception 'invalid_content';
  end if;

  update public.site_draft
     set content = p_content,
         revision = revision + 1,
         updated_at = now(),
         updated_by = auth.uid()
   where id = 1 and revision = p_expected_revision
  returning revision into v_revision;

  if v_revision is null then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;

  perform public.write_audit('draft.save', 'site_draft', '1', jsonb_build_object('summary', p_summary, 'revision', v_revision));
  return v_revision;
end;
$$;

-- Publica o rascunho actual numa única transacção.
create or replace function public.publish_site(p_expected_revision integer, p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.site_draft%rowtype;
  v_version_id bigint;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_draft from public.site_draft where id = 1 for update;
  if not found then
    raise exception 'draft_missing';
  end if;
  if v_draft.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;

  insert into public.site_versions (content, note, published_by, published_by_email)
  values (
    v_draft.content,
    nullif(trim(p_note), ''),
    auth.uid(),
    (select email from public.profiles where id = auth.uid())
  )
  returning id into v_version_id;

  insert into public.site_state (id, published_version_id) values (1, v_version_id)
  on conflict (id) do update set published_version_id = excluded.published_version_id;

  perform public.write_audit('site.publish', 'site_versions', v_version_id::text,
    jsonb_build_object('note', p_note, 'draft_revision', v_draft.revision));
  return v_version_id;
end;
$$;

-- Copia uma versão anterior para o rascunho (depois pode ser publicada).
create or replace function public.restore_version_to_draft(p_version_id bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content jsonb;
  v_revision integer;
begin
  if not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select content into v_content from public.site_versions where id = p_version_id;
  if v_content is null then
    raise exception 'version_not_found';
  end if;

  update public.site_draft
     set content = v_content, revision = revision + 1, updated_at = now(), updated_by = auth.uid()
   where id = 1
  returning revision into v_revision;

  perform public.write_audit('draft.restore', 'site_versions', p_version_id::text, '{}'::jsonb);
  return v_revision;
end;
$$;

-- Altera o papel de um utilizador (apenas administradores).
create or replace function public.set_user_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and p_role is distinct from 'admin' then
    raise exception 'cannot_demote_self';
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_user_id;
  if not found then
    raise exception 'user_not_found';
  end if;

  if not exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'last_admin';
  end if;

  perform public.write_audit('user.role', 'profiles', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.site_draft        enable row level security;
alter table public.site_versions     enable row level security;
alter table public.site_state        enable row level security;
alter table public.media             enable row level security;
alter table public.contact_messages  enable row level security;
alter table public.audit_log         enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_own_name on public.profiles;
create policy profiles_update_own_name on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Impede alterações de papel/email fora de set_user_role.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  -- Dentro de set_user_role (security definer) current_user é o dono da função.
  if current_user in ('authenticated', 'anon')
     and (new.role is distinct from old.role or new.email is distinct from old.email) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- site_draft / site_versions / site_state: leitura pela equipa; escrita só via funções.
drop policy if exists site_draft_select on public.site_draft;
create policy site_draft_select on public.site_draft
  for select to authenticated using (public.is_staff());

drop policy if exists site_versions_select on public.site_versions;
create policy site_versions_select on public.site_versions
  for select to authenticated using (public.is_staff());

drop policy if exists site_state_select on public.site_state;
create policy site_state_select on public.site_state
  for select to authenticated using (public.is_staff());

-- media
drop policy if exists media_select on public.media;
create policy media_select on public.media
  for select to authenticated using (public.is_staff());
drop policy if exists media_insert on public.media;
create policy media_insert on public.media
  for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
drop policy if exists media_update on public.media;
create policy media_update on public.media
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists media_delete on public.media;
create policy media_delete on public.media
  for delete to authenticated using (public.is_staff());

-- contact_messages: inserção apenas pelo servidor (chave secreta); leitura pela equipa.
drop policy if exists contact_select on public.contact_messages;
create policy contact_select on public.contact_messages
  for select to authenticated using (public.is_staff());
drop policy if exists contact_update on public.contact_messages;
create policy contact_update on public.contact_messages
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists contact_delete on public.contact_messages;
create policy contact_delete on public.contact_messages
  for delete to authenticated using (public.is_admin());

-- audit_log: só administradores lêem; escrita via write_audit().
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated using (public.is_admin());

-- Permissões de execução
revoke all on function public.get_published_site() from public;
grant execute on function public.get_published_site() to anon, authenticated;

revoke all on function public.save_draft(jsonb, integer, text) from public, anon;
revoke all on function public.publish_site(integer, text) from public, anon;
revoke all on function public.restore_version_to_draft(bigint) from public, anon;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
revoke all on function public.write_audit(text, text, text, jsonb) from public, anon;
grant execute on function public.save_draft(jsonb, integer, text) to authenticated;
grant execute on function public.publish_site(integer, text) to authenticated;
grant execute on function public.restore_version_to_draft(bigint) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.write_audit(text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Armazenamento (Supabase Storage)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists media_objects_insert on storage.objects;
create policy media_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_staff());

drop policy if exists media_objects_update on storage.objects;
create policy media_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_staff());

drop policy if exists media_objects_delete on storage.objects;
create policy media_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_staff());

drop policy if exists media_objects_select on storage.objects;
create policy media_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.is_staff());
