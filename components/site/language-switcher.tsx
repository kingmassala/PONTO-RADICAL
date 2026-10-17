"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { GATE_SKIP_KEY, LOCALE_INFO, LOCALES, type Locale } from "@/lib/i18n/config";
import { useLocale, useLocaleHref, useMessages } from "./i18n";

/**
 * Antes de abrir a página de outra língua: o ecrã de entrada não volta a aparecer
 * nesse carregamento (só nesse; ao actualizar ou voltar a abrir o site aparece de novo).
 */
export function skipNextGate() {
  try {
    sessionStorage.setItem(GATE_SKIP_KEY, "1");
  } catch {
    // Armazenamento bloqueado: o ecrã de entrada volta a aparecer, sem outro efeito.
  }
}

/** Selector de língua do cabeçalho. `variant="pills"` mostra todas as línguas lado a lado (menu móvel). */
export function LanguageSwitcher({ variant = "menu", tabIndex }: { variant?: "menu" | "pills"; tabIndex?: number }) {
  const locale = useLocale();
  const t = useMessages().header;
  const target = useLocaleHref();
  // Só a página inicial tem ecrã de entrada: saltá-lo apenas quando é para lá que se vai.
  const onPick = (l: Locale) => () => {
    if (target(l).home) skipNextGate();
  };
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
            href={target(l).href}
            hrefLang={LOCALE_INFO[l].htmlLang}
            lang={LOCALE_INFO[l].htmlLang}
            tabIndex={tabIndex}
            aria-current={l === locale ? "true" : undefined}
            onClick={onPick(l)}
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
                href={target(l).href}
                hrefLang={LOCALE_INFO[l].htmlLang}
                lang={LOCALE_INFO[l].htmlLang}
                aria-current={l === locale ? "true" : undefined}
                onClick={onPick(l)}
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
