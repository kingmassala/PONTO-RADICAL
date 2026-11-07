import { z } from "zod";

export type OpsResult<T = null> = { ok: true; data: T } | { ok: false; error: string; details?: string[] };

const DB_MESSAGES: [RegExp, string][] = [
  [/not_authorized|row-level security|permission denied/, "O seu perfil não tem permissão para esta operação."],
  [/vessel_client_mismatch/, "A embarcação escolhida não pertence a este cliente."],
  [/parent_other_order/, "A tarefa principal tem de pertencer à mesma obra."],
  [/task_not_completed/, "Só é possível validar tarefas concluídas."],
  [/task_not_found/, "A tarefa já não existe ou não lhe está atribuída."],
  [/quote_locked/, "Este orçamento já foi submetido e não pode ser alterado. Crie uma nova versão."],
  [/quote_not_submitted/, "Só é possível decidir orçamentos submetidos."],
  [/expense_locked/, "Despesas aprovadas não podem ser alteradas nem eliminadas (integridade financeira)."],
  [/report_locked/, "Relatório já validado: não pode ser alterado."],
  [/material_not_found/, "Material inexistente no catálogo."],
  [/ops_clients_nif_idx|nif/, "Já existe um cliente com este NIF."],
  [/ops_vessels_registration_idx/, "Já existe uma embarcação com esta matrícula."],
  [/ops_members_email_idx/, "Já existe um colaborador com este email."],
  [/ops_daily_reports_work_order_id_user_id_report_date_key/, "Já submeteu um relatório para esta obra neste dia. Edite o existente."],
  [/ops_teams_name_key|ops_suppliers_name_key/, "Já existe um registo com este nome."],
  [/violates foreign key constraint/, "Não é possível concluir: existem registos associados."],
  [/whatsapp_phone/, "Telefone WhatsApp inválido. Use o formato internacional, por ex. +244923000000."],
];

export function opsDbError(message: string | undefined): string {
  const m = message ?? "";
  for (const [re, text] of DB_MESSAGES) if (re.test(m)) return text;
  return m ? `Erro: ${m}` : "Ocorreu um erro inesperado.";
}

export function opsError(error: unknown): { ok: false; error: string; details?: string[] } {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: "Verifique os campos assinalados.",
      details: error.issues.slice(0, 8).map((i) => (i.path.length ? `${i.path.join(" › ")}: ${i.message}` : i.message)),
    };
  }
  if (error instanceof Error) {
    if (error.message.startsWith("NEXT_REDIRECT")) throw error;
    return { ok: false, error: opsDbError(error.message) };
  }
  return { ok: false, error: "Ocorreu um erro inesperado." };
}
