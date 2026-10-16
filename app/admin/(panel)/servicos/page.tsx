import type { Metadata } from "next";
import Link from "next/link";
import { getDraft } from "@/lib/cms/draft";
import { BookingSettingsEditor, CategoriesEditor, ServicesManager } from "@/components/admin/services-manager";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesPage() {
  const { doc } = await getDraft();
  const hasSection = doc.sections.some((s) => s.type === "services" && s.visible);
  const usage: Record<string, number> = {};
  for (const s of doc.services) usage[s.categoryId] = (usage[s.categoryId] ?? 0) + 1;
  return (
    <>
      <PageHeader
        title="Serviços"
        description={
          hasSection ? (
            "Passeios de barco, actividades e outras experiências. Os serviços visíveis aparecem na secção «Experiências» do website, por esta ordem, com o botão de pedido de reserva."
          ) : (
            <>
              Atenção: não existe nenhuma secção «Experiências e reservas» visível. Adicione-a em{" "}
              <Link href="/admin/seccoes" className="text-sky-700 underline">
                Secções
              </Link>{" "}
              para mostrar os serviços.
            </>
          )
        }
        actions={
          <Link href="/admin/reservas" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            Ver pedidos de reserva →
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ServicesManager services={doc.services} categories={doc.serviceCategories} />
        </div>
        <div className="space-y-6">
          <CategoriesEditor key={doc.serviceCategories.map((c) => `${c.id}:${c.label}`).join("|")} categories={doc.serviceCategories} usage={usage} />
          <BookingSettingsEditor value={doc.booking} hasWhatsapp={Boolean(doc.contact.whatsapp)} />
        </div>
      </div>
    </>
  );
}
