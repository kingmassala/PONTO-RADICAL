import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/env";
import { LOCALE_INFO, LOCALES, localePath } from "@/lib/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LOCALES.map((l) => [LOCALE_INFO[l].htmlLang, `${SITE_URL}${localePath(l)}`]));
  return LOCALES.map((l) => ({
    url: `${SITE_URL}${localePath(l)}`,
    changeFrequency: "weekly",
    priority: l === "pt" ? 1 : 0.8,
    alternates: { languages },
  }));
}
