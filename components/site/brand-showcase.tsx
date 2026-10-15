"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { Brand } from "@/lib/cms/schema";

function BrandLogo({ brand, className }: { brand: Brand; className?: string }) {
  if (brand.logo.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logo.url} alt={brand.logo.alt || brand.name} className={`h-10 w-auto max-w-[160px] object-contain ${className ?? ""}`} />;
  }
  return <span className={`pr-heading text-2xl ${className ?? ""}`}>{brand.name}</span>;
}

function BrandImage({ brand }: { brand: Brand }) {
  if (!brand.heroImage.url) return <div className="absolute inset-0 bg-primary" />;
  const svg = brand.heroImage.url.toLowerCase().split("?")[0].endsWith(".svg");
  return (
    <Image
      src={brand.heroImage.url}
      alt={brand.heroImage.alt}
      fill
      sizes="(min-width: 1024px) 55vw, 100vw"
      unoptimized={svg || !/^(\/|https:\/\/images\.unsplash\.com\/|https:\/\/[^/]+\.supabase\.co\/)/.test(brand.heroImage.url)}
      className="object-cover"
    />
  );
}

function ExternalLink({ brand, dark }: { brand: Brand; dark: boolean }) {
  if (!brand.externalUrl) return null;
  return (
    <a
      href={brand.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest ${
        dark ? "text-white" : "text-ink"
      } underline-offset-8 hover:underline`}
    >
      Site oficial {brand.name}
      <ArrowUpRight aria-hidden className="size-4" />
      <span className="sr-only">(abre numa nova janela)</span>
    </a>
  );
}

export function BrandShowcase({
  brands,
  layout,
  tone,
}: {
  brands: Brand[];
  layout: "editorial" | "grid";
  tone: "light" | "dark";
}) {
  const [active, setActive] = useState(0);
  const dark = tone === "dark";
  if (brands.length === 0) return null;

  if (layout === "grid") {
    return (
      <ul className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <li key={brand.id} className={`overflow-hidden ${dark ? "bg-white/5" : "bg-white"}`}>
            <div className="relative aspect-[16/10]">
              <BrandImage brand={brand} />
            </div>
            <div className="p-8">
              <BrandLogo brand={brand} />
              {brand.specialisation && (
                <p className={`pr-eyebrow mt-4 ${dark ? "text-white/60" : "text-secondary"}`}>{brand.specialisation}</p>
              )}
              <div
                className={`pr-rich mt-4 leading-relaxed ${dark ? "text-white/75" : "text-ink/70"}`}
                dangerouslySetInnerHTML={{ __html: brand.description }}
              />
              <ExternalLink brand={brand} dark={dark} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const current = brands[Math.min(active, brands.length - 1)];
  return (
    <div className="mt-16 grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-5">
        <ul role="tablist" aria-label="Marcas" className={`border-t ${dark ? "border-white/15" : "border-ink/10"}`}>
          {brands.map((brand, i) => {
            const selected = i === active;
            return (
              <li key={brand.id} className={`border-b ${dark ? "border-white/15" : "border-ink/10"}`}>
                <button
                  type="button"
                  role="tab"
                  id={`brand-tab-${brand.id}`}
                  aria-selected={selected}
                  aria-controls="brand-panel"
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  className="group flex w-full items-center justify-between gap-4 py-6 text-left"
                >
                  <span className="flex items-baseline gap-5">
                    <span className={`text-xs tabular-nums ${dark ? "text-white/40" : "text-ink/40"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`pr-heading text-3xl transition sm:text-4xl ${
                        selected ? "text-accent" : dark ? "text-white/60 group-hover:text-white" : "text-ink/50 group-hover:text-ink"
                      }`}
                    >
                      {brand.name}
                    </span>
                  </span>
                  <span aria-hidden className={`h-px transition-all ${selected ? "w-12 bg-accent" : "w-0"}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div id="brand-panel" role="tabpanel" aria-labelledby={`brand-tab-${current.id}`} className="lg:col-span-7">
        <div key={current.id} className="pr-reveal">
          <div className="relative aspect-[16/11] overflow-hidden">
            <BrandImage brand={current} />
            <div className="absolute bottom-0 left-0 bg-dark/85 px-6 py-4 text-white backdrop-blur">
              <BrandLogo brand={current} />
            </div>
          </div>
          {current.specialisation && (
            <p className={`pr-eyebrow mt-8 ${dark ? "text-white/60" : "text-secondary"}`}>{current.specialisation}</p>
          )}
          <div
            className={`pr-rich mt-4 max-w-2xl text-lg leading-relaxed ${dark ? "text-white/80" : "text-ink/75"}`}
            dangerouslySetInnerHTML={{ __html: current.description }}
          />
          <ExternalLink brand={current} dark={dark} />
        </div>
      </div>
    </div>
  );
}
