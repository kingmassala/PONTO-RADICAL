"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { deleteTask, logTime, saveTask, updateTaskProgress, validateTask } from "@/lib/ops/actions/tasks";
import { COMPANY_AREAS, COMPANY_AREA_LABELS, PRIORITIES, PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, type CompanyArea, type Priority, type TaskStatus } from "@/lib/ops/labels";
import { taskHref } from "@/lib/ops/task-href";
import { can } from "@/lib/ops/roles";
import { fmtDate, fmtDateTime, isoToLuandaInput, todayLuanda } from "@/lib/ops/time";
import { cx } from "@/lib/cx";
import { useOps } from "./context";
import { Badge, Button, Choice, EmptyState, FormError, Input, Modal, PeoplePicker, ProgressBar, Area } from "./ui";
import { useOpsAction } from "./use-action";

export type TaskView = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  /** null = tarefa de gestão da empresa. */
  work_order_id: string | null;
  area: CompanyArea | null;
  areaLabel: string | null;
  orderNumber: string;
  vessel: string;
  parent_id: string | null;
  responsible_id: string | null;
  responsible: string | null;
  assignees: string[];
  depends_on: string[];
  priority: Priority;
  status: TaskStatus;
  progress: number;
  start_at: string | null;
  due_at: string | null;
  planned_hours: number;
  used_hours: number;
  late: boolean;
  notes: string | null;
};

export const STATUS_TONE: Record<TaskStatus, "slate" | "sky" | "amber" | "green" | "red"> = {
  por_iniciar: "slate",
  em_curso: "sky",
  suspensa: "amber",
  concluida: "green",
  validada: "green",
  cancelada: "red",
};
export const PRIORITY_TONE: Record<Priority, "slate" | "sky" | "amber" | "red"> = { baixa: "slate", media: "sky", alta: "amber", urgente: "red" };

/* ------------------------------ Formulário ------------------------------ */

type Sibling = { id: string; code: string; title: string; work_order_id: string | null };

type FormValues = {
  id?: string;
  scope: "obra" | "empresa";
  work_order_id: string;
  area: CompanyArea | "";
  parent_id: string | null;
  title: string;
  description: string;
  responsible_id: string | null;
  assignees: string[];
  depends_on: string[];
  priority: Priority;
  start_at: string;
  due_at: string;
  planned_hours: string;
  status: TaskStatus;
};

export function TaskFormButton({
  orderId,
  orders,
  companyAllowed = false,
  defaultScope = "obra",
  people,
  siblings,
  task,
  label,
  variant = "primary",
}: {
  orderId?: string;
  orders?: { id: string; label: string }[];
  /** Pode criar tarefas de gestão da empresa (Administração, Direcção, Gestores). */
  companyAllowed?: boolean;
  defaultScope?: "obra" | "empresa";
  people: { id: string; name: string; hint?: string }[];
  siblings: Sibling[];
  task?: TaskView;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const initial: FormValues = task
    ? {
        id: task.id,
        scope: task.work_order_id ? "obra" : "empresa",
        work_order_id: task.work_order_id ?? "",
        area: task.area ?? "",
        parent_id: task.parent_id,
        title: task.title,
        description: task.description ?? "",
        responsible_id: task.responsible_id,
        assignees: task.assignees,
        depends_on: task.depends_on,
        priority: task.priority,
        start_at: isoToLuandaInput(task.start_at),
        due_at: isoToLuandaInput(task.due_at),
        planned_hours: String(task.planned_hours ?? 0),
        status: task.status,
      }
    : {
        scope: orderId || !companyAllowed ? "obra" : defaultScope,
        work_order_id: orderId ?? "",
        area: "",
        parent_id: null,
        title: "",
        description: "",
        responsible_id: null,
        assignees: [],
        depends_on: [],
        priority: "media",
        start_at: "",
        due_at: "",
        planned_hours: "0",
        status: "por_iniciar",
      };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<FormValues>(initial);
  const { pending, error, run } = useOpsAction();
  const set = (patch: Partial<FormValues>) => setV((c) => ({ ...c, ...patch }));
  // datetime-local está em hora de Luanda (UTC+1).
  const toIso = (local: string) => (local ? new Date(`${local}:00+01:00`).toISOString() : null);
  const company = v.scope === "empresa";
  const others = siblings.filter((s) => (company ? s.work_order_id === null : s.work_order_id === v.work_order_id) && s.id !== v.id);
  const canChooseScope = !task && !orderId && companyAllowed;

  return (
    <>
      <Button variant={variant} size={task ? "sm" : "md"} onClick={() => { setV(initial); setOpen(true); }}>
        {task ? <Pencil className="size-3.5" /> : <Plus className="size-4" />} {label ?? (task ? "Editar" : "Nova tarefa")}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={task ? `Editar tarefa ${task.code}` : "Nova tarefa"} wide>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveTask({
                  ...v,
                  work_order_id: company ? null : v.work_order_id,
                  area: company ? v.area || null : null,
                  responsible_id: v.responsible_id || null,
                  parent_id: v.parent_id || null,
                  start_at: toIso(v.start_at),
                  due_at: toIso(v.due_at),
                  planned_hours: Number(v.planned_hours || 0),
                }),
              () => setOpen(false),
            );
          }}
        >
          {canChooseScope && (
            <Choice
              label="Tipo de tarefa"
              value={v.scope}
              onChange={(x) => set({ scope: x, parent_id: null, depends_on: [] })}
              options={[
                { value: "obra", label: "Obra / embarcação" },
                { value: "empresa", label: "Gestão da empresa" },
              ]}
            />
          )}
          {company ? (
            <Choice label="Área da empresa" required value={v.area} placeholder="— Escolher área —" onChange={(x) => set({ area: x })} options={COMPANY_AREAS.map((a) => ({ value: a, label: COMPANY_AREA_LABELS[a] }))} />
          ) : (
            orders &&
            !orderId &&
            !task && <Choice label="Obra" required value={v.work_order_id} placeholder="— Escolher obra —" onChange={(x) => set({ work_order_id: x, parent_id: null, depends_on: [] })} options={orders.map((o) => ({ value: o.id, label: o.label }))} />
          )}
          <Input label="Designação" required value={v.title} onChange={(x) => set({ title: x })} placeholder={company ? "Ex.: Renovar o seguro das instalações" : "Ex.: Soldadura das chapas do costado"} />
          <Area label="Descrição" value={v.description} onChange={(x) => set({ description: x })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Choice label="Responsável" value={v.responsible_id ?? ""} placeholder="— Sem responsável —" onChange={(x) => set({ responsible_id: x || null })} options={people.map((p) => ({ value: p.id, label: p.name }))} />
            <Choice label="Prioridade" value={v.priority} onChange={(x) => set({ priority: x })} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
            <Input label="Tempo previsto (h)" type="number" min="0" step="0.5" value={v.planned_hours} onChange={(x) => set({ planned_hours: x })} />
            <Input label="Início" type="datetime-local" value={v.start_at} onChange={(x) => set({ start_at: x })} />
            <Input label="Prazo" type="datetime-local" value={v.due_at} onChange={(x) => set({ due_at: x })} />
            {task && <Choice label="Estado" value={v.status} onChange={(x) => set({ status: x })} options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))} />}
          </div>
          <PeoplePicker label={company ? "Pessoas atribuídas" : "Técnicos atribuídos"} people={people} value={v.assignees} onChange={(ids) => set({ assignees: ids })} />
          {others.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Choice label="Subtarefa de" value={v.parent_id ?? ""} placeholder="— Tarefa principal —" onChange={(x) => set({ parent_id: x || null })} options={others.filter((o) => !o.id.startsWith("_")).map((o) => ({ value: o.id, label: `${o.code} · ${o.title}` }))} />
              <PeoplePicker label="Depende de (tem de terminar antes)" people={others.map((o) => ({ id: o.id, name: `${o.code} · ${o.title}` }))} value={v.depends_on} onChange={(ids) => set({ depends_on: ids })} />
            </div>
          )}
          <p className="text-xs text-slate-500">Horas em hora de Angola. O responsável e as pessoas atribuídas recebem aviso por WhatsApp (se tiverem dado consentimento).</p>
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={pending}>
              Guardar tarefa
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------ Acções rápidas ------------------------------ */

export function TaskQuickActions({ task, compact }: { task: TaskView; compact?: boolean }) {
  const { role, userId } = useOps();
  const mine = task.responsible_id === userId || task.assignees.includes(userId);
  const allowed = can.manage(role) || mine;
  const [progressOpen, setProgressOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [progress, setProgress] = useState(task.progress);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [note, setNote] = useState("");
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(todayLuanda());
  const { pending, error, run } = useOpsAction();
  if (!allowed) return null;
  const techStatuses: TaskStatus[] = can.manage(role) ? [...TASK_STATUSES] : ["por_iniciar", "em_curso", "suspensa", "concluida"];

  return (
    <div className={cx("flex flex-wrap gap-1.5", compact && "justify-end")}>
      {task.status === "por_iniciar" && (
        <Button size="sm" loading={pending} onClick={() => run(() => updateTaskProgress({ task_id: task.id, status: "em_curso", progress: Math.max(task.progress, 5) }))}>
          Iniciar
        </Button>
      )}
      {["por_iniciar", "em_curso", "suspensa"].includes(task.status) && (
        <Button size="sm" onClick={() => setProgressOpen(true)}>
          Progresso
        </Button>
      )}
      {mine && !["cancelada", "validada"].includes(task.status) && (
        <Button size="sm" onClick={() => setTimeOpen(true)}>
          <Clock className="size-3.5" /> Horas
        </Button>
      )}
      {can.manage(role) && task.status === "concluida" && (
        <Button size="sm" variant="primary" loading={pending} onClick={() => run(() => validateTask(task.id))}>
          <ShieldCheck className="size-3.5" /> Validar
        </Button>
      )}
      {error && <p className="w-full text-xs text-red-600">{error.message}</p>}

      <Modal open={progressOpen} onClose={() => setProgressOpen(false)} title={`${task.code} · ${task.title}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateTaskProgress({ task_id: task.id, status, progress, note }), () => setProgressOpen(false));
          }}
        >
          <Choice label="Estado" value={status} onChange={(x) => setStatus(x)} options={techStatuses.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`p-${task.id}`}>
              Percentagem concluída: {status === "concluida" ? 100 : progress}%
            </label>
            <input
              id={`p-${task.id}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={status === "concluida" ? 100 : progress}
              disabled={status === "concluida"}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-black"
            />
          </div>
          <Area label="Nota (opcional)" value={note} onChange={setNote} placeholder="O que foi feito, o que falta…" />
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setProgressOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={pending}>
              Actualizar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={timeOpen} onClose={() => setTimeOpen(false)} title={`Registar horas · ${task.code}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => logTime({ task_id: task.id, work_date: date, hours: Number(hours), note }), () => {
              setTimeOpen(false);
              setHours("");
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" value={date} onChange={setDate} required />
            <Input label="Horas" type="number" inputMode="decimal" min="0.25" max="24" step="0.25" value={hours} onChange={setHours} required />
          </div>
          <Area label="Nota" value={note} onChange={setNote} />
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setTimeOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={pending}>
              Registar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function DeleteTaskButton({ id, code }: { id: string; code: string }) {
  const { role } = useOps();
  const { pending, error, run } = useOpsAction();
  const [confirm, setConfirm] = useState(false);
  if (!can.plan(role)) return null;
  return (
    <>
      <Button size="sm" variant="ghost" aria-label={`Eliminar ${code}`} onClick={() => setConfirm(true)}>
        <Trash2 className="size-3.5" />
      </Button>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Eliminar a tarefa ${code}?`}>
        <p className="text-sm text-slate-600">As subtarefas, horas registadas e atribuições desta tarefa também são eliminadas. A operação fica registada na auditoria.</p>
        <FormError error={error} />
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Cancelar</Button>
          <Button variant="danger" loading={pending} onClick={() => run(() => deleteTask(id), () => setConfirm(false))}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------ Vistas ------------------------------ */

function TaskMeta({ t }: { t: TaskView }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      {t.work_order_id ? <span>{t.orderNumber}</span> : <Badge tone="slate">Empresa · {t.areaLabel}</Badge>}
      {t.vessel && <span>{t.vessel}</span>}
      {t.responsible && <span>{t.responsible}</span>}
      {t.due_at && <span className={t.late ? "font-semibold text-red-600" : ""}>Prazo {fmtDateTime(t.due_at)}</span>}
      <span>
        {t.used_hours.toLocaleString("pt-PT")}h / {Number(t.planned_hours).toLocaleString("pt-PT")}h
      </span>
    </div>
  );
}

export function TaskList({ tasks, people, siblings, showOrder = true }: { tasks: TaskView[]; people: { id: string; name: string }[]; siblings: Sibling[]; showOrder?: boolean }) {
  const { role, href } = useOps();
  if (!tasks.length) return <EmptyState title="Sem tarefas">Ainda não existem tarefas nesta vista.</EmptyState>;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {tasks.map((t) => {
        const blockers = t.depends_on.map((d) => byId.get(d)).filter((d) => d && !["concluida", "validada", "cancelada"].includes(d.status));
        return (
          <li key={t.id} className={cx("p-4", t.parent_id && "pl-8 sm:pl-12")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{t.code}</span>
                  <p className="font-medium">{t.title}</p>
                  <Badge tone={STATUS_TONE[t.status]}>{TASK_STATUS_LABELS[t.status]}</Badge>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABELS[t.priority]}</Badge>
                  {t.late && (
                    <Badge tone="red">
                      <AlertTriangle className="size-3" /> Atrasada
                    </Badge>
                  )}
                  {t.status === "validada" && <CheckCircle2 className="size-4 text-emerald-600" aria-label="Validada" />}
                </div>
                {showOrder ? (
                  <Link href={href(taskHref(t))} className="block hover:underline">
                    <TaskMeta t={t} />
                  </Link>
                ) : (
                  <TaskMeta t={t} />
                )}
                {blockers.length > 0 && <p className="mt-1 text-xs text-amber-700">A aguardar: {blockers.map((b) => b!.code).join(", ")}</p>}
                <ProgressBar value={t.progress} tone={t.late ? "red" : t.progress === 100 ? "green" : "dark"} className="mt-2 max-w-sm" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <TaskQuickActions task={t} />
                {can.manage(role) && <TaskFormButton task={t} people={people} siblings={siblings} variant="ghost" />}
                <DeleteTaskButton id={t.id} code={t.code} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const KANBAN: TaskStatus[] = ["por_iniciar", "em_curso", "suspensa", "concluida", "validada"];

export function KanbanBoard({ tasks }: { tasks: TaskView[] }) {
  const { role, userId, href } = useOps();
  const { error, run } = useOpsAction();
  const [dragging, setDragging] = useState<string | null>(null);
  const columns = useMemo(() => KANBAN.map((s) => ({ status: s, items: tasks.filter((t) => t.status === s) })), [tasks]);
  const canMove = (t: TaskView) => can.manage(role) || t.responsible_id === userId || t.assignees.includes(userId);
  const move = (id: string, status: TaskStatus) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    if (status === "validada") {
      run(() => validateTask(id));
      return;
    }
    run(() => updateTaskProgress({ task_id: id, status }));
  };
  return (
    <div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
      <div className="flex snap-x gap-3 overflow-x-auto pb-3">
        {columns.map((col) => (
          <section
            key={col.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dragging && move(dragging, col.status)}
            className="w-72 shrink-0 snap-start rounded-xl bg-slate-200/60 p-2"
            aria-label={TASK_STATUS_LABELS[col.status]}
          >
            <h2 className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
              {TASK_STATUS_LABELS[col.status]} <span className="text-xs font-normal text-slate-500">{col.items.length}</span>
            </h2>
            <ul className="space-y-2">
              {col.items.map((t) => (
                <li
                  key={t.id}
                  draggable={canMove(t)}
                  onDragStart={() => setDragging(t.id)}
                  onDragEnd={() => setDragging(null)}
                  className={cx("rounded-lg border bg-white p-3 shadow-sm", t.late ? "border-red-300" : "border-slate-200", canMove(t) && "cursor-grab")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link href={href(taskHref(t))} className="text-sm font-medium hover:underline">
                      {t.title}
                    </Link>
                    <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABELS[t.priority]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.work_order_id ? t.orderNumber : t.areaLabel} · {t.code}
                    {t.responsible ? ` · ${t.responsible}` : ""}
                  </p>
                  {t.due_at && <p className={cx("mt-1 text-xs", t.late ? "font-semibold text-red-600" : "text-slate-500")}>Prazo {fmtDate(t.due_at)}</p>}
                  <ProgressBar value={t.progress} tone={t.late ? "red" : "dark"} className="mt-2" />
                  {canMove(t) && (
                    <select
                      aria-label="Mover para"
                      value={t.status}
                      onChange={(e) => move(t.id, e.target.value as TaskStatus)}
                      className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs lg:hidden"
                    >
                      {KANBAN.filter((s) => s !== "validada" || can.manage(role)).map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Calendário mensal: tarefas pelo prazo (ou início) e obras pelo prazo. */
export function MonthCalendar({ month, events }: { month: string; events: { date: string; label: string; href: string; tone: "late" | "task" | "order" | "done" }[] }) {
  const { href } = useOps();
  const first = new Date(`${month}-01T12:00:00Z`);
  const startOffset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((startOffset + days) / 7) * 7 }, (_, i) => {
    const d = i - startOffset + 1;
    return d >= 1 && d <= days ? `${month}-${String(d).padStart(2, "0")}` : null;
  });
  const today = todayLuanda();
  const byDay = new Map<string, typeof events>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const toneCls = { late: "bg-red-100 text-red-800", task: "bg-sky-100 text-sky-900", order: "bg-black text-white", done: "bg-emerald-100 text-emerald-800" };
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => (
          <div key={i} className={cx("min-h-24 border-b border-r border-slate-100 p-1.5 text-xs", !date && "bg-slate-50/60")}>
            {date && (
              <>
                <p className={cx("mb-1 inline-flex size-6 items-center justify-center rounded-full font-medium", date === today && "bg-black text-white")}>{Number(date.slice(8))}</p>
                <ul className="space-y-1">
                  {(byDay.get(date) ?? []).slice(0, 4).map((e, j) => (
                    <li key={j}>
                      <Link href={href(e.href)} className={cx("block truncate rounded px-1.5 py-0.5", toneCls[e.tone])} title={e.label}>
                        {e.label}
                      </Link>
                    </li>
                  ))}
                  {(byDay.get(date)?.length ?? 0) > 4 && <li className="px-1.5 text-slate-500">+{byDay.get(date)!.length - 4}</li>}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cronograma (Gantt) com barras entre início e prazo; dependências indicadas no rótulo. */
export function GanttChart({ tasks, now }: { tasks: TaskView[]; now: number }) {
  const { href } = useOps();
  const dated = tasks.filter((t) => t.start_at || t.due_at);
  if (!dated.length) return <EmptyState title="Sem datas">Defina início e prazo nas tarefas para ver o cronograma.</EmptyState>;
  const times = dated.flatMap((t) => [t.start_at, t.due_at].filter(Boolean).map((d) => new Date(d!).getTime()));
  const day = 86400000;
  const min = Math.floor(Math.min(...times, now) / day) * day - day;
  const max = Math.ceil(Math.max(...times, now) / day) * day + day;
  const span = Math.max(day, max - min);
  const pct = (t: number) => ((t - min) / span) * 100;
  const totalDays = Math.round(span / day);
  const ticks = Array.from({ length: totalDays + 1 }, (_, i) => min + i * day).filter((_, i) => i % Math.max(1, Math.ceil(totalDays / 14)) === 0);
  const codes = new Map(tasks.map((t) => [t.id, t.code]));
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="min-w-[760px]">
        <div className="relative ml-56 h-8 border-b border-slate-200 text-[11px] text-slate-500">
          {ticks.map((t) => (
            <span key={t} className="absolute top-2 -translate-x-1/2" style={{ left: `${pct(t)}%` }}>
              {fmtDate(new Date(t)).slice(0, 5)}
            </span>
          ))}
        </div>
        <ul>
          {dated.map((t) => {
            const s = new Date(t.start_at ?? t.due_at!).getTime();
            const e = new Date(t.due_at ?? t.start_at!).getTime();
            const left = pct(Math.min(s, e));
            const width = Math.max(1.2, pct(Math.max(s, e)) - left);
            return (
              <li key={t.id} className="flex items-center border-b border-slate-100 text-xs">
                <Link href={href(taskHref(t))} className="w-56 shrink-0 truncate px-3 py-2 hover:underline" title={t.title}>
                  <span className="font-mono text-slate-400">{t.orderNumber} {t.code}</span> {t.title}
                </Link>
                <div className="relative h-9 flex-1">
                  <div className="absolute inset-y-0 w-px bg-red-400" style={{ left: `${pct(now)}%` }} aria-hidden />
                  <div
                    className={cx("absolute top-2 h-5 overflow-hidden rounded", t.late ? "bg-red-200" : t.status === "validada" || t.status === "concluida" ? "bg-emerald-200" : "bg-slate-300")}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${fmtDateTime(t.start_at)} → ${fmtDateTime(t.due_at)}${t.depends_on.length ? ` · depende de ${t.depends_on.map((d) => codes.get(d)).join(", ")}` : ""}`}
                  >
                    <div className={cx("h-full", t.late ? "bg-red-500" : "bg-black")} style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="px-3 py-2 text-[11px] text-slate-500">Barra cinzenta = duração prevista; preenchimento = progresso; linha vermelha = hoje; vermelho = atrasada.</p>
      </div>
    </div>
  );
}
