import { BlogPostPage, blogPostMetadata, blogSlugParams } from "@/components/site/blog/blog-pages";

export const instant = false;

// Artigos publicados depois do build são gerados no primeiro pedido e ficam em cache.
export function generateStaticParams() {
  return blogSlugParams();
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  return blogPostMetadata("pt", slug);
}

export default async function BlogPostRoute({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  return <BlogPostPage locale="pt" slug={slug} />;
}
