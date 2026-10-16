import type { Metadata } from "next";
import { getDraft } from "@/lib/cms/draft";
import { AppearanceEditor } from "@/components/admin/part-editors";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Aparência" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function Page() {
  const { doc } = await getDraft();
  return (
    <>
      <PageHeader title="Aparência" description="Cores, tipografia e estilo dos botões. As alterações aplicam-se a todo o website de forma consistente." />
      <AppearanceEditor value={doc.appearance} />
    </>
  );
}
