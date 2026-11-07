import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarDays, MapPin, Ship, User } from "lucide-react";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { ORDER_SELECT, getClients, getFinance, getHoursMap, getMembers, getSettings, getTasks, getVessels, type OrderRow } from "@/lib/ops/queries";
import { loadExpenses, loadIncidents, loadQuotes, loadReminders, loadReports } from "@/lib/ops/loaders";
import { listAttachments } from "@/lib/ops/attachments";
import { describeActivity, type ActivityRow } from "@/lib/ops/activity";
import { nestTasks, toTaskView } from "@/lib/ops/views";
import { nowMs } from "@/lib/ops/time";
import { INTERVENTION_LABELS, type InterventionType } from "@/lib/ops/labels";
import { can } from "@/lib/ops/roles";
import { fmtDate, fmtDateTime, todayLuanda } from "@/lib/ops/time";
import { whatsappConfig } from "@/lib/ops/whatsapp";
import { cx } from "@/lib/cx";
import { OrderStatusBadge, PriorityBadge } from "@/components/ops/order-badges";
import { OrderEditButton } from "@/components/ops/registry-forms";
import { GanttChart, KanbanBoard, TaskFormButton, TaskList } from "@/components/ops/tasks";
import { ConsumptionForm, ExpenseFormButton, ExpenseTable, FinanceSummaryCard, QuotesPanel } from "@/components/ops/finance";
import { Attachments, IncidentFormButton, IncidentList, OrderStatusControl, ReminderPanel, ReportFormButton, ReportList } from "@/components/ops/field";
import { Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Obra" };
export const instant = false;

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "tarefas", label: "Tarefas" },
  { key: "custos", label: "Custos e orçamento", finance: true },
  { key: "relatorios", label: "Relatórios" },
  { key: "ocorrencias", label: "Ocorrências" },
  { key: "documentos", label: "Fotografias e documentos" },
  { key: "historico", label: "Linha temporal" },
] as const;

export default async function ObraPage({ params, searchParams }: PageProps<"/gestao/obras/[id]">) {
  const user = await requireOpsPage();
  const [{ id }, sp, base] = await Promise.all([params, searchParams as Promise<{ tab?: string; vista?: string }>, getOpsBase()]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const h = (p: string) => joinBase(base, p);
  const supabase = await createClient();
  const { data: orderData } = await supabase.from("ops_work_orders").select(`${ORDER_SELECT}, description, team_id, team:ops_teams(name)`).eq("id", id).maybeSingle();
  if (!orderData) notFound();
  const order = orderData as unknown as OrderRow & { description: string | null; team_id: string | null; team: { name: string } | null };

  const finance = can.finance(user.role);
  const tab = TABS.find((t) => t.key === sp.tab && (!("finance" in t) || finance))?.key ?? "resumo";

  const [taskRows, members, settings, progressRes] = await Promise.all([
    getTasks({ orderId: id }),
    getMembers(),
    getSettings(),
    supabase.from("ops_work_order_progress").select("progress, tasks_total, tasks_done, tasks_late").eq("work_order_id", id).maybeSingle(),
  ]);
  const hours = await getHoursMap(taskRows.map((t) => t.id));
  const tasks = nestTasks(taskRows.map((t) => toTaskView(t, hours)));
  const people = members.filter((m) => m.active).map((m) => ({ id: m.user_id, name: m.full_name, hint: m.job_title ?? undefined }));
  const siblings = tasks.map((t) => ({ id: t.id, code: t.code, title: t.title, work_order_id: t.work_order_id }));
  const taskOptions = tasks.map((t) => ({ id: t.id, label: `${t.code} · ${t.title}`, work_order_id: t.work_order_id }));
  const orderOption = [{ id: order.id, label: `${order.number} · ${order.title}` }];
  const progress = progressRes.data ?? { progress: 0, tasks_total: 0, tasks_done: 0, tasks_late: 0 };
  const late = order.due_date && order.due_date < todayLuanda() && !["concluida", "entregue", "cancelada"].includes(order.status);
  const vatDefault = Number(settings?.default_vat_rate ?? 14);
  const financeSummary = finance && tab === "resumo" ? (await getFinance([id])).get(id) : undefined;

  return (
    <>
      <div className="mb-5">
        <Link href={h("/obras")} className="text-xs font-medium text-slate-500 hover:text-black">
          ← Obras
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-sm text-slate-500">{order.number}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{order.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <PriorityBadge priority={order.priority} />
              {late && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="size-3" /> Prazo ultrapassado
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusControl orderId={order.id} status={order.status} />
            {can.manage(user.role) && (
              <OrderEditButton
                clients={(await getClients()).map((c) => ({ id: c.id, name: c.name }))}
                vessels={await getVessels()}
                managers={people}
                teams={(await supabase.from("ops_teams").select("id, name")).data ?? []}
                initial={{
                  id: order.id,
                  client_id: order.client_id,
                  vessel_id: order.vessel_id,
                  intervention_type: order.intervention_type as InterventionType,
                  title: order.title,
                  description: order.description,
                  location: order.location,
                  manager_id: order.manager_id,
                  team_id: order.team_id,
                  start_date: order.start_date,
                  due_date: order.due_date,
                  priority: order.priority,
                }}
              />
            )}
          </div>
        </div>
      </div>

      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0" aria-label="Secções da obra">
        {TABS.filter((t) => !("finance" in t) || finance).map((t) => (
          <Link
            key={t.key}
            href={h(`/obras/${id}${t.key === "resumo" ? "" : `?tab=${t.key}`}`)}
            aria-current={tab === t.key ? "page" : undefined}
            className={cx("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm", tab === t.key ? "border-black font-medium text-black" : "border-transparent text-slate-500 hover:text-black")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "resumo" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="Execução">
              <div className="flex items-end justify-between">
                <p className="text-4xl font-semibold tabular-nums">{progress.progress}%</p>
                <p className="text-sm text-slate-500">
                  {progress.tasks_done}/{progress.tasks_total} tarefas concluídas{progress.tasks_late ? ` · ${progress.tasks_late} atrasada(s)` : ""}
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className={cx("h-full", progress.tasks_late ? "bg-red-600" : "bg-black")} style={{ width: `${progress.progress}%` }} />
              </div>
              <p className="text-xs text-slate-500">Progresso ponderado pelas horas previstas de cada tarefa principal.</p>
            </Card>
            {order.description && (
              <Card title="Descrição / diagnóstico">
                <p className="whitespace-pre-wrap text-sm text-slate-700">{order.description}</p>
              </Card>
            )}
            {financeSummary && <FinanceSummaryCard f={financeSummary} orderId={id} vatDefault={vatDefault} />}
            <ReminderPanel reminders={await loadReminders({ orderId: id })} people={people} tasks={taskOptions} orderId={id} whatsappActive={Boolean(settings?.whatsapp_enabled && whatsappConfig().canSend)} />
          </div>
          <div className="space-y-6">
            <Card title="Dados da obra">
              <dl className="space-y-3 text-sm">
                <Row icon={<User className="size-4" />} label="Cliente" value={order.client?.name} />
                <Row icon={<Ship className="size-4" />} label="Embarcação" value={order.vessel ? <Link className="underline" href={h(`/embarcacoes/${order.vessel_id}`)}>{`${order.vessel.code} · ${order.vessel.name}`}</Link> : "—"} />
                <Row label="Intervenção" value={INTERVENTION_LABELS[order.intervention_type as InterventionType] ?? order.intervention_type} />
                <Row icon={<MapPin className="size-4" />} label="Local" value={order.location} />
                <Row label="Responsável técnico" value={order.manager?.full_name} />
                <Row label="Equipa" value={order.team?.name} />
                <Row icon={<CalendarDays className="size-4" />} label="Início" value={fmtDate(order.start_date)} />
                <Row icon={<CalendarDays className="size-4" />} label="Prazo" value={fmtDate(order.due_date)} />
                <Row label="Criada em" value={fmtDateTime(order.created_at)} />
                {order.closed_at && <Row label="Fechada em" value={fmtDateTime(order.closed_at)} />}
              </dl>
            </Card>
            <Card title="Acções no terreno">
              <div className="flex flex-col gap-2">
                <ReportFormButton orders={orderOption} defaultOrderId={id} />
                <IncidentFormButton orders={orderOption} tasks={taskOptions} defaultOrderId={id} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "tarefas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav className="flex gap-1.5">
              {[
                ["lista", "Lista"],
                ["kanban", "Kanban"],
                ["gantt", "Cronograma"],
              ].map(([k, l]) => (
                <Link key={k} href={h(`/obras/${id}?tab=tarefas&vista=${k}`)} className={cx("rounded-full px-3 py-1.5 text-sm", (sp.vista ?? "lista") === k ? "bg-black text-white" : "bg-white ring-1 ring-slate-200")}>
                  {l}
                </Link>
              ))}
            </nav>
            {can.manage(user.role) && <TaskFormButton orderId={id} people={people} siblings={siblings} />}
          </div>
          {sp.vista === "kanban" ? <KanbanBoard tasks={tasks} /> : sp.vista === "gantt" ? <GanttChart tasks={tasks} now={nowMs()} /> : <TaskList tasks={tasks} people={people} siblings={siblings} showOrder={false} />}
          <Card title="Consumo de materiais" description="Registe os materiais usados; o custo vem do catálogo.">
            <ConsumptionForm orderId={id} tasks={taskOptions} materials={((await supabase.from("ops_materials").select("id, name, unit").eq("active", true).order("name")).data ?? [])} />
          </Card>
        </div>
      )}

      {tab === "custos" && finance && <CostsTab orderId={id} taskOptions={taskOptions} vatDefault={vatDefault} />}

      {tab === "relatorios" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ReportFormButton orders={orderOption} defaultOrderId={id} />
          </div>
          <ReportList reports={await loadReports({ orderId: id })} orders={orderOption} />
        </div>
      )}

      {tab === "ocorrencias" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <IncidentFormButton orders={orderOption} tasks={taskOptions} defaultOrderId={id} />
          </div>
          <IncidentList incidents={await loadIncidents({ orderId: id })} people={people} />
        </div>
      )}

      {tab === "documentos" && (
        <Card
          title="Fotografias e documentos da obra"
          description="Ficheiros privados. Associe cada fotografia a uma tarefa e use «Partilhar» para a mostrar no portal do cliente (nada é partilhado sem esse passo)."
        >
          <Attachments
            entityType="work_order"
            entityId={id}
            workOrderId={id}
            tasks={taskOptions.map((t) => ({ id: t.id, label: t.label }))}
            items={(await listAttachments({ entity_type: ["work_order", "task"], work_order_id: id })).map((a) => ({
              ...a,
              label: a.entity_type === "task" ? (taskOptions.find((t) => t.id === a.entity_id)?.label ?? "Tarefa") : null,
            }))}
          />
          <p className="text-xs text-slate-500">As fotografias dos relatórios aparecem (e partilham-se) no separador Relatórios; as das ocorrências nunca são mostradas ao cliente.</p>
        </Card>
      )}

      {tab === "historico" && <Timeline orderId={id} />}
    </>
  );
}

function Row({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex items-center gap-1.5 text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}

async function CostsTab({ orderId, taskOptions, vatDefault }: { orderId: string; taskOptions: { id: string; label: string; work_order_id: string | null }[]; vatDefault: number }) {
  const supabase = await createClient();
  const [summary, expenses, quotes, suppliers] = await Promise.all([
    getFinance([orderId]),
    loadExpenses({ orderId }),
    loadQuotes(orderId),
    supabase.from("ops_suppliers").select("id, name").order("name"),
  ]);
  const receipts = await listAttachments({ entity_type: "expense", work_order_id: orderId });
  const byExpense = new Map<string, typeof receipts>();
  for (const r of receipts) byExpense.set(r.entity_id, [...(byExpense.get(r.entity_id) ?? []), r]);
  return (
    <div className="space-y-6">
      <FinanceSummaryCard f={summary.get(orderId)!} orderId={orderId} vatDefault={vatDefault} />
      <Card title="Orçamentos">
        <QuotesPanel orderId={orderId} quotes={quotes} />
      </Card>
      <Card title="Despesas" actions={<ExpenseFormButton orderId={orderId} tasks={taskOptions} suppliers={suppliers.data ?? []} vatDefault={vatDefault} />}>
        <ExpenseTable
          expenses={expenses}
          tasks={taskOptions}
          suppliers={suppliers.data ?? []}
          vatDefault={vatDefault}
          receipts={Object.fromEntries(expenses.map((e) => [e.id, <Attachments key={e.id} entityType="expense" entityId={e.id} workOrderId={orderId} items={byExpense.get(e.id) ?? []} compact />]))}
        />
      </Card>
      <Card title="Custo por tarefa">
        <ul className="divide-y divide-slate-100 text-sm">
          {Object.entries(summary.get(orderId)!.byTask).map(([taskId, value]) => (
            <li key={taskId} className="flex justify-between py-2">
              <span>{taskOptions.find((t) => t.id === taskId)?.label ?? "Obra em geral"}</span>
              <span className="tabular-nums">{value.toLocaleString("pt-PT", { style: "currency", currency: "AOA" })}</span>
            </li>
          ))}
          {Object.keys(summary.get(orderId)!.byTask).length === 0 && <li className="py-2 text-slate-500">Ainda sem custos registados.</li>}
        </ul>
      </Card>
    </div>
  );
}

async function Timeline({ orderId }: { orderId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("ops_activity").select("id, created_at, actor_name, table_name, record_id, action, changes").eq("work_order_id", orderId).order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as ActivityRow[];
  return (
    <Card title="Linha temporal" description="Registo automático de todas as alterações relevantes (auditoria).">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Sem registos visíveis para o seu perfil.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {rows.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-black" aria-hidden />
              <p className="text-sm">{describeActivity(a)}</p>
              <p className="text-xs text-slate-500">
                {fmtDateTime(a.created_at)} · {a.actor_name ?? "Sistema"}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
