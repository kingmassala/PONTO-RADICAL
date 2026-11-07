-- =====================================================================
-- Gestão de Obras — agendador automático a cada 5 minutos (Supabase pg_cron + pg_net)
--
-- NÃO é uma migração automática: contém um segredo. Executar UMA vez no SQL Editor do
-- Supabase depois de publicar a aplicação, substituindo:
--   <URL>          https://ponto-radical.vercel.app   (ou o domínio final)
--   <CRON_SECRET>  o mesmo valor da variável CRON_SECRET na Vercel
-- O segredo fica guardado no Vault do Supabase (cifrado), não no código.
-- A Vercel Cron (vercel.json) corre também uma vez por dia como reserva.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<CRON_SECRET>', 'gestao_cron_secret', 'Segredo do agendador da Gestão de Obras');

select cron.schedule(
  'gestao-obras-automacao',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := '<URL>/api/gestao/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'gestao_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Verificar:   select * from cron.job;  select * from cron.job_run_details order by start_time desc limit 10;
-- Respostas:   select status_code, content from net._http_response order by created desc limit 10;
-- Remover:     select cron.unschedule('gestao-obras-automacao');
