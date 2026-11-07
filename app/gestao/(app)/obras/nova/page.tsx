import type { Metadata } from "next";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getClients, getMembers, getVessels } from "@/lib/ops/queries";
import { OrderForm } from "@/components/ops/registry-forms";
import { ClientFormButton, VesselFormButton } from "@/components/ops/registry-forms";
import { Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Nova obra" };
export const instant = false;

export default async function NovaObraPage() {
  await requireOpsPage(["admin", "direcao", "gestor"]);
  const supabase = await createClient();
  const [clients, vessels, members, teams] = await Promise.all([getClients(), getVessels(), getMembers(), supabase.from("ops_teams").select("id, name").order("name")]);
  const activeClients = clients.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nova ordem de serviço</h1>
          <p className="mt-1 text-sm text-slate-500">O número (OS-AAAA-NNNN) é atribuído automaticamente ao guardar.</p>
        </div>
        <div className="flex gap-2">
          <ClientFormButton />
          <VesselFormButton clients={activeClients} />
        </div>
      </div>
      <Card>
        <OrderForm
          clients={activeClients}
          vessels={vessels.filter((v) => !v.archived)}
          managers={members.filter((m) => m.active && m.role !== "financeiro").map((m) => ({ id: m.user_id, name: m.full_name }))}
          teams={teams.data ?? []}
        />
      </Card>
    </>
  );
}
