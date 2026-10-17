@AGENTS.md

# Ponto Radical — instruções permanentes para o Claude

Lê também [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md) (estado actual, decisões e pendências) antes de mudar código.
Instalação noutro computador: [SETUP_NEW_COMPUTER.md](SETUP_NEW_COMPUTER.md). Backups: [docs/BACKUP-E-RECUPERACAO.md](docs/BACKUP-E-RECUPERACAO.md).

## O projecto

Website One Page da **Ponto Radical** (loja náutica e experiências no mar em Angola) com CMS próprio em `/admin`.
Next.js 16 (App Router, **Cache Components** + Partial Prefetching) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (Postgres, Auth, Storage, RLS) · Vercel. Interface e conteúdos em **português europeu** (pt-PT, ortografia
pré-acordo: «actividade», «electrónica», «óptimo»…); o website tem também ES, FR, EN, RU e ZH (chinês simplificado).

- Produção: https://ponto-radical.vercel.app (deploy automático a cada push para `main`).
- GitHub: https://github.com/kingmassala/PONTO-RADICAL · Supabase: projecto `gchtuvikrcvwxuxzmnty` (Frankfurt) ·
  Vercel: `kingmassala-s-projects/ponto-radical`.

## Comandos

```bash
npm run dev          # http://localhost:3000 (usa .env.local → base de dados de produção)
npm run lint
npm run typecheck    # next typegen && tsc --noEmit
npm test             # 34 testes do CMS + 24 da base de dados (PGlite, sem rede)
npm run build
npm run backup -- --out="/pasta"          # backup só de leitura (base de dados + Storage)
npm run backup:verify -- --dir="/pasta"   # prova que o backup se repõe numa base vazia
```

Antes de dar uma tarefa por concluída: `lint`, `typecheck`, `test` e `build` têm de passar. **Pára o servidor de
desenvolvimento antes de `npm run build`** (partilham `.next/` e o dev fica com CSS antigo). Se uma alteração a
`app/globals.css` não aparecer no dev, o Turbopack ficou com cache: reinicia o servidor ou edita o ficheiro outra vez.

## Regras de trabalho (combinadas com o cliente)

- **Modelo B — gestão técnica pelo desenvolvedor:** o código, deploys, base de dados, chaves e backups são da
  responsabilidade do desenvolvedor (Claude a trabalhar com o Dario); a equipa da Ponto Radical só gere conteúdos no
  painel. Mudanças de conteúdo pedidas no chat podem ser feitas no **rascunho**, mas publicar é sempre confirmado.
- Trabalha num ramo (`feat/…`, `fix/…`), faz commit e **pergunta antes de juntar a `main` e fazer push** (isso
  publica na produção). Publicar o rascunho do CMS também precisa de confirmação explícita.
- Commits: a identidade git deste Mac não está configurada; usa
  `git -c user.name="King Massala" -c user.email="itechzoneao@King-Massala.local" commit …` (como o histórico),
  ou a identidade que o utilizador configurar no computador novo.
- **Nunca** imprimas, peças ou coloques chaves no chat, em commits ou em URLs. Os segredos estão em `.env.local`
  (ignorado pelo git) e na Vercel. Scripts lêem-nos com `node --env-file=.env.local …`.
- O utilizador inicia sessão no painel sozinho: **nunca escrevas a palavra-passe de administrador**.
- Não apagues dados de produção nem recries projectos nas plataformas (GitHub, Vercel, Supabase).
- Verifica sempre no destino (site publicado, base de dados, GitHub) antes de dizer que algo está feito.
- O utilizador escreve em português; responde em português europeu.

## Arquitectura essencial

- Todo o conteúdo público é **um documento JSON** validado por `lib/cms/schema.ts` (zod). Rascunho em
  `site_draft` (uma linha, com `revision` para gravações concorrentes); cada publicação é uma linha imutável em
  `site_versions`; `site_state` aponta para a versão online; `publish_site()` é transaccional.
- Website: `app/(site)/page.tsx` (PT em `/`) e `app/(site)/[lang]/page.tsx` (`/es`, `/fr`, `/en`, `/ru`, `/zh`), ambos com
  `components/site/site-renderer.tsx`, que também serve a pré-visualização do painel.
- Traduções: textos fixos em `lib/i18n/messages.ts`; conteúdo do CMS em `doc.translations[língua][chave]`
  (chaves por id do elemento, ver `lib/i18n/content.ts`), editáveis em **Painel › Traduções**.
- Ecrã de entrada (logótipo a girar + escolha de língua): `components/site/language-gate.tsx` +
  `lib/i18n/gate-script.ts`. Aparece **em todos os carregamentos**; só é saltado logo a seguir a escolher outra
  língua (marca de uso único em `sessionStorage`).
- **Blog** (`lib/blog/`, `components/site/blog/`, Painel › Blog): cada artigo é uma linha em `blog_posts`
  (migração `20261017000001_blog_posts.sql`) com estado próprio (rascunho/publicado), **fora** do documento do CMS;
  publicar um artigo actualiza o website de imediato (`updateTag("blog-posts")`). Páginas em `/blog` e `/[lang]/blog`
  (moldura comum `SiteFrame` em `site-renderer.tsx`); a secção «Blog» da página inicial é um tipo de secção do CMS.
- Assinatura da marca: `lib/brand.ts` (`Boating · Water Sports · Camping · Fishing · Lifestyle & Co`).
- Modo preto e branco: `appearance.monochrome` → classe `.pr-mono`; o destaque inverte em `.pr-tone-dark` /
  `.pr-tone-light` e o texto sobre o destaque usa `text-on-accent` (nunca `text-white` em fundos `bg-accent`).

## Armadilhas já resolvidas (não voltes a introduzir)

- `lib/supabase/server.ts` chama `await connection()` antes de `cookies()` (o cliente Supabase usa `Date.now()`).
- Páginas do painel em `app/admin/(panel)/*/page.tsx` têm `export const instant = false`; uma página nova também
  precisa (o `instant = false` do layout não se propaga). `[lang]/page.tsx` também o tem.
- `dynamicParams` não é compatível com Cache Components.
- Não uses `overflow-hidden` em antepassados de animações `view()`/scroll-driven: usa `overflow-clip`.
- Modais do painel são desenhados no `<body>` (portal em `components/admin/ui.tsx`): dentro de um antepassado com
  `backdrop-filter`, um `fixed` fica preso a esse antepassado.
- Funções usadas no servidor não podem viver em ficheiros `"use client"`.
- CSS próprio em `app/globals.css` não tem camada: ganha aos utilitários Tailwind; para sobrepor, usa outra classe
  própria ou `style`.

## Alterar conteúdos sem o painel

Quando for preciso mexer no rascunho por script (ex.: muitas traduções ou marcas de uma vez): script temporário em
`scripts/.tmp-*.mts` que lê `site_draft`, valida com `siteDocumentSchema`, limpa com `sanitizeDocument`, grava com
`revision` esperada (`.eq("revision", rev)`), regista em `audit_log` e é apagado no fim. Executar com
`node --env-file=.env.local --conditions=react-server --import tsx scripts/.tmp-x.mts`. Depois pede ao utilizador
para rever na pré-visualização e só publica com confirmação.
