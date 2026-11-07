import { ORDER_STATUS_LABELS, TASK_STATUS_LABELS, type OrderStatus, type TaskStatus } from "./labels";

export type ActivityRow = {
  id: number;
  created_at: string;
  actor_name: string | null;
  table_name: string;
  record_id: string | null;
  action: string;
  changes: Record<string, unknown>;
};

const ENTITY: Record<string, string> = {
  ops_work_orders: "obra",
  ops_work_order_finance: "valores contratuais",
  ops_tasks: "tarefa",
  ops_expenses: "despesa",
  ops_quotes: "orçamento",
  ops_daily_reports: "relatório diário",
  ops_incidents: "ocorrência",
  ops_reminders: "lembrete",
  ops_material_consumptions: "consumo de material",
  ops_clients: "cliente",
  ops_vessels: "embarcação",
  ops_members: "colaborador",
  ops_member_rates: "custo/hora",
  ops_settings: "definições",
  ops_whatsapp_templates: "modelo WhatsApp",
};

const FIELD: Record<string, string> = {
  status: "estado",
  progress: "progresso",
  due_at: "prazo",
  start_at: "início",
  due_date: "prazo",
  start_date: "início",
  responsible_id: "responsável",
  approval: "aprovação",
  title: "título",
  priority: "prioridade",
  contract_price: "preço contratual",
  budget_revised: "orçamento revisto",
  stage: "situação",
  urgency: "urgência",
  role: "perfil",
  active: "activo",
};

function label(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") {
    if (v in ORDER_STATUS_LABELS) return ORDER_STATUS_LABELS[v as OrderStatus];
    if (v in TASK_STATUS_LABELS) return TASK_STATUS_LABELS[v as TaskStatus];
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("pt-PT", { timeZone: "Africa/Luanda", dateStyle: "short", timeStyle: "short" });
  }
  return String(v);
}

/** Frase legível para a linha temporal. */
export function describeActivity(a: ActivityRow): string {
  const entity = ENTITY[a.table_name] ?? a.table_name;
  const c = a.changes ?? {};
  const name = (c.title ?? c.description ?? c.number ?? c.name ?? c.full_name) as string | undefined;
  if (a.action === "insert") return `Criou ${entity}${name ? ` «${String(name).slice(0, 80)}»` : ""}`;
  if (a.action === "delete") return `Eliminou ${entity}${name ? ` «${String(name).slice(0, 80)}»` : ""}`;
  const parts = Object.entries(c)
    .filter(([k]) => k in FIELD)
    .map(([k, v]) => {
      const [from, to] = Array.isArray(v) ? v : [null, v];
      return `${FIELD[k]}: ${label(from)} → ${label(to)}`;
    });
  return `Alterou ${entity}${parts.length ? ` (${parts.join("; ")})` : ""}`;
}
