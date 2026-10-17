import type { Metadata } from "next";
import { getDraft } from "@/lib/cms/draft";
import { collectTexts } from "@/lib/i18n/content";
import { PageHeader } from "@/components/admin/page-header";
import { TranslationsEditor } from "@/components/admin/translations-editor";

export const metadata: Metadata = { title: "Traduções" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function Page() {
  const { doc } = await getDraft();
  return (
    <>
      <PageHeader title="Traduções" description="Conteúdo do website em espanhol, francês, inglês, russo e chinês." />
      <TranslationsEditor entries={collectTexts(doc)} value={doc.translations} />
    </>
  );
}
