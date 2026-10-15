"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { stripHtml } from "@/lib/cms/sanitize";

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "phone" | "subject" | "message", string>>;
};

const contactSchema = z.object({
  name: z.string().trim().min(2, "Indique o seu nome.").max(120),
  email: z.string().trim().email("Indique um email válido.").max(254),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[0-9+()\s.-]*$/, "Telefone inválido.")
    .optional()
    .default(""),
  subject: z.string().trim().min(2, "Indique o assunto.").max(160),
  message: z.string().trim().min(10, "A mensagem deve ter pelo menos 10 caracteres.").max(5000),
});

const MIN_FILL_MS = 3000; // um humano demora pelo menos alguns segundos a preencher
const RATE_LIMIT = 3; // mensagens por IP
const RATE_WINDOW_MIN = 15;

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Armadilhas anti-spam: campo invisível e tempo mínimo de preenchimento.
  const honeypot = String(formData.get("website") ?? "");
  const startedAt = Number(formData.get("startedAt") ?? 0);
  if (honeypot || !startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    // Resposta neutra para não ajudar bots a afinar o envio.
    return { status: "success" };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    const fieldErrors: ContactState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<ContactState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Verifique os campos assinalados.", fieldErrors };
  }

  if (!isServiceRoleConfigured()) {
    return {
      status: "error",
      message: "O formulário ainda não está configurado. Contacte-nos por telefone ou email.",
    };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "desconhecido";
  const salt = process.env.CONTACT_IP_SALT ?? "ponto-radical";
  const ipHash = createHash("sha256").update(`${salt}:${ip}`).digest("hex");

  const supabase = createAdminClient();
  const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabase
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT) {
    return {
      status: "error",
      message: "Recebemos várias mensagens a partir desta ligação. Aguarde alguns minutos e tente novamente.",
    };
  }

  const data = parsed.data;
  const { error } = await supabase.from("contact_messages").insert({
    name: stripHtml(data.name),
    email: data.email,
    phone: stripHtml(data.phone) || null,
    subject: stripHtml(data.subject),
    message: stripHtml(data.message),
    ip_hash: ipHash,
    user_agent: (h.get("user-agent") ?? "").slice(0, 300),
  });
  if (error) {
    console.error("Erro ao gravar contacto:", error.message);
    return { status: "error", message: "Não foi possível enviar a mensagem. Tente novamente dentro de instantes." };
  }

  return { status: "success" };
}
