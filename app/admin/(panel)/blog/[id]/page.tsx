import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostForPanel } from "@/lib/blog/queries";
import { BlogEditor } from "@/components/admin/blog-manager";

export const metadata: Metadata = { title: "Editar artigo" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../../loading.tsx).
export const instant = false;

export default async function EditBlogPostPage({ params }: PageProps<"/admin/blog/[id]">) {
  const { id } = await params;
  const post = await getPostForPanel(id);
  if (!post) notFound();
  return <BlogEditor post={post} />;
}
