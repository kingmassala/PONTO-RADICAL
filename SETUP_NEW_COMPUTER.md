# Instalar e continuar o projecto noutro computador

Guia passo a passo para recuperar o projecto Ponto Radical num computador novo (macOS ou Windows), com uma nova
conta do Claude, e continuar exactamente de onde parou. O website, o painel e a base de dados **continuam online**
durante a mudança: não é preciso reinstalar nada nas plataformas.

## 0. O que precisa de ter à mão

- Acesso à conta **GitHub** que tem o repositório `kingmassala/PONTO-RADICAL`.
- Acesso ao **Supabase** (projecto `gchtuvikrcvwxuxzmnty`) e à **Vercel** (`kingmassala-s-projects/ponto-radical`)
  — é daí que se copiam as chaves (nunca estiveram no GitHub).
- A sua conta Apple (iCloud Drive), onde estão os backups.

## 1. Instalar as ferramentas

1. **Git** — macOS: `xcode-select --install` · Windows: https://git-scm.com/download/win
2. **Node.js 20.9 ou mais recente** (LTS) — https://nodejs.org (o projecto foi desenvolvido com Node 25 e npm 11).
3. **Claude** — aplicação Claude para computador (https://claude.ai/download), separador **Code**, ou o Claude Code
   no terminal (`npm install -g @anthropic-ai/claude-code`).
4. Opcional: **Visual Studio Code**.

Confirme:

```bash
node -v
```

```bash
git --version
```

## 2. Descarregar o projecto do GitHub

```bash
git clone https://github.com/kingmassala/PONTO-RADICAL.git ponto-radical
```

```bash
cd ponto-radical
```

```bash
npm install
```

Para poder enviar alterações (`git push`), autentique-se no GitHub uma vez: com o GitHub Desktop, com
`gh auth login` (GitHub CLI) ou com um *personal access token* quando o git pedir a palavra-passe. Configure também
a sua identidade:

```bash
git config --global user.name "Dario Massala"
```

```bash
git config --global user.email "dariomassala@gmail.com"
```

## 3. Recuperar as variáveis de ambiente (`.env.local`)

Copie o modelo e preencha os valores (o modelo explica cada variável):

```bash
cp .env.example .env.local
```

| Variável | Onde obter o valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API › Project URL (`https://gchtuvikrcvwxuxzmnty.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase › Project Settings › API Keys › Publishable key |
| `SUPABASE_SECRET_KEY` | Supabase › Project Settings › API Keys › Secret key (**secreta**) |
| `SUPABASE_DB_URL` | Supabase › Connect › Session pooler (substituir `[YOUR-PASSWORD]` pela palavra-passe da base de dados; se não a souber: Database › Settings › Reset password) — só para scripts locais, **não** vai para a Vercel |
| `NEXT_PUBLIC_SITE_URL` | `https://ponto-radical.vercel.app` (ou o domínio final) |
| `CONTACT_IP_SALT` | Opcional; copiar da Vercel para manter o mesmo valor |

Atalho: com a CLI da Vercel (`npx vercel login`, `npx vercel link` escolhendo o projecto **existente**
`ponto-radical` — nunca criar um novo) pode descarregar as variáveis de produção:

```bash
npx vercel env pull .env.local --environment=production
```

Depois acrescente `SUPABASE_DB_URL` à mão (não está na Vercel, de propósito).

> `.env.local` nunca vai para o GitHub (está no `.gitignore`). Não o partilhe por email nem no chat.

## 4. Abrir no Claude com a nova conta

1. Inicie sessão na aplicação Claude com a nova conta.
2. No separador **Code**, abra a pasta `ponto-radical` (ou execute `claude` dentro da pasta no terminal).
3. O Claude lê automaticamente `CLAUDE.md` (regras do projecto) e `AGENTS.md`. Peça-lhe para ler também
   `PROJECT_HANDOVER.md` para ficar a par do estado e das pendências, por exemplo:
   «Lê o CLAUDE.md e o PROJECT_HANDOVER.md e diz-me o estado do projecto.»
4. Para pré-visualizar o site dentro da aplicação, existe `.claude/launch.json` com a configuração
   **«Ponto Radical»** (porta 3000, usa o `.env.local`).

## 5. Executar localmente

```bash
npm run dev
```

Abra http://localhost:3000 (website) e http://localhost:3000/admin (painel, com o seu email e palavra-passe de
administrador). **Atenção:** o servidor local usa a base de dados de produção — o que guardar no painel local fica
no mesmo rascunho que o painel online.

Verificações antes de publicar alterações:

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

(Pare o `npm run dev` antes do `build`.)

## 6. Editar e publicar

- **Código**: trabalhe num ramo, faça commit e junte a `main`; cada push para `main` publica automaticamente na
  Vercel (≈1 minuto). Acompanhe em https://vercel.com › ponto-radical › Deployments.
- **Conteúdos**: painel › editar › Guardar → Pré-visualizar → **Publicar**. O site actualiza em segundos.
- **Mudanças que alteram o esquema do conteúdo** (novos campos/opções em `lib/cms/schema.ts`): faça o **deploy do
  código antes** de publicar conteúdo que use as opções novas — o código antigo rejeita valores que não conhece.

## 7. Acesso ao painel e à base de dados

- Painel: https://ponto-radical.vercel.app/admin com as mesmas contas (os utilizadores vivem no Supabase, não no
  computador). Palavra-passe esquecida: «Esqueci-me da palavra-passe» no ecrã de login.
- Novo administrador: Painel › Utilizadores › Convidar, ou `npm run admin:create -- email@dominio "Nome"`
  (pede a palavra-passe sem a mostrar).
- Supabase: https://supabase.com/dashboard/project/gchtuvikrcvwxuxzmnty (tabelas, Storage, Auth, logs).

## 8. Backups

Os backups estão no iCloud Drive › `Backups Ponto Radical`. Fazer um novo, verificar e repor:
[docs/BACKUP-E-RECUPERACAO.md](docs/BACKUP-E-RECUPERACAO.md).

## 9. Problemas comuns

| Sintoma | Solução |
|---|---|
| Painel diz que o Supabase não está configurado | Falta/está errado o `.env.local`; reinicie o `npm run dev` depois de o corrigir |
| `git push` pede palavra-passe | Use um *personal access token* do GitHub ou `gh auth login` |
| Alteração de CSS não aparece no `npm run dev` | Reinicie o servidor (cache do Turbopack) |
| `npm run build` falha depois de usar o dev | Pare o dev e volte a correr o build |
| Site publicado mostra «temporariamente indisponível» | Conteúdo publicado usa opções que o código online não conhece: faça o deploy do código mais recente ou restaure a versão anterior em Publicações e Histórico |
