import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { getPublishedState } from "@/lib/cms/draft";
import { listDeliveries } from "@/lib/deliveries/queries";
import {
  controlDetailDeliveries,
  controlSummaryRows,
  filterDeliveries,
  formatDeliveryDate,
  formatQuantity,
  STATUS_TEXT,
  type ControlFilter,
} from "@/lib/deliveries/rules";
import { PrintButton } from "@/components/admin/print-button";
import { AutoPrint } from "@/components/admin/auto-print";

export const metadata: Metadata = { title: "Controlo de saídas de material" };
export const instant = false;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function MaterialReportPage({ searchParams }: PageProps<"/admin/relatorio-material">) {
  return (
    <Suspense fallback={<p className="p-10 text-sm text-slate-500">A preparar o relatório…</p>}>
      <MaterialReport searchParams={searchParams} />
    </Suspense>
  );
}

async function MaterialReport({ searchParams }: { searchParams: PageProps<"/admin/relatorio-material">["searchParams"] }) {
  const user = await requireStaffPage();
  const q = (await searchParams) as Record<string, string | undefined>;
  const tipo = q.tipo === "detalhe" ? "detalhe" : "resumo";
  const filter: ControlFilter = {
    from: DATE.test(q.de ?? "") ? q.de! : "",
    to: DATE.test(q.ate ?? "") ? q.ate! : "",
    client: (q.cliente ?? "todos").slice(0, 120) || "todos",
  };
  const [{ deliveries, error }, published] = await Promise.all([listDeliveries(5000), getPublishedState()]);
  const contact = published?.doc.contact;
  const companyLine = [contact?.address, contact?.phone, contact?.email].filter(Boolean).join(" · ");
  const inPeriod = filterDeliveries(deliveries, filter);
  const valid = inPeriod.filter((d) => d.status !== "anulada");
  const summary = controlSummaryRows(deliveries, filter);
  const detail = controlDetailDeliveries(deliveries, filter);
  const clients = new Set(valid.map((d) => d.recipient.trim().toLowerCase())).size;
  const period =
    filter.from || filter.to
      ? `${filter.from ? formatDeliveryDate(filter.from) : "início"} a ${filter.to ? formatDeliveryDate(filter.to) : "hoje"}`
      : "Todo o histórico";
  const generated = nowInLuanda();
  const title = tipo === "detalhe" ? "Detalhe das saídas de material" : "Controlo de saídas de material";

  return (
    <div className={`mx-auto px-4 py-8 print:max-w-none print:p-0 ${tipo === "detalhe" ? "max-w-[297mm]" : "max-w-[210mm]"}`}>
      {/* 8,5 pt em Inter ≈ «tamanho 10» num documento de Word (igual à guia de saída). */}
      <style>{`@page { size: A4 ${tipo === "detalhe" ? "landscape" : "portrait"}; margin: 12mm; } .pr-doc { font-size: 8.5pt; } @media print { body { background: #fff !important; } thead { display: table-header-group; } tr { break-inside: avoid; } }`}</style>
      <AutoPrint title={`${title} — Ponto Radical`} />
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href="/admin/saidas" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Saídas de material
        </Link>
        <PrintButton />
      </div>

      <article className="pr-doc rounded-xl bg-white p-8 leading-normal text-slate-900 shadow-sm ring-1 ring-slate-200 print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ponto-radical-mark.svg" alt="" className="size-11" />
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/ponto-radical-wordmark.png" alt="Ponto Radical" className="h-5 w-auto" />
              {companyLine && <p className="mt-1 max-w-sm text-[0.8em] text-slate-500">{companyLine}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[0.75em] font-semibold uppercase tracking-[0.18em] text-slate-500">Relatório</p>
            <p className="mt-1 text-[1.45em] font-bold leading-tight">{title}</p>
            <p className="mt-1 text-slate-600">{period}</p>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-4 gap-3">
          {[
            ["Cliente", filter.client === "todos" ? "Todos os clientes" : filter.client],
            ["Guias válidas", String(valid.length)],
            ["Materiais diferentes", String(summary.length)],
            ["Clientes", String(clients)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-300 p-2.5">
              <p className="text-[0.72em] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-0.5 truncate font-semibold">{value}</p>
            </div>
          ))}
        </section>

        {error && <p className="mt-6 text-red-700">{error}</p>}

        {tipo === "resumo" ? (
          <table className="mt-5 w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-slate-900 text-[0.8em] uppercase tracking-wide">
                <th className="py-1.5 pr-2 font-semibold">Material</th>
                <th className="w-24 py-1.5 pr-2 text-right font-semibold">Quantidade</th>
                <th className="w-14 py-1.5 pr-2 font-semibold">Unid.</th>
                <th className="w-12 py-1.5 pr-2 text-right font-semibold">Linhas</th>
                <th className="py-1.5 pr-2 font-semibold">Clientes</th>
                <th className="w-20 py-1.5 pr-2 font-semibold">1.ª saída</th>
                <th className="w-20 py-1.5 font-semibold">Última</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={`${r.description}|${r.unit}`} className="border-b border-slate-200 align-top">
                  <td className="py-1.5 pr-2">{r.description}</td>
                  <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{formatQuantity(r.quantity)}</td>
                  <td className="py-1.5 pr-2">{r.unit}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-slate-600">{r.lines}</td>
                  <td className="py-1.5 pr-2 text-slate-600">{r.clients.join(", ")}</td>
                  <td className="py-1.5 pr-2 tabular-nums text-slate-600">{shortDate(r.first)}</td>
                  <td className="py-1.5 tabular-nums text-slate-600">{shortDate(r.last)}</td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Sem materiais fornecidos neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="mt-5 w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-slate-900 text-[0.8em] uppercase tracking-wide">
                <th className="py-1.5 pr-2 font-semibold">Guia</th>
                <th className="py-1.5 pr-2 font-semibold">Data</th>
                <th className="w-20 py-1.5 pr-2 font-semibold">Estado</th>
                <th className="py-1.5 pr-2 font-semibold">Cliente</th>
                <th className="py-1.5 pr-2 font-semibold">Ref. / obra</th>
                <th className="py-1.5 pr-2 font-semibold">Material</th>
                <th className="py-1.5 pr-2 font-semibold">Ref. material</th>
                <th className="w-20 py-1.5 pr-2 text-right font-semibold">Qtd.</th>
                <th className="w-12 py-1.5 pr-2 font-semibold">Unid.</th>
                <th className="py-1.5 pr-2 font-semibold">Entregue por</th>
                <th className="py-1.5 font-semibold">Recebido por</th>
              </tr>
            </thead>
            <tbody>
              {detail.flatMap((d) =>
                d.items.map((it, i) => (
                  <tr key={`${d.id}-${i}`} className={`border-b border-slate-200 align-top ${d.status === "anulada" ? "line-through [&_td]:!text-slate-400" : ""}`}>
                    <td className="whitespace-nowrap py-1.5 pr-2 font-mono">{i === 0 ? d.number : ""}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums">{i === 0 ? shortDate(d.delivery_date) : ""}</td>
                    <td className="py-1.5 pr-2">{i === 0 ? STATUS_TEXT[d.status] : ""}</td>
                    <td className="py-1.5 pr-2">{i === 0 ? d.recipient : ""}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{i === 0 ? (d.reference ?? "") : ""}</td>
                    <td className="py-1.5 pr-2">{it.description}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{it.reference ?? ""}</td>
                    <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{formatQuantity(it.quantity)}</td>
                    <td className="py-1.5 pr-2">{it.unit}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{i === 0 ? d.delivered_by : ""}</td>
                    <td className="py-1.5 text-slate-600">{i === 0 ? (d.received_by ?? "") : ""}</td>
                  </tr>
                )),
              )}
              {detail.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-slate-500">
                    Sem guias neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <p className="mt-3 text-[0.8em] text-slate-500">
          {tipo === "resumo"
            ? "Totais das guias emitidas e assinadas (as guias anuladas não contam)."
            : "Inclui as guias anuladas (riscadas) para análise completa."}
        </p>

        <footer className="mt-8 flex justify-between border-t border-slate-200 pt-2.5 text-[0.72em] text-slate-400">
          <span>
            Gerado em {generated} por {user.fullName ?? user.email}
          </span>
          <span>Documento interno de controlo de saídas · Ponto Radical</span>
        </footer>
      </article>
    </div>
  );
}

function shortDate(iso: string) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
}

/** Data e hora actuais (chamado só durante o pedido, depois da verificação de sessão). */
function nowInLuanda() {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Luanda" }).format(Date.now());
}
