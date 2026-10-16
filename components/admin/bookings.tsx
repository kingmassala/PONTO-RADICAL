"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Check, ChevronDown, Clock, Mail, MessageCircle, Phone, Trash2, Users, X } from "lucide-react";
import { deleteBooking, updateBooking } from "@/lib/booking/admin-actions";
import {
  BOOKING_STATUS_LABELS,
  formatKwanza,
  formatLongDate,
  slotPhrase,
  todayIso,
  whatsappHref,
  type BookingStatus,
} from "@/lib/booking/rules";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, cx, Notice, Select } from "./ui";

export type Booking = {
  id: string;
  reference: string;
  service_id: string;
  service_name: string;
  service_snapshot: { meetingPoint?: string; priceFrom?: number | null; priceUnit?: string; category?: string } | null;
  requested_date: string;
  time_slot: string;
  people: number;
  name: string;
  email: string;
  phone: string;
  notes: string | null;
  status: BookingStatus;
  proposed_date: string | null;
  proposed_slot: string | null;
  internal_notes: string | null;
  quoted_amount: number | null;
  payment_status: "pendente" | "pago" | "reembolsado" | "nao_aplicavel";
  created_at: string;
};

export const BOOKING_STATUS_TONES: Record<BookingStatus, "sky" | "green" | "amber" | "red" | "slate"> = {
  novo: "sky",
  confirmado: "green",
  proposta: "amber",
  recusado: "red",
  concluido: "slate",
  cancelado: "slate",
};

const PAYMENT_LABELS = { pendente: "Por pagar", pago: "Pago", reembolsado: "Reembolsado", nao_aplicavel: "Não aplicável" } as const;

export function dayPart(iso: string, part: "weekday" | "month"): string {
  return new Intl.DateTimeFormat("pt-PT", { [part]: "short", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace(".", "");
}

/** Mensagem pré-escrita para responder ao cliente, conforme o estado. */
function replyText(b: Booking, status: BookingStatus, proposedDate: string, proposedSlot: string): string {
  const first = b.name.split(" ")[0];
  const what = `${b.service_name}, ${formatLongDate(b.requested_date)}, ${slotPhrase(b.time_slot)}, ${b.people} pessoa(s)`;
  switch (status) {
    case "confirmado":
      return `Olá ${first}! O seu pedido de reserva ${b.reference} (${what}) está confirmado.${
        b.service_snapshot?.meetingPoint ? ` Ponto de encontro: ${b.service_snapshot.meetingPoint}.` : ""
      } Enviaremos os dados para pagamento. Até breve — Ponto Radical`;
    case "proposta":
      return `Olá ${first}! Sobre o seu pedido ${b.reference} (${b.service_name}): a data pedida não está disponível. Podemos propor ${
        proposedDate ? formatLongDate(proposedDate) : "outra data"
      }${proposedSlot ? `, às ${proposedSlot}` : ""}. Diga-nos se lhe convém. — Ponto Radical`;
    case "recusado":
      return `Olá ${first}! Lamentamos, mas não nos é possível realizar o pedido ${b.reference} (${what}). Fale connosco para encontrarmos uma alternativa. — Ponto Radical`;
    default:
      return `Olá ${first}! Recebemos o seu pedido de reserva ${b.reference} (${what}). — Ponto Radical`;
  }
}

export function BookingRow({ booking, canDelete, defaultOpen }: { booking: Booking; canDelete: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? booking.status === "novo");
  const [status, setStatus] = useState<BookingStatus>(booking.status);
  const [notes, setNotes] = useState(booking.internal_notes ?? "");
  const [proposedDate, setProposedDate] = useState(booking.proposed_date ?? "");
  const [proposedSlot, setProposedSlot] = useState(booking.proposed_slot ?? "");
  const [amount, setAmount] = useState(booking.quoted_amount === null ? "" : String(booking.quoted_amount));
  const [payment, setPayment] = useState(booking.payment_status);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = (next: Partial<{ status: BookingStatus }> = {}) =>
    startTransition(async () => {
      const nextStatus = next.status ?? status;
      if (next.status) setStatus(next.status);
      const r = await updateBooking(booking.id, {
        status: nextStatus,
        internalNotes: notes,
        proposedDate,
        proposedSlot,
        quotedAmount: amount.trim() === "" ? null : Number(amount),
        paymentStatus: payment,
      });
      if (r.ok) {
        setError(null);
        setSaved(true);
      } else {
        setError(r.details?.join(" ") || r.error);
        setSaved(false);
        if (next.status) setStatus(booking.status);
      }
    });

  const text = replyText(booking, status, proposedDate, proposedSlot);
  const wa = whatsappHref(booking.phone, text);
  const past = booking.requested_date < todayIso();

  return (
    <li id={`reserva-${booking.id}`} className={cx("scroll-mt-24 rounded-xl border bg-white shadow-sm", booking.status === "novo" ? "border-sky-300" : "border-slate-200")}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-4 px-5 py-4 text-left">
        <div className={cx("flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5 text-center", past ? "bg-slate-100 text-slate-500" : "bg-orange-50 text-orange-700")}>
          <span className="text-[0.65rem] font-semibold uppercase">{dayPart(booking.requested_date, "weekday")}</span>
          <span className="text-xl font-bold leading-none">{Number(booking.requested_date.slice(8))}</span>
          <span className="text-[0.65rem] uppercase">{dayPart(booking.requested_date, "month")}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{booking.service_name}</p>
            <Badge tone={BOOKING_STATUS_TONES[booking.status]}>{BOOKING_STATUS_LABELS[booking.status]}</Badge>
            {booking.payment_status === "pago" && <Badge tone="green">Pago</Badge>}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {booking.time_slot}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {booking.people}
            </span>
            <span>{booking.name}</span>
            <span className="font-mono text-xs text-slate-400">{booking.reference}</span>
          </p>
        </div>
        <ChevronDown className={cx("mt-1 size-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-100 px-5 py-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="flex items-center gap-2 font-medium text-slate-800">
                <CalendarDays className="size-4 text-slate-400" />
                <span className="first-letter:uppercase">{formatLongDate(booking.requested_date)}</span>, {slotPhrase(booking.time_slot)}
              </p>
              <p className="text-slate-500">
                {booking.people} pessoa(s)
                {booking.service_snapshot?.category ? ` · ${booking.service_snapshot.category}` : ""}
                {typeof booking.service_snapshot?.priceFrom === "number"
                  ? ` · desde ${formatKwanza(booking.service_snapshot.priceFrom)}/${booking.service_snapshot.priceUnit === "grupo" ? "grupo" : "pessoa"}`
                  : ""}
              </p>
              <p className="text-xs text-slate-400">Recebido em {formatDateTime(booking.created_at)}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <a href={`mailto:${booking.email}?subject=${encodeURIComponent(`Pedido de reserva ${booking.reference}`)}&body=${encodeURIComponent(text)}`} className="inline-flex items-center gap-1.5 text-sky-700 hover:underline">
                <Mail className="size-4" /> {booking.email}
              </a>
              <a href={`tel:${booking.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1.5 text-sky-700 hover:underline">
                <Phone className="size-4" /> {booking.phone}
              </a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline">
                  <MessageCircle className="size-4" /> Responder no WhatsApp ({BOOKING_STATUS_LABELS[status].toLowerCase()})
                </a>
              )}
            </div>
          </div>
          {booking.notes && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{booking.notes}</p>}

          {status === "novo" && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => save({ status: "confirmado" })} loading={pending}>
                <Check className="size-3.5" /> Confirmar
              </Button>
              <Button size="sm" onClick={() => setStatus("proposta")}>
                <CalendarDays className="size-3.5" /> Propor outra data
              </Button>
              <Button size="sm" variant="danger" onClick={() => save({ status: "recusado" })}>
                <X className="size-3.5" /> Recusar
              </Button>
            </div>
          )}

          {error && <Notice tone="error">{error}</Notice>}

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Estado"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setSaved(false);
              }}
              options={Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => ({ value: value as BookingStatus, label }))}
            />
            {status === "proposta" && (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  Data proposta *
                  <input
                    type="date"
                    value={proposedDate}
                    onChange={(e) => setProposedDate(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Hora proposta
                  <input
                    value={proposedSlot}
                    maxLength={40}
                    placeholder="09:00"
                    onChange={(e) => setProposedSlot(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-sky-500"
                  />
                </label>
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Valor acordado (Kz)
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-sky-500"
              />
            </label>
            <Select
              label="Pagamento"
              value={payment}
              onChange={setPayment}
              options={Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value: value as Booking["payment_status"], label }))}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`bnotes-${booking.id}`}>
              Notas internas
            </label>
            <textarea
              id={`bnotes-${booking.id}`}
              value={notes}
              maxLength={4000}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button size="sm" variant="primary" onClick={() => save()} loading={pending}>
                Guardar
              </Button>
              {saved && !pending && <span className="text-xs text-emerald-700">Guardado.</span>}
            </div>
            {canDelete && (
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  window.confirm(`Eliminar definitivamente o pedido ${booking.reference}?`) &&
                  startTransition(async () => {
                    const r = await deleteBooking(booking.id);
                    if (!r.ok) setError(r.error);
                  })
                }
              >
                <Trash2 className="size-3.5" /> Eliminar
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
