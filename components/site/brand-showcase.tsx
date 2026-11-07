"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { Brand } from "@/lib/cms/schema";
import { useMessages } from "./i18n";

const OPTIMIZABLE = /^(\/|https:\/\/images\.unsplash\.com\/|https:\/\/[^/]+\.supabase\.co\/)/;

function BrandImage({ brand, sizes, className }: { brand: Brand; sizes: string; className?: string }) {
  if (!brand.heroImage.url) return <div className="absolute inset-0 bg-primary" />;
  const svg = brand.heroImage.url.toLowerCase().split("?")[0].endsWith(".svg");
  return (
    <Image
      src={brand.heroImage.url}
      alt={brand.heroImage.alt}
      fill
      sizes={sizes}
      unoptimized={svg || !OPTIMIZABLE.test(brand.heroImage.url)}
      className={className ?? "object-cover"}
    />
  );
}

/** Logótipo numa só cor (branco sobre fundo escuro, preto sobre fundo claro), para ficarem uniformes. */
function BrandLogo({ brand, className, onDark }: { brand: Brand; className?: string; onDark: boolean }) {
  if (brand.logo.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logo.url}
        alt={brand.logo.alt || brand.name}
        className={`h-10 w-auto max-w-[160px] object-contain ${onDark ? "pr-logo-white" : "pr-logo-black"} ${className ?? ""}`}
      />
    );
  }
  return <span className={`pr-heading text-xl ${className ?? ""}`}>{brand.name}</span>;
}

function ExternalLink({ brand, dark }: { brand: Brand; dark: boolean }) {
  const m = useMessages();
  if (!brand.externalUrl) return null;
  return (
    <a
      href={brand.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group/link mt-8 inline-flex items-center gap-2 border-b pb-1 text-xs font-bold uppercase tracking-[0.2em] ${
        dark ? "border-white/40 text-white" : "border-ink/40 text-ink"
      } hover:border-accent hover:text-accent`}
    >
      {m.brands.officialSite} {brand.name}
      <ArrowUpRight aria-hidden className="size-4 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
      <span className="sr-only">{m.common.newTab}</span>
    </a>
  );
}

export function BrandShowcase({ brands, layout, tone }: { brands: Brand[]; layout: "editorial" | "grid"; tone: "light" | "dark" }) {
  const dark = tone === "dark";
  const t = useMessages().common;
  const [hovered, setHovered] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const listRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);

  if (brands.length === 0) return null;

  if (layout === "grid") {
    return (
      <ul className="mt-10 grid gap-5 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <li key={brand.id} className={`group overflow-hidden rounded-[2rem] ${dark ? "bg-white/[0.06]" : "bg-white"}`}>
            <div className="relative aspect-[16/11] overflow-hidden">
              <BrandImage brand={brand} sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
            <div className="p-8">
              <BrandLogo brand={brand} onDark={dark} />
              {brand.specialisation && <p className="pr-eyebrow mt-4 text-accent">{brand.specialisation}</p>}
              <div className={`pr-rich mt-4 leading-relaxed ${dark ? "text-white/70" : "text-ink/70"}`} dangerouslySetInnerHTML={{ __html: brand.description }} />
              <ExternalLink brand={brand} dark={dark} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  // Imagem flutuante que segue o cursor (apenas com rato).
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !listRef.current || !floatRef.current) return;
    const r = listRef.current.getBoundingClientRect();
    floatRef.current.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0) translate(-50%, -50%) rotate(${
      (e.movementX || 0) * 0.4
    }deg)`;
  };

  const active = open ?? 0;
  const current = brands[Math.min(active, brands.length - 1)];

  // Versão compacta: as marcas em etiquetas (várias por linha) e um único painel com a marca escolhida.
  return (
    <div ref={listRef} className="relative mt-10 sm:mt-16" onPointerMove={onMove} onPointerLeave={() => setHovered(null)}>
      <div
        ref={floatRef}
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 z-20 hidden aspect-[4/5] w-56 overflow-hidden rounded-[1.25rem] shadow-2xl transition-[opacity,scale] duration-300 lg:block xl:w-64 ${
          hovered !== null && hovered !== active ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        {brands.map((brand, i) => (
          <div key={brand.id} className={`absolute inset-0 transition-opacity duration-300 ${hovered === i ? "opacity-100" : "opacity-0"}`}>
            <BrandImage brand={brand} sizes="256px" />
          </div>
        ))}
      </div>

      <ul role="tablist" aria-orientation="horizontal" className="pr-brand-chips flex flex-wrap gap-2 sm:gap-3">
        {brands.map((brand, i) => {
          const selected = active === i;
          return (
            <li key={brand.id} role="presentation" style={{ ["--i" as string]: i }}>
              <button
                type="button"
                role="tab"
                id={`brand-tab-${brand.id}`}
                aria-selected={selected}
                aria-controls="brand-panel"
                data-cursor={t.open}
                onClick={() => setOpen(i)}
                onPointerEnter={() => setHovered(i)}
                onFocus={() => setHovered(null)}
                className={`group inline-flex items-baseline gap-2 rounded-full border px-4 py-2 transition-all duration-300 sm:px-5 sm:py-2.5 ${
                  selected
                    ? "border-accent bg-accent text-on-accent"
                    : dark
                      ? "border-white/20 text-white hover:-translate-y-0.5 hover:border-accent hover:text-accent"
                      : "border-ink/15 bg-white text-ink hover:-translate-y-0.5 hover:border-accent hover:text-accent"
                }`}
              >
                <span className={`text-[0.6rem] tabular-nums ${selected ? "text-on-accent/70" : dark ? "text-white/40" : "text-ink/40"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="pr-heading text-[clamp(0.95rem,1.6vw,1.35rem)] leading-tight">{brand.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {current && (
        <div
          id="brand-panel"
          role="tabpanel"
          aria-labelledby={`brand-tab-${current.id}`}
          className={`mt-8 overflow-hidden rounded-[1.75rem] sm:mt-10 ${dark ? "bg-white/[0.05] ring-1 ring-white/10" : "bg-white ring-1 ring-ink/10"}`}
        >
          <div key={current.id} className="pr-brand-panel grid lg:grid-cols-12">
            <div className="relative aspect-[16/9] overflow-hidden lg:col-span-7 lg:aspect-auto lg:min-h-[22rem]">
              <BrandImage brand={current} sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover transition-transform duration-[1.2s] hover:scale-105" />
              <div className="absolute bottom-4 left-4 hidden rounded-full bg-dark/80 px-5 py-2.5 text-white backdrop-blur sm:block">
                <BrandLogo brand={current} onDark className="h-7 text-base" />
              </div>
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10 lg:col-span-5">
              <p className={`text-sm tabular-nums ${dark ? "text-white/40" : "text-ink/40"}`}>
                {String(active + 1).padStart(2, "0")} / {String(brands.length).padStart(2, "0")}
              </p>
              <h3 className={`pr-heading mt-2 text-[clamp(1.8rem,3.6vw,3rem)] leading-none ${dark ? "text-white" : "text-ink"}`}>{current.name}</h3>
              {current.specialisation && <p className="pr-eyebrow mt-4 text-accent">{current.specialisation}</p>}
              <div
                className={`pr-rich mt-4 leading-relaxed ${dark ? "text-white/75" : "text-ink/70"}`}
                dangerouslySetInnerHTML={{ __html: current.description }}
              />
              <div>
                <ExternalLink brand={current} dark={dark} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
