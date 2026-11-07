import type { TaskView } from "@/components/ops/tasks";
import { COMPANY_AREA_LABELS } from "./labels";
import { isLate, type TaskRow } from "./queries";

export function toTaskView(t: TaskRow, hours: Map<string, number>): TaskView {
  return {
    id: t.id,
    code: t.code,
    title: t.title,
    description: t.description,
    work_order_id: t.work_order_id,
    area: t.area,
    areaLabel: t.area ? COMPANY_AREA_LABELS[t.area] : null,
    orderNumber: t.order?.number ?? "",
    vessel: t.order?.vessel ? `${t.order.vessel.code} · ${t.order.vessel.name}` : "",
    parent_id: t.parent_id,
    responsible_id: t.responsible_id,
    responsible: t.responsible?.full_name ?? null,
    assignees: t.assignees.map((a) => a.user_id),
    depends_on: t.dependencies.map((d) => d.depends_on),
    priority: t.priority,
    status: t.status,
    progress: t.progress,
    start_at: t.start_at,
    due_at: t.due_at,
    planned_hours: Number(t.planned_hours),
    used_hours: hours.get(t.id) ?? 0,
    late: isLate(t),
    notes: t.notes,
  };
}

/** Ordena para que cada subtarefa apareça logo a seguir à tarefa principal. */
export function nestTasks<T extends { id: string; parent_id: string | null }>(tasks: T[]): T[] {
  const children = new Map<string, T[]>();
  for (const t of tasks) if (t.parent_id) children.set(t.parent_id, [...(children.get(t.parent_id) ?? []), t]);
  const ids = new Set(tasks.map((t) => t.id));
  const out: T[] = [];
  const visit = (t: T) => {
    out.push(t);
    for (const c of children.get(t.id) ?? []) visit(c);
  };
  for (const t of tasks) if (!t.parent_id || !ids.has(t.parent_id)) visit(t);
  return out;
}

export { taskHref } from "./task-href";
