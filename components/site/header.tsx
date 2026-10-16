"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import type { ResolvedLink } from "./links";

type Props = {
  logoText: string;
  logoUrl: string;
  logoAlt: string;
  items: { href: string; label: string }[];
  cta: ResolvedLink | null;
  store: ResolvedLink | null;
  headerStyle: "transparent" | "solid";
  topOffset?: number;
};

const newTabProps = (l: ResolvedLink) => (l.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {});

/** Texto que «rola» para cima ao passar o rato. */
function RollText({ children }: { children: string }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <span className="transition-transform duration-500 ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:-translate-y-full">{children}</span>
      <span aria-hidden className="absolute left-0 top-full text-accent transition-transform duration-500 ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:-translate-y-full">
        {children}
      </span>
    </span>
  );
}

export function SiteHeader({ logoText, logoUrl, logoAlt, items, cta, store, headerStyle, topOffset = 0 }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const compact = headerStyle === "solid" || scrolled;

  return (
    <header style={{ top: topOffset }} className="fixed inset-x-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={`mx-auto flex items-center justify-between gap-6 rounded-full text-white transition-all duration-500 ease-[cubic-bezier(0.2,0.75,0.15,1)] ${
          compact || open
            ? "max-w-6xl border border-white/10 bg-dark/75 py-2 pl-3 pr-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            : "max-w-[90rem] border border-transparent py-3 pl-2 pr-1 sm:px-4"
        }`}
      >
        <a href="#top" className="group flex items-center gap-3" aria-label={`${logoText || "Início"} — voltar ao início`}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={logoText ? "" : logoAlt}
              className={`w-auto object-contain transition-all duration-500 group-hover:rotate-[-12deg] ${compact ? "h-9" : "h-11"}`}
            />
          )}
          {logoText && <span className="pr-heading text-sm tracking-[0.08em] uppercase sm:text-base">{logoText}</span>}
        </a>

        <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <a key={item.href} href={item.href} className="group rounded-full px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10">
              <RollText>{item.label}</RollText>
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {store && (
            <a href={store.href} {...newTabProps(store)} title={store.label} className="group inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/25 px-3.5 py-2.5 text-sm font-semibold hover:border-white xl:px-5">
              <ShoppingBag aria-hidden className="size-4" />
              {/* Entre lg e xl o menu fica apertado: só o ícone (o texto continua acessível). */}
              <span className="sr-only xl:not-sr-only">
                <RollText>{store.label}</RollText>
              </span>
            </a>
          )}
          {cta && (
            <a href={cta.href} {...newTabProps(cta)} className="group inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white">
              <RollText>{cta.label}</RollText>
              <span className="flex size-6 items-center justify-center rounded-full bg-white text-accent transition-transform duration-500 group-hover:rotate-45">
                <ArrowUpRight className="size-3.5" aria-hidden />
              </span>
            </a>
          )}
        </div>

        <button
          type="button"
          className="relative flex size-12 items-center justify-center rounded-full bg-accent text-white lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden className={`absolute h-0.5 w-5 bg-current transition-transform duration-300 ${open ? "rotate-45" : "-translate-y-1"}`} />
          <span aria-hidden className={`absolute h-0.5 w-5 bg-current transition-transform duration-300 ${open ? "-rotate-45" : "translate-y-1"}`} />
        </button>
      </div>

      <div
        id="mobile-menu"
        aria-hidden={!open}
        className={`fixed inset-0 -z-10 flex flex-col justify-between bg-dark px-6 pb-10 pt-28 text-white transition-[clip-path] duration-700 ease-[cubic-bezier(0.7,0,0.2,1)] lg:hidden ${
          open ? "[clip-path:circle(150%_at_calc(100%-2.5rem)_2.5rem)]" : "pointer-events-none [clip-path:circle(0%_at_calc(100%-2.5rem)_2.5rem)]"
        }`}
      >
        <nav aria-label="Navegação móvel" className="flex flex-col">
          {items.map((item, i) => (
            <a
              key={item.href}
              href={item.href}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              style={{ transitionDelay: open ? `${150 + i * 60}ms` : "0ms" }}
              className={`pr-heading flex items-baseline gap-4 border-b border-white/10 py-4 text-[clamp(2.2rem,10vw,3.5rem)] transition-all duration-500 ${
                open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
            >
              <span className="text-xs font-normal text-accent">{String(i + 1).padStart(2, "0")}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex flex-col gap-3">
          {store && (
            <a href={store.href} {...newTabProps(store)} tabIndex={open ? 0 : -1} className="pr-btn pr-btn-secondary text-white">
              <ShoppingBag aria-hidden className="size-4" />
              {store.label}
            </a>
          )}
          {cta && (
            <a href={cta.href} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} className="pr-btn pr-btn-primary">
              {cta.label}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
