import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseView, QuoteView } from "@/components/ops/finance";
import type { AttachmentView, IncidentView, ReminderView, ReportView } from "@/components/ops/field";
import { listAttachments } from "./attachments";

function groupAttachments(all: Awaited<ReturnType<typeof listAttachments>>) {
  const map = new Map<string, AttachmentView[]>();
  for (const a of all) map.set(a.entity_id, [...(map.get(a.entity_id) ?? []), a]);
  return map;
}

export async function loadReports(filter: { orderId?: string; userId?: string; from?: string; to?: string; status?: string } = {}): Promise<ReportView[]> {
  const supabase = await createClient();
  let q = supabase
    .from("ops_daily_reports")
    .select("*, order:ops_work_orders(number), author:ops_members!ops_daily_reports_user_id_fkey(full_name)")
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (filter.orderId) q = q.eq("work_order_id", filter.orderId);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.from) q = q.gte("report_date", filter.from);
  if (filter.to) q = q.lte("report_date", filter.to);
  if (filter.status) q = q.eq("status", filter.status);
  const { data } = await q;
  const rows = data ?? [];
  const att = groupAttachments(rows.length ? await listAttachments({ entity_type: "report", work_order_id: filter.orderId }) : []);
  return rows.map((r) => ({
    ...r,
    hours: Number(r.hours),
    orderNumber: (r.order as { number: string } | null)?.number ?? "",
    author: (r.author as { full_name: string } | null)?.full_name ?? "—",
    attachments: att.get(r.id) ?? [],
  })) as ReportView[];
}

export async function loadIncidents(filter: { orderId?: string; open?: boolean } = {}): Promise<IncidentView[]> {
  const supabase = await createClient();
  let q = supabase
    .from("ops_incidents")
    .select(
      "*, order:ops_work_orders(number), task:ops_tasks!ops_incidents_task_id_fkey(code, title), reporter:ops_members!ops_incidents_reporter_id_fkey(full_name), owner:ops_members!ops_incidents_owner_id_fkey(full_name)",
    )
    .order("occurred_at", { ascending: false })
    .limit(300);
  if (filter.orderId) q = q.eq("work_order_id", filter.orderId);
  if (filter.open) q = q.in("status", ["aberta", "em_analise"]);
  const { data } = await q;
  const rows = data ?? [];
  const att = groupAttachments(rows.length ? await listAttachments({ entity_type: "incident", work_order_id: filter.orderId }) : []);
  const urgencyRank = { critico: 0, alto: 1, medio: 2, baixo: 3 } as Record<string, number>;
  return rows
    .map((r) => ({
      ...r,
      orderNumber: (r.order as { number: string } | null)?.number ?? "",
      taskLabel: r.task ? `${(r.task as { code: string }).code} · ${(r.task as { title: string }).title}` : null,
      reporter: (r.reporter as { full_name: string } | null)?.full_name ?? "—",
      owner: (r.owner as { full_name: string } | null)?.full_name ?? null,
      attachments: att.get(r.id) ?? [],
    }))
    .sort((a, b) => {
      const openA = ["aberta", "em_analise"].includes(a.status) ? 0 : 1;
      const openB = ["aberta", "em_analise"].includes(b.status) ? 0 : 1;
      return openA - openB || urgencyRank[a.urgency] - urgencyRank[b.urgency];
    }) as IncidentView[];
}

export async function loadExpenses(filter: { orderId?: string; approval?: string; scope?: "obras" | "gerais" } = {}): Promise<ExpenseView[]> {
  const supabase = await createClient();
  let q = supabase
    .from("ops_expenses")
    .select(
      "*, order:ops_work_orders(number), task:ops_tasks(code, title), supplier:ops_suppliers(name), responsible:ops_members!ops_expenses_responsible_id_fkey(full_name)",
    )
    .order("expense_date", { ascending: false })
    .limit(500);
  if (filter.orderId) q = q.eq("work_order_id", filter.orderId);
  if (filter.approval) q = q.eq("approval", filter.approval);
  if (filter.scope === "obras") q = q.not("work_order_id", "is", null);
  if (filter.scope === "gerais") q = q.is("work_order_id", null);
  const { data } = await q;
  return (data ?? []).map((e) => ({
    ...e,
    quantity: Number(e.quantity),
    unit_price: Number(e.unit_price),
    total: Number(e.total),
    vat_rate: Number(e.vat_rate),
    orderNumber: (e.order as { number: string } | null)?.number,
    taskLabel: e.task ? `${(e.task as { code: string }).code} · ${(e.task as { title: string }).title}` : null,
    supplier: (e.supplier as { name: string } | null)?.name ?? null,
    responsible: (e.responsible as { full_name: string } | null)?.full_name ?? null,
  })) as ExpenseView[];
}

export async function loadQuotes(orderId: string): Promise<QuoteView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ops_quotes")
    .select("id, version, status, vat_rate, notes, valid_until, decision_note, decided_at, items:ops_quote_items(id, description, category, quantity, unit_cost, unit_price, sort_order)")
    .eq("work_order_id", orderId)
    .order("version", { ascending: false });
  return (data ?? []).map((q) => ({
    ...q,
    vat_rate: Number(q.vat_rate),
    items: (q.items as QuoteView["items"]).map((i) => ({ ...i, quantity: Number(i.quantity), unit_cost: Number(i.unit_cost), unit_price: Number(i.unit_price) })),
  })) as QuoteView[];
}

export async function loadReminders(filter: { orderId?: string } = {}): Promise<ReminderView[]> {
  const supabase = await createClient();
  let q = supabase.from("ops_reminders").select("*, task:ops_tasks(code, title), order:ops_work_orders(number)").order("send_at", { ascending: false }).limit(200);
  if (filter.orderId) q = q.eq("work_order_id", filter.orderId);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    ...r,
    taskLabel: r.task ? `${(r.task as { code: string }).code} · ${(r.task as { title: string }).title}` : null,
    orderNumber: (r.order as { number: string } | null)?.number ?? null,
  })) as ReminderView[];
}
