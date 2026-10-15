import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/auth"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
