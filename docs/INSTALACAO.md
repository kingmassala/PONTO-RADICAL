# Instalação, publicação e manutenção

Este guia leva o projecto do código até ao website online, com o painel de administração a funcionar.
Tempo estimado: 30–45 minutos.

Precisa de:

- uma conta no [Supabase](https://supabase.com) (base de dados, autenticação e ficheiros);
- uma conta na [Vercel](https://vercel.com) (alojamento);
- o código num repositório GitHub (a Vercel publica a partir daí);
- Node.js 20.9 ou superior no computador onde vai preparar o projecto.

---

## 1. Criar o projecto no Supabase

1. Em supabase.com → **New project**. Região recomendada: **West EU (Ireland)** ou **Central EU (Frankfurt)** (as mais próximas de Angola).
2. Guarde a palavra-passe da base de dados num gestor de palavras-passe.
3. Quando o projecto estiver pronto, abra **Project Settings → API Keys** e anote:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (ou `anon` nas contas antigas) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (ou `service_role`) → `SUPABASE_SECRET_KEY`

> ⚠️ A chave secreta dá acesso total à base de dados. Nunca a coloque em variáveis `NEXT_PUBLIC_`, em código do browser,
> em emails ou em capturas de ecrã.

## 2. Criar as tabelas, as regras de segurança e o armazenamento

No Supabase, abra **SQL Editor → New query** e execute, por esta ordem:

1. todo o conteúdo de `supabase/migrations/20261015000001_cms_schema.sql`;
2. todo o conteúdo de `supabase/migrations/20261016000001_booking_requests.sql` (pedidos de reserva);
3. todo o conteúdo de `supabase/seed.sql` (conteúdo inicial do website).

Todos podem ser executados mais de uma vez sem duplicar dados.

Em alternativa, sem copiar SQL: defina `SUPABASE_DB_URL` em `.env.local` (Supabase → **Connect** → *Session pooler*)
e execute `npm run db:migrate` — aplica as migrações e o seed numa única transacção.

> **Projecto que já estava a funcionar antes das reservas?** Execute só a migração
> `20261016000001_booking_requests.sql` (ou `npm run db:migrate`). O seed não altera conteúdo existente, por isso
> os serviços de exemplo não aparecem: no painel, crie os serviços em **Serviços** e acrescente a secção
> **Experiências e reservas** em **Secções** (e, se quiser, aponte o botão do cabeçalho para ela). Depois publique.

Ou, com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <ref-do-projecto>
```

```bash
supabase db push
```

e depois `npm run db:seed` (ver passo 4).

Verificação: em **Table Editor** devem existir as tabelas `profiles`, `site_draft`, `site_versions`, `site_state`,
`media`, `contact_messages`, `booking_requests` e `audit_log`, e em **Storage** o bucket público `media`.

## 3. Configurar a autenticação

Em **Authentication → Sign In / Providers**:

- mantenha **Email** activo;
- **desactive «Allow new users to sign up»** (só administradores criam contas, por convite).

Em **Authentication → URL Configuration**:

- **Site URL**: o endereço final do website, por ex. `https://www.pontoradical.ao`;
- **Redirect URLs**: adicione `https://www.pontoradical.ao/auth/callback` e, para desenvolvimento,
  `http://localhost:3000/auth/callback`. Se usar o endereço provisório da Vercel, adicione também
  `https://<projecto>.vercel.app/auth/callback`.

Emails (recuperação de palavra-passe e convites): o serviço de email incluído no Supabase tem limites baixos
e serve apenas para testes. Para produção configure um SMTP próprio em **Authentication → Emails → SMTP Settings**
(por ex. o email do domínio, Resend, Brevo ou SendGrid).

## 4. Preparar o projecto localmente

```bash
npm install
```

```bash
cp .env.example .env.local
```

Preencha `.env.local` com os valores do passo 1. Depois:

```bash
npm run db:seed
```

(Só necessário se não executou `supabase/seed.sql` no passo 2. Não faz nada se o conteúdo já existir.)

## 5. Criar o administrador inicial

Não existe nenhuma palavra-passe fixa no código. O primeiro administrador é criado com:

```bash
npm run admin:create -- geral@pontoradical.ao "Nome Apelido"
```

O script pede a palavra-passe no terminal (mínimo 10 caracteres). Os restantes utilizadores são convidados a partir
do painel, em **Utilizadores**.

Alternativa sem terminal: no Supabase, **Authentication → Users → Add user** (marque «Auto confirm»), e depois no
**SQL Editor**:

```sql
update public.profiles set role = 'admin' where email = 'geral@pontoradical.ao';
```

## 6. Testar localmente

```bash
npm run dev
```

- Website: http://localhost:3000
- Painel: http://localhost:3000/admin

Sem as variáveis do Supabase, o website mostra o conteúdo inicial e o painel fica inacessível — útil só para
desenvolvimento do design.

## 7. Publicar na Vercel

1. Envie o código para um repositório GitHub (privado).
2. Em vercel.com → **Add New → Project** → importe o repositório. A Vercel detecta Next.js automaticamente.
3. Em **Environment Variables**, adicione (para Production e Preview):

   | Variável | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projecto Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave pública |
   | `SUPABASE_SECRET_KEY` | chave secreta (**não** marque como pública) |
   | `NEXT_PUBLIC_SITE_URL` | `https://www.pontoradical.ao` |
   | `CONTACT_IP_SALT` | texto aleatório longo (anonimiza o IP no formulário de contacto e nos pedidos de reserva) |

4. **Deploy**.
5. Em **Settings → Domains**, ligue o domínio (por ex. `pontoradical.ao` e `www.pontoradical.ao`) e siga as
   instruções de DNS do registador.
6. Actualize o **Site URL** e as **Redirect URLs** do Supabase (passo 3) com o domínio final.

A partir daqui, **as alterações feitas no painel e publicadas aparecem no website de imediato**, sem novo deploy.
Só é necessário um novo deploy quando o código muda (novas funcionalidades ou novos modelos de secção).

## 8. Lista de verificação após a publicação

- [ ] `https://<domínio>/admin` redirecciona para o início de sessão.
- [ ] Consegue entrar com o administrador criado no passo 5.
- [ ] Altera um título, guarda o rascunho e confirma que o website público **não** mudou.
- [ ] «Pré-visualizar» mostra a alteração.
- [ ] «Publicar» → o website público mostra a alteração (recarregue a página).
- [ ] Carrega uma imagem em **Biblioteca Multimédia** e usa-a numa secção.
- [ ] Envia uma mensagem pelo formulário do website e vê-a em **Mensagens**.
- [ ] Envia um pedido em **Experiências** (escolha um serviço, data e hora), recebe a referência e vê o pedido em
      **Reservas** (com o número de pedidos novos no menu). Confirme-o e veja-o na **Agenda** e na **Visão Geral**.
- [ ] «Esqueceu-se da palavra-passe?» envia o email e o link permite definir nova palavra-passe.
- [ ] O botão «Loja Online» não aparece em nenhum lugar (loja desactivada).

---

## Ligar a loja Quicksell (quando o endereço estiver disponível)

Não é preciso alterar código.

1. Painel → **Loja Online**.
2. Cole o endereço fornecido pela Quicksell (tem de começar por `https://`).
3. Active **«Activar Loja Online»**, ajuste o texto do botão e onde deve aparecer (cabeçalho e/ou abertura).
4. **Guardar rascunho** → **Pré-visualizar** → **Publicar**.

Para voltar a esconder o botão, desactive a loja e publique. Qualquer botão do website pode também apontar para a loja
escolhendo o destino «Loja Online»; esses botões ficam automaticamente ocultos enquanto a loja estiver desactivada.

---

## Cópias de segurança e recuperação

**Conteúdo do website (textos, secções, marcas, aparência)**
Cada publicação fica guardada em **Publicações e Histórico** e pode ser restaurada a qualquer momento. Isto cobre
a maioria dos enganos do dia-a-dia.

**Base de dados completa**
- O Supabase faz cópias diárias automáticas nos planos pagos (**Database → Backups**), com restauro a um ponto no
  tempo (PITR) como opção. No plano gratuito não há cópias automáticas descarregáveis — recomenda-se o plano Pro
  para um website em produção.
- Cópia manual recomendada: `npm run backup` (ver [BACKUP-E-RECUPERACAO.md](BACKUP-E-RECUPERACAO.md)), que inclui
  também os ficheiros do Storage. Alternativa com a Supabase CLI:

  ```bash
  supabase db dump --linked -f backup-$(date +%F).sql --data-only
  ```

  Guarde o ficheiro fora do Supabase (por ex. numa drive da empresa).

**Ficheiros (imagens e vídeos)**
O Supabase não inclui o Storage nas cópias da base de dados. Guarde os originais das fotografias numa pasta da
empresa, ou descarregue periodicamente o bucket `media` (Storage → media → seleccionar → Download).

**Restaurar**
- Um conteúdo: **Publicações e Histórico → Restaurar → Publicar**.
- A base de dados: Supabase **Database → Backups → Restore**, ou execute o ficheiro de cópia manual no SQL Editor
  de um projecto novo (depois da migração) e actualize as variáveis na Vercel.

---

## Desenvolvimento

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` / `npm run typecheck` | Verificações de código |
| `npm test` | Testes da lógica do CMS e das reservas e da base de dados (RLS, publicação, permissões, pedidos de reserva) |
| `npm run db:seed-sql` | Regenera `supabase/seed.sql` a partir de `lib/cms/seed-content.ts` |
| `npm run db:seed` | Insere o conteúdo inicial na base de dados configurada |
| `npm run admin:create` | Cria/promove o administrador inicial |

Os testes de base de dados correm num Postgres embutido (PGlite) que simula o ambiente Supabase; não precisam de
ligação à internet nem tocam no projecto real.

### Acrescentar um novo modelo de secção (requer programador)

1. Adicionar o esquema em `lib/cms/schema.ts` (união `sectionSchema`).
2. Adicionar o modelo em `lib/cms/templates.ts`.
3. Criar o componente público em `components/site/sections.tsx` e registá-lo em `site-renderer.tsx`.
4. Criar os campos de edição em `components/admin/section-editor.tsx`.
5. `npm test`, deploy.
