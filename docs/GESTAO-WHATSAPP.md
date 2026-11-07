# WhatsApp Business Platform (Cloud API) — configuração

A Gestão de Obras envia notificações reais pela API oficial da Meta. O código, a fila, os webhooks, os modelos e o
diagnóstico estão implementados. **Para o envio funcionar faltam passos externos, que só o titular da conta Meta pode
fazer.** Até lá, o envio está desactivado e nenhuma mensagem é apresentada como enviada.

## O que é preciso (externo)

1. **Meta Business Manager** verificado da Ponto Radical (business.facebook.com).
2. **App** em developers.facebook.com › Criar app › tipo «Business» › adicionar o produto **WhatsApp**.
3. **Número de telefone empresarial** dedicado (não pode estar em uso no WhatsApp normal) adicionado em WhatsApp ›
   API Setup e verificado por SMS ou chamada. Anotar o **Phone number ID**.
4. **Token permanente**: Business Settings › Users › System users › criar «Admin» › Generate token para a app, com as
   permissões `whatsapp_business_messaging` e `whatsapp_business_management`, sem expiração.
5. **App secret**: App settings › Basic › App secret.
6. **Método de pagamento** na conta WhatsApp (as conversas iniciadas pela empresa são cobradas pela Meta).

## Variáveis na Vercel (Production)

| Variável | Valor |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Token permanente do passo 4 |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID do passo 3 |
| `WHATSAPP_APP_SECRET` | App secret do passo 5 |
| `WHATSAPP_VERIFY_TOKEN` | Texto aleatório escolhido por si (repete-se no passo seguinte) |

Fazer novo deploy depois de as definir. Os valores nunca são mostrados na plataforma (Notificações › Configuração e
teste indica apenas se estão definidos).

## Webhook

Em developers.facebook.com › a sua app › WhatsApp › Configuration › Webhook:

- **Callback URL**: `https://<domínio>/api/gestao/whatsapp/webhook`
- **Verify token**: o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
- Subscrever o campo **messages**.

Os estados (enviada, entregue, lida, falhada) passam a aparecer no registo de envios. A assinatura de cada pedido é
validada com o App secret. Se um colaborador responder **PARAR** (ou STOP), o consentimento é retirado
automaticamente.

## Modelos de mensagem (WhatsApp Manager › Message templates)

Mensagens iniciadas pela empresa exigem modelos aprovados. Criar dois modelos, categoria **Utility**, língua
**Portuguese (POR)** → código `pt_PT`:

**`pr_notificacao_obra`**

```
PONTO RADICAL | Gestão de Obras
{{1}}
Obra: {{2}}
Embarcação: {{3}}
Tarefa: {{4}}
Responsável: {{5}}
Data: {{6}}
Hora: {{7}}
Prioridade: {{8}}
{{9}}
Consulte a plataforma para confirmar ou actualizar o estado da tarefa.
```

Exemplo para a revisão da Meta: `NOVA TAREFA ATRIBUÍDA`, `OS-2026-0001`, `PR-001`, `Reparação e soldadura do
casco`, `Técnico João`, `09/11/2026`, `08h00`, `Alta`, `—`.

**`pr_resumo_obras`**

```
PONTO RADICAL | Gestão de Obras
{{1}}
Olá {{2}},
{{3}}
Data: {{4}}
Consulte a plataforma para mais detalhes.
```

Exemplo: `RESUMO SEMANAL`, `Ana`, `Obras activas: 3. Tarefas atrasadas: 1.`, `09/11/2026`.

Se a Meta aprovar os modelos com outro nome ou língua, ajuste-os em **WhatsApp e avisos › Modelos** (sem alterar
código).

## Consentimento

Só recebem mensagens colaboradores **activos**, com número em formato internacional (`+244…`) e **consentimento
registado** (pelo próprio em «A minha conta» ou pela administração com o seu acordo expresso). O momento e a origem
do consentimento ficam registados.

## Activar e testar

1. Administração › Definições › activar «Enviar notificações WhatsApp».
2. WhatsApp e avisos › Configuração e teste › escolher um colaborador com consentimento:
   - **hello_world**: modelo de teste da Meta, disponível em todas as contas novas;
   - **Modelo da plataforma**: só depois de `pr_notificacao_obra` estar aprovado.
3. A plataforma mostra a resposta da Meta (HTTP e identificador da mensagem). O estado «entregue/lida» chega pelo
   webhook ao registo de envios. Só depois desta confirmação o WhatsApp deve ser considerado operacional.

## Funcionamento

- Eventos imediatos: nova tarefa atribuída, alteração de horário, tarefa cancelada, ocorrência crítica, pedido de
  aprovação (orçamento → Direcção; despesa do gestor → Financeiro/Direcção).
- Agendador (a cada 5 minutos, no servidor): tarefa próxima do início, prazo próximo do fim, tarefa atrasada (uma
  vez por dia), lembretes personalizados (data, hora, antecedência, repetição, destinatários, cancelamento automático
  quando a tarefa termina), lembrete diário e resumo semanal (horas configuráveis, fuso Africa/Luanda).
- Fila `ops_notifications`: chave única por mensagem (sem duplicados), até 5 tentativas com espera crescente em
  falhas temporárias (limites da Meta, erros de rede), limite de mensagens por execução, mensagens obsoletas ou com
  mais de 24 h canceladas.
