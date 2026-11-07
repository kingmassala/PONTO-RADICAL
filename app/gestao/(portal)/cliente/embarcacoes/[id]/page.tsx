import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalOverview, getPortalVesselPhotos, requirePortalPage } from "@/lib/ops/portal";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { VESSEL_TYPE_LABELS, type VesselType } from "@/lib/ops/labels";
import { fmtDate } from "@/lib/ops/time";
import { BackLink, ClientGallery, ClientOrderStatus } from "@/components/ops/portal";

export const metadata: Metadata = { title: "Embarcação" };
export const instant = false;

export default async function PortalVesselPage({ params }: PageProps<"/gestao/cliente/embarcacoes/[id]">) {
  const { id } = await params;
  await requirePortalPage();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [photos, overview, base] = await Promise.all([getPortalVesselPhotos(id), getPortalOverview(), getOpsBase()]);
  const vessel = overview.vessels.find((v) => v.id === id);
  if (!photos || !vessel) notFound();
  const orders = overview.orders.filter((o) => o.vessel_id === id);
  const h = (p: string) => joinBase(base, p);
  const facts = [
    ["Tipo", VESSEL_TYPE_LABELS[vessel.vessel_type as VesselType] ?? vessel.vessel_type],
    ["Matrícula", vessel.registration],
    ["Fabricante / modelo", [vessel.manufacturer, vessel.model].filter(Boolean).join(" ") || null],
    ["Comprimento", vessel.length_m ? `${Number(vessel.length_m).toLocaleString("pt-PT")} m` : null],
  ].filter(([, v]) => v);
  return (
    <>
      <BackLink href={h("/cliente")}>As minhas embarcações</BackLink>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{vessel.name}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="mb-2 font-semibold">Histórico de obras</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">Sem obras registadas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={h(`/cliente/obras/${o.id}`)} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:underline">
                  <span className="text-sm">
                    <span className="font-mono text-xs text-slate-500">{o.number}</span> {o.title}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {fmtDate(o.closed_at ?? o.start_date)}
                    <ClientOrderStatus status={o.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="mb-3 font-semibold">Fotografias</h2>
        <ClientGallery photos={photos} />
      </section>
    </>
  );
}
