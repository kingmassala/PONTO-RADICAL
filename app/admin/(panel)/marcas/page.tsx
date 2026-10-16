import type { Metadata } from "next";
import { getDraft } from "@/lib/cms/draft";
import { BrandsManager } from "@/components/admin/brands-manager";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Marcas" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function BrandsPage() {
  const { doc } = await getDraft();
  const hasBrandsSection = doc.sections.some((s) => s.type === "brands" && s.visible);
  return (
    <>
      <PageHeader
        title="Marcas"
        description={
          hasBrandsSection
            ? "As marcas visíveis aparecem na secção «Marcas» do website, por esta ordem."
            : "Atenção: não existe nenhuma secção «Montra de marcas» visível. Adicione-a em «Secções» para mostrar as marcas."
        }
      />
      <BrandsManager brands={doc.brands} />
    </>
  );
}
