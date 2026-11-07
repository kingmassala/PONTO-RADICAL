import type { Metadata } from "next";
import { requireOpsPage } from "@/lib/ops/auth";
import { loadReports } from "@/lib/ops/loaders";
import { REPORT_STATUS_LABELS } from "@/lib/ops/labels";
import { addDaysIso, fmtDate, fmtDateTime, todayLuanda } from "@/lib/ops/time";
import { PrintButton } from "@/components/ops/print-button";

export const metadata: Metadata = { title: "Relatórios (impressão)" };
export const instant = false;

/** Versão para impressão: «Imprimir → Guardar como PDF» gera o PDF no próprio dispositivo. */
export default async function ImprimirRelatoriosPage({ searchParams }: PageProps<"/gestao/relatorios/imprimir">) {
  const user = await requireOpsPage();
  const sp = (await searchParams) as { de?: string; ate?: string; tecnico?: string; obra?: string; estado?: string };
  const from = sp.de ?? addDaysIso(todayLuanda(), -30);
  const to = sp.ate ?? todayLuanda();
  const reports = await loadReports({ from, to, userId: sp.tecnico || undefined, orderId: sp.obra || undefined, status: sp.estado || undefined });
  return (
    <div className="bg-white p-6 text-sm text-black print:p-0">
      <style>{`@media print { nav, aside, header, .no-print { display: none !important } main { padding: 0 !important } body { background: white } }`}</style>
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <header className="mb-6 border-b border-black pb-3">
        <p className="text-xs uppercase tracking-[0.2em]">Ponto Radical · Gestão de Obras</p>
        <h1 className="text-xl font-semibold">Relatórios diários de obra</h1>
        <p>
          Período {fmtDate(from)} a {fmtDate(to)} · {reports.length} relatório(s) · {reports.reduce((s, r) => s + r.hours, 0).toLocaleString("pt-PT")} h · emitido por {user.fullName} em {fmtDateTime(new Date())}
        </p>
      </header>
      {reports.map((r) => (
        <section key={r.id} className="mb-5 break-inside-avoid border-b border-slate-300 pb-4">
          <p className="font-semibold">
            {fmtDate(r.report_date)} · {r.orderNumber} · {r.author} · {r.hours} h · {REPORT_STATUS_LABELS[r.status]}
          </p>
          {r.location && <p>Local: {r.location}</p>}
          <p className="mt-1 whitespace-pre-wrap">
            <strong>Actividades:</strong> {r.activities}
          </p>
          {r.tasks_done && <p className="whitespace-pre-wrap"><strong>Concluídas:</strong> {r.tasks_done}</p>}
          {r.tasks_pending && <p className="whitespace-pre-wrap"><strong>Pendentes:</strong> {r.tasks_pending}</p>}
          {r.materials_used && <p className="whitespace-pre-wrap"><strong>Materiais:</strong> {r.materials_used}</p>}
          {r.difficulties && <p className="whitespace-pre-wrap"><strong>Dificuldades:</strong> {r.difficulties}</p>}
          {r.notes && <p className="whitespace-pre-wrap"><strong>Observações:</strong> {r.notes}</p>}
          {r.review_note && <p className="whitespace-pre-wrap"><strong>Supervisão:</strong> {r.review_note}</p>}
          {r.attachments.length > 0 && <p className="text-xs text-slate-600">{r.attachments.length} fotografia(s)/documento(s) na plataforma.</p>}
        </section>
      ))}
      {reports.length === 0 && <p>Sem relatórios no período.</p>}
    </div>
  );
}
