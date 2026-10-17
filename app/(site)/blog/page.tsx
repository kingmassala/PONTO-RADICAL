import { BlogIndexPage, blogIndexMetadata } from "@/components/site/blog/blog-pages";

// Só se entra com uma navegação completa (links normais), como as páginas de cada língua.
export const instant = false;

export function generateMetadata() {
  return blogIndexMetadata("pt");
}

export default function BlogPage() {
  return <BlogIndexPage locale="pt" />;
}
