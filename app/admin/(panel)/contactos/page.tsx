import type { Metadata } from "next";
import { getDraft } from "@/lib/cms/draft";
import { ContactEditor } from "@/components/admin/part-editors";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Contactos" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function Page() {
  const { doc } = await getDraft();
  return (
    <>
      <PageHeader title="Contactos" description="Telefone, email, morada, horário e redes sociais apresentados no website." />
      <ContactEditor value={doc.contact} />
    </>
  );
}
