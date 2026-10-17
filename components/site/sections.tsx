import {
  Anchor,
  BadgeCheck,

  Compass,
  LifeBuoy,
  Map,
  Radar,
  Shield,
  Ship,
  ShoppingBag,
  ArrowUpRight,
  Sparkles,
  Sun,
  Truck,
  Users,
  Waves,
  Wind,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { SectionOf, SectionType, SiteDocument } from "@/lib/cms/schema";
import { sanitizeRichText } from "@/lib/cms/sanitize";
import { plainText } from "@/lib/cms/text";
import { resolveLink, storeLink } from "./links";
import { BACKGROUNDS, CmsButton, CmsImage, Eyebrow, RichText } from "./primitives";
import { BrandShowcase } from "./brand-showcase";
import { ContactForm } from "./contact-form";
import { ContactDetails } from "./contact-details";
import { Title } from "./title";
import { Tilt } from "./fx/tilt";
import { CountUp } from "./fx/count-up";
import { DragScroll } from "./fx/drag-scroll";
import { ServicesExplorer, ServicesNote } from "./booking/services-explorer";
import { visibleServices } from "@/lib/cms/validate";
import { BRAND_TAGLINE_PARTS } from "@/lib/brand";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";

type Props<T extends SectionType> = { section: SectionOf<T>; doc: SiteDocument; m: Messages; locale: Locale };

const ICONS: Record<string, LucideIcon> = {
  compass: Compass,
  anchor: Anchor,
  waves: Waves,
  wind: Wind,
  ship: Ship,
  radar: Radar,
  wrench: Wrench,
  shield: Shield,
  sparkles: Sparkles,
  "life-buoy": LifeBuoy,
  map: Map,
  truck: Truck,
  users: Users,
  sun: Sun,
};

const overlayStyle = (color: "dark" | "primary", opacity: number) => {
  const base = color === "primary" ? "--pr-primary" : "--pr-dark";
  return {
    background: `linear-gradient(100deg, color-mix(in srgb, var(${base}) ${Math.min(100, opacity + 30)}%, transparent) 0%, color-mix(in srgb, var(${base}) ${opacity}%, transparent) 55%, color-mix(in srgb, var(${base}) ${Math.max(0, opacity - 25)}%, transparent) 100%)`,
  };
};

/** Logótipo usado como separador e emblema. */
function LogoMark({ url, className }: { url: string; className?: string }) {
  if (!url) {
    return (
      <span aria-hidden className={className}>
        ✦
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" aria-hidden className={className} />;
}

/** Emblema circular com texto a rodar à volta do logótipo. */
function SpinBadge({ text, logo }: { text: string; logo: string }) {
  return (
    <div className="pr-float-3d relative size-36 sm:size-44" aria-hidden>
      <svg viewBox="0 0 200 200" className="pr-spin absolute inset-0 size-full text-white">
        <defs>
          <path id="pr-badge-path" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        {/* textLength = perímetro do círculo (2π × 78 ≈ 490): o texto ocupa a volta completa sem se sobrepor. */}
        <text fill="currentColor" style={{ font: "700 9px var(--pr-font-body)", textTransform: "uppercase" }}>
          <textPath href="#pr-badge-path" textLength="488" lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
      </svg>
      {/* Símbolo como no cabeçalho: contorno e «R» a branco sobre o fundo escuro, sem disco à volta. */}
      <div className="absolute inset-[29%] flex items-center justify-center">
        <LogoMark url={logo} className="size-full object-contain" />
      </div>
    </div>
  );
}

/* --------------------------------- Hero --------------------------------- */

export function HeroSection({ section, doc, m, locale }: Props<"hero">) {
  const store = doc.store.showInHero ? storeLink(doc, locale) : null;
  const centered = section.align === "center";
  const stripBrands = doc.brands.filter((b) => b.visible);
  const brandNames = stripBrands.map((b) => b.name);
  const badgeText = `${[doc.settings.siteName, ...BRAND_TAGLINE_PARTS].join(" • ")} • `;

  return (
    <section
      id={section.anchor}
      aria-label={section.navLabel || plainText(section.title)}
      className={`pr-tone-dark relative isolate flex overflow-clip bg-dark text-white ${section.height === "full" ? "min-h-[100svh]" : "min-h-[82svh]"}`}
    >
      <div className="absolute inset-0 -z-10 overflow-clip">
        <div className="pr-ken-burns absolute inset-0">
          {section.mediaKind === "video" && section.videoUrl ? (
            <video className="size-full object-cover" src={section.videoUrl} poster={section.image.url || undefined} autoPlay muted loop playsInline aria-hidden />
          ) : (
            <CmsImage media={section.image} sizes="100vw" priority />
          )}
        </div>
        <div className="absolute inset-0" style={overlayStyle(section.overlayColor, section.overlayOpacity)} />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-dark via-dark/30 to-transparent" />
        {/* Corte diagonal do «R» do logótipo, como textura */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute -right-[8%] top-0 h-full w-[50%] text-white/[0.05]" aria-hidden>
          <path d="M0 0 L100 100 L100 0 Z" fill="currentColor" />
        </svg>
      </div>

      <div
        className={`pr-3d-recede mx-auto flex w-full max-w-[90rem] flex-col justify-end px-5 pt-36 sm:px-8 lg:px-12 ${
          section.showBrandStrip ? "pb-40 sm:pb-44" : "pb-20 sm:pb-28"
        } ${centered ? "items-center text-center" : ""}`}
      >
        {section.eyebrow && (
          <p
            className={`pr-load-fade pr-eyebrow mb-8 inline-flex w-fit items-center gap-3 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-white/85 backdrop-blur ${centered ? "mx-auto" : ""}`}
            style={{ ["--d" as string]: "0.05s" }}
          >
            <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
            {section.eyebrow}
          </p>
        )}
        <Title text={section.title} as="h1" animate="load" className={`pr-display max-w-[14ch] ${centered ? "mx-auto" : ""}`} />
        <div className={`mt-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between ${centered ? "items-center" : ""}`}>
          <div className={`pr-load-fade max-w-xl ${centered ? "mx-auto" : ""}`} style={{ ["--d" as string]: "0.7s" }}>
            {section.subtitle && <p className="text-lg leading-relaxed text-white/80 sm:text-xl">{section.subtitle}</p>}
            <div className={`mt-9 flex flex-wrap gap-4 ${centered ? "justify-center" : ""}`}>
              <CmsButton link={resolveLink(section.primaryButton, doc, locale)} tone="dark" magnetic />
              <CmsButton link={resolveLink(section.secondaryButton, doc, locale)} tone="dark" magnetic />
              <CmsButton link={store} tone="dark" magnetic />
            </div>
          </div>
          {!centered && (
            <div className="pr-load-fade hidden shrink-0 lg:block" style={{ ["--d" as string]: "1s" }}>
              <SpinBadge text={badgeText} logo={doc.navigation.logo.url} />
            </div>
          )}
        </div>
      </div>

      {section.showBrandStrip && brandNames.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-8 overflow-hidden py-6">
            <p className="pr-eyebrow hidden shrink-0 pl-12 text-white/50 xl:block">{m.brands.represented}</p>
            <div className="pr-marquee relative flex-1 overflow-hidden" aria-label={`${m.brands.represented}: ${brandNames.join(", ")}`}>
              <ul
                className="pr-marquee-track flex w-max items-center gap-12"
                // Velocidade constante: a duração cresce com o número de marcas (8,5 s por marca).
                style={{ ["--pr-marquee-duration" as string]: `${Math.max(36, stripBrands.length * 8.5)}s` }}
                aria-hidden
              >
                {[...stripBrands, ...stripBrands, ...stripBrands, ...stripBrands].map((brand, i) => (
                  <li key={i} className="flex items-center gap-12 whitespace-nowrap">
                    <span className="flex items-center gap-3">
                      {brand.logo.url ? (
                        // Logótipos a branco sobre a faixa escura, para ficarem uniformes.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={brand.logo.url} alt="" loading="lazy" className="pr-logo-white h-7 w-auto max-w-[150px] object-contain sm:h-8" />
                      ) : (
                        <span className="pr-heading text-xl text-white sm:text-2xl">{brand.name}</span>
                      )}
                      {brand.authorized && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/25 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-white/80">
                          <BadgeCheck className="size-3.5" aria-hidden /> {m.brands.authorized}
                        </span>
                      )}
                    </span>
                    <LogoMark url={doc.navigation.logo.url} className="size-5 opacity-50" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Chamada para a loja ------------------------------ */

/** Faixa grande e animada com o botão para a Loja Online (a seguir à abertura). */
export function StoreCallout({ doc, m, locale }: { doc: SiteDocument; m: Messages; locale: Locale }) {
  const store = doc.store.showBanner ? storeLink(doc, locale) : null;
  if (!store) return null;
  const external = /^https?:\/\//i.test(store.href);
  return (
    <section aria-label={store.label} className="pr-tone-dark relative overflow-clip bg-dark py-16 text-white sm:py-24">
      <div className="pr-store-glow" aria-hidden />
      <div className="relative mx-auto flex max-w-[90rem] flex-col items-start gap-10 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
        <div className="pr-scroll-reveal max-w-2xl">
          <p className="pr-eyebrow flex items-center gap-3 text-white/60">
            <ShoppingBag className="size-4" aria-hidden /> {m.store.ctaEyebrow}
          </p>
          <p className="pr-heading pr-h2 mt-5">{m.store.ctaTitle}</p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">{m.store.ctaText}</p>
        </div>
        <a
          href={store.href}
          {...(store.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          data-cursor={store.label}
          className="pr-store-cta group relative inline-flex shrink-0 items-center gap-5 rounded-full bg-accent py-5 pl-8 pr-5 text-xl font-bold uppercase tracking-[0.12em] text-on-accent sm:py-6 sm:pl-10 sm:text-2xl"
        >
          <ShoppingBag className="size-7 sm:size-8" aria-hidden />
          {store.label}
          <span className="pr-store-cta-arrow flex size-12 items-center justify-center rounded-full bg-on-accent text-accent sm:size-14">
            <ArrowUpRight className="size-6 transition-transform duration-500 group-hover:rotate-45" aria-hidden />
          </span>
          {external && store.newTab && <span className="sr-only"> {m.common.newTab}</span>}
        </a>
      </div>
    </section>
  );
}

/* ------------------------------ Texto e imagem ------------------------------ */

export function SplitSection({ section, doc, locale }: Props<"split">) {
  const bg = BACKGROUNDS[section.background];
  const imageLeft = section.imagePosition === "left";
  const dark = bg.tone === "dark";
  const badge = section.stats[0];
  return (
    <section id={section.anchor} aria-label={section.navLabel || plainText(section.title)} className={`${bg.className} relative overflow-clip py-28 sm:py-40`}>
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
        <div className="pr-scroll-reveal">
          <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
        </div>
        <Title text={section.title} className="pr-h2 max-w-[18ch]" />

        <div className="mt-16 grid items-start gap-16 lg:mt-24 lg:grid-cols-12 lg:gap-20">
          <div className={`pr-3d-swing relative lg:col-span-6 ${imageLeft ? "" : "lg:order-2"}`}>
            {section.image.url && (
              <div className="pr-scroll-clip relative aspect-[4/5] overflow-clip rounded-[2rem] [clip-path:polygon(0_0,100%_0,100%_86%,80%_100%,0_100%)]">
                <div className="pr-parallax absolute inset-0">
                  <CmsImage media={section.image} sizes="(min-width: 1024px) 50vw, 100vw" />
                </div>
              </div>
            )}
            {badge && (
              <div className={`absolute -bottom-8 ${imageLeft ? "right-4 sm:-right-8" : "left-4 sm:-left-10"}`}>
                <div className="flex size-32 rotate-[-8deg] flex-col items-center justify-center rounded-full bg-accent text-center text-on-accent shadow-2xl transition-transform duration-500 hover:rotate-[6deg] hover:scale-110 sm:size-40">
                  <span className="pr-heading text-4xl sm:text-5xl">
                    <CountUp value={badge.value} />
                  </span>
                  <span className="mt-1 max-w-[10ch] text-[0.6rem] font-bold uppercase leading-tight tracking-widest">
                    {badge.label.split(" ").slice(0, 2).join(" ")}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className={`pr-scroll-reveal lg:col-span-6 lg:pt-10 ${imageLeft ? "" : "lg:order-1"}`}>
            <RichText html={section.body} className={`text-xl leading-relaxed sm:text-2xl sm:leading-[1.55] ${dark ? "text-white/80" : "text-ink/75"}`} />
            {section.stats.length > 0 && (
              <dl className={`mt-14 grid grid-cols-2 gap-x-8 gap-y-10 border-t pt-10 ${dark ? "border-white/15" : "border-ink/15"}`}>
                {section.stats.map((stat, i) => (
                  <div key={i}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="pr-heading block text-6xl text-accent sm:text-7xl">
                        <CountUp value={stat.value} />
                      </span>
                      <span className={`mt-3 block max-w-[22ch] text-sm leading-snug ${dark ? "text-white/65" : "text-ink/60"}`}>{stat.label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="mt-12">
              <CmsButton link={resolveLink(section.button, doc, locale)} tone={bg.tone} magnetic />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Marcas --------------------------------- */

export function BrandsSection({ section, doc, m, locale }: Props<"brands">) {
  const bg = BACKGROUNDS[section.background];
  const brands = doc.brands.filter((b) => b.visible).map((b) => ({ ...b, description: sanitizeRichText(b.description) }));
  const dark = bg.tone === "dark";
  const store = doc.store.showInBrands ? storeLink(doc, locale) : null;
  const authorized = doc.brands.filter((b) => b.visible && b.authorized);
  return (
    <section id={section.anchor} aria-label={section.navLabel || plainText(section.title)} className={`${bg.className} pr-diagonal relative pb-28 sm:pb-40`}>
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <div className="pr-scroll-reveal">
              <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
            </div>
            <Title text={section.title} className="pr-h2" />
          </div>
          {section.intro && (
            <p className={`pr-scroll-reveal text-lg leading-relaxed lg:col-span-4 ${dark ? "text-white/70" : "text-ink/70"}`}>{section.intro}</p>
          )}
        </div>
        {authorized.length > 0 && (
          <div
            className={`pr-scroll-reveal mt-16 rounded-[2rem] border p-8 sm:mt-20 sm:p-12 ${dark ? "border-white/15" : "border-ink/15 bg-white"}`}
          >
            <div className="max-w-2xl">
              <p className="pr-eyebrow flex items-center gap-2 text-accent">
                <BadgeCheck className="size-4" aria-hidden /> {m.brands.authorized}
              </p>
              <p className="pr-heading pr-h3 mt-4 text-2xl sm:text-3xl">{m.brands.authorizedTitle}</p>
              <p className={`mt-3 max-w-md leading-relaxed ${dark ? "text-white/70" : "text-ink/70"}`}>{m.brands.authorizedText}</p>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {authorized.map((brand) => (
                <li
                  key={brand.id}
                  className={`flex min-h-36 flex-col items-center justify-center gap-4 rounded-[1.5rem] p-5 text-center sm:p-6 ${dark ? "bg-white/[0.06]" : "bg-surface"}`}
                >
                  {brand.logo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo.url} alt={brand.logo.alt || brand.name} loading="lazy" className={`h-12 w-auto max-w-full object-contain ${dark ? "pr-logo-white" : ""}`} />
                  ) : (
                    <span className="pr-heading text-3xl">{brand.name}</span>
                  )}
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] ${dark ? "text-white/70" : "text-ink/60"}`}>
                    <BadgeCheck className="size-4 shrink-0 text-accent" aria-hidden /> {brand.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <BrandShowcase brands={brands} layout={section.layout} tone={bg.tone} />
        {store && (
          <div
            className={`pr-3d-rise mt-16 flex flex-col gap-8 rounded-[2rem] p-8 sm:mt-24 sm:p-12 lg:flex-row lg:items-center lg:justify-between ${
              dark ? "bg-white/[0.06] text-white ring-1 ring-white/10" : "pr-tone-dark bg-dark text-white"
            }`}
          >
            <div className="flex items-start gap-5 sm:gap-7">
              <span className="pr-float-3d flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent sm:size-16" aria-hidden>
                <ShoppingBag className="size-7 sm:size-8" strokeWidth={1.6} />
              </span>
              <div>
                {doc.store.brandsTitle && <p className="pr-heading pr-h3 max-w-[26ch] text-2xl sm:text-3xl">{doc.store.brandsTitle}</p>}
                {doc.store.brandsText && <p className="mt-3 max-w-xl leading-relaxed text-white/70">{doc.store.brandsText}</p>}
              </div>
            </div>
            <div className="shrink-0">
              <CmsButton link={store} tone="dark" magnetic />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* --------------------------------- Galeria --------------------------------- */

const GALLERY_SHAPES = [
  "aspect-[3/4] w-[78vw] sm:w-[30rem]",
  "aspect-[4/5] w-[64vw] sm:w-[22rem] sm:mt-16",
  "aspect-square w-[70vw] sm:w-[26rem]",
  "aspect-[3/4] w-[64vw] sm:w-[22rem] sm:mt-24",
  "aspect-[5/4] w-[80vw] sm:w-[34rem]",
];

export function GallerySection({ section }: Props<"gallery">) {
  const bg = BACKGROUNDS[section.background];
  const items = section.items.filter((i) => i.image.url);
  const dark = bg.tone === "dark";
  return (
    <section id={section.anchor} aria-label={section.navLabel || plainText(section.title)} className={`${bg.className} overflow-clip py-28 sm:py-40`}>
      <div className="mx-auto mb-16 grid max-w-[90rem] gap-8 px-5 sm:px-8 lg:grid-cols-12 lg:items-end lg:px-12">
        <div className="lg:col-span-8">
          <div className="pr-scroll-reveal">
            <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
          </div>
          <Title text={section.title} className="pr-h2" />
        </div>
        {section.intro && <p className={`pr-scroll-reveal text-lg lg:col-span-4 ${dark ? "text-white/70" : "text-ink/70"}`}>{section.intro}</p>}
      </div>

      {section.layout === "mosaic" ? (
        <DragScroll tone={bg.tone}>
          {items.map((item, i) => (
            <figure key={i} className={`pr-3d-coverflow group relative shrink-0 snap-start overflow-hidden rounded-[2rem] ${GALLERY_SHAPES[i % GALLERY_SHAPES.length]}`}>
              <CmsImage
                media={item.image}
                sizes="(min-width: 640px) 34rem, 80vw"
                className="pointer-events-none object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {item.caption && (
                <figcaption className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-widest text-ink backdrop-blur transition-colors group-hover:bg-accent group-hover:text-on-accent">
                  <span className="tabular-nums opacity-50">{String(i + 1).padStart(2, "0")}</span>
                  {item.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </DragScroll>
      ) : (
        <div className="mx-auto grid max-w-[90rem] grid-cols-2 gap-4 px-5 sm:px-8 md:grid-cols-3 lg:px-12">
          {items.map((item, i) => (
            <figure key={i} className="pr-scroll-reveal group relative aspect-[4/3] overflow-hidden rounded-3xl">
              <CmsImage media={item.image} sizes="(min-width: 768px) 33vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />
              {item.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-sm text-white">{item.caption}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------- Banner ---------------------------------- */

export function BannerSection({ section, doc, locale }: Props<"banner">) {
  return (
    <section
      id={section.anchor}
      aria-label={section.navLabel || plainText(section.title)}
      className={`pr-tone-dark relative isolate flex items-end overflow-clip bg-dark text-white ${section.height === "tall" ? "min-h-[110svh]" : "min-h-[70svh]"}`}
    >
      <div className="absolute inset-0 -z-10 overflow-clip">
        <div className="pr-scroll-scale absolute inset-0">
          <CmsImage media={section.image} sizes="100vw" />
        </div>
        <div className="absolute inset-0" style={overlayStyle("dark", section.overlayOpacity)} />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-dark to-transparent" />
      </div>
      <div className="mx-auto w-full max-w-[90rem] px-5 py-28 sm:px-8 sm:py-40 lg:px-12">
        <div className="pr-scroll-reveal">
          <Eyebrow tone="dark">{section.eyebrow}</Eyebrow>
        </div>
        <Title text={section.title} className="pr-display max-w-[13ch]" />
        <div className="pr-scroll-reveal mt-10 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          {section.subtitle && <p className="max-w-xl text-lg leading-relaxed text-white/80 sm:text-xl">{section.subtitle}</p>}
          <CmsButton link={resolveLink(section.button, doc, locale)} tone="dark" magnetic />
        </div>
      </div>
    </section>
  );
}

export function VideoSection({ section, doc, locale }: Props<"video">) {
  return (
    <section
      id={section.anchor}
      aria-label={section.navLabel || plainText(section.title)}
      className="pr-tone-dark relative isolate flex min-h-[90svh] items-end overflow-clip bg-dark text-white"
    >
      <div className="absolute inset-0 -z-10">
        {section.videoUrl ? (
          <video className="size-full object-cover" src={section.videoUrl} poster={section.poster.url || undefined} autoPlay muted loop playsInline aria-hidden />
        ) : (
          <CmsImage media={section.poster} sizes="100vw" />
        )}
        <div className="absolute inset-0" style={overlayStyle("dark", section.overlayOpacity)} />
      </div>
      <div className="mx-auto w-full max-w-[90rem] px-5 py-28 sm:px-8 lg:px-12">
        <div className="pr-scroll-reveal">
          <Eyebrow tone="dark">{section.eyebrow}</Eyebrow>
        </div>
        <Title text={section.title} className="pr-display max-w-[13ch]" />
        {section.subtitle && <p className="pr-scroll-reveal mt-8 max-w-xl text-lg text-white/80">{section.subtitle}</p>}
        <div className="mt-10">
          <CmsButton link={resolveLink(section.button, doc, locale)} tone="dark" magnetic />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- Soluções ---------------------------------- */

export function FeaturesSection({ section }: Props<"features">) {
  const bg = BACKGROUNDS[section.background];
  const dark = bg.tone === "dark";
  const cols = { 2: "md:grid-cols-2", 3: "md:grid-cols-2 lg:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" }[section.columns];
  return (
    <section id={section.anchor} aria-label={section.navLabel || plainText(section.title)} className={`${bg.className} py-28 sm:py-40`}>
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <div className="pr-scroll-reveal">
              <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
            </div>
            <Title text={section.title} className="pr-h2" />
          </div>
          {section.intro && (
            <p className={`pr-scroll-reveal text-lg leading-relaxed lg:col-span-4 ${dark ? "text-white/70" : "text-ink/70"}`}>{section.intro}</p>
          )}
        </div>

        <ul className={`mt-20 grid gap-4 ${cols}`}>
          {section.items.map((item, i) => {
            const Icon = ICONS[item.icon] ?? Compass;
            const featured = i === 0;
            // O cartão em destaque ocupa duas linhas só quando isso não deixa buracos na grelha.
            const span = featured && section.columns >= 3 && (section.items.length + 1) % section.columns === 0;
            return (
              <li key={i} className={`pr-3d-rise group ${span ? "lg:row-span-2" : ""}`}>
                <Tilt
                  className={`flex h-full min-h-72 flex-col overflow-hidden rounded-[2rem] p-8 sm:p-10 ${
                    featured
                      ? "bg-accent text-on-accent"
                      : dark
                        ? "bg-white/[0.06] text-white"
                        : "bg-white text-ink shadow-[0_30px_60px_-40px_rgba(5,11,16,0.35)]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex size-16 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:rotate-[-12deg] group-hover:scale-110 ${
                        featured ? "bg-on-accent text-accent" : "bg-accent text-on-accent"
                      }`}
                    >
                      <Icon aria-hidden className="size-8" strokeWidth={1.6} />
                    </span>
                    <span className={`pr-heading text-5xl ${featured ? "text-on-accent/30" : dark ? "text-white/15" : "text-ink/10"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className={`pr-heading mt-auto pt-16 ${featured ? "text-3xl sm:text-4xl" : "pr-h3"}`}>{item.title}</h3>
                  {item.text && (
                    <p className={`mt-4 leading-relaxed ${featured ? "text-lg text-on-accent/90" : dark ? "text-white/65" : "text-ink/65"}`}>{item.text}</p>
                  )}
                  {item.logo.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.logo.url}
                      alt={item.logo.alt || item.title}
                      loading="lazy"
                      className={`mt-6 h-14 w-auto max-w-[220px] object-contain object-left ${featured || dark ? "pr-logo-white" : ""}`}
                    />
                  )}
                </Tilt>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------------- Chamada --------------------------------- */

export function CtaSection({ section, doc, locale }: Props<"cta">) {
  const bg = BACKGROUNDS[section.background];
  return (
    <section id={section.anchor} aria-label={section.navLabel || plainText(section.title)} className={`${bg.className} relative overflow-clip py-28 sm:py-36`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute -right-20 top-0 h-full w-1/2 opacity-10" aria-hidden>
        <path d="M0 0 L100 100 L100 0 Z" fill="currentColor" />
      </svg>
      <div className="relative mx-auto flex max-w-[90rem] flex-col gap-12 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-12">
        <div className="max-w-4xl">
          <Title text={section.title} className="pr-h2" />
          {section.text && <p className={`pr-scroll-reveal mt-8 max-w-2xl text-xl ${bg.tone === "dark" ? "text-white/80" : "text-ink/70"}`}>{section.text}</p>}
        </div>
        <div className="flex flex-wrap gap-4">
          <CmsButton link={resolveLink(section.primaryButton, doc, locale)} tone={bg.tone} magnetic />
          <CmsButton link={resolveLink(section.secondaryButton, doc, locale)} tone={bg.tone} magnetic />
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- Texto em movimento ----------------------------- */

const SPEED = { slow: "60s", normal: "38s", fast: "22s" } as const;

export function MarqueeSection({ section, doc }: Props<"marquee">) {
  const bg = BACKGROUNDS[section.background];
  const words = [...section.items, ...section.items, ...section.items];
  const styleFor = (i: number) => (section.style === "outline" ? "pr-outline" : section.style === "solid" ? "" : i % 2 === 1 ? "pr-outline" : "");
  return (
    <section id={section.anchor} aria-label={section.items.join(", ")} className="relative z-10 overflow-hidden py-10 sm:py-16">
      <div className={`${bg.className} ${section.tilted ? "-mx-4 rotate-[-2.5deg] shadow-2xl" : ""} py-6 sm:py-8`}>
        <div className="pr-marquee overflow-hidden">
          <ul
            className="pr-marquee-track flex w-max items-center gap-10 sm:gap-14"
            data-direction={section.direction}
            style={{ ["--pr-marquee-duration" as string]: SPEED[section.speed] }}
            aria-hidden
          >
            {[...words, ...words].map((word, i) => (
              <li key={i} className="flex items-center gap-10 whitespace-nowrap sm:gap-14">
                <span
                  className={`pr-heading text-5xl sm:text-7xl lg:text-8xl ${styleFor(i)}`}
                  style={{ ["--pr-outline-color" as string]: bg.tone === "dark" ? "#fff" : "var(--pr-text)" }}
                >
                  {word}
                </span>
                <LogoMark url={doc.navigation.logo.url} className="size-10 shrink-0 sm:size-14" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Contactos --------------------------------- */

export function ContactSection({ section, doc, m, preview }: Props<"contact"> & { preview?: boolean }) {
  const bg = BACKGROUNDS[section.background];
  return (
    <section id={section.anchor} aria-label={section.navLabel || plainText(section.title)} className={`${bg.className} relative overflow-clip py-28 sm:py-40`}>
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
        <div className="pr-scroll-reveal">
          <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
        </div>
        <Title text={section.title} className="pr-display max-w-[16ch]" />
        <div className="mt-20 grid gap-16 lg:grid-cols-12">
          <div className="pr-scroll-reveal lg:col-span-5">
            {section.intro && <p className={`text-xl leading-relaxed ${bg.tone === "dark" ? "text-white/75" : "text-ink/70"}`}>{section.intro}</p>}
            <ContactDetails contact={doc.contact} tone={bg.tone} m={m} />
          </div>
          {section.showForm && (
            <div className="pr-scroll-reveal lg:col-span-7">
              <ContactForm title={section.formTitle} successMessage={section.successMessage} tone={bg.tone} disabled={preview} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------- Experiências e reservas ------------------------- */

export function ServicesSection({ section, doc, m, preview }: Props<"services"> & { preview?: boolean }) {
  const bg = BACKGROUNDS[section.background];
  const dark = bg.tone === "dark";
  const services = visibleServices(doc, section.categoryIds).map((s) => ({
    ...s,
    description: sanitizeRichText(s.description),
    categoryLabel: doc.serviceCategories.find((c) => c.id === s.categoryId)?.label ?? "",
  }));
  return (
    <section id={section.anchor} aria-label={section.navLabel || plainText(section.title)} className={`${bg.className} relative overflow-clip py-28 sm:py-40`}>
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <div className="pr-scroll-reveal">
              <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
            </div>
            <Title text={section.title} className="pr-h2" />
          </div>
          {section.intro && (
            <p className={`pr-scroll-reveal text-lg leading-relaxed lg:col-span-4 ${dark ? "text-white/70" : "text-ink/70"}`}>{section.intro}</p>
          )}
        </div>
        {services.length > 0 ? (
          <ServicesExplorer
            services={services}
            categories={doc.serviceCategories}
            showFilters={section.showFilters}
            buttonLabel={section.buttonLabel}
            settings={doc.booking}
            whatsapp={doc.contact.whatsapp}
            tone={bg.tone}
            preview={preview}
          />
        ) : (
          <p className={`mt-16 text-lg ${dark ? "text-white/60" : "text-ink/60"}`}>{m.services.soon}</p>
        )}
        <ServicesNote text={section.note} tone={bg.tone} />
      </div>
    </section>
  );
}
