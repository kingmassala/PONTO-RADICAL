import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDraft } from "@/lib/cms/draft";
import { ServiceEditor } from "@/components/admin/services-manager";

export const metadata: Metadata = { title: "Editar serviço" };

export default async function EditServicePage({ params }: PageProps<"/admin/servicos/[id]">) {
  const { id } = await params;
  const { doc } = await getDraft();
  const service = doc.services.find((s) => s.id === id);
  if (!service) notFound();
  return <ServiceEditor service={service} categories={doc.serviceCategories} />;
}
