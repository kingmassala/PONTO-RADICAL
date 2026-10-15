import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStaffPage } from "@/lib/auth";
import { getDraft } from "@/lib/cms/draft";
import { siteDocumentSchema } from "@/lib/cms/schema";
import { createClient } from "@/lib/supabase/server";
import { SiteRenderer } from "@/components/site/site-renderer";

export const metadata: Metadata = { title: "Pré-visualização" };

async function Preview({ searchParams }: { searchParams: Promise<{ versao?: string }> }) {
  await requireStaffPage();
  const { versao } = await searchParams;
  let doc = (await getDraft()).doc;
  let label = "Pré-visualização do rascunho · ainda não publicado";

  const versionId = Number(versao);
  if (versao && Number.isInteger(versionId) && versionId > 0) {
    const supabase = await createClient();
    const { data } = await supabase.from("site_versions").select("content, published_at").eq("id", versionId).maybeSingle();
    if (data) {
      doc = siteDocumentSchema.parse(data.content);
      label = `Pré-visualização da versão n.º ${versionId} (histórico)`;
    }
  }

  return (
    <SiteRenderer
      doc={doc}
      previewBanner={
        <div className="fixed inset-x-0 top-0 z-50 flex h-11 items-center justify-between gap-4 bg-amber-400 px-4 text-sm font-medium text-amber-950">
          <span>{label}</span>
          <a href="/admin" className="rounded bg-amber-950/10 px-3 py-1 hover:bg-amber-950/20">
            Voltar ao painel
          </a>
        </div>
      }
    />
  );
}

export default function PreviewPage({ searchParams }: PageProps<"/admin/pre-visualizacao">) {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">A preparar a pré-visualização…</div>}>
      <Preview searchParams={searchParams as Promise<{ versao?: string }>} />
    </Suspense>
  );
}
