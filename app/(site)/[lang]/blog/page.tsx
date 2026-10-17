import { notFound } from "next/navigation";
import { BlogIndexPage, blogIndexMetadata } from "@/components/site/blog/blog-pages";
import { isLocale, TRANSLATED_LOCALES, type Locale } from "@/lib/i18n/config";

export const instant = false;

export function generateStaticParams() {
  return TRANSLATED_LOCALES.map((lang) => ({ lang }));
}

async function localeFrom(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang) || lang === "pt") notFound();
  return lang;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/blog">) {
  return blogIndexMetadata(await localeFrom(params));
}

export default async function LocalizedBlogPage({ params }: PageProps<"/[lang]/blog">) {
  return <BlogIndexPage locale={await localeFrom(params)} />;
}
