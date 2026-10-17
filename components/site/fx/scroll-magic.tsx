"use client";

import { useEffect } from "react";

/** Blocos animados dentro de cada secção (o hero e as faixas em movimento ficam de fora). */
const TARGETS = ".pr-eyebrow, p, li, figure, form, img, dl, blockquote, a[href]";
/** Sítios onde a animação não entra: títulos (já animados palavra a palavra), faixas em movimento, duplicados decorativos. */
const SKIP = ".pr-heading, [aria-hidden='true'], .whitespace-nowrap, .pr-marquee, header, dialog";

/**
 * «Magia» ao fazer scroll no telemóvel: cada bloco aparece a desfocar-se para nítido,
 * a subir e a crescer, em cascata; os cartões chegam ligeiramente rodados, como cartas
 * a ser dadas. Funciona em qualquer browser (IntersectionObserver, não depende de
 * scroll-driven animations) e só é activada em ecrãs pequenos sem «reduzir movimento».
 * Usa as propriedades `translate`/`scale`/`rotate`, que se somam às animações 3D existentes.
 */
export function ScrollMagic() {
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px) and (prefers-reduced-motion: no-preference)");
    if (!media.matches || !("IntersectionObserver" in window)) return;

    const sections = [...document.querySelectorAll<HTMLElement>("#conteudo section")].slice(1);
    const chosen = new Set<HTMLElement>();
    for (const section of sections) {
      for (const el of section.querySelectorAll<HTMLElement>(TARGETS)) {
        if (el.closest(SKIP)) continue;
        // Só o bloco mais exterior: um cartão anima inteiro, não cada parágrafo lá dentro.
        let parent = el.parentElement;
        let nested = false;
        while (parent && parent !== section) {
          if (chosen.has(parent)) {
            nested = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (!nested) chosen.add(el);
      }
    }

    let card = 0;
    for (const el of chosen) {
      el.classList.add("pr-magic");
      if (el.tagName === "LI") el.style.setProperty("--pr-magic-rotate", `${card++ % 2 ? 2.5 : -2.5}deg`);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        entering.forEach((el, i) => {
          el.style.setProperty("--pr-magic-delay", `${Math.min(i, 6) * 80}ms`);
          el.classList.add("pr-magic-in");
          observer.unobserve(el);
          el.addEventListener("transitionend", () => el.classList.add("pr-magic-done"), { once: true });
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    chosen.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      chosen.forEach((el) => el.classList.remove("pr-magic", "pr-magic-in", "pr-magic-done"));
    };
  }, []);

  return null;
}
