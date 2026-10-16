import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { MessageRow, STATUS_LABELS, type Message } from "@/components/admin/messages";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState, Notice } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Mensagens" };
// Dados da sessão, lidos no pedido: a página pode bloquear (o indicador vem de ../loading.tsx).
export const instant = false;

const FILTERS = ["todas", "novo", "em_curso", "respondido", "arquivado"] as const;

export default async function MessagesPage({ searchParams }: PageProps<"/admin/mensagens">) {
  const user = await requireStaffPage();
  const { estado } = (await searchParams) as { estado?: string };
  const filter = FILTERS.includes(estado as (typeof FILTERS)[number]) ? (estado as (typeof FILTERS)[number]) : "todas";
  const supabase = await createClient();
  let query = supabase
    .from("contact_messages")
    .select("id, name, email, phone, subject, message, status, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter !== "todas") query = query.eq("status", filter);
  const { data, error } = await query;

  return (
    <>
      <PageHeader title="Mensagens" description="Pedidos recebidos através do formulário de contacto do website." />
      {!isServiceRoleConfigured() && (
        <div className="mb-6">
          <Notice tone="warning" title="O formulário de contacto ainda não está activo.">
            Defina a variável SUPABASE_SECRET_KEY no servidor (ver docs/INSTALACAO.md) para que as mensagens sejam gravadas.
          </Notice>
        </div>
      )}
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar por estado">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "todas" ? "/admin/mensagens" : `/admin/mensagens?estado=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm ${filter === f ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {f === "todas" ? "Todas" : STATUS_LABELS[f]}
          </Link>
        ))}
      </nav>
      {error && <Notice tone="error">{error.message}</Notice>}
      {(data ?? []).length === 0 ? (
        <EmptyState title="Sem mensagens">As mensagens enviadas pelo formulário do website aparecem aqui.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {(data as Message[]).map((m) => (
            <MessageRow key={m.id} message={m} canDelete={user.role === "admin"} />
          ))}
        </ul>
      )}
    </>
  );
}
