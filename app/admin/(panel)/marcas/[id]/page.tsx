import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDraft } from "@/lib/cms/draft";
import { BrandEditor } from "@/components/admin/brands-manager";

export const metadata: Metadata = { title: "Editar marca" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../../loading.tsx).
export const instant = false;

export default async function EditBrandPage({ params }: PageProps<"/admin/marcas/[id]">) {
  const { id } = await params;
  const { doc } = await getDraft();
  const brand = doc.brands.find((b) => b.id === id);
  if (!brand) notFound();
  return <BrandEditor brand={brand} />;
}
