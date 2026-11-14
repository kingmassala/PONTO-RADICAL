/** Saídas de material (guias de entrega à Promarine ou a outros clientes): constantes e validação partilhadas. */
import { z } from "zod";

export const DELIVERY_STATUSES = ["emitida", "assinada", "anulada"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  emitida: "Emitida (por assinar)",
  assinada: "Assinada",
  anulada: "Anulada",
};

export const UNITS = ["un", "cx", "kg", "g", "l", "ml", "m", "m²", "rolo", "par", "kit", "lata", "saco"] as const;

/** Destinatário sugerido numa guia nova (o cliente habitual); pode ser qualquer outro cliente. */
export const DEFAULT_RECIPIENT = "Promarine";

export type DeliveryItem = {
  id?: string;
  position?: number;
  description: string;
  reference: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
};

export type Delivery = {
  id: string;
  number: string;
  delivery_date: string;
  recipient: string;
  recipient_details: string | null;
  reference: string | null;
  delivered_by: string;
  received_by: string | null;
  notes: string | null;
  status: DeliveryStatus;
  signed_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  items: DeliveryItem[];
};

const text = (max: number) => z.string().trim().max(max);

export const deliveryItemSchema = z.object({
  description: text(200).min(2, "Indique o material."),
  reference: text(80).default("").transform((v) => v || null),
  quantity: z.coerce.number().positive("A quantidade tem de ser maior que zero.").max(1_000_000),
  unit: text(20).min(1).default("un"),
  notes: text(300).default("").transform((v) => v || null),
});

export const deliveryHeaderSchema = z.object({
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  recipient: text(120).min(2, "Indique o cliente (destinatário).").default(DEFAULT_RECIPIENT),
  recipient_details: text(500).default("").transform((v) => v || null),
  reference: text(160).default("").transform((v) => v || null),
  delivered_by: text(120).min(2, "Indique quem entrega (Ponto Radical)."),
  received_by: text(120).default("").transform((v) => v || null),
  notes: text(2000).default("").transform((v) => v || null),
});

export const deliveryInputSchema = z.object({
  header: deliveryHeaderSchema,
  items: z.array(deliveryItemSchema).min(1, "Acrescente pelo menos um material.").max(100),
});
export type DeliveryInput = z.input<typeof deliveryInputSchema>;

export function formatQuantity(q: number): string {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 3 }).format(q);
}

export function formatDeliveryDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

/** Total por material (descrição + unidade), para o controlo das saídas. */
export function summarizeItems(deliveries: Pick<Delivery, "status" | "items">[]) {
  const map = new Map<string, { description: string; unit: string; quantity: number; deliveries: number }>();
  for (const d of deliveries) {
    if (d.status === "anulada") continue;
    for (const it of d.items) {
      const key = `${it.description.trim().toLowerCase()}|${it.unit}`;
      const cur = map.get(key) ?? { description: it.description.trim(), unit: it.unit, quantity: 0, deliveries: 0 };
      cur.quantity += Number(it.quantity);
      cur.deliveries += 1;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.description.localeCompare(b.description, "pt"));
}

/** Clientes já usados em guias (mais recentes primeiro), com os últimos dados registados de cada um. */
export function knownRecipients(deliveries: Pick<Delivery, "recipient" | "recipient_details">[]) {
  const map = new Map<string, { name: string; details: string | null }>();
  for (const d of deliveries) {
    const key = d.recipient.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { name: d.recipient.trim(), details: d.recipient_details });
  }
  if (!map.has(DEFAULT_RECIPIENT.toLowerCase())) map.set(DEFAULT_RECIPIENT.toLowerCase(), { name: DEFAULT_RECIPIENT, details: null });
  return [...map.values()];
}

export const sameRecipient = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Filtros do controlo de material (iguais aos do ecrã e aos da exportação). */
export type ControlFilter = { from: string; to: string; client: string };

export function filterDeliveries<T extends Pick<Delivery, "delivery_date" | "recipient">>(deliveries: T[], f: ControlFilter): T[] {
  return deliveries.filter(
    (d) => (!f.from || d.delivery_date >= f.from) && (!f.to || d.delivery_date <= f.to) && (f.client === "todos" || !f.client || sameRecipient(d.recipient, f.client)),
  );
}

/** Célula CSV (separador «;», como o Excel em português espera). */
function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: (string | number | null | undefined)[][]): string {
  // BOM para o Excel reconhecer os acentos (UTF-8).
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

const STATUS_TEXT: Record<DeliveryStatus, string> = { emitida: "Emitida (por assinar)", assinada: "Assinada", anulada: "Anulada" };

/** Resumo por material: total fornecido no período (sem guias anuladas). */
export function controlSummaryCsv(deliveries: Delivery[], f: ControlFilter): string {
  const list = filterDeliveries(deliveries, f);
  const rows: (string | number)[][] = [["Material", "Unidade", "Quantidade fornecida", "Linhas", "Clientes", "Primeira saída", "Última saída"]];
  const extra = new Map<string, { clients: Map<string, string>; first: string; last: string }>();
  for (const d of list) {
    if (d.status === "anulada") continue;
    for (const it of d.items) {
      const key = `${it.description.trim().toLowerCase()}|${it.unit}`;
      const e = extra.get(key) ?? { clients: new Map<string, string>(), first: d.delivery_date, last: d.delivery_date };
      // O mesmo cliente escrito com maiúsculas/minúsculas diferentes conta uma vez.
      if (!e.clients.has(d.recipient.trim().toLowerCase())) e.clients.set(d.recipient.trim().toLowerCase(), d.recipient.trim());
      if (d.delivery_date < e.first) e.first = d.delivery_date;
      if (d.delivery_date > e.last) e.last = d.delivery_date;
      extra.set(key, e);
    }
  }
  for (const s of summarizeItems(list)) {
    const e = extra.get(`${s.description.trim().toLowerCase()}|${s.unit}`);
    rows.push([s.description, s.unit, s.quantity, s.deliveries, e ? [...e.clients.values()].join(", ") : "", e?.first ?? "", e?.last ?? ""]);
  }
  return csv(rows);
}

/** Detalhe: uma linha por material de cada guia (inclui anuladas, com o estado, para análise completa). */
export function controlDetailCsv(deliveries: Delivery[], f: ControlFilter): string {
  const rows: (string | number | null)[][] = [
    ["Guia", "Data", "Estado", "Cliente", "Dados do cliente", "Referência / obra", "Entregue por", "Recebido por", "Nº", "Material", "Referência do material", "Quantidade", "Unidade", "Notas da linha"],
  ];
  for (const d of [...filterDeliveries(deliveries, f)].sort((a, b) => a.delivery_date.localeCompare(b.delivery_date) || a.number.localeCompare(b.number))) {
    d.items.forEach((it, i) =>
      rows.push([
        d.number,
        d.delivery_date,
        STATUS_TEXT[d.status],
        d.recipient,
        d.recipient_details,
        d.reference,
        d.delivered_by,
        d.received_by,
        i + 1,
        it.description,
        it.reference,
        Number(it.quantity),
        it.unit,
        it.notes,
      ]),
    );
  }
  return csv(rows);
}
