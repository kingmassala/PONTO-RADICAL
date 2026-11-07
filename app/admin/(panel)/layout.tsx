import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireStaffPage } from "@/lib/auth";
import { documentsEqual, getDraft, getPublishedState } from "@/lib/cms/draft";
import { checkDocument } from "@/lib/cms/validate";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/admin/sidebar";
import { PublishBar } from "@/components/admin/publish-bar";
import { RevisionProvider } from "@/components/admin/draft-editor";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-400">
          <Loader2 className="size-6 animate-spin" aria-label="A carregar" />
        </div>
      }
    >
      <PanelShell>{children}</PanelShell>
    </Suspense>
  );
}

async function PanelShell({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  const supabase = await createClient();
  // Tarefas em atraso ou a vencer nas próximas 24 h (o detalhe por lembrete está na página Tarefas).
  const soon = isoFromNow(24);
  const [draft, published, unread, bookings, lateTasks, unsigned] = await Promise.all([
    getDraft(),
    getPublishedState(),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "novo"),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "novo"),
    supabase.from("pr_tasks").select("id", { count: "exact", head: true }).in("status", ["pendente", "em_curso"]).lte("due_at", soon),
    supabase.from("pr_material_deliveries").select("id", { count: "exact", head: true }).eq("status", "emitida"),
  ]);
  const hasUnpublished = !published || !documentsEqual(draft.doc, published.doc);

  return (
    <RevisionProvider revision={draft.revision}>
      <Sidebar
        user={user}
        unreadMessages={unread.count ?? 0}
        newBookings={bookings.count ?? 0}
        lateTasks={lateTasks.count ?? 0}
        unsignedDeliveries={unsigned.count ?? 0}
      />
      <div className="lg:pl-64">
        <PublishBar hasUnpublished={hasUnpublished} publishedAt={published?.publishedAt ?? null} issues={checkDocument(draft.doc)} />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </RevisionProvider>
  );
}

/** Instante (ISO) daqui a N horas; chamado só durante o pedido, depois da verificação de sessão. */
function isoFromNow(hours: number) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}
