import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { verifyWebhookSignature, whatsappConfig } from "@/lib/ops/whatsapp";

/**
 * Webhook da WhatsApp Cloud API.
 * GET  — verificação do endereço pela Meta (hub.challenge).
 * POST — estados das mensagens (sent/delivered/read/failed) e mensagens recebidas.
 *        «PARAR»/«STOP» retira o consentimento do colaborador.
 */
export async function GET(request: NextRequest) {
  await connection();
  const p = request.nextUrl.searchParams;
  const token = whatsappConfig().verifyToken;
  if (p.get("hub.mode") === "subscribe" && token && p.get("hub.verify_token") === token) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

type Status = { id: string; status: string; timestamp?: string; recipient_id?: string; errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[] };
type Inbound = { from: string; id: string; type: string; text?: { body?: string }; button?: { text?: string } };

const STATUS_MAP: Record<string, string> = { sent: "enviada", delivered: "entregue", read: "lida", failed: "falhada" };
const RANK: Record<string, number> = { agendada: 0, em_envio: 1, enviada: 2, entregue: 3, lida: 4, falhada: 5, cancelada: 5 };

export async function POST(request: NextRequest) {
  await connection();
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true });
  const db = createAdminClient();
  let payload: { entry?: { changes?: { value?: { statuses?: Status[]; messages?: Inbound[] } }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        await db.from("ops_whatsapp_events").insert({ kind: "status", wa_message_id: s.id, status: s.status, payload: s });
        const next = STATUS_MAP[s.status];
        if (!next) continue;
        const { data: current } = await db.from("ops_notifications").select("id, status").eq("wa_message_id", s.id).maybeSingle();
        if (!current) continue;
        // Os webhooks podem chegar fora de ordem: nunca recuar de «lida» para «entregue».
        if (next !== "falhada" && RANK[next] <= RANK[current.status as string]) continue;
        const at = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString();
        const patch: Record<string, unknown> = { status: next };
        if (next === "entregue") patch.delivered_at = at;
        if (next === "lida") patch.read_at = at;
        if (next === "falhada") patch.last_error = s.errors?.map((e) => `[${e.code}] ${e.error_data?.details ?? e.message ?? e.title}`).join("; ") ?? "Falhou";
        await db.from("ops_notifications").update(patch).eq("id", current.id);
      }
      for (const m of change.value?.messages ?? []) {
        await db.from("ops_whatsapp_events").insert({ kind: "message", wa_message_id: m.id, from_phone: m.from, payload: m });
        const text = (m.text?.body ?? m.button?.text ?? "").trim().toUpperCase();
        if (["PARAR", "STOP", "CANCELAR", "SAIR"].includes(text)) {
          await db
            .from("ops_members")
            .update({ whatsapp_consent: false, whatsapp_consent_at: new Date().toISOString(), whatsapp_consent_source: "Pedido por WhatsApp (PARAR)" })
            .eq("whatsapp_phone", `+${m.from.replace(/[^0-9]/g, "")}`);
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}
