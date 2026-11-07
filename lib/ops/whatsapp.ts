import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Integração com a WhatsApp Business Platform (Cloud API oficial da Meta).
 * As credenciais existem apenas em variáveis de ambiente do servidor:
 *   WHATSAPP_ACCESS_TOKEN       token permanente de um System User com whatsapp_business_messaging
 *   WHATSAPP_PHONE_NUMBER_ID    identificador do número empresarial (não é o número de telefone)
 *   WHATSAPP_APP_SECRET         segredo da app Meta (assinatura dos webhooks)
 *   WHATSAPP_VERIFY_TOKEN       texto escolhido por nós para validar o webhook
 *   WHATSAPP_GRAPH_VERSION      opcional (por omissão v23.0)
 */
export function whatsappConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  return {
    token,
    phoneNumberId,
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0",
    canSend: Boolean(token && phoneNumberId),
  };
}

/** Diagnóstico sem expor valores: indica apenas o que está definido. */
export function whatsappDiagnostics() {
  const c = whatsappConfig();
  return {
    accessToken: Boolean(c.token),
    phoneNumberId: Boolean(c.phoneNumberId),
    appSecret: Boolean(c.appSecret),
    verifyToken: Boolean(c.verifyToken),
    cronSecret: Boolean(process.env.CRON_SECRET),
    graphVersion: c.graphVersion,
  };
}

export type SendResult =
  | { ok: true; messageId: string; response: unknown; httpStatus: number }
  | { ok: false; error: string; retryable: boolean; response: unknown; httpStatus: number };

/** Envia uma mensagem de modelo aprovado. `to` em formato internacional (+244…). */
export async function sendTemplate(input: { to: string; template: string; language: string; params: string[] }): Promise<SendResult> {
  const c = whatsappConfig();
  if (!c.canSend) {
    return { ok: false, error: "WhatsApp não configurado (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID).", retryable: false, response: null, httpStatus: 0 };
  }
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to.replace(/[^0-9]/g, ""),
    type: "template",
    template: {
      name: input.template,
      language: { code: input.language },
      ...(input.params.length
        ? { components: [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text: sanitizeParam(text) })) }] }
        : {}),
    },
  };
  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${c.graphVersion}/${c.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return { ok: false, error: `Falha de rede: ${(error as Error).message}`, retryable: true, response: null, httpStatus: 0 };
  }
  const json = (await res.json().catch(() => null)) as {
    messages?: { id: string }[];
    error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } };
  } | null;
  const id = json?.messages?.[0]?.id;
  if (res.ok && id) return { ok: true, messageId: id, response: json, httpStatus: res.status };

  const code = json?.error?.code;
  const detail = json?.error?.error_data?.details ?? json?.error?.message ?? `HTTP ${res.status}`;
  // Limites de envio, erros temporários e do servidor: repetir mais tarde.
  const retryable = res.status === 429 || res.status >= 500 || code === 4 || code === 80007 || code === 130429 || code === 131016 || code === 131048;
  return { ok: false, error: `${code ? `[${code}] ` : ""}${detail}`, retryable, response: json, httpStatus: res.status };
}

/** A Meta rejeita parâmetros com quebras de linha, tabulações ou mais de 4 espaços seguidos. */
export function sanitizeParam(text: string): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return (clean || "—").slice(0, 900);
}

/** Valida a assinatura X-Hub-Signature-256 de um webhook da Meta. */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = whatsappConfig().appSecret;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const given = header.slice(7);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}
