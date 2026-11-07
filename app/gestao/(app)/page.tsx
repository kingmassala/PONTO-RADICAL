import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getFinance, getHoursMap, getMembers, getOrders, getProgressMap, getTasks, isLate } from "@/lib/ops/queries";
import { loadIncidents } from "@/lib/ops/loaders";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { ACTIVE_ORDER_STATUSES, OPEN_ORDER_STATUSES, URGENCY_LABELS } from "@/lib/ops/labels";
import { fmtAoa, fmtPct } from "@/lib/ops/money";
import { can } from "@/lib/ops/roles";
import { addDaysIso, fmtDate, fmtDateTime, todayLuanda } from "@/lib/ops/time";
import { nestTasks, toTaskView } from "@/lib/ops/views";
import { cx } from "@/lib/cx";
import { BarChart, LineChart } from "@/components/ops/charts";
import { Kpi } from "@/components/ops/finance";
import { OrderStatusBadge } from "@/components/ops/order-badges";
import { TaskList } from "@/components/ops/tasks";
import { IncidentFormButton, ReportFormButton } from "@/components/ops/field";
import { Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Dashboard" };
export const instant = false;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function DashboardPage({ searchParams }: PageProps<"/gestao">) {
  const user = await requireOpsPage();
  const sp = (await searchParams) as { erro?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const today = todayLuanda();
  const nowIso = new Date().toISOString();

  if (user.role === "tecnico") return <TechnicianHome userId={user.id} name={user.fullName} h={h} />;

  const supabase = await createClient();
  const finance = can.finance(user.role);
  const monthStart = `${today.slice(0, 7)}-01`;
  const sixMonthsAgo = `${addDaysIso(monthStart, -160).slice(0, 7)}-01`;
  const [orders, tasks, incidents, members, todayTime, expenses] = await Promise.all([
    getOrders(),
    getTasks(),
    loadIncidents({ open: true }),
    getMembers(),
    supabase.from("ops_time_entries").select("user_id").eq("work_date", today),
    finance ? supabase.from("ops_expenses").select("expense_date, total, approval, stage").gte("expense_date", sixMonthsAgo) : Promise.resolve({ data: [] as { expense_date: string; total: number; approval: string; stage: string }[] }),
  ]);
  const progress = await getProgressMap(orders.map((o) => o.id));
  const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  const lateOrders = orders.filter((o) => o.due_date && o.due_date < today && OPEN_ORDER_STATUSES.includes(o.status));
  const doneMonth = orders.filter((o) => ["concluida", "entregue"].includes(o.status) && (o.closed_at ?? "") >= monthStart);
  const openTasks = tasks.filter((t) => ["por_iniciar", "em_curso", "suspensa"].includes(t.status));
  const lateTasks = openTasks.filter((t) => isLate(t));
  const critical = incidents.filter((i) => i.urgency === "critico");
  const activeTechs = new Set([...(todayTime.data ?? []).map((t) => t.user_id), ...tasks.filter((t) => t.status === "em_curso").flatMap((t) => [t.responsible_id, ...t.assignees.map((a) => a.user_id)])].filter(Boolean));
  const upcoming = openTasks
    .filter((t) => t.due_at && t.due_at >= nowIso)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!))
    .slice(0, 8);
  const fin = finance ? await getFinance(active.map((o) => o.id)) : null;
  const totalCost = fin ? [...fin.values()].reduce((s, f) => s + f.costToDate, 0) : 0;
  const totalPrice = fin ? [...fin.values()].reduce((s, f) => s + (f.contractPrice ?? 0), 0) : 0;
  const totalProfit = fin ? [...fin.values()].reduce((s, f) => s + (f.grossProfit ?? 0), 0) : 0;
  // Evolução mensal das despesas (realizadas e comprometidas, não rejeitadas).
  const monthly: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(`${monthStart}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = d.toISOString().slice(0, 7);
    monthly.push({
      label: `${MONTHS[d.getUTCMonth()]}`,
      value: (expenses.data ?? []).filter((e) => e.expense_date.startsWith(key) && e.approval !== "rejeitada" && e.stage !== "prevista").reduce((s, e) => s + Number(e.total), 0),
    });
  }
  // Prioridades: obras urgentes/altas em aberto, atrasadas primeiro.
  const priorityOrders = orders
    .filter((o) => OPEN_ORDER_STATUSES.includes(o.status))
    .sort((a, b) => {
      const la = a.due_date && a.due_date < today ? 0 : 1;
      const lb = b.due_date && b.due_date < today ? 0 : 1;
      const rank = { urgente: 0, alta: 1, media: 2, baixa: 3 } as const;
      return la - lb || rank[a.priority] - rank[b.priority] || (a.due_date ?? "9").localeCompare(b.due_date ?? "9");
    })
    .slice(0, 8);

  return (
    <>
      {sp.erro === "sem-permissao" && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Essa área não está disponível para o seu perfil.</p>}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {user.fullName.split(" ")[0]}.</h1>
          <p className="mt-1 text-sm text-slate-500">Situação a {fmtDateTime(new Date())} (hora de Angola).</p>
        </div>
        {can.plan(user.role) && (
          <Link href={h("/obras/nova")} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
            Nova obra
          </Link>
        )}
      </div>

      {(critical.length > 0 || lateTasks.length > 0 || lateOrders.length > 0) && (
        <section aria-label="Alertas" className="mb-6 space-y-2">
          {critical.map((i) => (
            <Link key={i.id} href={h("/ocorrencias")} className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 hover:border-red-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>Ocorrência {URGENCY_LABELS[i.urgency].toLowerCase()}</strong> · {i.orderNumber} · {i.description.slice(0, 140)}
              </span>
            </Link>
          ))}
          {lateTasks.length > 0 && (
            <Link href={h("/tarefas")} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Clock className="size-4 shrink-0" aria-hidden /> {lateTasks.length} tarefa(s) com o prazo ultrapassado.
            </Link>
          )}
          {lateOrders.length > 0 && (
            <Link href={h("/obras")} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Clock className="size-4 shrink-0" aria-hidden /> {lateOrders.length} obra(s) fora do prazo: {lateOrders.map((o) => o.number).join(", ")}.
            </Link>
          )}
        </section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Obras activas" value={String(active.length)} sub={`${orders.filter((o) => OPEN_ORDER_STATUSES.includes(o.status)).length} em aberto no total`} />
        <Kpi label="Obras concluídas este mês" value={String(doneMonth.length)} />
        <Kpi label="Obras atrasadas" value={String(lateOrders.length)} tone={lateOrders.length ? "red" : "default"} />
        <Kpi label="Ocorrências críticas abertas" value={String(critical.length)} tone={critical.length ? "red" : "default"} />
        <Kpi label="Tarefas em execução" value={String(tasks.filter((t) => t.status === "em_curso").length)} />
        <Kpi label="Tarefas pendentes" value={String(tasks.filter((t) => t.status === "por_iniciar").length)} />
        <Kpi label="Tarefas atrasadas" value={String(lateTasks.length)} tone={lateTasks.length ? "red" : "default"} />
        <Kpi label="Técnicos em actividade hoje" value={String(activeTechs.size)} sub={`de ${members.filter((m) => m.active && m.role === "tecnico").length} técnicos`} />
      </div>

      {finance && fin && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Kpi label="Despesas acumuladas (obras activas)" value={fmtAoa(totalCost)} />
          <Kpi label="Preço contratual (obras activas)" value={fmtAoa(totalPrice)} />
          <Kpi label="Margem estimada" value={fmtPct(totalPrice ? totalProfit / totalPrice : null)} sub={`lucro bruto ${fmtAoa(totalProfit)}`} tone={totalProfit < 0 ? "red" : "default"} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Prioridades" className="lg:col-span-2" actions={<Link href={h("/obras")} className="text-xs underline">Todas as obras</Link>}>
          {priorityOrders.length === 0 ? (
            <p className="text-sm text-slate-500">Sem obras em aberto.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {priorityOrders.map((o) => {
                const p = progress.get(o.id);
                const late = o.due_date && o.due_date < today;
                return (
                  <li key={o.id} className="py-3">
                    <Link href={h(`/obras/${o.id}`)} className="flex flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="font-mono text-xs text-slate-500">{o.number}</span> <span className="font-medium">{o.title}</span>
                        <span className="block text-xs text-slate-500">
                          {o.vessel?.name} · {o.client?.name}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <OrderStatusBadge status={o.status} />
                        <span className="w-24">
                          <span className="block h-2 overflow-hidden rounded-full bg-slate-200">
                            <span className={cx("block h-full", p?.tasks_late ? "bg-red-600" : "bg-black")} style={{ width: `${p?.progress ?? 0}%` }} />
                          </span>
                          <span className="text-[11px] text-slate-500">{p?.progress ?? 0}%</span>
                        </span>
                        <span className={cx("w-20 text-right text-xs", late ? "font-semibold text-red-600" : "text-slate-500")}>{fmtDate(o.due_date)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Próximos prazos" actions={<Link href={h("/calendario")} className="text-xs underline">Calendário</Link>}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">Sem prazos próximos.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <Link href={h(`/obras/${t.work_order_id}?tab=tarefas`)} className="hover:underline">
                    {t.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {t.order?.number} · {t.responsible?.full_name ?? "sem responsável"} · {fmtDateTime(t.due_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {finance && (
          <>
            <Card title="Evolução das despesas (6 meses)" className="lg:col-span-2">
              <LineChart data={monthly} />
            </Card>
            <Card title="Custos por obra activa">
              <BarChart data={active.map((o) => ({ label: o.number, value: fin?.get(o.id)?.costToDate ?? 0 })).sort((a, b) => b.value - a.value)} format="aoa" />
            </Card>
          </>
        )}
        {!finance && (
          <Card title="Tarefas por estado" className="lg:col-span-3">
            <BarChart
              data={[
                { label: "Por iniciar", value: tasks.filter((t) => t.status === "por_iniciar").length },
                { label: "Em curso", value: tasks.filter((t) => t.status === "em_curso").length },
                { label: "Suspensas", value: tasks.filter((t) => t.status === "suspensa").length },
                { label: "Concluídas (a validar)", value: tasks.filter((t) => t.status === "concluida").length },
              ]}
            />
          </Card>
        )}
      </div>
    </>
  );
}

/** Página inicial do técnico: o essencial do dia, pensado para o telemóvel. */
async function TechnicianHome({ userId, name, h }: { userId: string; name: string; h: (p: string) => string }) {
  const [rows, members, orders] = await Promise.all([getTasks({ userId, openOnly: true }), getMembers(), getOrders()]);
  const hours = await getHoursMap(rows.map((t) => t.id));
  const tasks = nestTasks(rows.map((t) => toTaskView(t, hours))).sort((a, b) => Number(b.late) - Number(a.late) || (a.due_at ?? "9").localeCompare(b.due_at ?? "9"));
  const orderOptions = orders.map((o) => ({ id: o.id, label: `${o.number} · ${o.title}` }));
  const late = tasks.filter((t) => t.late).length;
  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {name.split(" ")[0]}.</h1>
        <p className="mt-1 text-sm text-slate-500">
          {tasks.length} tarefa(s) em aberto{late ? <span className="font-semibold text-red-600"> · {late} atrasada(s)</span> : null}
        </p>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2">
        <ReportFormButton orders={orderOptions} />
        <IncidentFormButton orders={orderOptions} tasks={tasks.map((t) => ({ id: t.id, label: `${t.code} · ${t.title}`, work_order_id: t.work_order_id }))} />
      </div>
      <TaskList tasks={tasks} people={members.map((m) => ({ id: m.user_id, name: m.full_name }))} siblings={[]} />
      <Link href={h("/tarefas?estado=todas")} className="mt-4 inline-flex items-center gap-1 text-sm underline">
        Ver também as concluídas <ArrowRight className="size-3.5" />
      </Link>
    </>
  );
}
