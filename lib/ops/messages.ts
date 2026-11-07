import { PRIORITY_LABELS, type NotificationEvent, type Priority } from "./labels";
import { fmtDate, fmtTime } from "./time";

/**
 * Conteúdo das mensagens WhatsApp.
 *
 * Modelo «pr_notificacao_obra» (categoria UTILITY, pt_PT) — texto a submeter à Meta:
 *   PONTO RADICAL | Gestão de Obras
 *   {{1}}
 *   Obra: {{2}}
 *   Embarcação: {{3}}
 *   Tarefa: {{4}}
 *   Responsável: {{5}}
 *   Data: {{6}}
 *   Hora: {{7}}
 *   Prioridade: {{8}}
 *   {{9}}
 *   Consulte a plataforma para confirmar ou actualizar o estado da tarefa.
 *
 * Modelo «pr_tarefa_empresa» (UTILITY, pt_PT) — tarefas de gestão da empresa:
 *   PONTO RADICAL | Gestão da Empresa
 *   {{1}}
 *   Referência: {{2}}
 *   Tarefa: {{3}}
 *   Área: {{4}}
 *   Responsável: {{5}}
 *   Data: {{6}}
 *   Hora: {{7}}
 *   Prioridade: {{8}}
 *   {{9}}
 *   Consulte a plataforma para confirmar ou actualizar o estado da tarefa.
 *
 * Modelo «pr_resumo_obras» (UTILITY, pt_PT):
 *   PONTO RADICAL | Gestão de Obras
 *   {{1}}
 *   Olá {{2}},
 *   {{3}}
 *   Data: {{4}}
 *   Consulte a plataforma para mais detalhes.
 */
export const EVENT_TITLES: Record<NotificationEvent, string> = {
  tarefa_atribuida: "NOVA TAREFA ATRIBUÍDA",
  tarefa_inicio: "TAREFA PRÓXIMA DO INÍCIO",
  prazo_proximo: "PRAZO PRÓXIMO DO FIM",
  tarefa_atrasada: "TAREFA ATRASADA",
  alteracao_horario: "ALTERAÇÃO DE HORÁRIO",
  tarefa_cancelada: "TAREFA CANCELADA",
  ocorrencia_critica: "OCORRÊNCIA CRÍTICA",
  pedido_aprovacao: "PEDIDO DE APROVAÇÃO",
  lembrete: "LEMBRETE",
  lembrete_diario: "LEMBRETE DIÁRIO",
  resumo_semanal: "RESUMO SEMANAL",
};

export type TaskMessageInput = {
  event: NotificationEvent;
  orderNumber: string;
  vessel: string;
  task: string;
  responsible: string;
  when: string | null;
  priority: Priority | null;
  note?: string;
};

/** Parâmetros (por ordem) e pré-visualização do modelo pr_notificacao_obra. */
export function taskMessage(input: TaskMessageInput) {
  const params = [
    EVENT_TITLES[input.event],
    input.orderNumber,
    input.vessel || "—",
    input.task || "—",
    input.responsible || "—",
    input.when ? fmtDate(input.when) : "—",
    input.when ? fmtTime(input.when) : "—",
    input.priority ? PRIORITY_LABELS[input.priority] : "—",
    input.note?.trim() || "—",
  ];
  const preview = [
    "PONTO RADICAL | Gestão de Obras",
    params[0],
    `Obra: ${params[1]}`,
    `Embarcação: ${params[2]}`,
    `Tarefa: ${params[3]}`,
    `Responsável: ${params[4]}`,
    `Data: ${params[5]}`,
    `Hora: ${params[6]}`,
    `Prioridade: ${params[7]}`,
    params[8] !== "—" ? params[8] : null,
    "Consulte a plataforma para confirmar ou actualizar o estado da tarefa.",
  ]
    .filter(Boolean)
    .join("\n");
  return { params, preview };
}

export type CompanyTaskMessageInput = {
  event: NotificationEvent;
  code: string;
  task: string;
  area: string;
  responsible: string;
  when: string | null;
  priority: Priority | null;
  note?: string;
};

/** Parâmetros (por ordem) e pré-visualização do modelo pr_tarefa_empresa. */
export function companyTaskMessage(input: CompanyTaskMessageInput) {
  const params = [
    EVENT_TITLES[input.event],
    input.code || "—",
    input.task || "—",
    input.area || "—",
    input.responsible || "—",
    input.when ? fmtDate(input.when) : "—",
    input.when ? fmtTime(input.when) : "—",
    input.priority ? PRIORITY_LABELS[input.priority] : "—",
    input.note?.trim() || "—",
  ];
  const preview = [
    "PONTO RADICAL | Gestão da Empresa",
    params[0],
    `Referência: ${params[1]}`,
    `Tarefa: ${params[2]}`,
    `Área: ${params[3]}`,
    `Responsável: ${params[4]}`,
    `Data: ${params[5]}`,
    `Hora: ${params[6]}`,
    `Prioridade: ${params[7]}`,
    params[8] !== "—" ? params[8] : null,
    "Consulte a plataforma para confirmar ou actualizar o estado da tarefa.",
  ]
    .filter(Boolean)
    .join("\n");
  return { params, preview };
}

/** Parâmetros e pré-visualização do modelo pr_resumo_obras. */
export function summaryMessage(input: { event: "lembrete_diario" | "resumo_semanal"; name: string; summary: string; date: string }) {
  const params = [EVENT_TITLES[input.event], input.name.split(" ")[0] || input.name, input.summary, fmtDate(input.date)];
  const preview = [
    "PONTO RADICAL | Gestão de Obras",
    params[0],
    `Olá ${params[1]},`,
    params[2],
    `Data: ${params[3]}`,
    "Consulte a plataforma para mais detalhes.",
  ].join("\n");
  return { params, preview };
}

/** Atraso exponencial entre tentativas: 2, 4, 8, 16, 32 minutos. */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(60, 2 ** Math.max(1, attempts));
}
export const MAX_SEND_ATTEMPTS = 5;
