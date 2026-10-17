import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/env";
import { LOCALE_INFO, LOCALES, localePath } from "@/lib/i18n/config";
import { getPublishedPosts } from "@/lib/blog/queries";
import { blogPath } from "@/lib/blog/schema";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const languages = (path: (l: (typeof LOCALES)[number]) => string) =>
    Object.fromEntries(LOCALES.map((l) => [LOCALE_INFO[l].htmlLang, `${SITE_URL}${path(l)}`]));
  const posts = await getPublishedPosts();
  return [
    ...LOCALES.map((l) => ({
      url: `${SITE_URL}${localePath(l)}`,
      changeFrequency: "weekly" as const,
      priority: l === "pt" ? 1 : 0.8,
      alternates: { languages: languages(localePath) },
    })),
    ...LOCALES.map((l) => ({
      url: `${SITE_URL}${blogPath(l)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: { languages: languages((x) => blogPath(x)) },
    })),
    ...posts.flatMap((p) =>
      LOCALES.map((l) => ({
        url: `${SITE_URL}${blogPath(l, p.slug)}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
        alternates: { languages: languages((x) => blogPath(x, p.slug)) },
      })),
    ),
  ];
}
