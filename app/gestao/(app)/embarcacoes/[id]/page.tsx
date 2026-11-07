import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getClients, getFinance, getOrders } from "@/lib/ops/queries";
import { listAttachments } from "@/lib/ops/attachments";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { INTERVENTION_LABELS, REGISTRATION_DOC_CAPTION, VESSEL_TYPE_LABELS, type InterventionType, type VesselType } from "@/lib/ops/labels";
import { fmtAoa } from "@/lib/ops/money";
import { can } from "@/lib/ops/roles";
import { fmtDate } from "@/lib/ops/time";
import { VesselFormButton } from "@/components/ops/registry-forms";
import { ArchiveButton } from "@/components/ops/archive-button";
import { OrderStatusBadge } from "@/components/ops/order-badges";
import { Attachments } from "@/components/ops/field";
import { Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Embarcação" };
export const instant = false;

export default async function EmbarcacaoPage({ params }: PageProps<"/gestao/embarcacoes/[id]">) {
  const user = await requireOpsPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: v } = await supabase.from("ops_vessels").select("*, client:ops_clients(id, name)").eq("id", id).maybeSingle();
  if (!v) notFound();
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const [orders, clients, files] = await Promise.all([getOrders({ vesselId: id }), getClients(), listAttachments({ entity_type: "vessel", entity_id: id })]);
  const finance = can.finance(user.role) ? await getFinance(orders.map((o) => o.id)) : null;
  const client = v.client as { id: string; name: string } | null;
  // Documento de registo mais recente (os anteriores ficam no histórico de ficheiros).
  const registrationDoc = files.find((f) => f.caption === REGISTRATION_DOC_CAPTION) ?? null;
  const fields: [string, string | null][] = [
    ["Tipo", VESSEL_TYPE_LABELS[v.vessel_type as VesselType]],
    ["Matrícula", v.registration],
    ["Fabricante", v.manufacturer],
    ["Modelo", v.model],
    ["Tipo de casco", v.hull_type],
    ["Comprimento", v.length_m ? `${Number(v.length_m).toLocaleString("pt-PT")} m` : null],
    ["Motorização", v.propulsion],
    ["Localização", v.location],
    ["Observações", v.notes],
  ];
  return (
    <>
      <Link href={h("/embarcacoes")} className="text-xs font-medium text-slate-500 hover:text-black">
        ← Embarcações
      </Link>
      <div className="mb-6 mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-sm text-slate-500">{v.code}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{v.name}</h1>
          {client && (
            <p className="text-sm text-slate-500">
              Proprietário:{" "}
              {can.manage(user.role) || user.role === "financeiro" ? (
                <Link href={h(`/clientes/${client.id}`)} className="underline">
                  {client.name}
                </Link>
              ) : (
                client.name
              )}
            </p>
          )}
        </div>
        {can.plan(user.role) && (
          <div className="flex gap-2">
            <VesselFormButton clients={clients.map((c) => ({ id: c.id, name: c.name }))} initial={{ ...v, length_m: v.length_m ?? "" }} label="Editar embarcação" registrationDoc={registrationDoc} />
            <ArchiveButton kind="vessel" id={id} archived={v.archived} />
          </div>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Ficha técnica">
            <dl className="space-y-2 text-sm">
              {fields.map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium">{val || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="Identificação">
            {registrationDoc?.url && registrationDoc.mime_type.startsWith("image/") && registrationDoc.mime_type !== "image/heic" && (
              <a href={registrationDoc.url} target="_blank" rel="noopener noreferrer" className="mb-3 block overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={registrationDoc.url} alt={`Identificação da embarcação ${v.name}`} className="max-h-56 w-full object-cover" />
              </a>
            )}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Matrícula</dt>
                <dd className="text-right font-medium">{v.registration || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Documento / fotografia</dt>
                <dd className="text-right">
                  {registrationDoc ? (
                    registrationDoc.url ? (
                      <a href={registrationDoc.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                        Abrir ({registrationDoc.mime_type === "application/pdf" ? "PDF" : "imagem"})
                      </a>
                    ) : (
                      "Carregado"
                    )
                  ) : (
                    <span className="text-amber-700">Por carregar</span>
                  )}
                </dd>
              </div>
              {registrationDoc && <p className="text-xs text-slate-500">Carregado a {fmtDate(registrationDoc.created_at)}.</p>}
            </dl>
            {!registrationDoc && can.plan(user.role) && (
              <p className="mt-2 text-xs text-slate-500">Use «Editar embarcação» para carregar o documento de registo da matrícula ou uma fotografia da embarcação.</p>
            )}
          </Card>
          <Card title="Fotografias e documentação">
            <Attachments entityType="vessel" entityId={id} workOrderId={null} items={files} canUpload={can.manage(user.role)} />
          </Card>
        </div>
        <Card title={`Histórico de intervenções (${orders.length})`} className="lg:col-span-2">
          {orders.length === 0 ? (
            <p className="text-sm text-slate-500">Sem obras registadas nesta embarcação.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {orders.map((o) => {
                const f = finance?.get(o.id);
                return (
                  <li key={o.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-black" aria-hidden />
                    <Link href={h(`/obras/${o.id}`)} className="font-medium hover:underline">
                      <span className="font-mono text-xs text-slate-500">{o.number}</span> {o.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <OrderStatusBadge status={o.status} />
                      <span>{INTERVENTION_LABELS[o.intervention_type as InterventionType] ?? o.intervention_type}</span>
                      <span>
                        {fmtDate(o.start_date)} → {fmtDate(o.closed_at ?? o.due_date)}
                      </span>
                      {f && <span>custo {fmtAoa(f.costToDate)}</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
