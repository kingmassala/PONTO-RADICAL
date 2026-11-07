import type { Metadata } from "next";
import Link from "next/link";
import { requireOpsPage } from "@/lib/ops/auth";
import { getClients, getOrders, getVessels } from "@/lib/ops/queries";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { can } from "@/lib/ops/roles";
import { ClientFormButton } from "@/components/ops/registry-forms";
import { EmptyState } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Clientes" };
export const instant = false;

export default async function ClientesPage({ searchParams }: PageProps<"/gestao/clientes">) {
  const user = await requireOpsPage(["admin", "direcao", "gestor", "supervisor", "financeiro"]);
  const sp = (await searchParams) as { q?: string; arquivados?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const [clients, vessels, orders] = await Promise.all([getClients(), getVessels(), getOrders()]);
  const q = (sp.q ?? "").toLowerCase().trim();
  const list = clients.filter((c) => (sp.arquivados === "1" || !c.archived) && (!q || [c.name, c.legal_name, c.nif, c.code, c.email].some((x) => x?.toLowerCase().includes(q))));
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">{list.length} cliente(s)</p>
        </div>
        <div className="flex gap-2">
          <form action={h("/clientes")}>
            <input name="q" defaultValue={sp.q} placeholder="Nome, NIF, código…" className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          </form>
          {can.plan(user.role) && <ClientFormButton />}
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState title="Sem clientes">Registe o primeiro cliente.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">NIF</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3 text-right">Embarcações</th>
                <th className="px-4 py-3 text-right">Obras</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={h(`/clientes/${c.id}`)} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <p className="font-mono text-xs text-slate-500">
                      {c.code}
                      {c.archived ? " · arquivado" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">{c.nif ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.phone ?? "—"}
                    <p className="text-xs text-slate-500">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{vessels.filter((v) => v.client_id === c.id).length}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{orders.filter((o) => o.client_id === c.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
