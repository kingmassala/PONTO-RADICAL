"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { BlogPost } from "@/lib/blog/schema";
import type { Locale } from "@/lib/i18n/config";
import { useMessages } from "../i18n";
import { PostCard } from "./post-card";

/** Velocidade do deslizar automático (px por segundo): devagar, para dar tempo de ler. */
const SPEED = 18;
/** Depois de o visitante mexer (arrastar, setas, toque), retoma o movimento ao fim deste tempo. */
const RESUME_AFTER = 4000;

/**
 * Artigos da secção «Blog» em faixa contínua que desliza muito devagar. Pára quando o
 * rato está por cima (para ler), quando um cartão tem o foco, enquanto se arrasta com o
 * dedo e fora do ecrã. Com «reduzir movimento» fica parada (desliza-se à mão ou com as setas).
 * A lista é repetida para o movimento ser contínuo; as cópias ficam escondidas dos leitores
 * de ecrã e do teclado.
 */
export function BlogCarousel({ posts, locale, tone }: { posts: BlogPost[]; locale: Locale; tone: "light" | "dark" }) {
  const m = useMessages();
  const track = useRef<HTMLDivElement>(null);
  // Uma «volta» tem pelo menos 6 cartões, para a faixa encher o ecrã antes de se repetir.
  const lap: BlogPost[] = [];
  while (lap.length < Math.max(6, posts.length)) lap.push(...posts);
  const loop = posts.length > 1;

  useEffect(() => {
    const el = track.current;
    if (!el || !loop) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pos = el.scrollLeft;
    let last = performance.now();
    let hover = false;
    let focus = false;
    let visible = true;
    let pausedUntil = 0;
    let frame = 0;

    /** Largura de uma volta (onde começa a segunda cópia). */
    const lapWidth = () => {
      const second = el.querySelector<HTMLElement>("[data-lap='1']");
      return second ? second.offsetLeft - (el.firstElementChild as HTMLElement).offsetLeft : el.scrollWidth / 2;
    };
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const running = !reduced && !hover && !focus && visible && !document.hidden && now > pausedUntil;
      const w = lapWidth();
      if (running) {
        pos += SPEED * dt;
        if (pos >= w) pos -= w;
        el.scrollLeft = pos;
      } else {
        // Parado: acompanha o que o visitante fez (arrastar, setas) e volta a encaixar na primeira volta.
        pos = el.scrollLeft;
        if (pos >= w) {
          pos -= w;
          el.scrollLeft = pos;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const pause = () => (pausedUntil = performance.now() + RESUME_AFTER);
    const onEnter = () => (hover = true);
    const onLeave = () => (hover = false);
    const onFocusIn = () => (focus = true);
    const onFocusOut = () => (focus = false);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchmove", pause, { passive: true });
    el.addEventListener("wheel", pause, { passive: true });
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(el);
    const onArrow = () => pause();
    el.addEventListener("pr-carousel-arrow", onArrow);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchmove", pause);
      el.removeEventListener("wheel", pause);
      el.removeEventListener("pr-carousel-arrow", onArrow);
    };
  }, [loop]);

  const step = (dir: number) => {
    const el = track.current;
    if (!el) return;
    el.dispatchEvent(new Event("pr-carousel-arrow"));
    const card = el.querySelector<HTMLElement>("[data-card]");
    const width = card ? card.offsetWidth + 24 : el.clientWidth * 0.8;
    // Para trás logo no início: salta para a mesma posição na segunda volta (sem se notar).
    if (dir < 0 && loop && el.scrollLeft < width) {
      const second = el.querySelector<HTMLElement>("[data-lap='1']");
      if (second) el.scrollLeft += second.offsetLeft - (el.firstElementChild as HTMLElement).offsetLeft;
    }
    el.scrollBy({ left: dir * width, behavior: "smooth" });
  };

  const cards = (copy: number) =>
    (loop ? lap : posts).map((post, i) => (
      <div
        key={`${copy}-${post.id}-${i}`}
        data-card
        data-lap={i === 0 ? copy : undefined}
        className="w-[84%] shrink-0 sm:w-[46%] lg:w-[31.5%]"
        {...(copy > 0 || i >= posts.length ? { "aria-hidden": true, inert: true } : {})}
      >
        <PostCard post={post} locale={locale} m={m} tone={tone} />
      </div>
    ));

  return (
    <div className="mt-10 sm:mt-16">
      <div
        ref={track}
        role="region"
        aria-roledescription="carousel"
        aria-label={m.blog.title}
        className="pr-blog-track flex gap-6 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards(0)}
        {loop && cards(1)}
      </div>
      {loop && (
        <div className="mt-8 flex justify-end gap-3">
          {[-1, 1].map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => step(dir)}
              aria-label={dir < 0 ? m.blog.previous : m.blog.next}
              className={`flex size-14 items-center justify-center rounded-full border transition hover:border-accent hover:bg-accent hover:text-on-accent ${
                tone === "dark" ? "border-white/25 text-white" : "border-ink/20 text-ink"
              }`}
            >
              {dir < 0 ? <ArrowLeft className="size-5" /> : <ArrowRight className="size-5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
