import type { Metadata } from "next";
import { getDraft } from "@/lib/cms/draft";
import { SeoEditor } from "@/components/admin/part-editors";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "SEO" };

export default async function Page() {
  const { doc } = await getDraft();
  return (
    <>
      <PageHeader title="SEO" description="Título, descrição e imagem usados pelo Google e nas partilhas em redes sociais." />
      <SeoEditor value={doc.seo} />
    </>
  );
}
