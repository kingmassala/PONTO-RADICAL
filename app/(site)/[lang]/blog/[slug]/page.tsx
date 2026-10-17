import { notFound } from "next/navigation";
import { BlogPostPage, blogPostMetadata, blogSlugParams } from "@/components/site/blog/blog-pages";
import { isLocale, TRANSLATED_LOCALES, type Locale } from "@/lib/i18n/config";

export const instant = false;

export async function generateStaticParams() {
  const slugs = await blogSlugParams();
  return TRANSLATED_LOCALES.flatMap((lang) => slugs.map(({ slug }) => ({ lang, slug })));
}

async function routeFrom(params: Promise<{ lang: string; slug: string }>): Promise<{ locale: Locale; slug: string }> {
  const { lang, slug } = await params;
  if (!isLocale(lang) || lang === "pt") notFound();
  return { locale: lang, slug };
}

export async function generateMetadata({ params }: PageProps<"/[lang]/blog/[slug]">) {
  const { locale, slug } = await routeFrom(params);
  return blogPostMetadata(locale, slug);
}

export default async function LocalizedBlogPostPage({ params }: PageProps<"/[lang]/blog/[slug]">) {
  const { locale, slug } = await routeFrom(params);
  return <BlogPostPage locale={locale} slug={slug} />;
}
