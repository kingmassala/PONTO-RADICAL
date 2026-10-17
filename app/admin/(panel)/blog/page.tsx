import type { Metadata } from "next";
import Link from "next/link";
import { getDraft } from "@/lib/cms/draft";
import { getAllPostsForPanel } from "@/lib/blog/queries";
import { BlogList } from "@/components/admin/blog-manager";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Blog" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

export default async function BlogAdminPage() {
  const [{ doc }, posts] = await Promise.all([getDraft(), getAllPostsForPanel()]);
  const hasSection = doc.sections.some((s) => s.type === "blog" && s.visible);
  return (
    <>
      <PageHeader
        title="Blog"
        description={
          <>
            Artigos sobre produtos, curiosidades e notícias. Cada artigo é publicado individualmente (não precisa de publicar o resto do
            website) e abre numa página própria, em <span className="font-mono">/blog</span>.
            {!hasSection && (
              <>
                {" "}
                Para mostrar os artigos mais recentes na página inicial, adicione a secção «Blog» em{" "}
                <Link href="/admin/seccoes" className="text-sky-700 underline">
                  Secções
                </Link>
                .
              </>
            )}
          </>
        }
        actions={
          <a
            href="/blog"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Ver o blog no website →
          </a>
        }
      />
      <BlogList posts={posts} />
    </>
  );
}
