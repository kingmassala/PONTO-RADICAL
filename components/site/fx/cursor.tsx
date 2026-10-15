"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor personalizado: ponto + anel que segue com inércia.
 * Cresce sobre links/botões e mostra uma etiqueta em elementos com data-cursor="Texto".
 * Só activo em dispositivos com rato e sem «reduzir movimento».
 */
export function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) {
      document.querySelector(".site")?.classList.remove("fx-cursor");
      return;
    }
    let x = -100;
    let y = -100;
    let rx = -100;
    let ry = -100;
    let frame = 0;

    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cursor], a, button");
      const text = target?.dataset.cursor;
      if (ring.current) ring.current.dataset.state = text ? "label" : target ? "link" : "";
      if (label.current) label.current.textContent = text ?? "";
    };
    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      frame = requestAnimationFrame(loop);
    };
    const leave = () => {
      x = -100;
      y = -100;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    frame = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div ref={ring} className="pr-cursor-ring" aria-hidden>
        <span ref={label} />
      </div>
      <div ref={dot} className="pr-cursor-dot" aria-hidden />
    </>
  );
}
