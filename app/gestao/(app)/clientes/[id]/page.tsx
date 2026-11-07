import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getClients, getOrders, getVessels } from "@/lib/ops/queries";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { VESSEL_TYPE_LABELS, type VesselType } from "@/lib/ops/labels";
import { can } from "@/lib/ops/roles";
import { fmtDate } from "@/lib/ops/time";
import { ClientFormButton, VesselFormButton } from "@/components/ops/registry-forms";
import { ArchiveButton } from "@/components/ops/archive-button";
import { OrderStatusBadge } from "@/components/ops/order-badges";
import { Card, EmptyState } from "@/components/admin/ui";
import { ClientAccessPanel, type ClientAccessView } from "@/components/ops/portal-admin";
import { requestOrigin } from "@/lib/ops/server-base";

export const metadata: Metadata = { title: "Cliente" };
export const instant = false;

export default async function ClientePage({ params }: PageProps<"/gestao/clientes/[id]">) {
  const user = await requireOpsPage(["admin", "direcao", "gestor", "supervisor", "financeiro"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: c } = await supabase.from("ops_clients").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const [vessels, orders, clients, accesses, origin] = await Promise.all([
    getVessels(),
    getOrders({ clientId: id }),
    getClients(),
    can.manage(user.role)
      ? supabase.from("ops_client_users").select("user_id, full_name, email, active, must_change_password, last_seen_at").eq("client_id", id).order("created_at")
      : Promise.resolve({ data: null }),
    requestOrigin(),
  ]);
  const own = vessels.filter((v) => v.client_id === id);
  return (
    <>
      <Link href={h("/clientes")} className="text-xs font-medium text-slate-500 hover:text-black">
        ← Clientes
      </Link>
      <div className="mb-6 mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-sm text-slate-500">{c.code}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          {c.legal_name && <p className="text-sm text-slate-500">{c.legal_name}</p>}
        </div>
        {can.plan(user.role) && (
          <div className="flex flex-wrap gap-2">
            <ClientFormButton initial={c} label="Editar cliente" />
            <VesselFormButton clients={clients.map((x) => ({ id: x.id, name: x.name }))} defaultClientId={id} />
            <ArchiveButton kind="client" id={id} archived={c.archived} />
          </div>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Dados">
          <dl className="space-y-2 text-sm">
            {[
              ["NIF", c.nif],
              ["Telefone", c.phone],
              ["Email", c.email],
              ["Morada", c.address],
              ["Responsável", c.contact_person],
              ["Observações", c.notes],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="whitespace-pre-wrap">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Embarcações (${own.length})`}>
            {own.length === 0 ? (
              <p className="text-sm text-slate-500">Sem embarcações registadas.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {own.map((v) => (
                  <li key={v.id} className="flex justify-between py-2">
                    <Link href={h(`/embarcacoes/${v.id}`)} className="font-medium hover:underline">
                      {v.code} · {v.name}
                    </Link>
                    <span className="text-slate-500">
                      {VESSEL_TYPE_LABELS[v.vessel_type as VesselType]}
                      {v.registration ? ` · ${v.registration}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {can.manage(user.role) && (
            <Card title="Portal do cliente">
              <ClientAccessPanel
                clientId={id}
                clientName={c.name}
                defaultEmail={c.email}
                accesses={(accesses.data ?? []) as ClientAccessView[]}
                canEdit={can.plan(user.role)}
                portalUrl={`${origin}${h("/entrar")}`}
              />
            </Card>
          )}
          <Card title={`Histórico de serviços (${orders.length})`}>
            {orders.length === 0 ? (
              <EmptyState title="Sem obras" />
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={h(`/obras/${o.id}`)} className="hover:underline">
                      <span className="font-mono text-xs text-slate-500">{o.number}</span> {o.title}
                      <span className="block text-xs text-slate-500">
                        {o.vessel?.name} · {fmtDate(o.start_date)} → {fmtDate(o.due_date)}
                      </span>
                    </Link>
                    <OrderStatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
