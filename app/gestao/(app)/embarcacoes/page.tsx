import type { Metadata } from "next";
import Link from "next/link";
import { requireOpsPage } from "@/lib/ops/auth";
import { getClients, getOrders, getVessels } from "@/lib/ops/queries";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { VESSEL_TYPE_LABELS, type VesselType } from "@/lib/ops/labels";
import { can } from "@/lib/ops/roles";
import { VesselFormButton } from "@/components/ops/registry-forms";
import { EmptyState } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Embarcações" };
export const instant = false;

export default async function EmbarcacoesPage({ searchParams }: PageProps<"/gestao/embarcacoes">) {
  const user = await requireOpsPage(["admin", "direcao", "gestor", "supervisor", "financeiro"]);
  const sp = (await searchParams) as { q?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const [vessels, clients, orders] = await Promise.all([getVessels(), getClients(), getOrders()]);
  const q = (sp.q ?? "").toLowerCase().trim();
  const list = vessels.filter((v) => !v.archived && (!q || [v.name, v.code, v.registration, v.client?.name, v.manufacturer, v.model].some((x) => x?.toLowerCase().includes(q))));
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Embarcações</h1>
          <p className="mt-1 text-sm text-slate-500">{list.length} embarcação(ões)</p>
        </div>
        <div className="flex gap-2">
          <form action={h("/embarcacoes")}>
            <input name="q" defaultValue={sp.q} placeholder="Nome, matrícula, proprietário…" className="w-60 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          </form>
          {can.plan(user.role) && <VesselFormButton clients={clients.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name }))} />}
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState title="Sem embarcações" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => {
            const count = orders.filter((o) => o.vessel_id === v.id).length;
            const active = orders.filter((o) => o.vessel_id === v.id && ["aprovada", "planeada", "em_execucao", "suspensa"].includes(o.status)).length;
            return (
              <Link key={v.id} href={h(`/embarcacoes/${v.id}`)} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-black">
                <p className="font-mono text-xs text-slate-500">{v.code}</p>
                <p className="mt-0.5 text-lg font-semibold">{v.name}</p>
                <p className="text-sm text-slate-500">
                  {VESSEL_TYPE_LABELS[v.vessel_type as VesselType]}
                  {v.registration ? ` · ${v.registration}` : ""}
                </p>
                <p className="mt-2 text-sm">{v.client?.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {count} intervenção(ões){active ? ` · ${active} em curso` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
