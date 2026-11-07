import { z } from "zod";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string; details?: string[] };

const LABELS: Record<string, string> = {
  sections: "Secções",
  brands: "Marcas",
  services: "Serviços",
  serviceCategories: "Categorias",
  booking: "Reservas",
  slug: "Endereço",
  timeSlots: "Horários",
  minPeople: "Mínimo de pessoas",
  maxPeople: "Máximo de pessoas",
  appearance: "Aparência",
  navigation: "Menu",
  contact: "Contactos",
  store: "Loja Online",
  seo: "SEO",
  footer: "Rodapé",
  settings: "Definições",
  title: "Título",
  anchor: "Âncora",
  url: "Endereço",
  label: "Texto",
  name: "Nome",
  email: "Email",
  description: "Descrição",
  responsibleName: "Responsável",
  responsiblePhone: "Telemóvel",
  dueLocal: "Prazo",
  header: "Guia",
  items: "Materiais",
  quantity: "Quantidade",
  unit: "Unidade",
  delivery_date: "Data",
  delivered_by: "Entreguei",
  recipient: "Destinatário",
};

export function formatZodError(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((issue) => {
    const path = issue.path.map((p) => (typeof p === "number" ? `#${p + 1}` : (LABELS[String(p)] ?? String(p))));
    return path.length ? `${path.join(" › ")}: ${issue.message}` : issue.message;
  });
}

/** Converte erros do Postgres/Supabase em mensagens compreensíveis. */
export function friendlyDbError(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("revision_conflict")) {
    return "O conteúdo foi alterado entretanto (noutro separador ou por outro utilizador). Recarregue a página para continuar a partir da versão mais recente.";
  }
  if (m.includes("not_authorized")) return "Não tem permissão para esta operação.";
  if (m.includes("cannot_demote_self")) return "Não pode retirar a si próprio o papel de administrador.";
  if (m.includes("last_admin")) return "Tem de existir pelo menos um administrador.";
  if (m.includes("version_not_found")) return "A versão indicada já não existe.";
  if (m.includes("draft_missing")) return "O rascunho não existe. Execute o seed inicial.";
  if (m.includes("delivery_locked")) return "Esta guia já foi assinada ou anulada e não pode ser alterada.";
  if (m.includes("delivery_no_items")) return "Acrescente pelo menos um material à guia.";
  if (m.includes("delivery_bad_status")) return "Uma guia nova começa sempre como «emitida».";
  if (m.includes("pr_deliveries_cancel_reason")) return "Indique o motivo da anulação.";
  if (m.includes("responsible_phone")) return "Telemóvel do responsável inválido (use o formato +244 923 456 789).";
  return m ? `Erro: ${m}` : "Ocorreu um erro inesperado.";
}

export function errorResult(error: unknown): { ok: false; error: string; details?: string[] } {
  if (error instanceof z.ZodError) {
    return { ok: false, error: "Existem campos inválidos.", details: formatZodError(error) };
  }
  if (error instanceof Error) return { ok: false, error: friendlyDbError(error.message) };
  return { ok: false, error: "Ocorreu um erro inesperado." };
}
