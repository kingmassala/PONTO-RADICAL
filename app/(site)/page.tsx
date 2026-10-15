import type { Metadata } from "next";
import { SiteRenderer } from "@/components/site/site-renderer";
import { getPublishedSite } from "@/lib/cms/published";
import { SITE_URL } from "@/lib/supabase/env";

export async function generateMetadata(): Promise<Metadata> {
  const { doc } = await getPublishedSite();
  const { seo, settings } = doc;
  const image = seo.ogImage.url || undefined;
  return {
    title: seo.title || settings.siteName,
    description: seo.description || undefined,
    keywords: seo.keywords ? seo.keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    metadataBase: new URL(seo.siteUrl || SITE_URL),
    openGraph: {
      title: seo.title || settings.siteName,
      description: seo.description || undefined,
      siteName: settings.siteName,
      locale: "pt_PT",
      type: "website",
      images: image ? [{ url: image, alt: seo.ogImage.alt || settings.siteName }] : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function HomePage() {
  const { doc } = await getPublishedSite();
  return <SiteRenderer doc={doc} />;
}
