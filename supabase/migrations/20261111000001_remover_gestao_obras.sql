-- =====================================================================
-- Remove a Gestão de Obras (tabelas, vistas, funções, tipos e bucket ops_*)
-- A plataforma passou para o projecto próprio da Promarine (07/11/2026).
-- Idempotente: numa base sem estes objectos não faz nada.
-- Backup dos dados antes da remoção: iCloud › Backups Ponto Radical.
-- =====================================================================

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'ops\_%' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;

  for r in select viewname from pg_views where schemaname = 'public' and viewname like 'ops\_%' loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;

  for r in select tablename from pg_tables where schemaname = 'public' and tablename like 'ops\_%' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;

  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'ops\_%' loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;

  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typname like 'ops\_%' and t.typtype in ('e', 'c', 'd') loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;

  -- Bucket privado da gestão (vazio). O Supabase pode recusar apagar tabelas do Storage directamente: nesse caso
  -- o bucket fica sem políticas (inacessível) e pode ser apagado em Storage › ops › Delete bucket.
  begin
    delete from storage.buckets where id = 'ops' and not exists (select 1 from storage.objects where bucket_id = 'ops');
  exception when others then
    raise notice 'Bucket ops não apagado: %', sqlerrm;
  end;
end $$;
