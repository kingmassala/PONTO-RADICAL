"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { BookingSettings, Service } from "@/lib/cms/schema";
import { submitBooking, type BookingState } from "@/lib/booking/actions";
import {
  bookingWindow,
  dateProblem,
  FLEXIBLE_SLOT,
  formatDuration,
  formatKwanza,
  formatLongDate,
  formatPeople,
  formatPrice,
  slotOptions,
  slotPhrase,
  todayIso,
  whatsappHref,
  type BookingField,
} from "@/lib/booking/rules";
import { DatePicker } from "./date-picker";

const initial: BookingState = { status: "idle" };
const OPTIMIZABLE = /^(\/|https:\/\/images\.unsplash\.com\/|https:\/\/[^/]+\.supabase\.co\/)/;

export type DialogService = Service & { categoryLabel: string };

/**
 * Painel de pedido de reserva: detalhes do serviço à esquerda, formulário à
 * direita (no telemóvel, um por baixo do outro). O envio é validado no
 * servidor; aqui só se evita escolher datas e horários impossíveis.
 */
export function BookingDialog({
  service,
  settings,
  whatsapp,
  disabled,
  onClose,
}: {
  service: DialogService;
  settings: BookingSettings;
  whatsapp: string;
  disabled?: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(submitBooking, initial);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Datas calculadas no browser (o painel só existe depois de o cliente o abrir).
  // O instante de abertura serve também de verificação anti-spam (tempo mínimo de preenchimento).
  const [{ today, first, last, openedAt }] = useState(() => {
    const now = new Date();
    return { today: todayIso(now), openedAt: now.getTime(), ...bookingWindow(settings, now) };
  });
  const slots = slotOptions(service);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(slots.length === 1 ? slots[0] : "");
  const [people, setPeople] = useState(Math.max(service.minPeople, Math.min(2, service.maxPeople)));
  const [photo, setPhoto] = useState(0);

  const bookable = service.bookable && settings.enabled;
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const isAvailable = useMemo(() => (iso: string) => dateProblem(service, settings, iso) === null, [service, settings]);

  // Foco, tecla Esc, bloqueio do scroll e devolução do foco ao fechar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]):not([tabindex="-1"]), textarea, select, [tabindex="0"]',
      );
      const list = Array.from(focusable).filter((el) => el.offsetParent !== null);
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  // Depois de um envio com erros, leva o cliente ao primeiro campo assinalado.
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    const firstKey = Object.keys(state.fieldErrors)[0];
    if (firstKey) panelRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  const images = service.gallery.filter((g) => g.url);
  const price = formatPrice(service);
  const estimate =
    service.priceFrom !== null ? formatKwanza(service.priceUnit === "pessoa" ? service.priceFrom * people : service.priceFrom) : null;
  const duration = formatDuration(service.durationMinutes);
  const fallbackWhatsapp = whatsapp ? whatsappHref(whatsapp, `Olá! Gostaria de saber mais sobre: ${service.name}.`) : null;

  const fieldCls = (key: BookingField) =>
    `w-full rounded-2xl border bg-white px-4 py-3.5 text-base outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15 ${
      errors[key] ? "border-red-500" : "border-ink/15"
    }`;
  const err = (key: BookingField) =>
    errors[key] ? (
      <p id={`bk-${key}-error`} className="mt-2 text-sm font-medium text-red-600">
        {errors[key]}
      </p>
    ) : null;
  const step = (n: number, label: string) => (
    <span className="pr-eyebrow mb-4 flex items-center gap-3 text-ink/55">
      <span className="flex size-7 items-center justify-center rounded-full bg-ink text-[0.7rem] tracking-normal text-white">{n}</span>
      {label}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[65] flex justify-end" role="presentation">
      <div className="pr-overlay-in absolute inset-0 bg-dark/70 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pr-drawer-in relative h-full w-full max-w-[72rem] overflow-hidden bg-background text-ink shadow-2xl lg:rounded-l-[2.5rem]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          data-cursor="Fechar"
          className="absolute right-4 top-4 z-20 flex size-12 items-center justify-center rounded-full bg-white/90 text-ink shadow-lg backdrop-blur transition-transform duration-500 hover:rotate-90 hover:bg-accent hover:text-white"
        >
          <X className="size-5" aria-hidden />
        </button>
        <div className="flex h-full flex-col overflow-y-auto overscroll-contain lg:flex-row lg:overflow-hidden">

        {/* ------------------------- Detalhes do serviço ------------------------- */}
        <section className="relative shrink-0 bg-dark text-white lg:w-[42%] lg:overflow-y-auto">
          <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/10] lg:aspect-[4/5]">
            {images.length > 0 ? (
              images.map((img, i) => (
                <Image
                  key={img.url}
                  src={img.url}
                  alt={img.alt}
                  fill
                  sizes="(min-width: 1024px) 30rem, 100vw"
                  unoptimized={!OPTIMIZABLE.test(img.url) || img.url.toLowerCase().split("?")[0].endsWith(".svg")}
                  className={`object-cover transition-all duration-700 ${i === photo ? "scale-100 opacity-100" : "scale-110 opacity-0"}`}
                  priority={i === 0}
                />
              ))
            ) : (
              <div className="absolute inset-0 bg-primary" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-dark via-dark/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="pr-eyebrow mb-3 inline-flex rounded-full bg-accent px-3 py-1.5 text-white">{service.categoryLabel}</p>
              <h2 id={titleId} className="pr-heading text-[clamp(1.9rem,4vw,3rem)] leading-[0.95]">
                {service.name}
              </h2>
            </div>
            {images.length > 1 && (
              <div className="absolute left-6 top-6 flex gap-2">
                {images.map((img, i) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setPhoto(i)}
                    aria-label={`Fotografia ${i + 1} de ${images.length}`}
                    aria-pressed={i === photo}
                    className={`h-2 rounded-full transition-all duration-500 ${i === photo ? "w-8 bg-white" : "w-2 bg-white/45 hover:bg-white/80"}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            <ul className="flex flex-wrap gap-2 text-sm">
              {duration && (
                <li className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-2">
                  <Clock className="size-4 text-accent" aria-hidden /> {duration}
                </li>
              )}
              <li className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-2">
                <Users className="size-4 text-accent" aria-hidden /> {formatPeople(service)}
              </li>
              <li className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-2">
                <Wallet className="size-4 text-accent" aria-hidden /> {price ? `desde ${price}` : "Preço sob consulta"}
              </li>
            </ul>

            {service.description ? (
              <div className="pr-rich text-lg leading-relaxed text-white/80" dangerouslySetInnerHTML={{ __html: service.description }} />
            ) : (
              service.summary && <p className="text-lg leading-relaxed text-white/80">{service.summary}</p>
            )}

            {service.included.length > 0 && (
              <div>
                <p className="pr-eyebrow mb-4 text-white/50">Incluído</p>
                <ul className="grid gap-2.5">
                  {service.included.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent">
                        <Check className="size-3" aria-hidden strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {service.requirements.length > 0 && (
              <div>
                <p className="pr-eyebrow mb-4 text-white/50">Antes de reservar</p>
                <ul className="grid gap-2.5 text-white/75">
                  {service.requirements.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-white/40" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {service.meetingPoint && (
              <p className="flex items-start gap-3 rounded-2xl bg-white/[0.06] p-4">
                <MapPin className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="pr-eyebrow block text-white/50">Ponto de encontro</span>
                  <span className="mt-1 block">{service.meetingPoint}</span>
                </span>
              </p>
            )}
          </div>
        </section>

        {/* ------------------------------ Formulário ------------------------------ */}
        <section className="flex-1 p-6 sm:p-10 lg:overflow-y-auto lg:p-12" aria-label="Pedido de reserva">
          {state.status === "success" ? (
            <BookingSuccess
              state={state}
              service={service}
              date={date}
              slot={slot}
              people={people}
              settings={settings}
              onClose={onClose}
            />
          ) : !bookable ? (
            <div className="flex h-full flex-col justify-center gap-6">
              <p className="pr-heading pr-h2 max-w-[14ch]">
                Reservas <span className="pr-accent">por contacto</span>
              </p>
              <p className="max-w-md text-lg text-ink/70">
                Esta experiência não aceita pedidos online de momento. Fale connosco para saber datas e condições.
              </p>
              <div className="flex flex-wrap gap-3">
                {fallbackWhatsapp && (
                  <a href={fallbackWhatsapp} target="_blank" rel="noopener noreferrer" className="pr-btn pr-btn-primary">
                    <MessageCircle className="size-4" aria-hidden /> WhatsApp
                  </a>
                )}
                <a href="#contactos" onClick={onClose} className="pr-btn pr-btn-secondary text-ink">
                  Contactos <ArrowRight className="pr-btn-arrow size-4" aria-hidden />
                </a>
              </div>
            </div>
          ) : (
            <form
              noValidate
              className="relative"
              onSubmit={(e) => {
                // Envio manual (sem <form action>): o React não limpa o formulário depois de um erro,
                // o que apagaria o que o cliente escreveu e a marca de tempo anti-spam.
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                startTransition(() => action(data));
              }}
            >
              <p className="pr-eyebrow text-accent">Pedido de reserva</p>
              <p className="pr-heading mt-3 text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[0.95]">
                Escolha o dia. <span className="pr-accent">Nós</span> confirmamos.
              </p>

              <input type="hidden" name="serviceId" value={service.id} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="slot" value={slot} />
              <input type="hidden" name="people" value={people} />
              <input type="hidden" name="startedAt" value={openedAt} />
              {/* Campo-armadilha para bots: invisível para pessoas e leitores de ecrã. */}
              <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              <div className="mt-10 space-y-10">
                <fieldset data-field="date">
                  <legend className="contents">{step(1, "Quando?")}</legend>
                  <DatePicker
                    value={date}
                    onChange={setDate}
                    first={first}
                    last={last}
                    today={today}
                    isAvailable={isAvailable}
                    invalid={Boolean(errors.date)}
                    describedBy={errors.date ? "bk-date-error" : undefined}
                  />
                  <p className="mt-3 flex items-center gap-2 text-sm text-ink/60" aria-live="polite">
                    <CalendarDays className="size-4 text-accent" aria-hidden />
                    {date ? <strong className="font-semibold text-ink first-letter:uppercase">{formatLongDate(date)}</strong> : "Escolha uma data disponível."}
                  </p>
                  {err("date")}
                </fieldset>

                <fieldset data-field="slot">
                  <legend className="contents">{step(2, slots.length === 1 && slots[0] !== FLEXIBLE_SLOT ? "Horário de partida" : "A que horas?")}</legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Horário" aria-describedby={errors.slot ? "bk-slot-error" : undefined}>
                    {slots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={slot === s}
                        onClick={() => setSlot(s)}
                        className={`inline-flex items-center gap-2 rounded-full border-2 px-5 py-3 text-base font-bold tabular-nums transition-all duration-300 ${
                          slot === s ? "border-accent bg-accent text-white" : "border-ink/15 bg-white hover:-translate-y-0.5 hover:border-accent"
                        }`}
                      >
                        <Clock className="size-4" aria-hidden /> {s}
                      </button>
                    ))}
                  </div>
                  {slots[0] === FLEXIBLE_SLOT && <p className="mt-2 text-sm text-ink/55">O horário é combinado com a equipa na confirmação.</p>}
                  {err("slot")}
                </fieldset>

                <fieldset data-field="people">
                  <legend className="contents">{step(3, "Quantas pessoas?")}</legend>
                  <div className="flex flex-wrap items-center gap-5">
                    <div className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white p-1.5">
                      <button
                        type="button"
                        onClick={() => setPeople((p) => Math.max(service.minPeople, p - 1))}
                        disabled={people <= service.minPeople}
                        aria-label="Menos uma pessoa"
                        className="flex size-11 items-center justify-center rounded-full bg-ink/5 transition hover:bg-accent hover:text-white disabled:opacity-30"
                      >
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <output className="pr-heading w-14 text-center text-3xl tabular-nums" aria-live="polite" aria-label={`${people} pessoa(s)`}>
                        {people}
                      </output>
                      <button
                        type="button"
                        onClick={() => setPeople((p) => Math.min(service.maxPeople, p + 1))}
                        disabled={people >= service.maxPeople}
                        aria-label="Mais uma pessoa"
                        className="flex size-11 items-center justify-center rounded-full bg-ink/5 transition hover:bg-accent hover:text-white disabled:opacity-30"
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                    <p className="text-sm text-ink/55">
                      {formatPeople(service)} por reserva
                      {estimate && (
                        <>
                          <br />
                          Estimativa: <strong className="text-base text-ink">desde {estimate}</strong>
                        </>
                      )}
                    </p>
                  </div>
                  {err("people")}
                </fieldset>

                <fieldset>
                  <legend className="contents">{step(4, "Os seus contactos")}</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div data-field="name" className="sm:col-span-2">
                      <label htmlFor="bk-name" className="mb-2 block text-sm font-semibold">
                        Nome *
                      </label>
                      <input id="bk-name" name="name" autoComplete="name" required className={fieldCls("name")} aria-invalid={!!errors.name} aria-describedby={errors.name ? "bk-name-error" : undefined} />
                      {err("name")}
                    </div>
                    <div data-field="email">
                      <label htmlFor="bk-email" className="mb-2 block text-sm font-semibold">
                        Email *
                      </label>
                      <input id="bk-email" name="email" type="email" autoComplete="email" required className={fieldCls("email")} aria-invalid={!!errors.email} aria-describedby={errors.email ? "bk-email-error" : undefined} />
                      {err("email")}
                    </div>
                    <div data-field="phone">
                      <label htmlFor="bk-phone" className="mb-2 block text-sm font-semibold">
                        Telefone / WhatsApp *
                      </label>
                      <input id="bk-phone" name="phone" type="tel" autoComplete="tel" required placeholder="+244" className={fieldCls("phone")} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "bk-phone-error" : undefined} />
                      {err("phone")}
                    </div>
                    <div data-field="notes" className="sm:col-span-2">
                      <label htmlFor="bk-notes" className="mb-2 block text-sm font-semibold">
                        Observações <span className="font-normal text-ink/50">(opcional)</span>
                      </label>
                      <textarea id="bk-notes" name="notes" rows={3} maxLength={2000} placeholder="Ocasião especial, crianças, nível de experiência…" className={`${fieldCls("notes")} resize-y`} />
                      {err("notes")}
                    </div>
                  </div>
                </fieldset>
              </div>

              {errors.serviceId && (
                <p role="alert" className="mt-8 rounded-2xl border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {errors.serviceId}
                </p>
              )}
              {state.status === "error" && state.message && !errors.serviceId && (
                <div role="alert" className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <span>{state.message}</span>
                  {state.whatsapp && (
                    <a href={state.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-bold underline">
                      <MessageCircle className="size-4" aria-hidden /> WhatsApp
                    </a>
                  )}
                </div>
              )}

              <div className="mt-10 rounded-[1.5rem] bg-surface p-5 sm:p-6">
                {settings.paymentInfo && (
                  <p className="flex items-start gap-3 text-sm leading-relaxed text-ink/75">
                    <Wallet className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                    {settings.paymentInfo}
                  </p>
                )}
                <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
                  <p className="text-xs text-ink/50">Os seus dados são usados apenas para tratar este pedido.</p>
                  <button type="submit" disabled={pending || disabled} className="pr-btn pr-btn-primary disabled:opacity-60" data-cursor="Enviar">
                    {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
                    {disabled ? "Envio desactivado na pré-visualização" : pending ? "A enviar…" : "Enviar pedido"}
                    {!pending && !disabled && <ArrowRight aria-hidden className="pr-btn-arrow size-4" />}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}

function BookingSuccess({
  state,
  service,
  date,
  slot,
  people,
  settings,
  onClose,
}: {
  state: BookingState;
  service: Service;
  date: string;
  slot: string;
  people: number;
  settings: BookingSettings;
  onClose: () => void;
}) {
  return (
    <div role="status" className="flex min-h-full flex-col justify-center">
      <div className="pr-pop flex size-20 items-center justify-center rounded-full bg-accent text-white shadow-[0_20px_50px_-15px_var(--pr-accent)]">
        <CheckCircle2 className="size-10" aria-hidden />
      </div>
      <p className="pr-heading mt-8 text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[0.95]">
        Pedido <span className="pr-accent">enviado!</span>
      </p>
      {state.reference && (
        <p className="mt-6 inline-flex w-fit items-center gap-3 rounded-full bg-ink px-5 py-2.5 text-white">
          <span className="pr-eyebrow text-white/60">Referência</span>
          <span className="font-mono text-lg font-bold tracking-widest">{state.reference}</span>
        </p>
      )}
      <dl className="mt-8 grid gap-px overflow-hidden rounded-[1.5rem] bg-ink/10 sm:grid-cols-3">
        {[
          { label: "Experiência", value: service.name },
          { label: "Data", value: date ? `${formatLongDate(date)}, ${slotPhrase(slot)}` : "—" },
          { label: "Pessoas", value: String(people) },
        ].map((row) => (
          <div key={row.label} className="bg-white p-5">
            <dt className="pr-eyebrow text-ink/45">{row.label}</dt>
            <dd className="mt-2 font-semibold first-letter:uppercase">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink/75">
        {settings.successMessage || "Recebemos o seu pedido. A nossa equipa vai confirmar a disponibilidade e responder em breve."}
      </p>
      {settings.paymentInfo && (
        <p className="mt-4 flex max-w-xl items-start gap-3 text-sm text-ink/60">
          <Wallet className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          {settings.paymentInfo}
        </p>
      )}
      <div className="mt-10 flex flex-wrap gap-3">
        {state.whatsapp && (
          <a href={state.whatsapp} target="_blank" rel="noopener noreferrer" className="pr-btn pr-btn-primary">
            <MessageCircle className="size-4" aria-hidden /> Continuar no WhatsApp
            <span className="sr-only"> (abre numa nova janela)</span>
          </a>
        )}
        <button type="button" onClick={onClose} className="pr-btn pr-btn-secondary text-ink">
          Fechar
        </button>
      </div>
    </div>
  );
}
