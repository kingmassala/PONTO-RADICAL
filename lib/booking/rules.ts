import { z } from "zod";
import type { BookingSettings, Service, SiteDocument } from "@/lib/cms/schema";
import { LOCALE_INFO, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Regras dos pedidos de reserva, partilhadas pelo formulário (browser) e pela
 * validação no servidor. Não há motor de disponibilidade: os dias e horários
 * do serviço limitam o que o cliente pode pedir, e a equipa confirma no painel.
 */

export const BOOKING_TZ = "Africa/Luanda";

export const BOOKING_STATUSES = ["novo", "confirmado", "proposta", "recusado", "concluido", "cancelado"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  proposta: "Nova data proposta",
  recusado: "Recusado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** Etiqueta usada quando o serviço não tem horários definidos. */
export const FLEXIBLE_SLOT = "A combinar";

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const WEEKDAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Data de hoje (AAAA-MM-DD) no fuso de Luanda. */
export function todayIso(now: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BOOKING_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function isValidIsoDate(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Primeira e última data que se podem pedir hoje. */
export function bookingWindow(settings: BookingSettings, now: Date = new Date()) {
  const today = todayIso(now);
  return { first: addDays(today, settings.minNoticeDays), last: addDays(today, settings.maxAdvanceDays) };
}

/** Motivo pelo qual uma data não pode ser pedida, ou null se for válida. */
export function dateProblem(service: Service, settings: BookingSettings, iso: string, now: Date = new Date()): string | null {
  if (!isValidIsoDate(iso)) return "Escolha uma data.";
  const { first, last } = bookingWindow(settings, now);
  if (iso < first) {
    return settings.minNoticeDays === 0
      ? "Essa data já passou."
      : `Os pedidos são feitos com pelo menos ${settings.minNoticeDays} dia(s) de antecedência.`;
  }
  if (iso > last) return "Essa data ainda não está aberta para pedidos.";
  if (service.weekdays.length > 0 && !service.weekdays.includes(weekdayOf(iso))) {
    return "Esta experiência não se realiza nesse dia da semana.";
  }
  return null;
}

export function slotPhrase(slot: string, locale: Locale = "pt"): string {
  const f = getMessages(locale).format;
  return slot === FLEXIBLE_SLOT ? f.flexibleSlot : f.atTime(slot);
}

/** Etiqueta de um horário na interface (o valor «A combinar» é traduzido). */
export function slotLabel(slot: string, locale: Locale = "pt"): string {
  return slot === FLEXIBLE_SLOT ? getMessages(locale).format.flexibleLabel : slot;
}

export function slotOptions(service: Service): string[] {
  return service.timeSlots.length > 0 ? [...service.timeSlots].sort() : [FLEXIBLE_SLOT];
}

export function isServiceBookable(doc: Pick<SiteDocument, "booking">, service: Service | undefined): service is Service {
  return Boolean(service && service.visible && service.bookable && doc.booking.enabled);
}

/* ----------------------------- Formulário ----------------------------- */

export type BookingField = "serviceId" | "date" | "slot" | "people" | "name" | "email" | "phone" | "notes";

export const bookingInputSchema = z.object({
  serviceId: z.string().trim().min(1, "Escolha uma experiência.").max(64),
  date: z.string().trim().max(10),
  slot: z.string().trim().max(40),
  people: z.coerce.number({ message: "Indique o número de pessoas." }).int("Indique o número de pessoas."),
  name: z.string().trim().min(2, "Indique o seu nome.").max(120),
  email: z.string().trim().email("Indique um email válido.").max(254),
  phone: z
    .string()
    .trim()
    .min(6, "Indique um telefone para contacto.")
    .max(40)
    .regex(/^[0-9+()\s.-]*$/, "Telefone inválido."),
  notes: z.string().trim().max(2000, "As observações são demasiado longas.").optional().default(""),
});
export type BookingInput = z.infer<typeof bookingInputSchema>;

export type ValidBooking = BookingInput & { service: Service };

/**
 * Valida um pedido contra o documento publicado: serviço existente e
 * reservável, data dentro da janela e num dia disponível, horário da lista
 * e número de pessoas dentro da capacidade.
 */
export function validateBooking(
  doc: Pick<SiteDocument, "services" | "booking">,
  raw: Record<string, unknown>,
  now: Date = new Date(),
): { ok: true; data: ValidBooking } | { ok: false; fieldErrors: Partial<Record<BookingField, string>> } {
  const fieldErrors: Partial<Record<BookingField, string>> = {};
  const parsed = bookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as BookingField;
      fieldErrors[key] ??= issue.message;
    }
  }

  const serviceId = typeof raw.serviceId === "string" ? raw.serviceId : "";
  const service = doc.services.find((s) => s.id === serviceId);
  if (!isServiceBookable(doc, service)) {
    return { ok: false, fieldErrors: { ...fieldErrors, serviceId: "Esta experiência não está disponível para reserva." } };
  }

  const date = typeof raw.date === "string" ? raw.date.trim() : "";
  const problem = dateProblem(service, doc.booking, date, now);
  if (problem) fieldErrors.date = problem;

  const slot = typeof raw.slot === "string" ? raw.slot.trim() : "";
  if (!slotOptions(service).includes(slot)) fieldErrors.slot = "Escolha um horário.";

  const people = Number(raw.people);
  if (!fieldErrors.people && (!Number.isInteger(people) || people < service.minPeople || people > service.maxPeople)) {
    fieldErrors.people =
      service.minPeople === service.maxPeople
        ? `Esta experiência é para ${service.maxPeople} pessoa(s).`
        : `Entre ${service.minPeople} e ${service.maxPeople} pessoas por reserva.`;
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, data: { ...parsed.data, date, slot, service } };
}

/* ------------------------------ Formatação ------------------------------ */

export function formatKwanza(value: number, locale: Locale = "pt"): string {
  return `${new Intl.NumberFormat(LOCALE_INFO[locale].intl, { maximumFractionDigits: 0 }).format(value)} Kz`;
}

export function formatPrice(service: Pick<Service, "priceFrom" | "priceUnit">, locale: Locale = "pt"): string | null {
  if (service.priceFrom === null) return null;
  const f = getMessages(locale).format;
  return `${formatKwanza(service.priceFrom, locale)} / ${service.priceUnit === "pessoa" ? f.perPerson : f.perGroup}`;
}

export function formatDuration(minutes: number, locale: Locale = "pt"): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  if (minutes >= 24 * 60 && minutes % (24 * 60) === 0) {
    return getMessages(locale).format.days(minutes / (24 * 60));
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatPeople(service: Pick<Service, "minPeople" | "maxPeople">, locale: Locale = "pt"): string {
  const f = getMessages(locale).format;
  if (service.minPeople === service.maxPeople) return f.person(service.maxPeople);
  return f.peopleRange(service.minPeople, service.maxPeople);
}

/** Data longa (ex.: «sábado, 24 de outubro de 2026»). */
export function formatLongDate(iso: string, locale: Locale = "pt"): string {
  if (!isValidIsoDate(iso)) return iso;
  return new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

export function formatShortDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso;
  return new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

export function whatsappHref(number: string, text?: string): string | null {
  const digits = number.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
