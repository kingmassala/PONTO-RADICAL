import type { Metadata } from "next";
import { getPublishedSite } from "@/lib/cms/published";
import { SITE_URL } from "@/lib/supabase/env";
import { LOCALE_INFO, LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { localizeDoc } from "@/lib/i18n/content";

/** Metadados da página inicial numa língua (SEO traduzido e ligações hreflang entre línguas). */
export async function siteMetadata(locale: Locale): Promise<Metadata> {
  const { doc: source } = await getPublishedSite();
  const doc = localizeDoc(source, locale);
  const { seo, settings } = doc;
  // Imagem de partilha (WhatsApp, Facebook…): a definida em «SEO» ou, por omissão, o logótipo oficial.
  const image = seo.ogImage.url || "/brand/og-ponto-radical.png";
  return {
    title: seo.title || settings.siteName,
    description: seo.description || undefined,
    keywords: seo.keywords ? seo.keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    metadataBase: new URL(seo.siteUrl || SITE_URL),
    alternates: {
      canonical: localePath(locale),
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [LOCALE_INFO[l].htmlLang, localePath(l)])),
        "x-default": "/",
      },
    },
    openGraph: {
      title: seo.title || settings.siteName,
      description: seo.description || undefined,
      siteName: settings.siteName,
      locale: LOCALE_INFO[locale].og,
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => LOCALE_INFO[l].og),
      type: "website",
      url: localePath(locale),
      images: [{ url: image, width: 1200, height: 630, alt: seo.ogImage.alt || settings.siteName }],
    },
    twitter: { card: "summary_large_image" },
  };
}
