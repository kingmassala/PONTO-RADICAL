"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LOCALE_INFO, LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { skipNextGate } from "./language-switcher";

const noopSubscribe = () => () => {};

/** Símbolo do logótipo oficial (círculo e «R»), igual a public/brand/ponto-radical-mark.svg. */
function LogoMark() {
  return (
    <svg viewBox="226 66 801 801" className="size-full" aria-hidden>
      <circle cx="626.5" cy="466" r="383.5" fill="#fff" stroke="#000" strokeWidth="32" />
      <g fill="#000">
        <path d="M486 238H690A98.75 98.75 0 0 1 690 435.5H639Z" />
        <path d="M480.5 435.5H639L829 683H480.5Z" />
      </g>
    </svg>
  );
}

/**
 * Ecrã de entrada: o logótipo a girar em 3D sobre fundo branco e a escolha da língua.
 * Aparece em todos os carregamentos da página (incluindo ao actualizar); o script de
 * lib/i18n/gate-script.ts só o esconde logo a seguir a escolher outra língua.
 *
 * Na pré-visualização do painel (`previewHrefs`) aparece sempre, a escolha não é
 * guardada e cada língua abre a pré-visualização nessa língua.
 */
export function LanguageGate({
  locale,
  siteName,
  previewHrefs,
}: {
  locale: Locale;
  siteName: string;
  previewHrefs?: Record<Locale, string>;
}) {
  const preview = Boolean(previewHrefs);
  const [state, setState] = useState<"open" | "closing" | "closed">("open");
  const firstButton = useRef<HTMLAnchorElement>(null);
  // Acabou de escolher outra língua (marcado no <html> pelo script de entrada): não volta a perguntar.
  const chosenBefore = useSyncExternalStore(
    noopSubscribe,
    () => !preview && Boolean(document.documentElement.dataset.prLocale) && state === "open",
    () => false,
  );

  useEffect(() => {
    if (preview || !document.documentElement.dataset.prLocale) firstButton.current?.focus({ preventScroll: true });
  }, [preview]);

  if (state === "closed" || chosenBefore) return null;

  const choose = (e: React.MouseEvent, l: Locale) => {
    if (l !== locale) {
      // Segue o link para a página dessa língua, sem voltar a mostrar a entrada lá.
      if (!preview) skipNextGate();
      return;
    }
    e.preventDefault();
    // Na pré-visualização, actualizar a página já não volta a mostrar a entrada.
    if (previewHrefs) window.history.replaceState(null, "", previewHrefs[l]);
    setState("closing");
    window.setTimeout(() => setState("closed"), 700);
  };

  // A língua da página aparece primeiro; as restantes pela ordem habitual.
  const order = [locale, ...LOCALES.filter((l) => l !== locale)];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-gate-title"
      className={`pr-gate fixed inset-0 z-[90] flex flex-col items-center justify-center-safe overflow-y-auto bg-white px-6 py-12 text-black ${
        state === "closing" ? "pr-gate-out" : ""
      }`}
    >
      <div className="relative flex flex-col items-center">
        <div className="pr-coin-wrap" aria-hidden>
          <div className="pr-coin">
            <div className="pr-coin-face">
              <LogoMark />
            </div>
            <div className="pr-coin-face pr-coin-back">
              <LogoMark />
            </div>
          </div>
          <div className="pr-coin-shadow" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ponto-radical-wordmark.png" alt="" aria-hidden width={641} height={253} className="mt-6 h-auto w-[clamp(9rem,26vw,13rem)]" />
        <p className="pr-logo-type mt-5 text-center text-[clamp(0.62rem,1.6vw,0.8rem)] text-black/70">Boating · Water Sports · Camping · Fishing &amp; Co</p>

        <h1 id="pr-gate-title" className="sr-only">
          {siteName} — {getMessages(locale).intro.prompt}
        </h1>
        <ul className="pr-gate-prompts mt-9 text-center" aria-hidden>
          {order.map((l) => (
            <li key={l} lang={LOCALE_INFO[l].htmlLang} className="pr-heading text-[clamp(1.4rem,4vw,2.2rem)] leading-tight first:text-black">
              {getMessages(l).intro.prompt}
            </li>
          ))}
        </ul>

        <nav aria-label={getMessages(locale).header.language} className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          {order.map((l, i) => (
            <a
              key={l}
              ref={i === 0 ? firstButton : undefined}
              href={previewHrefs ? previewHrefs[l] : localePath(l)}
              hrefLang={LOCALE_INFO[l].htmlLang}
              lang={LOCALE_INFO[l].htmlLang}
              onClick={(e) => choose(e, l)}
              style={{ ["--i" as string]: i }}
              className="pr-gate-option group flex flex-col items-center gap-1 rounded-2xl border border-black/15 px-4 py-4 transition-colors duration-300 hover:border-black hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white focus-visible:outline-none"
            >
              <span className="text-xs font-bold tracking-[0.3em] text-black/45 transition-colors group-hover:text-white/60 group-focus-visible:text-white/60">
                {LOCALE_INFO[l].short}
              </span>
              <span className="text-base font-semibold">{LOCALE_INFO[l].label}</span>
            </a>
          ))}
        </nav>
        <p className="pr-logo-type mt-10 text-center text-[clamp(0.75rem,2vw,1rem)] text-black" style={{ fontWeight: 600 }}>
          We share the same passion
        </p>
      </div>
    </div>
  );
}
