import type { Section, SiteDocument } from "@/lib/cms/schema";
import { themeStyle } from "@/lib/cms/theme";
import { DEFAULT_LOCALE, LOCALE_INFO, type Locale } from "@/lib/i18n/config";
import { localizeDoc } from "@/lib/i18n/content";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import { LocaleProvider } from "./i18n";
import { languageGateScript } from "@/lib/i18n/gate-script";
import { LanguageGate } from "./language-gate";
import { SiteHeader } from "./header";
import { CustomCursor } from "./fx/cursor";
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
  MarqueeSection,
  ServicesSection,
  SplitSection,
  VideoSection,
} from "./sections";

function renderSection(section: Section, doc: SiteDocument, preview: boolean, m: Messages, locale: Locale) {
  const ctx = { doc, m, locale };
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} {...ctx} />;
    case "split":
      return <SplitSection section={section} {...ctx} />;
    case "brands":
      return <BrandsSection section={section} {...ctx} />;
    case "gallery":
      return <GallerySection section={section} {...ctx} />;
    case "banner":
      return <BannerSection section={section} {...ctx} />;
    case "video":
      return <VideoSection section={section} {...ctx} />;
    case "features":
      return <FeaturesSection section={section} {...ctx} />;
    case "cta":
      return <CtaSection section={section} {...ctx} />;
    case "contact":
      return <ContactSection section={section} {...ctx} preview={preview} />;
    case "marquee":
      return <MarqueeSection section={section} {...ctx} />;
    case "services":
      return <ServicesSection section={section} {...ctx} preview={preview} />;
  }
}

/**
 * Desenha o website completo a partir de um documento do CMS.
 * É usado tanto pelo website público (versão publicada) como pela
 * pré-visualização do painel (rascunho), garantindo que são idênticos.
 */
export function SiteRenderer({
  doc: source,
  locale = DEFAULT_LOCALE,
  previewBanner,
  previewGateHrefs,
}: {
  doc: SiteDocument;
  locale?: Locale;
  previewBanner?: React.ReactNode;
  /** Pré-visualização: mostra o ecrã de entrada com links para a pré-visualização em cada língua. */
  previewGateHrefs?: Record<Locale, string>;
}) {
  const preview = Boolean(previewBanner);
  const doc = localizeDoc(source, locale);
  const m = getMessages(locale);
  const fx = doc.appearance.effects;
  const header = doc.store.showInHeader ? storeLink(doc, locale) : null;
  const firstVisible = doc.sections.find((s) => s.visible);
  const startsWithHero = firstVisible?.type === "hero" || firstVisible?.type === "banner" || firstVisible?.type === "video";

  return (
    <LocaleProvider locale={locale}>
    <div
      id="top"
      lang={LOCALE_INFO[locale].htmlLang}
      className={`site min-h-screen ${fx.customCursor ? "fx-cursor" : ""} ${fx.grain ? "fx-grain" : ""} ${fx.animations ? "fx-motion" : ""} ${
        doc.appearance.monochrome ? "pr-mono" : ""
      }`}
      style={themeStyle(doc.appearance)}
    >
      {!preview && (
        <>
          {/* Tem de correr antes de o ecrã de entrada ser desenhado. */}
          <script dangerouslySetInnerHTML={{ __html: languageGateScript(locale) }} />
          <LanguageGate locale={locale} siteName={doc.settings.siteName} />
        </>
      )}
      {preview && previewGateHrefs && <LanguageGate locale={locale} siteName={doc.settings.siteName} previewHrefs={previewGateHrefs} />}
      <div className="pr-progress" aria-hidden />
      {fx.customCursor && <CustomCursor />}
      <a
        href="#conteudo"
        className="sr-only z-50 bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {m.common.skipToContent}
      </a>
      {previewBanner}
      <SiteHeader
        logoText={doc.navigation.logoText}
        logoUrl={doc.navigation.logo.url}
        logoAlt={doc.navigation.logo.alt}
        items={navItems(doc)}
        cta={resolveLink(doc.navigation.ctaButton, doc, locale)}
        store={header}
        headerStyle={startsWithHero ? doc.navigation.headerStyle : "solid"}
        topOffset={preview ? 44 : 0}
      />
      <main id="conteudo" className={startsWithHero ? "" : "pt-28"}>
        {doc.sections
          .filter((s) => s.visible)
          .map((section) => (
            <div key={section.id}>{renderSection(section, doc, preview, m, locale)}</div>
          ))}
      </main>
      <SiteFooter doc={doc} m={m} locale={locale} />
    </div>
    </LocaleProvider>
  );
}
