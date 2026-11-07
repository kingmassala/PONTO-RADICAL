export const ORDER_STATUSES = [
  "em_avaliacao",
  "aguarda_orcamento",
  "aguarda_aprovacao",
  "aprovada",
  "planeada",
  "em_execucao",
  "suspensa",
  "concluida",
  "entregue",
  "cancelada",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  em_avaliacao: "Em avaliação",
  aguarda_orcamento: "A aguardar orçamento",
  aguarda_aprovacao: "A aguardar aprovação",
  aprovada: "Aprovada",
  planeada: "Planeada",
  em_execucao: "Em execução",
  suspensa: "Suspensa",
  concluida: "Concluída",
  entregue: "Entregue",
  cancelada: "Cancelada",
};
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["aprovada", "planeada", "em_execucao", "suspensa"];
export const OPEN_ORDER_STATUSES: OrderStatus[] = ORDER_STATUSES.filter((s) => !["concluida", "entregue", "cancelada"].includes(s));

export const PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };

export const TASK_STATUSES = ["por_iniciar", "em_curso", "suspensa", "concluida", "validada", "cancelada"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  por_iniciar: "Por iniciar",
  em_curso: "Em curso",
  suspensa: "Suspensa",
  concluida: "Concluída",
  validada: "Validada",
  cancelada: "Cancelada",
};
export const DONE_TASK_STATUSES: TaskStatus[] = ["concluida", "validada", "cancelada"];

export const EXPENSE_CATEGORIES = [
  "materiais",
  "mao_de_obra",
  "equipamentos",
  "transportes",
  "combustivel",
  "alimentacao",
  "alojamento",
  "servicos_externos",
  "subcontratacoes",
  "consumiveis",
  "imprevistos",
  "limpeza_higiene",
  "escritorio",
  "agua_luz_comunicacoes",
  "manutencao_instalacoes",
  "outros",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  materiais: "Materiais",
  mao_de_obra: "Mão-de-obra",
  equipamentos: "Equipamentos",
  transportes: "Transportes",
  combustivel: "Combustível",
  alimentacao: "Alimentação",
  alojamento: "Alojamento",
  servicos_externos: "Serviços externos",
  subcontratacoes: "Subcontratações",
  consumiveis: "Consumíveis",
  imprevistos: "Imprevistos",
  limpeza_higiene: "Limpeza e higiene",
  escritorio: "Material de escritório",
  agua_luz_comunicacoes: "Água, luz e comunicações",
  manutencao_instalacoes: "Manutenção das instalações",
  outros: "Outros",
};

export const EXPENSE_STAGES = ["prevista", "comprometida", "realizada"] as const;
export type ExpenseStage = (typeof EXPENSE_STAGES)[number];
export const EXPENSE_STAGE_LABELS: Record<ExpenseStage, string> = {
  prevista: "Prevista",
  comprometida: "Comprometida (encomendada)",
  realizada: "Realizada (paga/facturada)",
};
export const APPROVAL_LABELS = { pendente: "Pendente", aprovada: "Aprovada", rejeitada: "Rejeitada" } as const;
export type Approval = keyof typeof APPROVAL_LABELS;

export const QUOTE_STATUS_LABELS = { rascunho: "Rascunho", submetido: "Submetido para aprovação", aprovado: "Aprovado", rejeitado: "Rejeitado" } as const;
export type QuoteStatus = keyof typeof QUOTE_STATUS_LABELS;

export const REPORT_STATUS_LABELS = { submetido: "Submetido", validado: "Validado", correccao: "Correcção pedida" } as const;
export type ReportStatus = keyof typeof REPORT_STATUS_LABELS;

export const INCIDENT_CATEGORIES = [
  "meteorologia",
  "falta_materiais",
  "transporte",
  "atraso_cliente",
  "acesso",
  "seguranca",
  "falha_equipamento",
  "alteracao",
  "coordenacao",
  "acidente",
  "outro",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  meteorologia: "Condições meteorológicas adversas",
  falta_materiais: "Falta de materiais",
  transporte: "Problemas de transporte",
  atraso_cliente: "Atraso provocado pelo cliente",
  acesso: "Restrições de acesso",
  seguranca: "Problema de segurança",
  falha_equipamento: "Falha de equipamento",
  alteracao: "Alteração de última hora",
  coordenacao: "Problema de coordenação",
  acidente: "Acidente ou incidente",
  outro: "Outro factor externo",
};
export const URGENCIES = ["baixo", "medio", "alto", "critico"] as const;
export type Urgency = (typeof URGENCIES)[number];
export const URGENCY_LABELS: Record<Urgency, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico" };
export const INCIDENT_STATUS_LABELS = { aberta: "Aberta", em_analise: "Em análise", resolvida: "Resolvida", encerrada: "Encerrada" } as const;
export type IncidentStatus = keyof typeof INCIDENT_STATUS_LABELS;

export const VESSEL_TYPES = ["pesca", "turistica", "recreio", "lancha", "transporte", "apoio_maritimo", "outra"] as const;
export type VesselType = (typeof VESSEL_TYPES)[number];
export const VESSEL_TYPE_LABELS: Record<VesselType, string> = {
  pesca: "Pesca",
  turistica: "Turística",
  recreio: "Recreio",
  lancha: "Lancha",
  transporte: "Transporte",
  apoio_maritimo: "Apoio marítimo",
  outra: "Outra",
};

export const INTERVENTION_TYPES = [
  "diagnostico",
  "manutencao_preventiva",
  "reparacao_motor",
  "reparacao_casco",
  "soldadura_estrutural",
  "electrica_electronica",
  "pintura_tratamento",
  "instalacao_equipamentos",
  "recuperacao",
  "outra",
] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];
export const INTERVENTION_LABELS: Record<InterventionType, string> = {
  diagnostico: "Diagnóstico e avaliação",
  manutencao_preventiva: "Manutenção preventiva",
  reparacao_motor: "Motores e propulsão",
  reparacao_casco: "Reparação de casco",
  soldadura_estrutural: "Estruturas metálicas e alumínio",
  electrica_electronica: "Sistemas eléctricos e electrónicos",
  pintura_tratamento: "Pintura e tratamento anticorrosivo",
  instalacao_equipamentos: "Instalação de equipamentos náuticos",
  recuperacao: "Recuperação de embarcação",
  outra: "Outra intervenção",
};

export const NOTIFICATION_STATUS_LABELS = {
  agendada: "Agendada",
  em_envio: "Em envio",
  enviada: "Enviada",
  entregue: "Entregue",
  lida: "Lida",
  falhada: "Falhada",
  cancelada: "Cancelada",
} as const;
export type NotificationStatus = keyof typeof NOTIFICATION_STATUS_LABELS;

export const NOTIFICATION_EVENTS = {
  tarefa_atribuida: "Nova tarefa atribuída",
  tarefa_inicio: "Tarefa próxima do início",
  prazo_proximo: "Prazo próximo do fim",
  tarefa_atrasada: "Tarefa atrasada",
  alteracao_horario: "Alteração de horário",
  tarefa_cancelada: "Tarefa cancelada",
  ocorrencia_critica: "Ocorrência crítica",
  pedido_aprovacao: "Pedido de aprovação",
  lembrete: "Lembrete personalizado",
  lembrete_diario: "Lembrete diário",
  resumo_semanal: "Resumo semanal",
} as const;
export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;

/** Áreas das tarefas de gestão da empresa (sem obra associada). */
export const COMPANY_AREAS = [
  "administracao",
  "financeiro",
  "comercial",
  "recursos_humanos",
  "compras",
  "logistica",
  "instalacoes",
  "legal",
  "marketing",
  "informatica",
  "outro",
] as const;
export type CompanyArea = (typeof COMPANY_AREAS)[number];
export const COMPANY_AREA_LABELS: Record<CompanyArea, string> = {
  administracao: "Administração",
  financeiro: "Finanças e contabilidade",
  comercial: "Comercial e clientes",
  recursos_humanos: "Recursos humanos",
  compras: "Compras e fornecedores",
  logistica: "Logística e armazém",
  instalacoes: "Instalações e equipamentos",
  legal: "Legal e licenças",
  marketing: "Marketing e comunicação",
  informatica: "Informática",
  outro: "Outro",
};

/** Nomes das linhas da tabela de modelos WhatsApp (eventos + modelo das tarefas da empresa). */
export const TEMPLATE_EVENT_LABELS: Record<string, string> = {
  ...NOTIFICATION_EVENTS,
  tarefa_empresa: "Tarefas da empresa (modelo usado em todos os avisos destas tarefas)",
};

/** Legenda que identifica o documento de registo da matrícula entre os anexos da embarcação. */
export const REGISTRATION_DOC_CAPTION = "Documento de registo da matrícula";
