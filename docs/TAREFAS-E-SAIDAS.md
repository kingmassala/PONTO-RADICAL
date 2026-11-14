# Tarefas e saídas de material (painel /admin)

Duas áreas do painel da Ponto Radical, para toda a equipa com acesso ao painel (administradores e editores):

| Área | Endereço | Para quê |
|---|---|---|
| **Tarefas** | `/admin/tarefas` | Registo, controlo e alertas das tarefas da equipa |
| **Saídas de material** | `/admin/saidas` | Material fornecido à **Promarine** ou a **outros clientes**, com guia de entrega assinada |

A antiga Gestão de Obras Navais passou para a plataforma própria da Promarine (outro projecto, outra base de
dados). `/gestao` neste site redirecciona para `https://promarine-angola.vercel.app/gestao`.

## Tarefas

- Cada tarefa tem número `TR-AAAA-NNNN`, área, prioridade, **responsável** (nome + telemóvel WhatsApp), **prazo**
  (hora de Luanda) e lembrete (2 h, 1 dia, 2 dias ou 1 semana antes).
- Estados: Pendente → Em curso → Concluída (ou Cancelada). Concluir regista a data.
- **Alertas no painel**: a Visão Geral e o menu mostram as tarefas em atraso e a vencer nas próximas 24 h.
- **Alertas por WhatsApp** ao responsável:
  - ao criar a tarefa (ou ao mudar de responsável) — «NOVA TAREFA ATRIBUÍDA»;
  - antes do prazo, conforme o lembrete — «LEMBRETE DE PRAZO»;
  - quando o prazo passa sem estar concluída — «TAREFA EM ATRASO».
  Cada alerta é enviado uma vez por prazo; mudar o prazo ou o responsável volta a activá-los. O resultado de cada
  envio fica registado (`pr_task_alerts`) e aparece na tarefa («Último alerta»).
- Enquanto a WhatsApp Cloud API não estiver configurada, cada tarefa tem o botão **«Enviar pelo WhatsApp»**, que abre
  o WhatsApp com a mensagem pronta (envio manual).
- Apagar tarefas: só administradores (fica na auditoria).

### Agendador

`/api/admin/tarefas/cron` com `Authorization: Bearer <CRON_SECRET>`. A Vercel chama-o todos os dias às 06:00 UTC
(07:00 em Luanda), conforme `vercel.json` (o plano gratuito da Vercel só permite uma execução diária). Para lembretes
mais frequentes, agendar o mesmo pedido noutro serviço (ex.: Supabase pg_cron) a cada 15 minutos.

### WhatsApp (Cloud API oficial da Meta)

Variáveis na Vercel: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `CRON_SECRET` (e opcional
`WHATSAPP_GRAPH_VERSION`). Modelo a aprovar no WhatsApp Manager — nome **`pr_alerta_tarefa`**, categoria
*Utility*, língua *Portuguese (POR)* `pt_PT`, corpo:

```
PONTO RADICAL | Tarefas
{{1}}
Tarefa: {{2}} — {{3}}
Responsável: {{4}}
Prazo: {{5}}
Prioridade: {{6}}
Ver no painel: {{7}}
```

Exemplos para a aprovação: `NOVA TAREFA ATRIBUÍDA`, `TR-2026-0001`, `Preparar material de pintura para a
Promarine`, `Ana Silva`, `qui., 12/11/2026, 15:30`, `Alta`, `https://ponto-radical.vercel.app/admin/tarefas?t=TR-2026-0001`.

O WhatsApp só se considera a funcionar depois de um envio real confirmado pela Meta.

## Saídas de material (Promarine e outros clientes)

1. **Saídas de material › Nova saída de material**: data, **cliente** (Promarine por omissão; escolher outro já usado
   ou escrever um novo), **dados do cliente** opcionais (NIF, morada, contacto — preenchidos automaticamente com os
   da última guia desse cliente), referência (obra/embarcação, opcional), quem entrega, quem recebe (opcional),
   materiais com quantidade e unidade, observações.
2. **Emitir guia**: cria a guia `GS-AAAA-NNNN` e abre o documento para **imprimir ou guardar em PDF**, com a
   declaração de fornecimento, a lista de materiais e as assinaturas **«Entreguei — Ponto Radical»** e
   **«Recebi — <cliente>»** (nome, assinatura e data).
3. Depois de assinada em papel: **Marcar como assinada** (indica quem recebeu). A guia fica bloqueada.
4. Erros: enquanto está por assinar pode ser **corrigida**; depois só pode ser **anulada** (com motivo — fica marcada
   «ANULADA» no documento). Apagar só por administradores e só guias nunca assinadas; os números não se reutilizam.
5. **Controlo por material**: total fornecido por material e unidade num período (sem as guias anuladas), para todos
   os clientes ou filtrado por cliente. A lista de guias também se filtra por cliente.
6. **Download para análise** (no «Controlo por material»): ficheiros CSV para Excel/Numbers/Google Sheets, com o período e
   o cliente escolhidos — «Resumo por material» (totais, clientes, primeira e última saída; sem anuladas) e «Detalhe
   por guia» (uma linha por material de cada guia, com estado, cliente, referência e quem entregou/recebeu).
   Rota: `/admin/saidas/exportar?tipo=resumo|detalhe&de=&ate=&cliente=`.

## Base de dados

Migrações `20261111000002_tarefas_saidas_material.sql` e `20261114000001_guias_outros_clientes.sql` (dados do cliente): `pr_tasks`, `pr_task_alerts`, `pr_material_deliveries`,
`pr_material_delivery_items`, `pr_counters`; funções `pr_create_delivery`, `pr_replace_delivery_items`. Acesso pela
RLS (`is_staff()`; apagar `is_admin()`), auditoria em `audit_log`. Testes: `npm run test:admin-db`.
