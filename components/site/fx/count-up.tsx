"use client";

import { useEffect, useRef, useState } from "react";

const PATTERN = /^(\D*)(\d+(?:[.,]\d+)?)(.*)$/;

/** Anima o número inicial de um texto (ex.: «360°») quando fica visível. */
export function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const match = value.match(PATTERN);
    const el = ref.current;
    if (!match || !el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = Number(match[2].replace(",", "."));
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / 1400);
          setCurrent(target * (1 - Math.pow(1 - p, 4)));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  const match = value.match(PATTERN);
  if (!match) return <span>{value}</span>;
  const decimals = /[.,]/.test(match[2]) ? 1 : 0;
  const shown = current === null ? match[2] : current.toFixed(decimals);
  return (
    <span ref={ref} aria-label={value}>
      <span aria-hidden>
        {match[1]}
        {shown}
        {match[3]}
      </span>
    </span>
  );
}
