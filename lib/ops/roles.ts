/**
 * Perfis da Gestão de Obras. Espelham as funções SQL (ops_has_role, ops_can_manage,
 * ops_can_finance): a interface usa-as para mostrar/esconder, mas quem decide é a
 * base de dados (RLS) e as Server Actions.
 */
export const OPS_ROLES = ["admin", "direcao", "gestor", "supervisor", "tecnico", "financeiro"] as const;
export type OpsRole = (typeof OPS_ROLES)[number];

export const ROLE_LABELS: Record<OpsRole, string> = {
  admin: "Administrador",
  direcao: "Direcção",
  gestor: "Gestor de Obras",
  supervisor: "Supervisor",
  tecnico: "Técnico",
  financeiro: "Financeiro",
};

export const ROLE_DESCRIPTIONS: Record<OpsRole, string> = {
  admin: "Acesso integral, utilizadores, configuração e integrações.",
  direcao: "Visão global, aprovação de orçamentos e despesas, indicadores.",
  gestor: "Cria e planeia obras, atribui técnicos, controla prazos e recursos.",
  supervisor: "Acompanha trabalhos, valida tarefas e relatórios, gere ocorrências.",
  tecnico: "Vê e actualiza as suas tarefas, regista horas, fotografias, relatórios e ocorrências.",
  financeiro: "Despesas, orçamentos, custos e relatórios financeiros.",
};

export const can = {
  manage: (r: OpsRole) => r === "admin" || r === "direcao" || r === "gestor" || r === "supervisor",
  plan: (r: OpsRole) => r === "admin" || r === "direcao" || r === "gestor",
  finance: (r: OpsRole) => r === "admin" || r === "direcao" || r === "gestor" || r === "financeiro",
  approveExpenses: (r: OpsRole) => r === "admin" || r === "direcao" || r === "financeiro",
  approveQuotes: (r: OpsRole) => r === "admin" || r === "direcao",
  editRates: (r: OpsRole) => r === "admin" || r === "financeiro",
  admin: (r: OpsRole) => r === "admin",
  seeAudit: (r: OpsRole) => r === "admin" || r === "direcao",
  readReports: (r: OpsRole) => r !== "tecnico" && r !== "financeiro",
};
