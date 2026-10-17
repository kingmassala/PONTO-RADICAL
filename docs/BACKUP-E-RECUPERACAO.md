# Backups e recuperação

## O que é guardado onde

| O quê | Onde vive | Como está protegido |
|---|---|---|
| Código, migrações, documentação | GitHub `kingmassala/PONTO-RADICAL` | Histórico git |
| Conteúdo do website (todas as versões publicadas) | Supabase `site_versions` | Painel › Publicações e Histórico + backup |
| Contas, mensagens, pedidos de reserva, auditoria | Supabase (Postgres) | Backup (`npm run backup`) |
| Imagens e logótipos | Supabase Storage, bucket `media` | Backup (`npm run backup`) |
| Chaves e variáveis de ambiente | `.env.local` (local) e Vercel | Nunca no GitHub nem nos backups; recuperam-se no Supabase/Vercel |

Backups privados, fora do GitHub: **iCloud Drive › Backups Ponto Radical › AAAA-MM-DD**.
Primeiro backup: `2026-10-17` (verificado: repõe todas as tabelas e os 25 ficheiros sem erros).

> Os backups contêm dados pessoais (mensagens e pedidos de clientes, emails e *hashes* das palavras-passe das
> contas do painel). Mantenha a pasta privada e não a partilhe.

## Conteúdo de cada backup

```
manifest.json                contagens, tamanhos e SHA-256 de todos os ficheiros
database/restore-data.sql    dados em INSERT (upsert), prontos a repor numa base com as migrações aplicadas
database/data.json           os mesmos dados em JSON legível
database/schema.json         colunas, políticas RLS, funções, triggers e tipos (para comparar/recriar)
storage/media/...            todos os ficheiros do bucket media, com os mesmos caminhos
```

Tabelas incluídas: `auth.users`, `auth.identities`, `storage.buckets`, `public.profiles`, `public.media`,
`public.site_versions`, `public.site_state`, `public.site_draft`, `public.contact_messages`,
`public.booking_requests`, `public.audit_log` (e qualquer tabela nova em `public`).

## Fazer um backup (só leitura, não altera nada)

Requer `.env.local` com `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY`.

```bash
npm run backup -- --out="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Backups Ponto Radical/$(date +%F)"
```

No Windows, use a pasta do iCloud Drive para Windows (ex.: `--out="C:\Users\<nome>\iCloudDrive\Backups Ponto Radical\2026-11-01"`).
Recomendado: mensalmente e antes de grandes alterações.

## Verificar um backup (sem tocar em nenhuma base real)

```bash
npm run backup:verify -- --dir="/caminho/para/o/backup"
```

Confirma o SHA-256 de todos os ficheiros e repõe os dados numa base Postgres em memória com as migrações do
repositório, comparando as contagens com o `manifest.json`.

## Repor

**Um conteúdo antigo do website** (o caso mais comum): Painel › Publicações e Histórico › Restaurar › Publicar.

**A base de dados inteira num projecto Supabase novo** (perda do projecto actual):

1. Crie o projecto no Supabase e copie as chaves novas para `.env.local` e para a Vercel
   (ver [SETUP_NEW_COMPUTER.md](../SETUP_NEW_COMPUTER.md)).
2. Crie as tabelas, regras e bucket: `npm run db:migrate`.
3. Supabase › SQL Editor: cole e execute o conteúdo de `database/restore-data.sql` (repõe contas, perfis, conteúdos,
   versões, mensagens, reservas e auditoria; os triggers ficam desligados durante a carga).
4. Reponha os ficheiros: Storage › `media` › carregue a pasta `storage/media/` mantendo os caminhos (as subpastas
   `marcas/AAAA-MM/…`, `geral/AAAA-MM/…`). Se o URL do projecto mudar, os endereços das imagens guardados no
   conteúdo apontam para o projecto antigo: substitua o domínio antigo pelo novo em `restore-data.sql` antes do
   passo 3 (procurar `gchtuvikrcvwxuxzmnty.supabase.co`).
5. Configure a autenticação (Site URL e Redirect URLs) e faça um deploy na Vercel.

**No mesmo projecto** (dados apagados por engano): execute só as partes necessárias de `restore-data.sql` no SQL
Editor — cada linha é um *upsert* pela chave primária, por isso não duplica registos existentes.

**Backups automáticos do Supabase**: disponíveis nos planos pagos (Database › Backups, com PITR opcional).
