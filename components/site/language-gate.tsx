"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LOCALE_INFO, LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { rememberLocale } from "./language-switcher";

const noopSubscribe = () => () => {};

/** «R» do logótipo (mesmos traços de public/brand/ponto-radical-mark.svg). */
function LogoR() {
  return (
    <svg viewBox="140 108 184 236" className="size-full" aria-hidden>
      <g fill="currentColor">
        <path d="M152 120H262A51 51 0 0 1 262 222H228Z" />
        <path d="M152 222H228L310 332H152Z" />
      </g>
    </svg>
  );
}

/**
 * Ecrã de entrada: a bola do logótipo a girar em 3D e a escolha da língua.
 * Aparece só na primeira visita; o script de lib/i18n/gate-script.ts esconde-o antes
 * de ser desenhado quando a escolha já está guardada.
 */
export function LanguageGate({ locale, siteName }: { locale: Locale; siteName: string }) {
  const [state, setState] = useState<"open" | "closing" | "closed">("open");
  const firstButton = useRef<HTMLAnchorElement>(null);
  // Língua já escolhida numa visita anterior (marcada no <html> pelo script de entrada).
  const chosenBefore = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(document.documentElement.dataset.prLocale) && state === "open",
    () => false,
  );

  useEffect(() => {
    if (!document.documentElement.dataset.prLocale) firstButton.current?.focus({ preventScroll: true });
  }, []);

  if (state === "closed" || chosenBefore) return null;

  const choose = (e: React.MouseEvent, l: Locale) => {
    rememberLocale(l);
    if (l !== locale) return; // segue o link para a página dessa língua
    e.preventDefault();
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
      className={`pr-gate fixed inset-0 z-[90] flex flex-col items-center justify-center-safe overflow-y-auto bg-black px-6 py-12 text-white ${
        state === "closing" ? "pr-gate-out" : ""
      }`}
    >
      <div className="pr-gate-glow" aria-hidden />
      <div className="relative flex flex-col items-center">
        <div className="pr-ball-wrap" aria-hidden>
          <div className="pr-ball">
            <div className="pr-ball-face">
              <LogoR />
            </div>
            <div className="pr-ball-face pr-ball-face-back">
              <LogoR />
            </div>
          </div>
          <div className="pr-ball-shadow" />
        </div>

        <h1 id="pr-gate-title" className="sr-only">
          {siteName} — {getMessages(locale).intro.prompt}
        </h1>
        <ul className="pr-gate-prompts mt-12 text-center" aria-hidden>
          {order.map((l) => (
            <li key={l} lang={LOCALE_INFO[l].htmlLang} className="pr-heading text-[clamp(1.4rem,4vw,2.2rem)] leading-tight first:text-white">
              {getMessages(l).intro.prompt}
            </li>
          ))}
        </ul>

        <nav aria-label={getMessages(locale).header.language} className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          {order.map((l, i) => (
            <a
              key={l}
              ref={i === 0 ? firstButton : undefined}
              href={localePath(l)}
              hrefLang={LOCALE_INFO[l].htmlLang}
              lang={LOCALE_INFO[l].htmlLang}
              onClick={(e) => choose(e, l)}
              style={{ ["--i" as string]: i }}
              className="pr-gate-option group flex flex-col items-center gap-1 rounded-2xl border border-white/20 px-4 py-4 transition-colors duration-300 hover:border-white hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black focus-visible:outline-none"
            >
              <span className="text-xs font-bold tracking-[0.3em] text-white/50 transition-colors group-hover:text-black/50 group-focus-visible:text-black/50">
                {LOCALE_INFO[l].short}
              </span>
              <span className="text-base font-semibold">{LOCALE_INFO[l].label}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
