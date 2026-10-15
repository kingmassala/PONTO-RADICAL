"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Plus } from "lucide-react";
import type { Brand } from "@/lib/cms/schema";

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

function BrandLogo({ brand, className }: { brand: Brand; className?: string }) {
  if (brand.logo.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logo.url} alt={brand.logo.alt || brand.name} className={`h-10 w-auto max-w-[160px] object-contain ${className ?? ""}`} />;
  }
  return <span className={`pr-heading text-xl ${className ?? ""}`}>{brand.name}</span>;
}

function ExternalLink({ brand, dark }: { brand: Brand; dark: boolean }) {
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
      Site oficial {brand.name}
      <ArrowUpRight aria-hidden className="size-4 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
      <span className="sr-only">(abre numa nova janela)</span>
    </a>
  );
}

export function BrandShowcase({ brands, layout, tone }: { brands: Brand[]; layout: "editorial" | "grid"; tone: "light" | "dark" }) {
  const dark = tone === "dark";
  const [hovered, setHovered] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const listRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);

  if (brands.length === 0) return null;

  if (layout === "grid") {
    return (
      <ul className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <li key={brand.id} className={`group overflow-hidden rounded-[2rem] ${dark ? "bg-white/[0.06]" : "bg-white"}`}>
            <div className="relative aspect-[16/11] overflow-hidden">
              <BrandImage brand={brand} sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
            <div className="p-8">
              <BrandLogo brand={brand} />
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

  return (
    <div ref={listRef} className="relative mt-20" onPointerMove={onMove} onPointerLeave={() => setHovered(null)}>
      <div
        ref={floatRef}
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 z-20 hidden aspect-[4/5] w-72 overflow-hidden rounded-[1.5rem] shadow-2xl transition-[opacity,scale] duration-300 lg:block xl:w-80 ${
          hovered !== null && hovered !== open ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        {brands.map((brand, i) => (
          <div key={brand.id} className={`absolute inset-0 transition-opacity duration-300 ${hovered === i ? "opacity-100" : "opacity-0"}`}>
            <BrandImage brand={brand} sizes="320px" />
          </div>
        ))}
      </div>

      <ul className={`border-t ${dark ? "border-white/15" : "border-ink/15"}`}>
        {brands.map((brand, i) => {
          const expanded = open === i;
          return (
            <li key={brand.id} className={`border-b ${dark ? "border-white/15" : "border-ink/15"}`}>
              <h3>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`brand-panel-${brand.id}`}
                  data-cursor={expanded ? "Fechar" : "Abrir"}
                  onClick={() => setOpen(expanded ? null : i)}
                  onPointerEnter={() => setHovered(i)}
                  className="group flex w-full items-center gap-5 py-7 text-left sm:gap-8 sm:py-9"
                >
                  <span className={`w-8 shrink-0 text-sm tabular-nums ${dark ? "text-white/40" : "text-ink/40"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span
                    className={`pr-heading flex-1 text-[clamp(2rem,6.5vw,6.5rem)] leading-none transition-all duration-500 ${
                      expanded ? "text-accent" : hovered === i ? "translate-x-3 text-accent" : dark ? "text-white" : "text-ink"
                    }`}
                  >
                    {brand.name}
                  </span>
                  <span className={`hidden max-w-[18ch] text-right text-sm md:block ${dark ? "text-white/55" : "text-ink/55"}`}>{brand.specialisation}</span>
                  <span
                    className={`flex size-12 shrink-0 items-center justify-center rounded-full border transition-all duration-500 sm:size-14 ${
                      expanded ? "rotate-45 border-accent bg-accent text-white" : dark ? "border-white/25 group-hover:border-accent" : "border-ink/20 group-hover:border-accent"
                    }`}
                    aria-hidden
                  >
                    <Plus className="size-5" />
                  </span>
                </button>
              </h3>
              <div
                id={`brand-panel-${brand.id}`}
                role="region"
                aria-label={brand.name}
                className={`grid transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.2,0.75,0.15,1)] ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  <div className="grid gap-8 pb-12 pl-0 sm:pl-16 lg:grid-cols-12 lg:gap-12">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] lg:col-span-7">
                      <BrandImage brand={brand} sizes="(min-width: 1024px) 55vw, 100vw" />
                      <div className="absolute bottom-4 left-4 rounded-full bg-dark/80 px-5 py-2.5 text-white backdrop-blur">
                        <BrandLogo brand={brand} className="h-7 text-base" />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center lg:col-span-5">
                      {brand.specialisation && <p className="pr-eyebrow text-accent">{brand.specialisation}</p>}
                      <div
                        className={`pr-rich mt-5 text-xl leading-relaxed ${dark ? "text-white/80" : "text-ink/75"}`}
                        dangerouslySetInnerHTML={{ __html: brand.description }}
                      />
                      <div>
                        <ExternalLink brand={brand} dark={dark} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
