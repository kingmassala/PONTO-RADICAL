"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorResult, friendlyDbError, type ActionResult } from "@/lib/cms/errors";
import { BOOKING_STATUSES, isValidIsoDate } from "./rules";

const PAYMENT_STATUSES = ["pendente", "pago", "reembolsado", "nao_aplicavel"] as const;

const updateSchema = z
  .object({
    status: z.enum(BOOKING_STATUSES),
    internalNotes: z.string().trim().max(4000).default(""),
    proposedDate: z.string().trim().default(""),
    proposedSlot: z.string().trim().max(40).default(""),
    quotedAmount: z.number().min(0).max(1_000_000_000).nullable().default(null),
    paymentStatus: z.enum(PAYMENT_STATUSES).default("pendente"),
  })
  .refine((v) => v.proposedDate === "" || isValidIsoDate(v.proposedDate), { message: "Data proposta inválida.", path: ["proposedDate"] })
  .refine((v) => v.status !== "proposta" || v.proposedDate !== "", {
    message: "Indique a data que quer propor ao cliente.",
    path: ["proposedDate"],
  });

/**
 * Actualiza o estado e as notas de um pedido. As mudanças de estado ficam
 * registadas na auditoria por um trigger da base de dados.
 */
export async function updateBooking(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireStaff();
    const v = updateSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("booking_requests")
      .update({
        status: v.status,
        internal_notes: v.internalNotes || null,
        proposed_date: v.proposedDate || null,
        proposed_slot: v.proposedSlot || null,
        quoted_amount: v.quotedAmount,
        payment_status: v.paymentStatus,
      })
      .eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteBooking(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("booking_requests").delete().eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    return errorResult(error);
  }
}
