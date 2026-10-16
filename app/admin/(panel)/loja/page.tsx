import type { Metadata } from "next";
import { getDraft } from "@/lib/cms/draft";
import { StoreEditor } from "@/components/admin/part-editors";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Loja Online" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function Page() {
  const { doc } = await getDraft();
  return (
    <>
      <PageHeader title="Loja Online" description="Configuração do botão para a loja externa na plataforma Quicksell." />
      <StoreEditor value={doc.store} />
    </>
  );
}
