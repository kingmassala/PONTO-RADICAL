/**
 * Tarefas do painel: constantes, estados de prazo, telefones e texto dos alertas.
 * Sem dependências de servidor (usado também nos componentes do painel).
 */
export const TASK_TZ = "Africa/Luanda";
/** Angola não tem horário de Verão: UTC+1 todo o ano. */
const LUANDA_OFFSET = "+01:00";

export const TASK_STATUSES = ["pendente", "em_curso", "concluida", "cancelada"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendente: "Pendente",
  em_curso: "Em curso",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const TASK_PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };

export const TASK_AREAS = [
  "geral",
  "loja",
  "armazem",
  "compras",
  "fornecimentos",
  "financeiro",
  "marketing",
  "experiencias",
  "manutencao",
  "administrativo",
] as const;
export type TaskArea = (typeof TASK_AREAS)[number];
export const TASK_AREA_LABELS: Record<TaskArea, string> = {
  geral: "Geral",
  loja: "Loja",
  armazem: "Armazém",
  compras: "Compras",
  fornecimentos: "Fornecimentos à Promarine",
  financeiro: "Financeiro",
  marketing: "Marketing e redes sociais",
  experiencias: "Experiências no mar",
  manutencao: "Manutenção",
  administrativo: "Administrativo",
};

export const REMIND_OPTIONS = [
  { value: 0, label: "Sem lembrete" },
  { value: 2, label: "2 horas antes" },
  { value: 24, label: "1 dia antes" },
  { value: 48, label: "2 dias antes" },
  { value: 168, label: "1 semana antes" },
] as const;

export type Task = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  area: TaskArea;
  priority: TaskPriority;
  status: TaskStatus;
  responsible_name: string;
  responsible_phone: string | null;
  due_at: string | null;
  remind_before_hours: number;
  notes: string | null;
  completed_at: string | null;
  reminder_sent_at: string | null;
  overdue_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskAlertKind = "atribuida" | "lembrete" | "atraso" | "teste";
export const TASK_ALERT_LABELS: Record<TaskAlertKind, string> = {
  atribuida: "NOVA TAREFA ATRIBUÍDA",
  lembrete: "LEMBRETE DE PRAZO",
  atraso: "TAREFA EM ATRASO",
  teste: "MENSAGEM DE TESTE",
};

export type DueState = "sem_prazo" | "no_prazo" | "a_vencer" | "atrasada" | "fechada";

/** Situação do prazo: «a vencer» = dentro da janela de lembrete (ou nas próximas 24 h, se não houver lembrete). */
export function dueState(task: Pick<Task, "status" | "due_at" | "remind_before_hours">, now: Date = new Date()): DueState {
  if (task.status === "concluida" || task.status === "cancelada") return "fechada";
  if (!task.due_at) return "sem_prazo";
  const due = new Date(task.due_at).getTime();
  if (due < now.getTime()) return "atrasada";
  const windowMs = (task.remind_before_hours || 24) * 3_600_000;
  return due - now.getTime() <= windowMs ? "a_vencer" : "no_prazo";
}

/** Normaliza um telemóvel para o formato internacional (+244… por omissão). Devolve null se for inválido. */
export function normalizePhone(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/[^0-9+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+")) {
    digits = digits.replace(/\+/g, "");
    if (/^9\d{8}$/.test(digits)) digits = `+244${digits}`;
    else if (/^244\d{9}$/.test(digits)) digits = `+${digits}`;
    else return null;
  }
  digits = `+${digits.slice(1).replace(/\+/g, "")}`;
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** «2026-11-12T15:30» (hora de Luanda, campo datetime-local) → ISO com fuso. */
export function luandaLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00${LUANDA_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → «2026-11-12T15:30» em hora de Luanda (para preencher um datetime-local). */
export function isoToLuandaLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 3_600_000);
  return d.toISOString().slice(0, 16);
}

export function formatDue(iso: string | null): string {
  if (!iso) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: TASK_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Parâmetros do modelo de WhatsApp «pr_alerta_tarefa» (ordem {{1}}…{{7}}). */
export function taskAlertParams(task: Pick<Task, "code" | "title" | "responsible_name" | "due_at" | "priority">, kind: TaskAlertKind, link: string): string[] {
  return [TASK_ALERT_LABELS[kind], task.code, task.title, task.responsible_name, formatDue(task.due_at), TASK_PRIORITY_LABELS[task.priority], link];
}

/** Texto completo do alerta, igual ao modelo aprovado (pré-visualização e envio manual por wa.me). */
export function taskAlertText(task: Pick<Task, "code" | "title" | "responsible_name" | "due_at" | "priority">, kind: TaskAlertKind, link: string): string {
  const [label, code, title, who, due, priority, url] = taskAlertParams(task, kind, link);
  return [
    "PONTO RADICAL | Tarefas",
    label,
    `Tarefa: ${code} — ${title}`,
    `Responsável: ${who}`,
    `Prazo: ${due}`,
    `Prioridade: ${priority}`,
    `Ver no painel: ${url}`,
  ].join("\n");
}

export function waMeHref(phone: string | null, text: string): string | null {
  const p = normalizePhone(phone);
  return p ? `https://wa.me/${p.slice(1)}?text=${encodeURIComponent(text)}` : null;
}
