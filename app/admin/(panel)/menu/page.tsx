import type { Metadata } from "next";
import { getDraft } from "@/lib/cms/draft";
import { anchorOptions } from "@/lib/cms/anchors";
import { isStoreActive } from "@/lib/cms/validate";
import { SECTION_TYPE_LABELS } from "@/lib/cms/templates";
import { MenuEditor } from "@/components/admin/part-editors";
import { PageHeader } from "@/components/admin/page-header";
import { plainText } from "@/lib/cms/text";

export const metadata: Metadata = { title: "Menu e Botões" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function Page() {
  const { doc } = await getDraft();
  const value = {
    navigation: doc.navigation,
    footer: doc.footer,
    nav: doc.sections.map((s) => ({
      id: s.id,
      title: ("title" in s && plainText(s.title)) || SECTION_TYPE_LABELS[s.type],
      anchor: s.anchor,
      visible: s.visible,
      showInNav: s.showInNav,
      navLabel: s.navLabel,
    })),
  };
  return (
    <>
      <PageHeader
        title="Menu e Botões"
        description="Itens do menu, logótipo, botão do cabeçalho e links do rodapé. Os botões dentro das secções editam-se em cada secção."
      />
      <MenuEditor value={value} anchors={anchorOptions(doc)} storeEnabled={isStoreActive(doc)} />
    </>
  );
}
