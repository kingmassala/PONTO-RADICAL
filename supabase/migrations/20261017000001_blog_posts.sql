-- =====================================================================
-- Ponto Radical — Blog (produtos, curiosidades e notícias)
-- Cada artigo é uma linha com o seu próprio estado (rascunho/publicado):
-- publicar um artigo não depende da publicação do resto do website.
-- O website (anon) só vê artigos publicados com data já passada; a equipa vê e edita tudo.
-- =====================================================================

create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category      text not null default 'noticias'
                check (category in ('produtos', 'curiosidades', 'noticias')),
  title         text not null check (char_length(title) between 1 and 200),
  excerpt       text not null default '' check (char_length(excerpt) <= 400),
  -- Texto rico já limpo pelo servidor (mesmo subconjunto de HTML do CMS).
  body          text not null default '' check (char_length(body) <= 100000),
  cover         jsonb not null default '{"url": "", "alt": "", "mediaId": null}'::jsonb,
  gallery       jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery) = 'array'),
  -- Traduções opcionais: { "en": { "title": "...", "excerpt": "...", "body": "..." }, ... }
  translations  jsonb not null default '{}'::jsonb check (jsonb_typeof(translations) = 'object'),
  featured      boolean not null default false,
  status        text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  published_at  timestamptz,
  author_name   text check (char_length(author_name) <= 120),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,
  updated_by    uuid references auth.users (id) on delete set null
);
create index if not exists blog_posts_public_idx on public.blog_posts (status, published_at desc);

-- Datas automáticas: actualização, e data de publicação na primeira vez que o artigo é publicado.
create or replace function public.blog_posts_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  if new.status = 'publicado' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists blog_posts_write on public.blog_posts;
create trigger blog_posts_write before insert or update on public.blog_posts
  for each row execute function public.blog_posts_before_write();

-- Auditoria: criação, publicação/despublicação e eliminação.
create or replace function public.blog_posts_audit()
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
    values (auth.uid(), v_email, 'blog.create', 'blog_posts', new.id::text, jsonb_build_object('title', new.title));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, details)
      values (auth.uid(), v_email, 'blog.status', 'blog_posts', new.id::text,
        jsonb_build_object('title', new.title, 'from', old.status, 'to', new.status));
    end if;
    return new;
  else
    insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, details)
    values (auth.uid(), v_email, 'blog.delete', 'blog_posts', old.id::text, jsonb_build_object('title', old.title));
    return old;
  end if;
end;
$$;
drop trigger if exists blog_posts_audit on public.blog_posts;
create trigger blog_posts_audit after insert or update or delete on public.blog_posts
  for each row execute function public.blog_posts_audit();
revoke all on function public.blog_posts_audit() from public, anon, authenticated;

alter table public.blog_posts enable row level security;
grant select on public.blog_posts to anon, authenticated;
grant insert, update, delete on public.blog_posts to authenticated;

drop policy if exists blog_select on public.blog_posts;
create policy blog_select on public.blog_posts
  for select to anon, authenticated
  using ((status = 'publicado' and published_at <= now()) or public.is_staff());
drop policy if exists blog_insert on public.blog_posts;
create policy blog_insert on public.blog_posts
  for insert to authenticated with check (public.is_staff());
drop policy if exists blog_update on public.blog_posts;
create policy blog_update on public.blog_posts
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists blog_delete on public.blog_posts;
create policy blog_delete on public.blog_posts
  for delete to authenticated using (public.is_staff());
