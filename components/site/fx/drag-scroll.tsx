"use client";

import { useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useMessages } from "../i18n";

/** Faixa horizontal que se arrasta com o rato (e desliza com o dedo/scroll). */
export function DragScroll({ children, tone }: { children: React.ReactNode; tone: "light" | "dark" }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useMessages().common;
  const state = useRef({ down: false, startX: 0, scroll: 0, moved: false });

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    state.current = { down: true, startX: e.clientX, scroll: ref.current.scrollLeft, moved: false };
    ref.current.style.scrollSnapType = "none";
  };
  const onMove = (e: React.PointerEvent) => {
    if (!state.current.down || !ref.current) return;
    const dx = e.clientX - state.current.startX;
    if (Math.abs(dx) > 4) state.current.moved = true;
    ref.current.scrollLeft = state.current.scroll - dx;
  };
  const onUp = () => {
    state.current.down = false;
    if (ref.current) ref.current.style.scrollSnapType = "";
  };
  const by = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: "smooth" });

  return (
    <div>
      <div
        ref={ref}
        data-cursor={t.drag}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onClickCapture={(e) => state.current.moved && e.preventDefault()}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 [scrollbar-width:none] sm:px-8 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))] [&::-webkit-scrollbar]:hidden select-none"
      >
        {children}
      </div>
      <div className="mx-auto mt-6 flex max-w-7xl justify-end gap-3 px-5 sm:px-8">
        {[-1, 1].map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => by(dir)}
            aria-label={dir < 0 ? t.previousPhotos : t.nextPhotos}
            className={`flex size-14 items-center justify-center rounded-full border transition hover:bg-accent hover:border-accent hover:text-on-accent ${
              tone === "dark" ? "border-white/25 text-white" : "border-ink/20 text-ink"
            }`}
          >
            {dir < 0 ? <ArrowLeft className="size-5" /> : <ArrowRight className="size-5" />}
          </button>
        ))}
      </div>
    </div>
  );
}
