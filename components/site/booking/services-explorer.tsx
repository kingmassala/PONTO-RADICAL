"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Clock, Info, Users } from "lucide-react";
import type { BookingSettings, ServiceCategory } from "@/lib/cms/schema";
import { formatDuration, formatPeople, formatPrice } from "@/lib/booking/rules";
import { BookingDialog, type DialogService } from "./booking-dialog";

const OPTIMIZABLE = /^(\/|https:\/\/images\.unsplash\.com\/|https:\/\/[^/]+\.supabase\.co\/)/;
const HASH_PREFIX = "#reservar-";

/**
 * Cartões das experiências com filtro por categoria. Cada cartão abre o painel
 * de pedido de reserva. Uma ligação directa como /#reservar-<endereço> abre o
 * painel desse serviço (útil para partilhar no WhatsApp ou nas redes sociais).
 */
export function ServicesExplorer({
  services,
  categories,
  showFilters,
  buttonLabel,
  settings,
  whatsapp,
  tone,
  preview,
}: {
  services: DialogService[];
  categories: ServiceCategory[];
  showFilters: boolean;
  buttonLabel: string;
  settings: BookingSettings;
  whatsapp: string;
  tone: "light" | "dark";
  preview?: boolean;
}) {
  const [filter, setFilter] = useState<string>("todas");
  const [open, setOpen] = useState<{ service: DialogService; n: number } | null>(null);
  const dark = tone === "dark";

  const openService = useCallback((service: DialogService) => setOpen((o) => ({ service, n: (o?.n ?? 0) + 1 })), []);
  const close = useCallback(() => {
    setOpen(null);
    if (window.location.hash.startsWith(HASH_PREFIX)) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    const fromHash = () => {
      const hash = decodeURIComponent(window.location.hash);
      if (!hash.startsWith(HASH_PREFIX)) return;
      const service = services.find((s) => s.slug === hash.slice(HASH_PREFIX.length));
      if (service) openService(service);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [services, openService]);

  const used = categories.filter((c) => services.some((s) => s.categoryId === c.id));
  const shown = filter === "todas" ? services : services.filter((s) => s.categoryId === filter);

  if (services.length === 0) return null;

  return (
    <>
      {showFilters && used.length > 1 && (
        <div role="group" aria-label="Filtrar por categoria" className="mt-14 flex flex-wrap gap-2">
          {[{ id: "todas", label: "Todas" }, ...used].map((c) => {
            const count = c.id === "todas" ? services.length : services.filter((s) => s.categoryId === c.id).length;
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(c.id)}
                className={`group inline-flex items-center gap-2.5 rounded-full border-2 px-5 py-2.5 text-sm font-bold uppercase tracking-[0.12em] transition-all duration-300 ${
                  active
                    ? "border-accent bg-accent text-white"
                    : dark
                      ? "border-white/20 text-white hover:border-white"
                      : "border-ink/15 text-ink hover:border-ink"
                }`}
              >
                {c.label}
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-[0.7rem] tracking-normal tabular-nums transition-colors ${
                    active ? "bg-white text-accent" : dark ? "bg-white/10" : "bg-ink/5"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <ul className={`grid gap-5 sm:grid-cols-2 ${showFilters && used.length > 1 ? "mt-8" : "mt-16"}`} aria-live="polite">
        {shown.map((service, i) => {
          const image = service.gallery.find((g) => g.url);
          const price = formatPrice(service);
          const duration = formatDuration(service.durationMinutes);
          const wide = shown.length % 2 === 1 && i === 0;
          const bookable = service.bookable && settings.enabled;
          const label = buttonLabel || "Pedir reserva";
          return (
            <li key={service.id} className={`pr-card-in ${wide ? "sm:col-span-2" : ""}`} style={{ ["--i" as string]: i }}>
              <article
                data-cursor={bookable ? "Reservar" : "Ver"}
                className="group relative overflow-hidden rounded-[2rem] bg-dark text-white has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent"
              >
                <div className={`relative ${wide ? "aspect-[4/5] sm:aspect-[21/9]" : "aspect-[4/5] lg:aspect-[5/4]"}`}>
                  {image ? (
                    <Image
                      src={image.url}
                      alt={image.alt}
                      fill
                      sizes={wide ? "100vw" : "(min-width: 640px) 50vw, 100vw"}
                      unoptimized={!OPTIMIZABLE.test(image.url) || image.url.toLowerCase().split("?")[0].endsWith(".svg")}
                      className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-primary" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/35 to-dark/10 transition-opacity duration-500 group-hover:opacity-90" />

                  <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-3 sm:inset-x-7 sm:top-7">
                    <span className="rounded-full bg-white/90 px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ink backdrop-blur">
                      {service.categoryLabel}
                    </span>
                    <span className="pr-heading text-4xl text-white/30 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                    <h3 className="pr-heading max-w-[16ch] text-[clamp(1.7rem,3.2vw,2.8rem)] leading-[0.95] transition-transform duration-500 group-hover:-translate-y-1">
                      {service.name}
                    </h3>
                    {service.summary && <p className="mt-3 line-clamp-2 max-w-xl text-white/75">{service.summary}</p>}
                    <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                      <ul className="flex flex-wrap gap-2 text-sm">
                        {duration && (
                          <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
                            <Clock className="size-3.5" aria-hidden /> {duration}
                          </li>
                        )}
                        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
                          <Users className="size-3.5" aria-hidden /> {formatPeople(service)}
                        </li>
                      </ul>
                      <div className="flex items-center gap-3">
                        <p className="text-right leading-tight">
                          <span className="block text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/55">{price ? "desde" : "preço"}</span>
                          <span className="pr-heading text-lg sm:text-xl">{price ?? "sob consulta"}</span>
                        </p>
                        <span aria-hidden className="flex h-14 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-bold uppercase tracking-[0.12em]">
                          <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-500 group-hover:mr-2 group-hover:max-w-[12rem]">
                            {bookable ? label : "Ver"}
                          </span>
                          <ArrowUpRight className="size-6 transition-transform duration-500 group-hover:rotate-45" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* O cartão inteiro abre o pedido de reserva. */}
                <button
                  type="button"
                  onClick={() => openService(service)}
                  aria-haspopup="dialog"
                  aria-label={`${service.name} — ${bookable ? label : "ver detalhes"}`}
                  className="absolute inset-0 z-10 rounded-[2rem] outline-none"
                />
              </article>
            </li>
          );
        })}
      </ul>

      {open && (
        <BookingDialog key={open.n} service={open.service} settings={settings} whatsapp={whatsapp} disabled={preview} onClose={close} />
      )}
    </>
  );
}

export function ServicesNote({ text, tone }: { text: string; tone: "light" | "dark" }) {
  if (!text) return null;
  return (
    <p className={`mt-8 flex items-start gap-3 text-sm ${tone === "dark" ? "text-white/60" : "text-ink/60"}`}>
      <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      {text}
    </p>
  );
}
