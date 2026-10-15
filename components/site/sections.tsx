import {
  Anchor,
  Compass,
  LifeBuoy,
  Map,
  Radar,
  Shield,
  Ship,
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
import { resolveLink, storeLink } from "./links";
import { BACKGROUNDS, CmsButton, CmsImage, Eyebrow, RichText } from "./primitives";
import { BrandShowcase } from "./brand-showcase";
import { ContactForm } from "./contact-form";
import { ContactDetails } from "./contact-details";

type Props<T extends SectionType> = { section: SectionOf<T>; doc: SiteDocument };

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

const overlayStyle = (color: "dark" | "primary", opacity: number) => ({
  background: `linear-gradient(90deg, color-mix(in srgb, var(${
    color === "primary" ? "--pr-primary" : "--pr-dark"
  }) ${Math.min(100, opacity + 25)}%, transparent) 0%, color-mix(in srgb, var(${
    color === "primary" ? "--pr-primary" : "--pr-dark"
  }) ${opacity}%, transparent) 100%)`,
});

export function HeroSection({ section, doc }: Props<"hero">) {
  const store = doc.store.showInHero ? storeLink(doc) : null;
  const centered = section.align === "center";
  const brandNames = doc.brands.filter((b) => b.visible).map((b) => b.name);
  return (
    <section
      id={section.anchor}
      aria-label={section.navLabel || section.title}
      className={`relative isolate flex overflow-hidden bg-dark text-white ${
        section.height === "full" ? "min-h-[100svh]" : "min-h-[78svh]"
      }`}
    >
      <div className="absolute inset-0 -z-10">
        {section.mediaKind === "video" && section.videoUrl ? (
          <video
            className="size-full object-cover"
            src={section.videoUrl}
            poster={section.image.url || undefined}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
          />
        ) : (
          <CmsImage media={section.image} sizes="100vw" priority />
        )}
        <div className="absolute inset-0" style={overlayStyle(section.overlayColor, section.overlayOpacity)} />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div
        className={`mx-auto flex w-full max-w-7xl flex-col justify-end px-5 pt-36 sm:px-8 ${
          section.showBrandStrip ? "pb-36 sm:pb-40" : "pb-20 sm:pb-28"
        } ${
          centered ? "items-center text-center" : ""
        }`}
      >
        <div className={`pr-reveal max-w-4xl ${centered ? "mx-auto" : ""}`}>
          {section.eyebrow && (
            <p className={`pr-eyebrow mb-6 flex items-center gap-3 text-white/80 ${centered ? "justify-center" : ""}`}>
              <span aria-hidden className="h-px w-10 bg-accent" />
              {section.eyebrow}
            </p>
          )}
          <h1 className="pr-heading pr-display drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)]">{section.title}</h1>
          {section.subtitle && (
            <p className={`mt-7 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl ${centered ? "mx-auto" : ""}`}>
              {section.subtitle}
            </p>
          )}
          <div className={`mt-10 flex flex-wrap gap-4 ${centered ? "justify-center" : ""}`}>
            <CmsButton link={resolveLink(section.primaryButton, doc)} tone="dark" />
            <CmsButton link={resolveLink(section.secondaryButton, doc)} tone="dark" />
            <CmsButton link={store} tone="dark" />
          </div>
        </div>
      </div>

      {section.showBrandStrip && brandNames.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 border-t border-white/15 bg-black/25 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-8 overflow-hidden px-5 py-5 sm:px-8">
            <p className="pr-eyebrow hidden shrink-0 text-white/55 md:block">Marcas representadas</p>
            <div className="pr-marquee relative flex-1 overflow-hidden" aria-label={`Marcas representadas: ${brandNames.join(", ")}`}>
              <ul className="pr-marquee-track flex w-max items-center gap-12" aria-hidden>
                {[...brandNames, ...brandNames].map((name, i) => (
                  <li key={i} className="pr-heading whitespace-nowrap text-xl tracking-[0.14em] text-white/85 sm:text-2xl">
                    {name}
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

export function SplitSection({ section, doc }: Props<"split">) {
  const bg = BACKGROUNDS[section.background];
  const imageLeft = section.imagePosition === "left";
  return (
    <section id={section.anchor} aria-label={section.navLabel || section.title} className={`${bg.className} py-24 sm:py-32`}>
      <div className="pr-scroll-reveal mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-12 lg:gap-20">
        <div className={`lg:col-span-6 ${imageLeft ? "lg:order-2" : ""}`}>
          <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
          <h2 className="pr-heading pr-h2">{section.title}</h2>
          <RichText
            html={section.body}
            className={`mt-8 text-lg leading-relaxed ${bg.tone === "dark" ? "text-white/80" : "text-ink/75"}`}
          />
          {section.stats.length > 0 && (
            <dl className={`mt-12 grid grid-cols-2 gap-8 border-t pt-10 ${bg.tone === "dark" ? "border-white/15" : "border-ink/10"}`}>
              {section.stats.map((stat, i) => (
                <div key={i}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="pr-heading block text-5xl text-accent">{stat.value}</span>
                    <span className={`mt-2 block text-sm ${bg.tone === "dark" ? "text-white/70" : "text-ink/65"}`}>{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-10">
            <CmsButton link={resolveLink(section.button, doc)} tone={bg.tone} />
          </div>
        </div>
        <div className={`lg:col-span-6 ${imageLeft ? "lg:order-1" : ""}`}>
          {section.image.url && (
            <div className="group relative aspect-[4/5] overflow-hidden rounded-sm shadow-[0_40px_80px_-40px_rgba(0,0,0,0.45)] sm:aspect-[5/6]">
              <CmsImage
                media={section.image}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-105"
              />
              <div aria-hidden className="absolute -bottom-px left-0 h-2 w-1/3 bg-accent" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function BrandsSection({ section, doc }: Props<"brands">) {
  const bg = BACKGROUNDS[section.background];
  const brands = doc.brands
    .filter((b) => b.visible)
    .map((b) => ({ ...b, description: sanitizeRichText(b.description) }));
  return (
    <section id={section.anchor} aria-label={section.navLabel || section.title} className={`${bg.className} py-24 sm:py-32`}>
      <div className="pr-scroll-reveal mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
            <h2 className="pr-heading pr-h2">{section.title}</h2>
          </div>
          {section.intro && (
            <p className={`self-end text-lg leading-relaxed lg:col-span-5 ${bg.tone === "dark" ? "text-white/75" : "text-ink/70"}`}>
              {section.intro}
            </p>
          )}
        </div>
        <BrandShowcase brands={brands} layout={section.layout} tone={bg.tone} />
      </div>
    </section>
  );
}

export function GallerySection({ section }: Props<"gallery">) {
  const bg = BACKGROUNDS[section.background];
  const items = section.items.filter((i) => i.image.url);
  return (
    <section id={section.anchor} aria-label={section.navLabel || section.title} className={`${bg.className} py-24 sm:py-32`}>
      <div className="pr-scroll-reveal mx-auto max-w-7xl px-5 sm:px-8">
        <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
        <h2 className="pr-heading pr-h2 max-w-3xl">{section.title}</h2>
        {section.intro && (
          <p className={`mt-6 max-w-2xl text-lg ${bg.tone === "dark" ? "text-white/75" : "text-ink/70"}`}>{section.intro}</p>
        )}
        <div
          className={`mt-14 grid gap-4 ${
            section.layout === "mosaic" ? "grid-cols-2 md:grid-cols-4 md:auto-rows-[220px]" : "grid-cols-2 md:grid-cols-3"
          }`}
        >
          {items.map((item, i) => {
            const big = section.layout === "mosaic" && i % 5 === 0;
            return (
              <figure
                key={i}
                className={`group relative overflow-hidden ${
                  section.layout === "mosaic" ? (big ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square md:aspect-auto") : "aspect-[4/3]"
                }`}
              >
                <CmsImage
                  media={item.image}
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                {item.caption && (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-sm text-white">
                    {item.caption}
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function BannerSection({ section, doc }: Props<"banner">) {
  return (
    <section
      id={section.anchor}
      aria-label={section.navLabel || section.title}
      className={`relative isolate flex items-end overflow-hidden bg-dark text-white ${
        section.height === "tall" ? "min-h-[90svh]" : "min-h-[60svh]"
      }`}
    >
      <div className="absolute inset-0 -z-10">
        <CmsImage media={section.image} sizes="100vw" />
        <div className="absolute inset-0" style={overlayStyle("dark", section.overlayOpacity)} />
      </div>
      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="max-w-3xl">
          <Eyebrow tone="dark">{section.eyebrow}</Eyebrow>
          <h2 className="pr-heading pr-display">{section.title}</h2>
          {section.subtitle && <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">{section.subtitle}</p>}
          <div className="mt-10">
            <CmsButton link={resolveLink(section.button, doc)} tone="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function VideoSection({ section, doc }: Props<"video">) {
  return (
    <section
      id={section.anchor}
      aria-label={section.navLabel || section.title}
      className="relative isolate flex min-h-[80svh] items-center overflow-hidden bg-dark text-white"
    >
      <div className="absolute inset-0 -z-10">
        {section.videoUrl ? (
          <video
            className="size-full object-cover"
            src={section.videoUrl}
            poster={section.poster.url || undefined}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
          />
        ) : (
          <CmsImage media={section.poster} sizes="100vw" />
        )}
        <div className="absolute inset-0" style={overlayStyle("dark", section.overlayOpacity)} />
      </div>
      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:px-8">
        <div className="max-w-3xl">
          <Eyebrow tone="dark">{section.eyebrow}</Eyebrow>
          <h2 className="pr-heading pr-display">{section.title}</h2>
          {section.subtitle && <p className="mt-7 max-w-2xl text-lg text-white/85">{section.subtitle}</p>}
          <div className="mt-10">
            <CmsButton link={resolveLink(section.button, doc)} tone="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}

const COLUMN_CLASSES = { 2: "md:grid-cols-2", 3: "md:grid-cols-2 lg:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" } as const;

export function FeaturesSection({ section }: Props<"features">) {
  const bg = BACKGROUNDS[section.background];
  const dark = bg.tone === "dark";
  return (
    <section id={section.anchor} aria-label={section.navLabel || section.title} className={`${bg.className} py-24 sm:py-32`}>
      <div className="pr-scroll-reveal mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
            <h2 className="pr-heading pr-h2">{section.title}</h2>
          </div>
          {section.intro && (
            <p className={`self-end text-lg leading-relaxed lg:col-span-5 ${dark ? "text-white/75" : "text-ink/70"}`}>{section.intro}</p>
          )}
        </div>
        <ul className={`mt-16 grid gap-px ${dark ? "bg-white/10" : "bg-ink/10"} ${COLUMN_CLASSES[section.columns]}`}>
          {section.items.map((item, i) => {
            const Icon = ICONS[item.icon] ?? Compass;
            return (
              <li key={i} className={`${bg.className} group relative p-8 transition-colors duration-300 sm:p-10 ${dark ? "hover:bg-white/5" : "hover:bg-white"}`}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-500 group-hover:scale-x-100" />
                <div className="flex items-center justify-between">
                  <span className="flex size-14 items-center justify-center rounded-full bg-accent/10 transition-colors duration-300 group-hover:bg-accent">
                    <Icon aria-hidden className="size-7 text-accent transition-colors duration-300 group-hover:text-white" strokeWidth={1.5} />
                  </span>
                  <span className={`text-sm tabular-nums ${dark ? "text-white/40" : "text-ink/35"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="pr-heading pr-h3 mt-10">{item.title}</h3>
                {item.text && <p className={`mt-4 leading-relaxed ${dark ? "text-white/70" : "text-ink/70"}`}>{item.text}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function CtaSection({ section, doc }: Props<"cta">) {
  const bg = BACKGROUNDS[section.background];
  return (
    <section id={section.anchor} aria-label={section.navLabel || section.title} className={`${bg.className} py-24 sm:py-28`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="pr-heading pr-h2">{section.title}</h2>
          {section.text && <p className={`mt-6 text-lg ${bg.tone === "dark" ? "text-white/80" : "text-ink/70"}`}>{section.text}</p>}
        </div>
        <div className="flex flex-wrap gap-4">
          <CmsButton link={resolveLink(section.primaryButton, doc)} tone={bg.tone} />
          <CmsButton link={resolveLink(section.secondaryButton, doc)} tone={bg.tone} />
        </div>
      </div>
    </section>
  );
}

export function ContactSection({ section, doc, preview }: Props<"contact"> & { preview?: boolean }) {
  const bg = BACKGROUNDS[section.background];
  return (
    <section id={section.anchor} aria-label={section.navLabel || section.title} className={`${bg.className} py-24 sm:py-32`}>
      <div className="pr-scroll-reveal mx-auto grid max-w-7xl gap-16 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
          <h2 className="pr-heading pr-h2">{section.title}</h2>
          {section.intro && (
            <p className={`mt-6 text-lg leading-relaxed ${bg.tone === "dark" ? "text-white/75" : "text-ink/70"}`}>{section.intro}</p>
          )}
          <ContactDetails contact={doc.contact} tone={bg.tone} />
        </div>
        {section.showForm && (
          <div className="lg:col-span-7">
            <ContactForm
              title={section.formTitle}
              successMessage={section.successMessage}
              tone={bg.tone}
              disabled={preview}
            />
          </div>
        )}
      </div>
    </section>
  );
}
