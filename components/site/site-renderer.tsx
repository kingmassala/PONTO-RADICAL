import type { Section, SiteDocument } from "@/lib/cms/schema";
import { themeStyle } from "@/lib/cms/theme";
import { SiteHeader } from "./header";
import { SiteFooter } from "./footer";
import { navItems, resolveLink, storeLink } from "./links";
import {
  BannerSection,
  BrandsSection,
  ContactSection,
  CtaSection,
  FeaturesSection,
  GallerySection,
  HeroSection,
  SplitSection,
  VideoSection,
} from "./sections";

function renderSection(section: Section, doc: SiteDocument, preview: boolean) {
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} doc={doc} />;
    case "split":
      return <SplitSection section={section} doc={doc} />;
    case "brands":
      return <BrandsSection section={section} doc={doc} />;
    case "gallery":
      return <GallerySection section={section} doc={doc} />;
    case "banner":
      return <BannerSection section={section} doc={doc} />;
    case "video":
      return <VideoSection section={section} doc={doc} />;
    case "features":
      return <FeaturesSection section={section} doc={doc} />;
    case "cta":
      return <CtaSection section={section} doc={doc} />;
    case "contact":
      return <ContactSection section={section} doc={doc} preview={preview} />;
  }
}

/**
 * Desenha o website completo a partir de um documento do CMS.
 * É usado tanto pelo website público (versão publicada) como pela
 * pré-visualização do painel (rascunho), garantindo que são idênticos.
 */
export function SiteRenderer({ doc, previewBanner }: { doc: SiteDocument; previewBanner?: React.ReactNode }) {
  const preview = Boolean(previewBanner);
  const header = doc.store.showInHeader ? storeLink(doc) : null;
  const firstVisible = doc.sections.find((s) => s.visible);
  const startsWithHero = firstVisible?.type === "hero" || firstVisible?.type === "banner" || firstVisible?.type === "video";

  return (
    <div id="top" className="site min-h-screen" style={themeStyle(doc.appearance)}>
      <a
        href="#conteudo"
        className="sr-only z-50 bg-accent px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar para o conteúdo
      </a>
      {previewBanner}
      <SiteHeader
        logoText={doc.navigation.logoText}
        logoUrl={doc.navigation.logo.url}
        logoAlt={doc.navigation.logo.alt}
        items={navItems(doc)}
        cta={resolveLink(doc.navigation.ctaButton, doc)}
        store={header}
        headerStyle={startsWithHero ? doc.navigation.headerStyle : "solid"}
        topOffset={preview ? 44 : 0}
      />
      <main id="conteudo" className={startsWithHero ? "" : "pt-20"}>
        {doc.sections
          .filter((s) => s.visible)
          .map((section) => (
            <div key={section.id}>{renderSection(section, doc, preview)}</div>
          ))}
      </main>
      <SiteFooter doc={doc} />
    </div>
  );
}
