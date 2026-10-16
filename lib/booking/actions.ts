"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getPublishedSite } from "@/lib/cms/published";
import { stripHtml } from "@/lib/cms/sanitize";
import { formatLongDate, slotPhrase, validateBooking, whatsappHref, type BookingField } from "./rules";

export type BookingState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<BookingField, string>>;
  /** Referência do pedido, para o cliente citar ao falar com a equipa. */
  reference?: string;
  /** Ligação para continuar a conversa no WhatsApp (se configurado). */
  whatsapp?: string;
};

const MIN_FILL_MS = 4000; // escolher data, horário e preencher contactos demora sempre alguns segundos
const RATE_LIMIT = 4; // pedidos por IP
const RATE_WINDOW_MIN = 30;

export async function submitBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  // Armadilhas anti-spam (iguais às do formulário de contacto): campo invisível e tempo mínimo.
  const honeypot = String(formData.get("website") ?? "");
  const startedAt = Number(formData.get("startedAt") ?? 0);
  if (honeypot || !startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    // Resposta neutra para não ajudar bots a afinar o envio.
    return { status: "success" };
  }

  const { doc } = await getPublishedSite();
  const result = validateBooking(doc, {
    serviceId: formData.get("serviceId"),
    date: formData.get("date"),
    slot: formData.get("slot"),
    people: formData.get("people"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes") ?? "",
  });
  if (!result.ok) {
    return { status: "error", message: "Verifique os campos assinalados.", fieldErrors: result.fieldErrors };
  }

  const fallbackWhatsapp = doc.contact.whatsapp ? whatsappHref(doc.contact.whatsapp) : null;
  if (!isServiceRoleConfigured()) {
    return {
      status: "error",
      message: "As reservas online ainda não estão activas. Contacte-nos por telefone ou WhatsApp para reservar.",
      whatsapp: fallbackWhatsapp ?? undefined,
    };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "desconhecido";
  const salt = process.env.CONTACT_IP_SALT ?? "ponto-radical";
  const ipHash = createHash("sha256").update(`${salt}:${ip}`).digest("hex");

  const supabase = createAdminClient();
  const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabase
    .from("booking_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT) {
    return {
      status: "error",
      message: "Recebemos vários pedidos a partir desta ligação. Aguarde alguns minutos ou contacte-nos directamente.",
    };
  }

  const { service, ...data } = result.data;
  const { data: row, error } = await supabase
    .from("booking_requests")
    .insert({
      service_id: service.id,
      service_name: service.name,
      service_snapshot: {
        slug: service.slug,
        categoryId: service.categoryId,
        category: doc.serviceCategories.find((c) => c.id === service.categoryId)?.label ?? "",
        durationMinutes: service.durationMinutes,
        priceFrom: service.priceFrom,
        priceUnit: service.priceUnit,
        meetingPoint: service.meetingPoint,
      },
      requested_date: data.date,
      time_slot: data.slot,
      people: data.people,
      name: stripHtml(data.name),
      email: data.email,
      phone: stripHtml(data.phone),
      notes: stripHtml(data.notes) || null,
      ip_hash: ipHash,
      user_agent: (h.get("user-agent") ?? "").slice(0, 300),
    })
    .select("reference")
    .single();
  if (error || !row) {
    console.error("Erro ao gravar pedido de reserva:", error?.message);
    return { status: "error", message: "Não foi possível enviar o pedido. Tente novamente dentro de instantes." };
  }

  const reference = row.reference as string;
  const whatsapp =
    doc.booking.whatsappFollowUp && doc.contact.whatsapp
      ? whatsappHref(
          doc.contact.whatsapp,
          `Olá! Acabei de enviar o pedido de reserva ${reference}: ${service.name}, ${formatLongDate(data.date)}, ${slotPhrase(data.slot)}, ${data.people} pessoa(s).`,
        )
      : null;
  return { status: "success", reference, whatsapp: whatsapp ?? undefined };
}
