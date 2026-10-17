import { SiteRenderer } from "@/components/site/site-renderer";
import { getPublishedSite } from "@/lib/cms/published";
import { siteMetadata } from "./site-metadata";

export function generateMetadata() {
  return siteMetadata("pt");
}

export default async function HomePage() {
  const { doc } = await getPublishedSite();
  return <SiteRenderer doc={doc} locale="pt" />;
}
