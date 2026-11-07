# Gestão de Obras Navais — instalação, configuração e utilização

Área empresarial privada do ecossistema Ponto Radical para gerir obras de reparação, manutenção e recuperação de
embarcações. Faz parte da mesma aplicação (Next.js + Supabase + Vercel) que o website e o painel `/admin`, mas tem
utilizadores, perfis e dados próprios.

| Onde | Endereço |
|---|---|
| Subdomínio (recomendado) | `https://gestao.<domínio>` — ex.: `https://gestao.pontoradical.com` |
| Sem domínio próprio | `https://ponto-radical.vercel.app/gestao` |
| WhatsApp (webhook) | `https://<domínio>/api/gestao/whatsapp/webhook` |
| Automatização (cron) | `https://<domínio>/api/gestao/cron` |

Integração com WhatsApp: [GESTAO-WHATSAPP.md](GESTAO-WHATSAPP.md).

---

## 1. Arquitectura

- **Código**: `app/gestao/*` (páginas), `components/ops/*` (interface), `lib/ops/*` (regras, acções do servidor,
  finanças, WhatsApp, fila e agendador), `app/api/gestao/*` (cron e webhook).
- **Base de dados**: migração `supabase/migrations/20261107000001_gestao_obras.sql`, aditiva (tabelas `ops_*`, não
  altera nada do website). Row Level Security em todas as tabelas: as permissões são impostas pela base de dados,
  não só pela interface.
- **Ficheiros**: bucket privado `ops` (fotografias JPG/PNG/WebP/HEIC e PDF). Só se acede por links temporários
  (1 hora) gerados depois de verificar a permissão.
- **Autenticação**: Supabase Auth (a mesma do painel), com perfis próprios em `ops_members`. Uma pessoa pode ser
  administradora do website e não ter acesso à gestão, ou o contrário.
- **Subdomínio**: o `next.config.ts` reescreve `gestao.*/x` para `/gestao/x`; o `proxy.ts` renova a sessão nos dois
  endereços.
- **Automatização**: `/api/gestao/cron` gera os avisos devidos e envia a fila de WhatsApp. É chamado a cada 5
  minutos pelo Supabase (pg_cron + pg_net) e, como reserva, uma vez por dia pela Vercel Cron (`vercel.json`).
  Funciona com todos os browsers fechados.
- **Auditoria**: triggers registam em `ops_activity` quem alterou o quê e quando (linha temporal de cada obra e
  Administração › Registo de actividade).

### Perfis e permissões

| Perfil | Pode |
|---|---|
| Administrador | Tudo, incluindo utilizadores, definições, modelos e diagnóstico WhatsApp e auditoria completa |
| Direcção | Visão global, finanças, **aprova orçamentos** e despesas, auditoria |
| Gestor de Obras | Cria e planeia obras e tarefas, atribui técnicos, regista despesas e orçamentos (não os aprova) |
| Supervisor | Acompanha obras, valida tarefas e relatórios, gere ocorrências e lembretes (sem finanças) |
| Técnico | Só as suas tarefas: progresso, horas, fotografias, relatórios diários e ocorrências (sem finanças) |
| Financeiro | Despesas, aprovação de despesas, custos/hora, orçamentos (sem os aprovar), relatórios financeiros |

### Regras de cálculo (finanças, AOA)

- **Custos realizados** = despesas realizadas (não rejeitadas) + mão-de-obra (horas × custo/hora) + consumos de
  materiais (custo do catálogo no momento do consumo).
- **Custos comprometidos** = despesas encomendadas ainda não facturadas.
- **Custos previstos** = orçamento revisto → orçamento inicial → despesas previstas.
- **Custo estimado final** = máximo entre (realizados + comprometidos) e previstos.
- **Desvio orçamental** = (realizados + comprometidos) − orçamento de referência.
- **Lucro bruto** = preço contratual (sem IVA) − custo estimado final.
- **Margem bruta** = lucro ÷ preço. **Markup** = lucro ÷ custo. São mostrados separadamente.
- **IVA** configurável (por omissão 14%), aplicado ao preço e a cada despesa; não entra na margem.
- **Progresso da obra** = média das tarefas principais ponderada pelas horas previstas (peso 1 sem horas).
- **Integridade**: só Direcção/Financeiro/Administração aprovam despesas. Uma despesa aprovada não pode ser
  alterada nem eliminada. Orçamentos submetidos ficam bloqueados; aprovar actualiza os valores contratuais numa única
  transacção. Numeração `OS-AAAA-NNNN`, `CL-NNNN` e `EMB-NNNN` sem duplicados (contador transaccional).

---

## 2. Instalação (uma vez)

### 2.1 Base de dados

Aplicar só a migração nova (não reaplica as do website):

```bash
npm run db:migrate -- --only=20261107000001_gestao_obras.sql
```

Em alternativa, colar o ficheiro no SQL Editor do Supabase. A migração pode ser executada mais de uma vez.

### 2.2 Variáveis de ambiente (Vercel › Settings › Environment Variables, Production)

| Variável | Para quê |
|---|---|
| `CRON_SECRET` | Texto aleatório longo; protege o agendador (obrigatório) |
| `NEXT_PUBLIC_GESTAO_HOST` | Opcional: `gestao.pontoradical.com` |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | WhatsApp (ver GESTAO-WHATSAPP.md) |

`SUPABASE_SECRET_KEY` (já existente) é necessária para criar contas, enviar mensagens e gerar links de ficheiros.
Depois de alterar variáveis, fazer novo deploy.

### 2.3 Primeiro administrador

Dar acesso a uma conta que já existe (por ex. a do painel do website), sem mexer na palavra-passe:

```bash
npm run gestao:admin -- <email-da-conta> "Nome Apelido"
```

Os restantes colaboradores são criados em **Administração › Utilizadores**, com palavra-passe temporária (mostrada
uma vez ao administrador e obrigatoriamente alterada no primeiro acesso) ou convite por email (requer SMTP no
Supabase).

### 2.4 Subdomínio

1. Vercel › Project › Settings › Domains › adicionar `gestao.pontoradical.com`.
2. No registador do domínio, criar o registo DNS indicado pela Vercel (normalmente `CNAME gestao →
   cname.vercel-dns.com`).
3. Supabase › Authentication › URL Configuration › Redirect URLs: acrescentar
   `https://gestao.pontoradical.com/auth/callback` (recuperação de palavra-passe e convites).

Sem domínio próprio, use `https://ponto-radical.vercel.app/gestao`. Não é possível criar subdomínios de
`vercel.app`.

### 2.5 Automatização a cada 5 minutos

Depois do deploy, executar uma vez no SQL Editor `supabase/manual/gestao-cron.sql`, substituindo `<URL>` e
`<CRON_SECRET>`. O segredo fica no Vault do Supabase. Verificação: `select * from cron.job_run_details order by
start_time desc limit 5;`.

### 2.6 Instalar como aplicação (PWA)

No telemóvel, abrir o endereço da gestão e escolher «Adicionar ao ecrã principal» (Safari: botão Partilhar; Chrome:
menu ⋮). A aplicação abre em ecrã inteiro. Por segurança não guarda dados no dispositivo: sem rede, mostra um aviso.

---

## 3. Utilização

- **Dashboard**: obras activas/concluídas/atrasadas, tarefas, ocorrências críticas, técnicos em actividade, prazos,
  prioridades e (perfis financeiros) despesas, margem e evolução mensal. Tudo calculado da base de dados.
- **Obras**: criar ordem de serviço (cliente, embarcação, intervenção, responsável, equipa, datas, prioridade).
  Ficha com separadores: Resumo, Tarefas (lista, Kanban, cronograma), Custos e orçamento, Relatórios, Ocorrências,
  Fotografias e documentos, Linha temporal.
- **Tarefas**: tarefas e subtarefas, dependências, responsáveis, técnicos atribuídos, horas previstas e registadas,
  progresso. Atrasadas assinaladas a vermelho. O técnico actualiza o estado e o progresso e regista horas; a
  supervisão valida.
- **Relatórios diários**: submetidos no telemóvel com fotografias; a supervisão valida ou pede correcção. Filtros
  por período, técnico e obra; exportação para Excel (CSV) e PDF (impressão do browser).
- **Ocorrências**: categoria, urgência, impacto, medidas, responsável, fotografias. As críticas notificam por WhatsApp
  a Administração, a Direcção, os Gestores e os Supervisores. Podem gerar uma tarefa correctiva.
- **Custos e orçamentos**: despesas com comprovativo, aprovação, orçamentos por versões, catálogo de materiais,
  fornecedores, rentabilidade por obra; exportação para Excel.
- **Técnicos e equipas**: carga de trabalho, horas do mês e (Financeiro/Administração) custo/hora.
- **WhatsApp e avisos**: registo de envios com estados da Meta, lembretes agendados, modelos e teste.
- **Telemóvel**: barra inferior com Tarefas, Relatório, Problema e Agenda.

---

## 4. Backups e recuperação

`npm run backup` (ver [BACKUP-E-RECUPERACAO.md](BACKUP-E-RECUPERACAO.md)) inclui automaticamente todas as tabelas
`ops_*` e os ficheiros do bucket privado `ops`. Recomenda-se o plano Supabase Pro para backups diários
automáticos e recuperação a um ponto no tempo, e um backup manual antes de cada actualização da plataforma.

---

## 5. Estado dos testes de aceitação

Testes automáticos (`npm test`): 21 testes de base de dados da gestão em Postgres embutido (perfis, RLS,
numeração, tarefas, progresso ponderado, finanças, relatórios, ocorrências, auditoria, fila sem duplicados) e 13
testes de lógica (cálculos financeiros verificáveis à mão, mensagens, CSV, assinatura dos webhooks, subdomínio).

| Teste | Estado |
|---|---|
| 1 Multiutilizador (admin + 2 técnicos, permissões) | Verificado na base de dados (RLS); falta o ensaio no browser em produção |
| 2 Persistência após fechar o browser | Garantida pela arquitectura (servidor + Postgres); falta o ensaio em produção |
| 3 Obra com cinco tarefas actualizadas por contas diferentes | Verificado na base de dados; falta o ensaio no browser |
| 4 Despesas e cálculos | Verificado (testes de base de dados + lógica) |
| 5 Ocorrência crítica no dashboard | Verificado na base de dados; falta o ensaio no browser |
| 6 WhatsApp real | **Pendente**: requer conta Meta, número e modelos aprovados |
| 7 Envio agendado com o browser fechado | **Pendente**: requer WhatsApp configurado e o cron activo |
| 8 Técnico sem acesso a finanças/administração | Verificado na base de dados (RLS) e nas rotas |
