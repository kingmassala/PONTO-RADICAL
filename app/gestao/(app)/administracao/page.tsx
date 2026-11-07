import type { Metadata } from "next";
import Link from "next/link";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/ops/queries";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { describeActivity, type ActivityRow } from "@/lib/ops/activity";
import { ROLE_LABELS } from "@/lib/ops/roles";
import { fmtDateTime } from "@/lib/ops/time";
import { whatsappConfig } from "@/lib/ops/whatsapp";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { cx } from "@/lib/cx";
import { MemberEditButton, NewMemberButton, SettingsForm, type MemberRow } from "@/components/ops/admin";
import { Badge, Card, Notice } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Administração" };
export const instant = false;

export default async function AdministracaoPage({ searchParams }: PageProps<"/gestao/administracao">) {
  await requireOpsPage(["admin"]);
  const sp = (await searchParams) as { ver?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const view = sp.ver ?? "utilizadores";
  const supabase = await createClient();

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="mt-1 text-sm text-slate-500">Utilizadores e permissões, configuração do sistema e registo de actividade.</p>
      </div>
      {!isServiceRoleConfigured() && (
        <div className="mb-4">
          <Notice tone="warning">SUPABASE_SECRET_KEY não está definida no servidor: não é possível criar contas nem enviar notificações.</Notice>
        </div>
      )}
      <nav className="mb-5 flex gap-1.5">
        {[
          ["utilizadores", "Utilizadores"],
          ["definicoes", "Definições"],
          ["auditoria", "Registo de actividade"],
        ].map(([k, l]) => (
          <Link key={k} href={h(`/administracao?ver=${k}`)} className={cx("rounded-full px-3 py-1.5 text-sm", view === k ? "bg-black text-white" : "bg-white ring-1 ring-slate-200")}>
            {l}
          </Link>
        ))}
      </nav>

      {view === "utilizadores" && <Users />}
      {view === "definicoes" && <SettingsView />}
      {view === "auditoria" && <Audit />}
    </>
  );

  async function Users() {
    const { data } = await supabase.from("ops_members").select("user_id, full_name, email, role, job_title, active, whatsapp_phone, whatsapp_consent, whatsapp_consent_at").order("full_name");
    const members = (data ?? []) as MemberRow[];
    return (
      <Card title={`Colaboradores (${members.length})`} actions={<NewMemberButton />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">Nome</th>
                <th className="py-2">Perfil</th>
                <th className="py-2">WhatsApp</th>
                <th className="py-2">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td className="py-2">
                    <p className="font-medium">{m.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {m.email}
                      {m.job_title ? ` · ${m.job_title}` : ""}
                    </p>
                  </td>
                  <td className="py-2">
                    <Badge>{ROLE_LABELS[m.role]}</Badge>
                  </td>
                  <td className="py-2">
                    {m.whatsapp_phone ?? "—"}
                    <p className="text-xs text-slate-500">{m.whatsapp_consent ? `Consentimento ${fmtDateTime(m.whatsapp_consent_at)}` : "Sem consentimento"}</p>
                  </td>
                  <td className="py-2">
                    <Badge tone={m.active ? "green" : "red"}>{m.active ? "Activa" : "Desactivada"}</Badge>
                  </td>
                  <td className="py-2 text-right">
                    <MemberEditButton member={m} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  async function SettingsView() {
    const settings = await getSettings();
    if (!settings) return <Notice tone="error">Definições em falta: execute a migração da Gestão de Obras.</Notice>;
    return <SettingsForm initial={settings} canSend={whatsappConfig().canSend} />;
  }

  async function Audit() {
    const { data } = await supabase.from("ops_activity").select("id, created_at, actor_name, table_name, record_id, action, changes").order("created_at", { ascending: false }).limit(200);
    const rows = (data ?? []) as ActivityRow[];
    return (
      <Card title="Registo de actividade" description="Todas as alterações relevantes, com autor e data. Não pode ser alterado pela aplicação.">
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between">
              <span>
                <strong className="font-medium">{a.actor_name ?? "Sistema"}</strong> · {describeActivity(a)}
              </span>
              <span className="shrink-0 text-xs text-slate-500">{fmtDateTime(a.created_at)}</span>
            </li>
          ))}
          {rows.length === 0 && <li className="py-2 text-slate-500">Sem actividade.</li>}
        </ul>
      </Card>
    );
  }
}
