import type { Metadata } from "next";
import Link from "next/link";
import { requireOpsPage } from "@/lib/ops/auth";
import { getHoursMap, getMembers, getOrders, getTasks } from "@/lib/ops/queries";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { OPEN_ORDER_STATUSES } from "@/lib/ops/labels";
import { can } from "@/lib/ops/roles";
import { nestTasks, toTaskView } from "@/lib/ops/views";
import { nowMs } from "@/lib/ops/time";
import { cx } from "@/lib/cx";
import { GanttChart, KanbanBoard, TaskFormButton, TaskList } from "@/components/ops/tasks";

export const metadata: Metadata = { title: "Tarefas" };
export const instant = false;

export default async function TarefasPage({ searchParams }: PageProps<"/gestao/tarefas">) {
  const user = await requireOpsPage();
  const sp = (await searchParams) as { vista?: string; minhas?: string; estado?: string; tecnico?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  // Os técnicos vêem sempre só as suas tarefas (RLS); para os restantes, «minhas» é um filtro.
  const mine = sp.minhas === "1" || user.role === "tecnico";
  const open = sp.estado !== "todas";
  const [rows, members, orders] = await Promise.all([
    getTasks({ userId: mine ? user.id : sp.tecnico || undefined, openOnly: open && sp.vista !== "kanban" }),
    getMembers(),
    can.manage(user.role) ? getOrders({ status: OPEN_ORDER_STATUSES }) : Promise.resolve([]),
  ]);
  const hours = await getHoursMap(rows.map((t) => t.id));
  const tasks = nestTasks(rows.map((t) => toTaskView(t, hours)));
  const sorted = [...tasks].sort((a, b) => Number(b.late) - Number(a.late) || (a.due_at ?? "9").localeCompare(b.due_at ?? "9"));
  const people = members.filter((m) => m.active).map((m) => ({ id: m.user_id, name: m.full_name, hint: m.job_title ?? undefined }));
  const siblings = tasks.map((t) => ({ id: t.id, code: t.code, title: t.title, work_order_id: t.work_order_id }));
  const vista = sp.vista ?? "lista";
  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return h(`/tarefas${p.size ? `?${p}` : ""}`);
  };
  const late = tasks.filter((t) => t.late).length;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{mine ? "As minhas tarefas" : "Tarefas"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tasks.length} tarefa(s){late ? <span className="font-semibold text-red-600"> · {late} atrasada(s)</span> : null}
          </p>
        </div>
        {can.manage(user.role) && <TaskFormButton orders={orders.map((o) => ({ id: o.id, label: `${o.number} · ${o.title}` }))} people={people} siblings={siblings} />}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          ["lista", "Lista"],
          ["kanban", "Kanban"],
          ["gantt", "Cronograma"],
        ].map(([k, l]) => (
          <Link key={k} href={q({ vista: k })} className={cx("rounded-full px-3 py-1.5 text-sm", vista === k ? "bg-black text-white" : "bg-white ring-1 ring-slate-200")}>
            {l}
          </Link>
        ))}
        <Link href={h("/calendario")} className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200">
          Calendário
        </Link>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden />
        {user.role !== "tecnico" && (
          <Link href={q({ minhas: mine ? undefined : "1", tecnico: undefined })} className={cx("rounded-full px-3 py-1.5 text-sm", mine ? "bg-black text-white" : "bg-white ring-1 ring-slate-200")}>
            Só as minhas
          </Link>
        )}
        <Link href={q({ estado: open ? "todas" : undefined })} className={cx("rounded-full px-3 py-1.5 text-sm", !open ? "bg-black text-white" : "bg-white ring-1 ring-slate-200")}>
          Incluir concluídas
        </Link>
        {can.manage(user.role) && !mine && (
          <form action={h("/tarefas")} className="ml-auto">
            {sp.vista && <input type="hidden" name="vista" value={sp.vista} />}
            <select name="tecnico" defaultValue={sp.tecnico ?? ""} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Filtrar por técnico">
              <option value="">Todos os técnicos</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
              Filtrar
            </button>
          </form>
        )}
      </div>
      {vista === "kanban" ? <KanbanBoard tasks={tasks} /> : vista === "gantt" ? <GanttChart tasks={tasks} now={nowMs()} /> : <TaskList tasks={sorted} people={people} siblings={siblings} />}
    </>
  );
}
