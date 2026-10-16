import type { Metadata } from "next";
import { getDraft } from "@/lib/cms/draft";
import { StoreEditor } from "@/components/admin/part-editors";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Loja Online" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function Page() {
  const { doc } = await getDraft();
  // Para onde vão os botões enquanto não houver link da Quicksell (ver storeTarget em components/site/links.ts).
  const fallback = doc.contact.whatsapp.replace(/[^0-9]/g, "")
    ? "whatsapp"
    : doc.sections.some((s) => s.type === "contact" && s.visible)
      ? "contact"
      : null;
  return (
    <>
      <PageHeader title="Loja Online" description="Botões e chamadas para a loja externa na plataforma Quicksell." />
      <StoreEditor value={doc.store} fallback={fallback} />
    </>
  );
}
