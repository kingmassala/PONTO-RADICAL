"use client";

import { useEffect, useState } from "react";
import { Menu, ShoppingBag, X } from "lucide-react";
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

export function SiteHeader({ logoText, logoUrl, logoAlt, items, cta, store, headerStyle, topOffset = 0 }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
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

  const solid = headerStyle === "solid" || scrolled || open;

  return (
    <header
      style={{ top: topOffset }}
      className={`fixed inset-x-0 z-40 transition-colors duration-300 ${
        solid ? "bg-dark/95 text-white shadow-lg shadow-black/10 backdrop-blur" : "bg-transparent text-white"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label={`${logoText} — voltar ao início`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={logoAlt || logoText} className="h-9 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="pr-heading text-2xl tracking-wide">{logoText}</span>
          )}
        </a>

        <nav aria-label="Navegação principal" className="hidden items-center gap-8 lg:flex">
          {items.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-medium tracking-wide text-white/85 transition hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {store && (
            <a
              href={store.href}
              {...(store.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="pr-btn pr-btn-secondary min-h-10 px-5 py-2 text-white"
            >
              <ShoppingBag aria-hidden className="size-4" />
              {store.label}
            </a>
          )}
          {cta && (
            <a
              href={cta.href}
              {...(cta.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="pr-btn pr-btn-primary min-h-10 px-5 py-2"
            >
              {cta.label}
            </a>
          )}
        </div>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/30 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="h-[calc(100dvh-5rem)] overflow-y-auto border-t border-white/10 bg-dark px-5 pb-10 lg:hidden">
          <nav aria-label="Navegação móvel" className="flex flex-col py-6">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="pr-heading border-b border-white/10 py-4 text-3xl"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            {store && (
              <a
                href={store.href}
                {...(store.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="pr-btn pr-btn-secondary text-white"
              >
                <ShoppingBag aria-hidden className="size-4" />
                {store.label}
              </a>
            )}
            {cta && (
              <a href={cta.href} onClick={() => setOpen(false)} className="pr-btn pr-btn-primary">
                {cta.label}
              </a>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
