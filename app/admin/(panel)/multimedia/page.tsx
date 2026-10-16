import type { Metadata } from "next";
import { listMedia } from "@/lib/media/actions";
import { MediaLibrary } from "@/components/admin/media-library";
import { PageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Biblioteca Multimédia" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function MediaPage() {
  const result = await listMedia();
  return (
    <>
      <PageHeader title="Biblioteca Multimédia" description="Todas as imagens, logótipos e vídeos usados no website." />
      {result.ok ? <MediaLibrary items={result.data} /> : <Notice tone="error">{result.error}</Notice>}
    </>
  );
}
