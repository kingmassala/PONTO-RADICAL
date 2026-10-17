"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, weekdayOf } from "@/lib/booking/rules";
import { LOCALE_INFO, type Locale } from "@/lib/i18n/config";
import { useLocale, useMessages } from "../i18n";

/** Nomes dos meses na língua da página. */
function monthNames(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => {
    const name = fmt.format(new Date(Date.UTC(2026, i, 15)));
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}

/** Cabeçalho da semana (a começar à segunda-feira) na língua da página. */
function weekHead(locale: Locale): { short: string; long: string }[] {
  const intl = LOCALE_INFO[locale].intl;
  const long = new Intl.DateTimeFormat(intl, { weekday: "long", timeZone: "UTC" });
  const narrow = new Intl.DateTimeFormat(intl, { weekday: "narrow", timeZone: "UTC" });
  // 2026-01-05 foi uma segunda-feira.
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 5 + i));
    return { short: narrow.format(d).toUpperCase(), long: long.format(d) };
  });
}

const monthOf = (iso: string) => iso.slice(0, 7);
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};

/**
 * Calendário mensal para escolher a data do pedido. As datas fora da janela de
 * reservas ou em dias sem saídas ficam desactivadas. Navegação por teclado com as setas.
 */
export function DatePicker({
  value,
  onChange,
  first,
  last,
  isAvailable,
  today,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (iso: string) => void;
  first: string;
  last: string;
  isAvailable: (iso: string) => boolean;
  today: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const locale = useLocale();
  const t = useMessages().booking;
  const MONTHS = monthNames(locale);
  const HEAD = weekHead(locale);
  const [month, setMonth] = useState(monthOf(value || first));
  const gridRef = useRef<HTMLDivElement>(null);

  const [y, m] = month.split("-").map(Number);
  const firstOfMonth = `${month}-01`;
  const offset = (weekdayOf(firstOfMonth) + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(firstOfMonth, i)),
  ];
  const enabled = (iso: string) => iso >= first && iso <= last && isAvailable(iso);
  const focusTarget = cells.find((c) => c && c === value) ?? cells.find((c) => c && enabled(c)) ?? null;

  const canPrev = month > monthOf(first);
  const canNext = month < monthOf(last);

  const focusDay = (iso: string) => {
    if (monthOf(iso) !== month) setMonth(monthOf(iso));
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent, iso: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    let next = addDays(iso, step);
    // Salta dias indisponíveis na mesma direcção (até 6 semanas).
    for (let i = 0; i < 42 && next >= first && next <= last && !enabled(next); i++) next = addDays(next, step > 0 ? 1 : -1);
    if (next >= first && next <= last && enabled(next)) focusDay(next);
  };

  return (
    <div className={`rounded-[1.5rem] border p-4 sm:p-5 ${invalid ? "border-red-500" : "border-ink/10"} bg-white`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="pr-heading text-lg" aria-live="polite">
          {MONTHS[m - 1]} <span className="text-ink/40">{y}</span>
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={!canPrev}
            aria-label={t.previousMonth}
            className="flex size-10 items-center justify-center rounded-full border border-ink/15 transition hover:border-accent hover:text-accent disabled:opacity-30"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={!canNext}
            aria-label={t.nextMonth}
            className="flex size-10 items-center justify-center rounded-full border border-ink/15 transition hover:border-accent hover:text-accent disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label={t.chooseDateLabel} aria-describedby={describedBy} ref={gridRef}>
        {HEAD.map((d, i) => (
          <abbr key={i} title={d.long} className="pb-1 text-[0.68rem] font-bold uppercase tracking-widest text-ink/40 no-underline">
            {d.short}
          </abbr>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <span key={`e${i}`} />;
          const on = enabled(iso);
          const selected = iso === value;
          return (
            <button
              key={iso}
              type="button"
              data-iso={iso}
              disabled={!on}
              tabIndex={iso === focusTarget ? 0 : -1}
              aria-pressed={selected}
              aria-label={new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
                new Date(`${iso}T12:00:00Z`),
              )}
              onClick={() => onChange(iso)}
              onKeyDown={(e) => onKeyDown(e, iso)}
              className={`relative flex aspect-square items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-all duration-200 ${
                selected
                  ? "scale-110 bg-accent text-on-accent shadow-[0_10px_24px_-10px_var(--pr-accent)]"
                  : on
                    ? "text-ink hover:bg-accent/10 hover:text-accent"
                    : "text-ink/20 line-through decoration-ink/20"
              }`}
            >
              {Number(iso.slice(8))}
              {iso === today && !selected && <span aria-hidden className="absolute bottom-1.5 size-1 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
