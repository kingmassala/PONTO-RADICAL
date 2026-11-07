import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/supabase/env";
import { whatsappConfig } from "@/lib/whatsapp";
import { TASK_COLUMNS } from "@/lib/tasks/alerts";
import type { Task } from "@/lib/tasks/rules";
import { NewTaskHeaderButton, TaskBoard, type TaskAlertRow } from "@/components/admin/tasks";
import { PageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Tarefas" };
export const instant = false;

export default async function TasksPage({ searchParams }: PageProps<"/admin/tarefas">) {
  const user = await requireStaffPage();
  const { t } = (await searchParams) as { t?: string };
  const supabase = await createClient();
  const [tasks, alerts] = await Promise.all([
    supabase.from("pr_tasks").select(TASK_COLUMNS).order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(500),
    supabase.from("pr_task_alerts").select("task_id, kind, status, error, created_at").order("created_at", { ascending: false }).limit(1000),
  ]);

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Registo e controlo das tarefas da equipa. Cada tarefa tem um responsável e um prazo; o responsável é avisado no WhatsApp quando a tarefa é atribuída, antes do prazo e se ficar em atraso."
        actions={<NewTaskHeaderButton />}
      />
      {tasks.error && (
        <div className="mb-6">
          <Notice tone="error">{tasks.error.message}</Notice>
        </div>
      )}
      <TaskBoard
        tasks={(tasks.data ?? []) as Task[]}
        alerts={(alerts.data ?? []) as TaskAlertRow[]}
        canDelete={user.role === "admin"}
        whatsappReady={whatsappConfig().canSend}
        siteUrl={SITE_URL}
        focusCode={typeof t === "string" ? t : undefined}
      />
    </>
  );
}
