# Ponto Radical — Website + CMS

Website institucional One Page da Ponto Radical, com painel de administração próprio (`/admin`) para gerir
conteúdos, imagens, marcas, secções, aparência, botões, contactos, Loja Online (Quicksell), SEO e **experiências
reserváveis** (passeios de barco, actividades) — com rascunho, pré-visualização, publicação imediata e histórico de
versões — e caixa de entrada de **pedidos de reserva** com agenda.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth,
Storage, RLS) · Vercel.

**Produção:** https://ponto-radical.vercel.app · **Painel:** https://ponto-radical.vercel.app/admin ·
**Línguas:** português (`/`), espanhol (`/es`), francês (`/fr`) e inglês (`/en`).

## Documentação

- [CLAUDE.md](CLAUDE.md) — instruções permanentes para o Claude (regras, comandos, arquitectura, armadilhas).
- [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md) — estado actual, identidade visual, marcas, estrutura do site e do
  painel, decisões e pendências.
- [SETUP_NEW_COMPUTER.md](SETUP_NEW_COMPUTER.md) — instalar e continuar o projecto noutro computador.
- [docs/BACKUP-E-RECUPERACAO.md](docs/BACKUP-E-RECUPERACAO.md) — backups da base de dados e do Storage e
  recuperação.
- [docs/INSTALACAO.md](docs/INSTALACAO.md) — configuração do Supabase, administrador inicial, publicação na Vercel,
  ligação da Quicksell.
- [docs/GUIA-CMS.md](docs/GUIA-CMS.md) — guia de utilização do painel.

## Funcionalidades

- Ecrã de entrada com o logótipo a girar em 3D e escolha da língua (aparece em cada visita).
- Website em 4 línguas: textos fixos traduzidos no código (`lib/i18n/messages.ts`) e conteúdo traduzido no painel
  (**Traduções**), com `hreflang`, sitemap por língua e imagem de partilha com o logótipo.
- Modo preto e branco, tipografia geométrica (Jost), animações 3D em CSS e logótipo oficial em SVG.
- Marcas com logótipos e selo de **revendedor autorizado**; faixa animada e botões para a **Loja Online**
  (Quicksell, com alternativa por WhatsApp/contactos enquanto não houver link).
- Experiências reserváveis com pedidos de reserva e agenda no painel; formulário de contacto; histórico de versões.

## Arranque rápido

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Sem Supabase configurado, o website mostra o conteúdo inicial (`lib/cms/seed-content.ts`) e o painel fica
bloqueado. Para o painel funcionar, siga `docs/INSTALACAO.md`.

## Arquitectura

```
app/(site)/page.tsx          Website público (lê a versão publicada; cache invalidada ao publicar)
app/admin/(panel)/…          Painel (protegido: proxy + verificação no servidor + RLS)
app/admin/pre-visualizacao   Pré-visualização do rascunho ou de versões antigas
app/auth/callback            Links de email (recuperação de palavra-passe, convites)
components/site/             Componentes do website (um renderizador partilhado por site e pré-visualização)
components/admin/            Componentes do painel
lib/cms/schema.ts            Modelo de conteúdos (zod) — fonte de validação
lib/cms/actions.ts           Server Actions de conteúdo (rascunho, secções, marcas, publicar, restaurar)
lib/booking/                 Reservas: regras partilhadas (datas, horários, capacidade), envio público e acções do painel
lib/media/                   Carregamento e validação de ficheiros
supabase/migrations/         Tabelas, funções transaccionais, RLS, bucket de ficheiros
supabase/seed.sql            Conteúdo inicial (gerado)
tests/                       Testes do CMS e da base de dados (PGlite)
```

**Modelo de conteúdo.** Todo o conteúdo público é um documento JSON validado por `lib/cms/schema.ts`.
O rascunho vive em `site_draft` (uma linha, com número de revisão para evitar gravações concorrentes);
cada publicação é uma linha imutável em `site_versions`; `site_state` aponta para a versão online.
Publicar é uma única função SQL transaccional (`publish_site`), e restaurar copia uma versão para o rascunho.
Esta abordagem dá publicações atómicas, pré-visualização fiel e histórico completo sem duplicar tabelas.

**Reservas.** Os serviços (`services`, `serviceCategories`, `booking`) fazem parte do documento do CMS e por isso
têm rascunho, publicação e histórico. Os pedidos dos clientes ficam na tabela `booking_requests` (inserção só pelo
servidor, leitura e tratamento pela equipa, auditoria por trigger), com uma cópia do serviço no momento do pedido.
Não há motor de disponibilidade: o cliente envia um pedido e a equipa confirma, propõe outra data ou recusa.
O pagamento acontece fora do website, mas a tabela já tem os campos para pagamentos futuros.

**Segurança.**
- Autenticação Supabase (email + palavra-passe, recuperação por email, convites); sem palavras-passe no código.
- Papéis `admin` / `editor` em `profiles`; alterações de papel só via `set_user_role` (com salvaguardas).
- RLS em todas as tabelas; o público só consegue chamar `get_published_site()`; escrita de conteúdo só via
  funções que verificam o papel.
- Server Actions verificam a sessão com `getUser()` antes de cada operação.
- Texto rico limpo com `sanitize-html` ao gravar e ao mostrar; URLs restringidos a http(s)/mailto/tel; cores
  validadas como hexadecimal (sem CSS livre).
- Ficheiros validados pelo conteúdo real (não pela extensão), SVG com código rejeitado, limites de tamanho e tipos
  também impostos no bucket.
- Formulário de contacto e pedidos de reserva: validação no servidor, campo-armadilha, tempo mínimo e limite por IP
  (anonimizado); gravação só no servidor. Os pedidos são validados contra o conteúdo publicado (serviço visível,
  data, dia da semana, horário e capacidade).
- A chave secreta do Supabase só é usada no servidor (`lib/supabase/admin.ts`, marcado `server-only`).
- Registo de auditoria das operações relevantes.

## Testes

```bash
npm test
```

Inclui 31 testes da lógica do CMS, das reservas e das traduções (validação, XSS, links, loja, serviços, regras dos
pedidos, chaves de tradução) e 22 testes da base de dados num Postgres embutido (RLS, permissões por papel, rascunho
vs. publicado, publicação, restauro, armazenamento, pedidos de reserva).

## Backups

```bash
npm run backup -- --out="/pasta/privada/AAAA-MM-DD"
```

```bash
npm run backup:verify -- --dir="/pasta/privada/AAAA-MM-DD"
```

Só leitura: exporta contas, conteúdos, versões, mensagens, reservas, auditoria, políticas e os ficheiros do Storage,
e prova que o backup se repõe numa base vazia. Detalhes em [docs/BACKUP-E-RECUPERACAO.md](docs/BACKUP-E-RECUPERACAO.md).
