import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth";
import { listDeliveries } from "@/lib/deliveries/queries";
import { todayIso } from "@/lib/booking/rules";
import { DeliveriesBoard } from "@/components/admin/deliveries";
import { PageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Saídas de material" };
export const instant = false;

export default async function DeliveriesPage() {
  const user = await requireStaffPage();
  const { deliveries, error } = await listDeliveries();
  return (
    <>
      <PageHeader
        title="Saídas de material"
        description="Controlo do material fornecido à Promarine. Cada saída gera uma guia numerada (GS-AAAA-NNNN) com o material, as quantidades e as assinaturas «Entreguei — Ponto Radical» e «Recebi — Promarine»."
      />
      {error && (
        <div className="mb-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <DeliveriesBoard deliveries={deliveries} canDelete={user.role === "admin"} defaultDeliveredBy={user.fullName ?? ""} today={todayIso()} />
    </>
  );
}
