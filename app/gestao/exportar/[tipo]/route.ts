import { NextResponse, type NextRequest } from "next/server";
import { getOpsUser } from "@/lib/ops/auth";
import { can } from "@/lib/ops/roles";
import { toCsv } from "@/lib/ops/csv";
import { loadExpenses, loadReports } from "@/lib/ops/loaders";
import { getOrders, getProgressMap, getTasks, isLate } from "@/lib/ops/queries";
import { APPROVAL_LABELS, EXPENSE_CATEGORY_LABELS, EXPENSE_STAGE_LABELS, ORDER_STATUS_LABELS, PRIORITY_LABELS, REPORT_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/ops/labels";
import { addDaysIso, fmtDate, fmtDateTime, todayLuanda } from "@/lib/ops/time";

/** Exportações para Excel. Os dados respeitam as permissões do utilizador (RLS). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const user = await getOpsUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });
  const { tipo } = await params;
  const sp = request.nextUrl.searchParams;
  let csv: string;
  let name: string;

  if (tipo === "relatorios") {
    const from = sp.get("de") ?? addDaysIso(todayLuanda(), -30);
    const to = sp.get("ate") ?? todayLuanda();
    const rows = await loadReports({ from, to, userId: sp.get("tecnico") || undefined, orderId: sp.get("obra") || undefined, status: sp.get("estado") || undefined });
    csv = toCsv(
      ["Data", "Obra", "Técnico", "Local", "Horas", "Actividades", "Concluídas", "Pendentes", "Materiais", "Dificuldades", "Observações", "Estado", "Nota da supervisão"],
      rows.map((r) => [fmtDate(r.report_date), r.orderNumber, r.author, r.location, r.hours, r.activities, r.tasks_done, r.tasks_pending, r.materials_used, r.difficulties, r.notes, REPORT_STATUS_LABELS[r.status], r.review_note]),
    );
    name = `relatorios-${from}-a-${to}`;
  } else if (tipo === "despesas") {
    if (!can.finance(user.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    const scope = sp.get("ambito");
    const rows = await loadExpenses({ orderId: sp.get("obra") || undefined, scope: scope === "gerais" || scope === "obras" ? scope : undefined });
    csv = toCsv(
      ["Data", "Obra", "Tarefa", "Categoria", "Descrição", "Quantidade", "Preço unitário (AOA)", "Total sem IVA (AOA)", "IVA %", "Total com IVA (AOA)", "Situação", "Aprovação", "Fornecedor", "Responsável"],
      rows.map((e) => [
        fmtDate(e.expense_date),
        e.work_order_id ? e.orderNumber : "Geral da empresa",
        e.taskLabel,
        EXPENSE_CATEGORY_LABELS[e.category],
        e.description,
        e.quantity,
        e.unit_price,
        e.total,
        e.vat_rate,
        Math.round((e.total + (e.total * e.vat_rate) / 100) * 100) / 100,
        EXPENSE_STAGE_LABELS[e.stage],
        APPROVAL_LABELS[e.approval],
        e.supplier,
        e.responsible,
      ]),
    );
    name = "despesas";
  } else if (tipo === "obras") {
    const orders = await getOrders();
    const progress = await getProgressMap(orders.map((o) => o.id));
    csv = toCsv(
      ["OS", "Título", "Cliente", "Embarcação", "Estado", "Prioridade", "Início", "Prazo", "Progresso %", "Tarefas", "Atrasadas", "Responsável"],
      orders.map((o) => {
        const p = progress.get(o.id);
        return [o.number, o.title, o.client?.name, o.vessel ? `${o.vessel.code} ${o.vessel.name}` : "", ORDER_STATUS_LABELS[o.status], PRIORITY_LABELS[o.priority], fmtDate(o.start_date), fmtDate(o.due_date), p?.progress ?? 0, p?.tasks_total ?? 0, p?.tasks_late ?? 0, o.manager?.full_name];
      }),
    );
    name = "obras";
  } else if (tipo === "tarefas") {
    const tasks = await getTasks({ orderId: sp.get("obra") || undefined });
    csv = toCsv(
      ["Obra", "Código", "Tarefa", "Responsável", "Estado", "Prioridade", "Progresso %", "Início", "Prazo", "Horas previstas", "Atrasada"],
      tasks.map((t) => [t.order?.number, t.code, t.title, t.responsible?.full_name, TASK_STATUS_LABELS[t.status], PRIORITY_LABELS[t.priority], t.progress, fmtDateTime(t.start_at), fmtDateTime(t.due_at), Number(t.planned_hours), isLate(t) ? "Sim" : "Não"]),
    );
    name = "tarefas";
  } else {
    return NextResponse.json({ error: "Exportação desconhecida" }, { status: 404 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ponto-radical-${name}-${todayLuanda()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
