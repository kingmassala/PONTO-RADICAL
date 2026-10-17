"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { LOCALE_INFO, LOCALE_STORAGE_KEY, LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { useLocale, useMessages } from "./i18n";

/** Guarda a língua escolhida (para o ecrã de entrada não voltar a aparecer). */
export function rememberLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Armazenamento bloqueado: fica o cookie abaixo.
  }
  // Cookie de reserva (1 ano), para browsers que bloqueiam ou limpam o localStorage.
  document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; max-age=31536000; path=/; samesite=lax`;
  document.documentElement.dataset.prLocale = locale;
}

/** Selector de língua do cabeçalho. `variant="pills"` mostra as quatro línguas lado a lado (menu móvel). */
export function LanguageSwitcher({ variant = "menu", tabIndex }: { variant?: "menu" | "pills"; tabIndex?: number }) {
  const locale = useLocale();
  const t = useMessages().header;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (variant === "pills") {
    return (
      <nav aria-label={t.language} className="flex gap-2">
        {LOCALES.map((l) => (
          <a
            key={l}
            href={localePath(l)}
            hrefLang={LOCALE_INFO[l].htmlLang}
            lang={LOCALE_INFO[l].htmlLang}
            tabIndex={tabIndex}
            aria-current={l === locale ? "true" : undefined}
            onClick={() => rememberLocale(l)}
            className={`flex-1 rounded-full border py-2.5 text-center text-sm font-bold tracking-widest ${
              l === locale ? "border-white bg-white text-dark" : "border-white/25 text-white/80"
            }`}
          >
            {LOCALE_INFO[l].short}
          </a>
        ))}
      </nav>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${t.language}: ${LOCALE_INFO[locale].label}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-2.5 text-sm font-bold tracking-widest hover:border-white"
      >
        <Globe aria-hidden className="size-4" />
        {LOCALE_INFO[locale].short}
      </button>
      {open && (
        <ul className="absolute right-0 top-full mt-2 min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-dark/95 p-1.5 shadow-2xl backdrop-blur-xl">
          {LOCALES.map((l) => (
            <li key={l}>
              <a
                href={localePath(l)}
                hrefLang={LOCALE_INFO[l].htmlLang}
                lang={LOCALE_INFO[l].htmlLang}
                aria-current={l === locale ? "true" : undefined}
                onClick={() => rememberLocale(l)}
                className="flex items-center justify-between gap-4 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white"
              >
                <span>
                  <span className="mr-2 text-xs font-bold tracking-widest text-white/45">{LOCALE_INFO[l].short}</span>
                  {LOCALE_INFO[l].label}
                </span>
                {l === locale && <Check aria-hidden className="size-4" />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
