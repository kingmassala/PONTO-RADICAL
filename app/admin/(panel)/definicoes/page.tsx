import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth";
import { getDraft } from "@/lib/cms/draft";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { SiteSettingsEditor } from "@/components/admin/part-editors";
import { AccountSettings } from "@/components/admin/account-settings";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Definições" };

const ACTIONS: Record<string, string> = {
  "draft.save": "Guardou rascunho",
  "draft.restore": "Restaurou versão para o rascunho",
  "site.publish": "Publicou o website",
  "media.upload": "Carregou ficheiro",
  "media.replace": "Substituiu imagem",
  "media.delete": "Eliminou ficheiro",
  "message.update": "Actualizou mensagem",
  "message.delete": "Eliminou mensagem",
  "user.invite": "Convidou utilizador",
  "user.role": "Alterou permissões",
  "user.password": "Alterou a palavra-passe",
};

export default async function SettingsPage() {
  const user = await requireStaffPage();
  const { doc } = await getDraft();
  const supabase = await createClient();
  const audit =
    user.role === "admin"
      ? (await supabase.from("audit_log").select("id, actor_email, action, details, created_at").order("id", { ascending: false }).limit(40)).data ?? []
      : [];

  return (
    <>
      <PageHeader title="Definições" description="Definições gerais do website e da sua conta." />
      <div className="space-y-6">
        <SiteSettingsEditor value={doc.settings} />
        <AccountSettings email={user.email} fullName={user.fullName} />
        {user.role === "admin" && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-semibold">Registo de actividade</h2>
              <p className="text-sm text-slate-500">Últimas 40 operações relevantes no painel.</p>
            </header>
            <ul className="divide-y divide-slate-100 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="font-medium text-slate-800">{a.actor_email ?? "Sistema"}</span>{" "}
                    <span className="text-slate-600">
                      {ACTIONS[a.action] ?? a.action}
                      {a.action === "draft.save" && (a.details as { summary?: string })?.summary
                        ? ` · ${(a.details as { summary?: string }).summary}`
                        : ""}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{formatDateTime(a.created_at)}</span>
                </li>
              ))}
              {audit.length === 0 && <li className="px-6 py-6 text-slate-500">Sem actividade registada.</li>}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
