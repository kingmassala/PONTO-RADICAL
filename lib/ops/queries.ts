import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { computeFinance, type FinanceSummary } from "./finance";
import type { CompanyArea, OrderStatus, Priority, TaskStatus } from "./labels";
import type { OpsRole } from "./roles";

export type Member = { user_id: string; full_name: string; role: OpsRole; job_title: string | null; active: boolean };
export type Option = { id: string; name: string; hint?: string };

export const getMembers = cache(async (): Promise<Member[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("ops_members").select("user_id, full_name, role, job_title, active").order("full_name");
  return (data ?? []) as Member[];
});

export async function memberOptions(onlyActive = true): Promise<Option[]> {
  const members = await getMembers();
  return members.filter((m) => !onlyActive || m.active).map((m) => ({ id: m.user_id, name: m.full_name, hint: m.job_title ?? undefined }));
}

export const getClients = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("ops_clients").select("id, code, name, legal_name, nif, phone, email, archived").order("name");
  return data ?? [];
});

export const getVessels = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ops_vessels")
    .select("id, code, name, vessel_type, registration, manufacturer, model, client_id, archived, client:ops_clients(name)")
    .order("name");
  return (data ?? []) as unknown as {
    id: string;
    code: string;
    name: string;
    vessel_type: string;
    registration: string | null;
    manufacturer: string | null;
    model: string | null;
    client_id: string;
    archived: boolean;
    client: { name: string } | null;
  }[];
});

export type OrderRow = {
  id: string;
  number: string;
  title: string;
  intervention_type: string;
  status: OrderStatus;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  location: string | null;
  manager_id: string | null;
  client_id: string;
  vessel_id: string;
  created_at: string;
  closed_at: string | null;
  client: { name: string } | null;
  vessel: { name: string; code: string } | null;
  manager: { full_name: string } | null;
};

export const ORDER_SELECT =
  "id, number, title, intervention_type, status, priority, start_date, due_date, location, manager_id, client_id, vessel_id, created_at, closed_at, client:ops_clients(name), vessel:ops_vessels(name, code), manager:ops_members!ops_work_orders_manager_id_fkey(full_name)";

export async function getOrders(filter: { status?: string[]; vesselId?: string; clientId?: string } = {}): Promise<OrderRow[]> {
  const supabase = await createClient();
  let q = supabase.from("ops_work_orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(500);
  if (filter.status?.length) q = q.in("status", filter.status);
  if (filter.vesselId) q = q.eq("vessel_id", filter.vesselId);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  const { data } = await q;
  return (data ?? []) as unknown as OrderRow[];
}

export async function getProgressMap(orderIds?: string[]) {
  const supabase = await createClient();
  let q = supabase.from("ops_work_order_progress").select("work_order_id, progress, tasks_total, tasks_done, tasks_late");
  if (orderIds) q = q.in("work_order_id", orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;
  return new Map((data ?? []).map((p) => [p.work_order_id as string, p as { progress: number; tasks_total: number; tasks_done: number; tasks_late: number }]));
}

export type TaskRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  work_order_id: string | null;
  area: CompanyArea | null;
  created_by: string | null;
  parent_id: string | null;
  responsible_id: string | null;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  start_at: string | null;
  due_at: string | null;
  planned_hours: number;
  notes: string | null;
  sort_order: number;
  validated_at: string | null;
  order: { number: string; title: string; vessel: { name: string; code: string } | null } | null;
  responsible: { full_name: string } | null;
  assignees: { user_id: string }[];
  dependencies: { depends_on: string }[];
};

export const TASK_SELECT =
  "id, code, title, description, work_order_id, area, created_by, parent_id, responsible_id, priority, status, progress, start_at, due_at, planned_hours, notes, sort_order, validated_at, order:ops_work_orders(number, title, vessel:ops_vessels(name, code)), responsible:ops_members!ops_tasks_responsible_id_fkey(full_name), assignees:ops_task_assignees(user_id), dependencies:ops_task_dependencies!ops_task_dependencies_task_id_fkey(depends_on)";

export async function getTasks(filter: { orderId?: string; scope?: "obra" | "empresa"; userId?: string; openOnly?: boolean; from?: string; to?: string } = {}): Promise<TaskRow[]> {
  const supabase = await createClient();
  let q = supabase.from("ops_tasks").select(TASK_SELECT).order("sort_order").order("created_at").limit(1000);
  if (filter.orderId) q = q.eq("work_order_id", filter.orderId);
  if (filter.scope === "obra") q = q.not("work_order_id", "is", null);
  if (filter.scope === "empresa") q = q.is("work_order_id", null);
  if (filter.openOnly) q = q.in("status", ["por_iniciar", "em_curso", "suspensa"]);
  if (filter.from) q = q.gte("due_at", filter.from);
  if (filter.to) q = q.lte("start_at", filter.to);
  const { data } = await q;
  let rows = (data ?? []) as unknown as TaskRow[];
  if (filter.userId) rows = rows.filter((t) => t.responsible_id === filter.userId || t.assignees.some((a) => a.user_id === filter.userId));
  return rows;
}

export async function getHoursMap(taskIds: string[]) {
  const supabase = await createClient();
  if (!taskIds.length) return new Map<string, number>();
  const { data } = await supabase.from("ops_task_hours").select("task_id, used_hours").in("task_id", taskIds);
  return new Map((data ?? []).map((h) => [h.task_id as string, Number(h.used_hours)]));
}

export function isLate(t: { status: string; due_at: string | null }, now = new Date()) {
  return Boolean(t.due_at && new Date(t.due_at) < now && !["concluida", "validada", "cancelada"].includes(t.status));
}

/** Resumo financeiro de uma ou mais obras (só para perfis com acesso financeiro; a RLS devolve vazio aos restantes). */
export async function getFinance(orderIds: string[]): Promise<Map<string, FinanceSummary>> {
  const result = new Map<string, FinanceSummary>();
  if (!orderIds.length) return result;
  const supabase = await createClient();
  const [fin, exp, time, rates, mats, settingsRow] = await Promise.all([
    supabase.from("ops_work_order_finance").select("work_order_id, budget_initial, budget_revised, contract_price, vat_rate").in("work_order_id", orderIds),
    supabase.from("ops_expenses").select("work_order_id, task_id, total, stage, approval, category").in("work_order_id", orderIds),
    supabase.from("ops_time_entries").select("user_id, task_id, hours, task:ops_tasks!inner(work_order_id)").in("task.work_order_id", orderIds),
    supabase.from("ops_member_rates").select("user_id, hourly_cost"),
    supabase.from("ops_material_consumptions").select("work_order_id, task_id, total").in("work_order_id", orderIds),
    supabase.from("ops_settings").select("default_vat_rate").eq("id", 1).single(),
  ]);
  const rateMap = new Map((rates.data ?? []).map((r) => [r.user_id as string, Number(r.hourly_cost)]));
  const finMap = new Map((fin.data ?? []).map((f) => [f.work_order_id as string, f]));
  for (const id of orderIds) {
    const f = finMap.get(id);
    result.set(
      id,
      computeFinance({
        contractPrice: f?.contract_price === null || f?.contract_price === undefined ? null : Number(f.contract_price),
        vatRate: f ? Number(f.vat_rate) : Number(settingsRow.data?.default_vat_rate ?? 14),
        budgetInitial: f?.budget_initial === null || f?.budget_initial === undefined ? null : Number(f.budget_initial),
        budgetRevised: f?.budget_revised === null || f?.budget_revised === undefined ? null : Number(f.budget_revised),
        expenses: (exp.data ?? []).filter((e) => e.work_order_id === id).map((e) => ({ ...e, total: Number(e.total) })) as never,
        labour: (time.data ?? [])
          .filter((t) => (t.task as unknown as { work_order_id: string }).work_order_id === id)
          .map((t) => ({ user_id: t.user_id, task_id: t.task_id, hours: Number(t.hours), hourly_cost: rateMap.has(t.user_id) ? rateMap.get(t.user_id)! : null })),
        materials: (mats.data ?? []).filter((m) => m.work_order_id === id).map((m) => ({ total: Number(m.total), task_id: m.task_id })),
      }),
    );
  }
  return result;
}

export async function getSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("ops_settings").select("*").eq("id", 1).single();
  return data as {
    company_name: string;
    default_vat_rate: number;
    daily_reminder_enabled: boolean;
    daily_reminder_time: string;
    weekly_summary_enabled: boolean;
    weekly_summary_dow: number;
    weekly_summary_time: string;
    task_start_lead_minutes: number;
    due_soon_hours: number;
    whatsapp_enabled: boolean;
    max_messages_per_run: number;
  } | null;
}
