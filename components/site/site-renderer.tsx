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
import { ScrollMagic } from "./fx/scroll-magic";
import { GateSkipLinks } from "./fx/gate-skip-links";
import { SiteFooter } from "./footer";
import { BlogSection } from "./blog/blog-section";
import { navItems, resolveLink, storeLink } from "./links";
import {
  BannerSection,
  BrandsSection,
  StoreCallout,
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
    case "blog":
      return <BlogSection section={section} {...ctx} />;
  }
}

/**
 * Moldura comum a todas as páginas do website: tema, efeitos, cabeçalho e rodapé.
 * `base` é o endereço da página inicial quando a página não é a inicial (blog):
 * os links do menu passam a apontar para as secções dessa página.
 */
export function SiteFrame({
  doc,
  locale,
  base = "",
  paths,
  before,
  headerStyle,
  mainClassName,
  topOffset = 0,
  children,
}: {
  /** Documento já traduzido (localizeDoc). */
  doc: SiteDocument;
  locale: Locale;
  base?: string;
  /** Esta página nas outras línguas (selector de língua). */
  paths?: Partial<Record<Locale, string>>;
  /** Ecrã de entrada e barra de pré-visualização (antes do cabeçalho). */
  before?: React.ReactNode;
  headerStyle: SiteDocument["navigation"]["headerStyle"];
  mainClassName?: string;
  /** Altura da barra de pré-visualização do painel. */
  topOffset?: number;
  children: React.ReactNode;
}) {
  const m = getMessages(locale);
  const fx = doc.appearance.effects;
  const header = doc.store.showInHeader ? storeLink(doc, locale, base) : null;

  return (
    <LocaleProvider locale={locale} paths={paths}>
      <div
        id="top"
        lang={LOCALE_INFO[locale].htmlLang}
        className={`site min-h-screen ${fx.customCursor ? "fx-cursor" : ""} ${fx.grain ? "fx-grain" : ""} ${fx.animations ? "fx-motion" : ""} ${
          doc.appearance.monochrome ? "pr-mono" : ""
        }`}
        style={themeStyle(doc.appearance)}
      >
        {before}
        <div className="pr-progress" aria-hidden />
        {fx.customCursor && <CustomCursor />}
        {fx.animations && <ScrollMagic />}
        {base && <GateSkipLinks home={base} />}
        <a
          href="#conteudo"
          className="sr-only z-50 bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {m.common.skipToContent}
        </a>
        <SiteHeader
          logoText={doc.navigation.logoText}
          logoUrl={doc.navigation.logo.url}
          logoAlt={doc.navigation.logo.alt}
          logoHref={base || undefined}
          items={navItems(doc, base)}
          cta={resolveLink(doc.navigation.ctaButton, doc, locale, base)}
          store={header}
          headerStyle={headerStyle}
          topOffset={topOffset}
        />
        <main id="conteudo" className={mainClassName}>
          {children}
        </main>
        <SiteFooter doc={doc} m={m} locale={locale} base={base} />
      </div>
    </LocaleProvider>
  );
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
  const firstVisible = doc.sections.find((s) => s.visible);
  const startsWithHero = firstVisible?.type === "hero" || firstVisible?.type === "banner" || firstVisible?.type === "video";

  return (
    <SiteFrame
      doc={doc}
      locale={locale}
      headerStyle={startsWithHero ? doc.navigation.headerStyle : "solid"}
      mainClassName={startsWithHero ? "" : "pt-28"}
      topOffset={preview ? 44 : 0}
      before={
        <>
          {!preview && (
            <>
              {/* Tem de correr antes de o ecrã de entrada ser desenhado. */}
              <script dangerouslySetInnerHTML={{ __html: languageGateScript() }} />
              <LanguageGate locale={locale} siteName={doc.settings.siteName} />
            </>
          )}
          {preview && previewGateHrefs && <LanguageGate locale={locale} siteName={doc.settings.siteName} previewHrefs={previewGateHrefs} />}
          {previewBanner}
        </>
      }
    >
      {doc.sections
        .filter((s) => s.visible)
        .map((section, i) => (
          <div key={section.id}>
            {renderSection(section, doc, preview, m, locale)}
            {/* A faixa da loja fica logo a seguir à primeira secção (a abertura). */}
            {i === 0 && <StoreCallout doc={doc} m={m} locale={locale} />}
          </div>
        ))}
    </SiteFrame>
  );
}
