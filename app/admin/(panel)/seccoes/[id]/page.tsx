import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDraft } from "@/lib/cms/draft";
import { anchorOptions } from "@/lib/cms/anchors";
import { isStoreActive } from "@/lib/cms/validate";
import { SectionEditor } from "@/components/admin/section-editor";

export const metadata: Metadata = { title: "Editar secção" };

export default async function EditSectionPage({ params }: PageProps<"/admin/seccoes/[id]">) {
  const { id } = await params;
  const { doc } = await getDraft();
  const section = doc.sections.find((s) => s.id === id);
  if (!section) notFound();
  return <SectionEditor section={section} anchors={anchorOptions(doc)} storeEnabled={isStoreActive(doc)} />;
}
