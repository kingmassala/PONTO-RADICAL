import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { getPublishedState } from "@/lib/cms/draft";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { RestoreVersionButton } from "@/components/admin/version-actions";
import { Badge } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Publicações e Histórico" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function VersionsPage() {
  const supabase = await createClient();
  const [published, { data: versions }] = await Promise.all([
    getPublishedState(),
    supabase.from("site_versions").select("id, note, published_at, published_by_email").order("id", { ascending: false }).limit(100),
  ]);

  return (
    <>
      <PageHeader
        title="Publicações e Histórico"
        description="Cada publicação fica guardada. Pode pré-visualizar qualquer versão e restaurá-la para o rascunho, para depois a publicar novamente."
      />
      <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
        <p className="font-medium">Como funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Edite os conteúdos e clique em «Guardar rascunho». O website público não muda.</li>
          <li>Use «Pré-visualizar» (barra superior) para ver o rascunho exactamente como ficará.</li>
          <li>Clique em «Publicar». As alterações ficam online de imediato, sem necessidade de programador.</li>
          <li>Se precisar de voltar atrás, restaure uma versão abaixo e publique-a.</li>
        </ol>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {(versions ?? []).map((v) => (
            <li key={v.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-medium text-slate-900">
                  Versão n.º {v.id}
                  {published?.versionId === v.id && <Badge tone="green">Online</Badge>}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDateTime(v.published_at)}
                  {v.published_by_email ? ` · ${v.published_by_email}` : ""}
                </p>
                {v.note && <p className="mt-1 text-sm text-slate-700">{v.note}</p>}
              </div>
              <div className="flex items-start gap-2">
                <a
                  href={`/admin/pre-visualizacao?versao=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="size-3.5" /> Ver
                </a>
                <RestoreVersionButton versionId={v.id} />
              </div>
            </li>
          ))}
          {(versions ?? []).length === 0 && <li className="px-6 py-10 text-center text-sm text-slate-500">Ainda não existem publicações.</li>}
        </ul>
      </section>
    </>
  );
}
