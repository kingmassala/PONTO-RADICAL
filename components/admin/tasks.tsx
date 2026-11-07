"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, MessageCircle, Pencil, Plus, Trash2, User } from "lucide-react";
import { createTask, deleteTask, sendTaskAlertNow, setTaskStatus, updateTask } from "@/lib/tasks/actions";
import {
  dueState,
  formatDue,
  isoToLuandaLocal,
  REMIND_OPTIONS,
  TASK_AREA_LABELS,
  TASK_AREAS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  taskAlertText,
  waMeHref,
  type DueState,
  type Task,
  type TaskArea,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/rules";
import { Badge, Button, cx, Field, Modal, Notice, Select, TextArea, TextInput } from "./ui";

export type TaskAlertRow = { task_id: string; kind: string; status: string; error: string | null; created_at: string };

const PRIORITY_TONE: Record<TaskPriority, "slate" | "sky" | "amber" | "red"> = { baixa: "slate", media: "sky", alta: "amber", urgente: "red" };
const STATUS_TONE: Record<TaskStatus, "slate" | "sky" | "green"> = { pendente: "slate", em_curso: "sky", concluida: "green", cancelada: "slate" };
const DUE_CLS: Record<DueState, string> = {
  sem_prazo: "text-slate-500",
  no_prazo: "text-slate-600",
  a_vencer: "font-medium text-amber-700",
  atrasada: "font-semibold text-red-700",
  fechada: "text-slate-400",
};
const ALERT_STATUS: Record<string, string> = {
  enviado: "enviado por WhatsApp",
  falhou: "falhou",
  sem_configuracao: "WhatsApp por configurar",
  sem_telefone: "sem telemóvel",
};
const ALERT_KIND: Record<string, string> = { atribuida: "Atribuição", lembrete: "Lembrete", atraso: "Atraso", teste: "Teste" };

type FormState = {
  title: string;
  description: string;
  area: TaskArea;
  priority: TaskPriority;
  status: TaskStatus;
  responsibleName: string;
  responsiblePhone: string;
  dueLocal: string;
  remindBeforeHours: number;
  notes: string;
  notify: boolean;
};

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  area: "geral",
  priority: "media",
  status: "pendente",
  responsibleName: "",
  responsiblePhone: "",
  dueLocal: "",
  remindBeforeHours: 24,
  notes: "",
  notify: true,
});

const fromTask = (t: Task): FormState => ({
  title: t.title,
  description: t.description ?? "",
  area: t.area,
  priority: t.priority,
  status: t.status,
  responsibleName: t.responsible_name,
  responsiblePhone: t.responsible_phone ?? "",
  dueLocal: isoToLuandaLocal(t.due_at),
  remindBeforeHours: t.remind_before_hours,
  notes: t.notes ?? "",
  notify: true,
});

export function TaskBoard({
  tasks,
  alerts,
  canDelete,
  whatsappReady,
  siteUrl,
  focusCode,
}: {
  tasks: Task[];
  alerts: TaskAlertRow[];
  canDelete: boolean;
  whatsappReady: boolean;
  siteUrl: string;
  focusCode?: string;
}) {
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [filter, setFilter] = useState<"abertas" | "todas" | TaskStatus>("abertas");
  const [area, setArea] = useState<"todas" | TaskArea>("todas");
  const [query, setQuery] = useState("");
  // Hora de referência para «atrasada»/«a vencer»: só no browser (evita diferenças de hidratação).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!focusCode) return;
    document.getElementById(`tarefa-${focusCode}`)?.scrollIntoView({ block: "center" });
  }, [focusCode]);

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) if (!map.has(t.responsible_name)) map.set(t.responsible_name, t.responsible_phone ?? "");
    return [...map.entries()].map(([name, phone]) => ({ name, phone }));
  }, [tasks]);

  const alertsByTask = useMemo(() => {
    const map = new Map<string, TaskAlertRow[]>();
    for (const a of alerts) map.set(a.task_id, [...(map.get(a.task_id) ?? []), a]);
    return map;
  }, [alerts]);

  const q = query.trim().toLowerCase();
  const visible = tasks.filter((t) => {
    if (filter === "abertas" && (t.status === "concluida" || t.status === "cancelada")) return false;
    if (filter !== "abertas" && filter !== "todas" && t.status !== filter) return false;
    if (area !== "todas" && t.area !== area) return false;
    if (q && !`${t.code} ${t.title} ${t.responsible_name} ${t.description ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const ref = now ?? new Date(0);
  const state = (t: Task) => (now ? dueState(t, ref) : t.status === "concluida" || t.status === "cancelada" ? "fechada" : "no_prazo");
  const groups: { key: string; title: string; icon: React.ReactNode; items: Task[] }[] = [
    { key: "atrasada", title: "Em atraso", icon: <AlertTriangle className="size-4 text-red-600" />, items: visible.filter((t) => state(t) === "atrasada") },
    { key: "a_vencer", title: "A vencer", icon: <BellRing className="size-4 text-amber-600" />, items: visible.filter((t) => state(t) === "a_vencer") },
    {
      key: "abertas",
      title: "Em aberto",
      icon: <CalendarClock className="size-4 text-slate-500" />,
      items: visible.filter((t) => state(t) === "no_prazo" || state(t) === "sem_prazo"),
    },
    { key: "fechadas", title: "Concluídas e canceladas", icon: <CheckCircle2 className="size-4 text-emerald-600" />, items: visible.filter((t) => state(t) === "fechada") },
  ];
  const late = tasks.filter((t) => now && dueState(t, ref) === "atrasada").length;
  const soon = tasks.filter((t) => now && dueState(t, ref) === "a_vencer").length;

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Em aberto" value={tasks.filter((t) => t.status === "pendente" || t.status === "em_curso").length} />
        <Stat label="A vencer" value={soon} tone={soon ? "amber" : undefined} />
        <Stat label="Em atraso" value={late} tone={late ? "red" : undefined} />
      </div>

      {!whatsappReady && (
        <div className="mb-6">
          <Notice tone="info" title="Alertas automáticos por WhatsApp ainda não estão ligados.">
            Enquanto a conta WhatsApp Business (Meta) não estiver configurada, use «Enviar pelo WhatsApp» em cada tarefa: abre o WhatsApp com a
            mensagem pronta para o responsável. Os alertas e atrasos aparecem sempre aqui e na Visão Geral.
          </Notice>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {(["abertas", "todas", ...TASK_STATUSES] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cx(
                "rounded-full px-3 py-1.5 text-sm",
                filter === f ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {f === "abertas" ? "Em aberto" : f === "todas" ? "Todas" : TASK_STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2 lg:justify-end">
          <select
            aria-label="Área"
            value={area}
            onChange={(e) => setArea(e.target.value as typeof area)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="todas">Todas as áreas</option>
            {TASK_AREAS.map((a) => (
              <option key={a} value={a}>
                {TASK_AREA_LABELS[a]}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar…"
            aria-label="Procurar tarefas"
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-slate-900">Sem tarefas {filter === "abertas" ? "em aberto" : "neste filtro"}</p>
          <p className="mt-2 text-sm text-slate-500">Crie uma tarefa, atribua um responsável e um prazo: o responsável recebe o aviso no WhatsApp.</p>
          <Button variant="primary" className="mt-5" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Nova tarefa
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.key}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  {g.icon} {g.title} <span className="font-normal text-slate-400">({g.items.length})</span>
                </h2>
                <ul className="space-y-3">
                  {g.items.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      state={state(t)}
                      alerts={alertsByTask.get(t.id) ?? []}
                      canDelete={canDelete}
                      whatsappReady={whatsappReady}
                      siteUrl={siteUrl}
                      focused={focusCode === t.code}
                      onEdit={() => setEditing(t)}
                    />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      <NewTaskButton onClick={() => setEditing("new")} />
      <Modal open={editing !== null} title={editing === "new" ? "Nova tarefa" : `Editar ${editing?.code ?? ""}`} onClose={() => setEditing(null)}>
        {editing && <TaskForm key={editing === "new" ? "new" : editing.id} task={editing === "new" ? null : editing} people={people} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

/** O botão «Nova tarefa» do cabeçalho da página dispara este evento. */
function NewTaskButton({ onClick }: { onClick: () => void }) {
  useEffect(() => {
    const handler = () => onClick();
    window.addEventListener("pr:nova-tarefa", handler);
    return () => window.removeEventListener("pr:nova-tarefa", handler);
  }, [onClick]);
  return null;
}

export function NewTaskHeaderButton() {
  return (
    <Button variant="primary" onClick={() => window.dispatchEvent(new Event("pr:nova-tarefa"))}>
      <Plus className="size-4" /> Nova tarefa
    </Button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "red" }) {
  return (
    <div
      className={cx(
        "rounded-xl border bg-white px-4 py-3 shadow-sm",
        tone === "red" ? "border-red-200" : tone === "amber" ? "border-amber-200" : "border-slate-200",
      )}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cx("mt-1 text-2xl font-semibold", tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-slate-900")}>{value}</p>
    </div>
  );
}

function TaskRow({
  task,
  state,
  alerts,
  canDelete,
  whatsappReady,
  siteUrl,
  focused,
  onEdit,
}: {
  task: Task;
  state: DueState;
  alerts: TaskAlertRow[];
  canDelete: boolean;
  whatsappReady: boolean;
  siteUrl: string;
  focused: boolean;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const kind = state === "atrasada" ? "atraso" : state === "a_vencer" ? "lembrete" : "atribuida";
  const manualHref = waMeHref(task.responsible_phone, taskAlertText(task, kind, `${siteUrl}/admin/tarefas?t=${task.code}`));
  const closed = task.status === "concluida" || task.status === "cancelada";
  const lastAlert = alerts[0];

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText?: string) =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? (okText ? { tone: "success", text: okText } : null) : { tone: "error", text: r.error ?? "Erro." });
    });

  return (
    <li
      id={`tarefa-${task.code}`}
      className={cx(
        "rounded-xl border bg-white p-4 shadow-sm",
        state === "atrasada" ? "border-red-200" : state === "a_vencer" ? "border-amber-200" : "border-slate-200",
        focused && "ring-2 ring-sky-400",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{task.code}</span>
            <Badge tone={STATUS_TONE[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
            <Badge tone={PRIORITY_TONE[task.priority]}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
            <Badge>{TASK_AREA_LABELS[task.area]}</Badge>
          </div>
          <p className={cx("mt-1.5 font-medium text-slate-900", closed && "text-slate-500 line-through decoration-slate-300")}>{task.title}</p>
          {task.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{task.description}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <User className="size-3.5 text-slate-400" /> {task.responsible_name}
              {task.responsible_phone && <span className="text-slate-400">· {task.responsible_phone}</span>}
            </span>
            <span className={cx("inline-flex items-center gap-1.5", DUE_CLS[state])}>
              <CalendarClock className="size-3.5" /> {formatDue(task.due_at)}
              {state === "atrasada" && " · em atraso"}
              {state === "a_vencer" && " · a vencer"}
            </span>
          </p>
          {lastAlert && (
            <p className="mt-1.5 text-xs text-slate-500">
              Último alerta: {ALERT_KIND[lastAlert.kind] ?? lastAlert.kind} · {ALERT_STATUS[lastAlert.status] ?? lastAlert.status} ·{" "}
              {new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(lastAlert.created_at))}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <select
            aria-label="Estado"
            value={task.status}
            disabled={pending}
            onChange={(e) => run(() => setTaskStatus(task.id, e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" /> Editar
          </Button>
          {!closed &&
            (whatsappReady && task.responsible_phone ? (
              <Button
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await sendTaskAlertNow(task.id);
                    if (!r.ok) setMessage({ tone: "error", text: r.error });
                    else if (r.data.status === "enviado") setMessage({ tone: "success", text: "Aviso enviado por WhatsApp." });
                    else setMessage({ tone: "warning", text: r.data.error ?? "O aviso não foi enviado." });
                  })
                }
              >
                <MessageCircle className="size-3.5" /> Avisar
              </Button>
            ) : manualHref ? (
              <a
                href={manualHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
              >
                <MessageCircle className="size-3.5" /> Enviar pelo WhatsApp
              </a>
            ) : null)}
          {canDelete && (
            <Button
              size="sm"
              variant="danger"
              aria-label={`Apagar ${task.code}`}
              disabled={pending}
              onClick={() => {
                if (confirm(`Apagar a tarefa ${task.code}? Esta acção não pode ser desfeita.`)) run(() => deleteTask(task.id));
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {message && (
        <div className="mt-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
    </li>
  );
}

function TaskForm({ task, people, onDone }: { task: Task | null; people: { name: string; phone: string }[]; onDone: () => void }) {
  const [f, setF] = useState<FormState>(() => (task ? fromTask(task) : emptyForm()));
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; details?: string[] } | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const pickPerson = (name: string) => {
    set("responsibleName", name);
    const known = people.find((p) => p.name === name);
    if (known?.phone && !f.responsiblePhone) set("responsiblePhone", known.phone);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = task ? await updateTask(task.id, f) : await createTask(f);
      if (r.ok) onDone();
      else setError({ text: r.error, details: r.details });
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextInput label="Tarefa" required value={f.title} onChange={(v) => set("title", v)} maxLength={160} placeholder="Ex.: Preparar material de pintura para a Promarine" />
      <TextArea label="Descrição" value={f.description} onChange={(v) => set("description", v)} maxLength={4000} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Área" value={f.area} onChange={(v) => set("area", v)} options={TASK_AREAS.map((a) => ({ value: a, label: TASK_AREA_LABELS[a] }))} />
        <Select label="Prioridade" value={f.priority} onChange={(v) => set("priority", v)} options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Responsável *" htmlFor="task-responsible">
          <input
            id="task-responsible"
            list="task-people"
            value={f.responsibleName}
            maxLength={120}
            onChange={(e) => pickPerson(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
          <datalist id="task-people">
            {people.map((p) => (
              <option key={p.name} value={p.name} />
            ))}
          </datalist>
        </Field>
        <TextInput
          label="Telemóvel (WhatsApp)"
          type="tel"
          value={f.responsiblePhone}
          onChange={(v) => set("responsiblePhone", v)}
          placeholder="923 456 789"
          hint="Recebe o aviso de nova tarefa, o lembrete e o alerta de atraso."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prazo" htmlFor="task-due" hint="Hora de Luanda.">
          <input
            id="task-due"
            type="datetime-local"
            value={f.dueLocal}
            onChange={(e) => set("dueLocal", e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </Field>
        <Select
          label="Lembrete"
          value={String(f.remindBeforeHours)}
          onChange={(v) => set("remindBeforeHours", Number(v))}
          options={REMIND_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
        />
      </div>
      {task && <Select label="Estado" value={f.status} onChange={(v) => set("status", v)} options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))} />}
      <TextArea label="Notas internas" value={f.notes} onChange={(v) => set("notes", v)} maxLength={4000} rows={2} />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={f.notify} onChange={(e) => set("notify", e.target.checked)} className="mt-0.5 accent-black" />
        <span>{task ? "Avisar o responsável por WhatsApp se mudar o responsável" : "Avisar o responsável por WhatsApp"}</span>
      </label>
      {error && (
        <Notice tone="error" title={error.text}>
          {error.details && (
            <ul className="list-disc pl-4">
              {error.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={pending}>
          {task ? "Guardar" : "Criar tarefa"}
        </Button>
      </div>
    </form>
  );
}
