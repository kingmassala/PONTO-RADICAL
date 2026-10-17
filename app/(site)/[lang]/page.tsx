import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/site-renderer";
import { getPublishedSite } from "@/lib/cms/published";
import { isLocale, TRANSLATED_LOCALES, type Locale } from "@/lib/i18n/config";
import { siteMetadata } from "../site-metadata";

// Cada língua é pré-gerada (generateStaticParams) e só se entra nela com uma navegação
// completa (links normais e ecrã de entrada), por isso não há App Shell partilhado a validar.
export const instant = false;

// Só /es, /fr e /en existem (o português está em «/»); outros valores dão 404.
export function generateStaticParams() {
  return TRANSLATED_LOCALES.map((lang) => ({ lang }));
}

async function localeFrom(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang) || lang === "pt") notFound();
  return lang;
}

export async function generateMetadata({ params }: PageProps<"/[lang]">) {
  return siteMetadata(await localeFrom(params));
}

export default async function LocalizedHomePage({ params }: PageProps<"/[lang]">) {
  const locale = await localeFrom(params);
  const { doc } = await getPublishedSite();
  return <SiteRenderer doc={doc} locale={locale} />;
}
