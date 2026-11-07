import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { getPublishedState } from "@/lib/cms/draft";
import { getDelivery } from "@/lib/deliveries/queries";
import { DELIVERY_STATUS_LABELS, formatDeliveryDate, formatQuantity } from "@/lib/deliveries/rules";
import { PrintButton } from "@/components/admin/print-button";

export const metadata: Metadata = { title: "Guia de saída de material" };
export const instant = false;

export default function DeliveryNotePage({ params }: PageProps<"/admin/guia/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-sm text-slate-500">A preparar a guia…</p>}>
      <DeliveryNote params={params} />
    </Suspense>
  );
}

async function DeliveryNote({ params }: { params: PageProps<"/admin/guia/[id]">["params"] }) {
  await requireStaffPage();
  const { id } = await params;
  const [d, published] = await Promise.all([getDelivery(id), getPublishedState()]);
  if (!d) notFound();
  const contact = published?.doc.contact;
  const companyLine = [contact?.address, contact?.phone, contact?.email].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-[210mm] px-4 py-8 print:p-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { body { background: #fff !important; } }`}</style>
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href="/admin/saidas" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Saídas de material
        </Link>
        <PrintButton />
      </div>

      <article className="relative rounded-xl bg-white p-8 text-[13px] leading-relaxed text-slate-900 shadow-sm ring-1 ring-slate-200 print:rounded-none print:p-0 print:shadow-none print:ring-0">
        {d.status === "anulada" && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-black uppercase tracking-widest text-red-600/15 -rotate-12">
            Anulada
          </p>
        )}
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
          <div className="flex items-center gap-4">
            <img src="/brand/ponto-radical-mark.svg" alt="" className="size-14" />
            <div>
              <img src="/brand/ponto-radical-wordmark.png" alt="Ponto Radical" className="h-6 w-auto" />
              {companyLine && <p className="mt-1.5 max-w-xs text-[11px] text-slate-500">{companyLine}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Guia de saída de material</p>
            <p className="mt-1 font-mono text-2xl font-bold">{d.number}</p>
            <p className="mt-1 text-slate-600">{formatDeliveryDate(d.delivery_date)}</p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-300 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Fornecedor (entrega)</p>
            <p className="mt-1 font-semibold">Ponto Radical</p>
          </div>
          <div className="rounded-lg border border-slate-300 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Destinatário (recebe)</p>
            <p className="mt-1 font-semibold">{d.recipient}</p>
            {d.reference && <p className="text-slate-600">Referência: {d.reference}</p>}
          </div>
        </section>

        <p className="mt-6">
          Declara-se que a <strong>Ponto Radical</strong> fornece à <strong>{d.recipient}</strong> os materiais abaixo indicados, nas quantidades
          referidas, que foram entregues e conferidos na data desta guia.
        </p>

        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-slate-900 text-[11px] uppercase tracking-wide">
              <th className="w-10 py-2 pr-2 font-semibold">Nº</th>
              <th className="py-2 pr-2 font-semibold">Material</th>
              <th className="w-32 py-2 pr-2 font-semibold">Referência</th>
              <th className="w-28 py-2 pr-2 text-right font-semibold">Quantidade</th>
              <th className="w-20 py-2 font-semibold">Unidade</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((it, i) => (
              <tr key={it.id ?? i} className="border-b border-slate-200 align-top">
                <td className="py-2 pr-2 text-slate-500">{i + 1}</td>
                <td className="py-2 pr-2">
                  {it.description}
                  {it.notes && <span className="block text-[11px] text-slate-500">{it.notes}</span>}
                </td>
                <td className="py-2 pr-2 text-slate-600">{it.reference ?? "—"}</td>
                <td className="py-2 pr-2 text-right font-semibold tabular-nums">{formatQuantity(it.quantity)}</td>
                <td className="py-2">{it.unit}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="pt-2 text-[11px] text-slate-500">
                {d.items.length} linha(s) de material.
              </td>
            </tr>
          </tfoot>
        </table>

        {d.notes && (
          <section className="mt-5 rounded-lg bg-slate-50 p-3 print:border print:border-slate-300 print:bg-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Observações</p>
            <p className="mt-1 whitespace-pre-line">{d.notes}</p>
          </section>
        )}

        <section className="mt-12 grid grid-cols-2 gap-10 break-inside-avoid">
          {[
            { title: "Entreguei — Ponto Radical", name: d.delivered_by },
            { title: `Recebi — ${d.recipient}`, name: d.received_by },
          ].map((s) => (
            <div key={s.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{s.title}</p>
              <div className="mt-14 border-b border-slate-900" />
              <p className="mt-1 text-[11px] text-slate-500">Assinatura</p>
              <p className="mt-4">
                Nome: <span className="inline-block min-w-48 border-b border-dotted border-slate-400">{s.name ?? ""}</span>
              </p>
              <p className="mt-3">
                Data: <span className="inline-block min-w-36 border-b border-dotted border-slate-400">&nbsp;</span>
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-10 flex justify-between border-t border-slate-200 pt-3 text-[10px] text-slate-400">
          <span>
            {d.number} · Estado no sistema: {DELIVERY_STATUS_LABELS[d.status]}
            {d.status === "anulada" && d.cancelled_reason ? ` (${d.cancelled_reason})` : ""}
          </span>
          <span>Documento interno de controlo de saídas · Ponto Radical</span>
        </footer>
      </article>
    </div>
  );
}
