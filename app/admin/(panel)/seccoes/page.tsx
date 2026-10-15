import type { Metadata } from "next";
import { getDraft } from "@/lib/cms/draft";
import { SECTION_TYPE_LABELS } from "@/lib/cms/templates";
import { SectionsManager } from "@/components/admin/sections-manager";
import { plainText } from "@/lib/cms/text";

export const metadata: Metadata = { title: "Secções" };

export default async function SectionsPage() {
  const { doc } = await getDraft();
  const sections = doc.sections.map((s) => ({
    id: s.id,
    anchor: s.anchor,
    title: ("title" in s && plainText(s.title)) || s.navLabel || SECTION_TYPE_LABELS[s.type],
    typeLabel: SECTION_TYPE_LABELS[s.type],
    visible: s.visible,
    showInNav: s.showInNav,
    navLabel: s.navLabel,
  }));
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Secções</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
          A página é composta por estas secções, pela ordem apresentada. Pode reordenar, ocultar, duplicar, eliminar e
          criar novas secções a partir de modelos. Cada alteração fica no rascunho até publicar.
        </p>
      </div>
      <SectionsManager sections={sections} />
    </>
  );
}
