import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Ship } from "lucide-react";
import { getPortalOverview, requirePortalPage } from "@/lib/ops/portal";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { INTERVENTION_LABELS, VESSEL_TYPE_LABELS, type InterventionType, type VesselType } from "@/lib/ops/labels";
import { fmtDate } from "@/lib/ops/time";
import { ClientOrderStatus, Progress } from "@/components/ops/portal";

export const metadata: Metadata = { title: "As minhas embarcações" };
export const instant = false;

const DONE = ["concluida", "entregue"];

export default async function PortalHome() {
  const [user, data, base] = await Promise.all([requirePortalPage(), getPortalOverview(), getOpsBase()]);
  const h = (p: string) => joinBase(base, p);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Olá, {user.fullName.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-slate-600">Acompanhe aqui os trabalhos nas embarcações de {user.client.name}.</p>

      {data.vessels.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Ainda não há embarcações associadas à sua conta.
        </div>
      )}

      <div className="mt-6 space-y-6">
        {data.vessels.map((v) => {
          const orders = data.orders.filter((o) => o.vessel_id === v.id);
          const current = orders.filter((o) => !DONE.includes(o.status));
          const past = orders.filter((o) => DONE.includes(o.status));
          return (
            <section key={v.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-black text-white">
                    <Ship className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="font-semibold">{v.name}</h2>
                    <p className="text-xs text-slate-500">
                      {VESSEL_TYPE_LABELS[v.vessel_type as VesselType] ?? v.vessel_type}
                      {v.registration ? ` · Matrícula ${v.registration}` : ""}
                      {[v.manufacturer, v.model].filter(Boolean).length ? ` · ${[v.manufacturer, v.model].filter(Boolean).join(" ")}` : ""}
                    </p>
                  </div>
                </div>
                <Link href={h(`/cliente/embarcacoes/${v.id}`)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                  <Camera className="size-4" aria-hidden /> Fotografias e histórico
                </Link>
              </div>
              {orders.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">Sem obras registadas para esta embarcação.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {[...current, ...past].map((o) => (
                    <li key={o.id}>
                      <Link href={h(`/cliente/obras/${o.id}`)} className="grid gap-3 p-4 hover:bg-slate-50 sm:grid-cols-[1fr_14rem] sm:items-center sm:p-5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-slate-500">{o.number}</span>
                            <ClientOrderStatus status={o.status} />
                          </div>
                          <p className="mt-1 font-medium">{o.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {INTERVENTION_LABELS[o.intervention_type as InterventionType] ?? o.intervention_type}
                            {o.start_date ? ` · início ${fmtDate(o.start_date)}` : ""}
                            {o.closed_at ? ` · concluída ${fmtDate(o.closed_at)}` : o.due_date ? ` · previsão ${fmtDate(o.due_date)}` : ""}
                            {o.photos ? ` · ${o.photos} fotografia(s)` : ""}
                          </p>
                        </div>
                        <div>
                          <Progress value={DONE.includes(o.status) ? 100 : o.progress} label={`${o.tasks_done} de ${o.tasks_total} trabalhos concluídos`} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
