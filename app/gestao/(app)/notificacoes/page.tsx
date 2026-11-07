import type { Metadata } from "next";
import Link from "next/link";
import { requireOpsPage } from "@/lib/ops/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembers, getOrders, getSettings, getTasks } from "@/lib/ops/queries";
import { loadReminders } from "@/lib/ops/loaders";
import { getOpsBase, requestOrigin } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { NOTIFICATION_EVENTS, NOTIFICATION_STATUS_LABELS, OPEN_ORDER_STATUSES, type NotificationEvent, type NotificationStatus } from "@/lib/ops/labels";
import { fmtDateTime } from "@/lib/ops/time";
import { whatsappConfig, whatsappDiagnostics } from "@/lib/ops/whatsapp";
import { cx } from "@/lib/cx";
import { ReminderPanel } from "@/components/ops/field";
import { TemplatesEditor, WhatsappDiagnostics } from "@/components/ops/admin";
import { Badge, Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "WhatsApp e avisos" };
export const instant = false;

const TONE: Record<NotificationStatus, "slate" | "sky" | "green" | "red" | "amber"> = {
  agendada: "slate",
  em_envio: "sky",
  enviada: "sky",
  entregue: "green",
  lida: "green",
  falhada: "red",
  cancelada: "amber",
};

export default async function NotificacoesPage({ searchParams }: PageProps<"/gestao/notificacoes">) {
  const user = await requireOpsPage(["admin", "direcao", "gestor", "supervisor"]);
  const sp = (await searchParams) as { ver?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const view = sp.ver ?? "registo";
  const supabase = await createClient();
  const [settings, members] = await Promise.all([getSettings(), getMembers()]);
  const whatsappActive = Boolean(settings?.whatsapp_enabled && whatsappConfig().canSend);
  const tabs: [string, string][] = [
    ["registo", "Registo de envios"],
    ["lembretes", "Lembretes"],
    ...(user.role === "admin" ? ([["modelos", "Modelos"], ["diagnostico", "Configuração e teste"]] as [string, string][]) : []),
  ];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp e avisos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Envio real pela WhatsApp Business Platform (Cloud API da Meta).{" "}
          {whatsappActive ? <Badge tone="green">Activo</Badge> : <Badge tone="amber">Desactivado ou por configurar</Badge>}
        </p>
      </div>
      <nav className="mb-5 flex flex-wrap gap-1.5">
        {tabs.map(([k, l]) => (
          <Link key={k} href={h(`/notificacoes?ver=${k}`)} className={cx("rounded-full px-3 py-1.5 text-sm", view === k ? "bg-black text-white" : "bg-white ring-1 ring-slate-200")}>
            {l}
          </Link>
        ))}
      </nav>

      {view === "registo" && (
        <Card title="Últimas mensagens" description="Cada mensagem tem uma chave única: a mesma notificação nunca é enviada duas vezes.">
          <Outbox />
        </Card>
      )}

      {view === "lembretes" && (
        <ReminderPanel
          reminders={await loadReminders()}
          people={members.filter((m) => m.active).map((m) => ({ id: m.user_id, name: m.full_name }))}
          tasks={(await getTasks({ openOnly: true })).map((t) => ({ id: t.id, label: `${t.order?.number ?? "Empresa"} ${t.code} · ${t.title}`, work_order_id: t.work_order_id }))}
          orders={(await getOrders({ status: OPEN_ORDER_STATUSES })).map((o) => ({ id: o.id, label: `${o.number} · ${o.title}` }))}
          whatsappActive={whatsappActive}
        />
      )}

      {view === "modelos" && user.role === "admin" && (
        <Card title="Modelos de mensagem por evento" description="Nomes dos modelos aprovados na Meta (WhatsApp Manager › Modelos de mensagem). O texto dos modelos está em docs/GESTAO-WHATSAPP.md.">
          <TemplatesEditor templates={(await supabase.from("ops_whatsapp_templates").select("event, template_name, language, enabled").order("event")).data ?? []} />
        </Card>
      )}

      {view === "diagnostico" && user.role === "admin" && (
        <WhatsappDiagnostics
          diagnostics={whatsappDiagnostics()}
          enabled={Boolean(settings?.whatsapp_enabled)}
          webhookUrl={`${await requestOrigin()}/api/gestao/whatsapp/webhook`}
          members={(
            await supabase.from("ops_members").select("user_id, full_name, whatsapp_phone").eq("active", true).eq("whatsapp_consent", true).not("whatsapp_phone", "is", null)
          ).data?.map((m) => ({ id: m.user_id, name: m.full_name, phone: m.whatsapp_phone as string })) ?? []}
        />
      )}
    </>
  );
}

async function Outbox() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ops_notifications")
    .select("id, event, phone, preview, status, attempts, last_error, wa_message_id, created_at, sent_at, delivered_at, read_at, recipient:ops_members(full_name)")
    .order("created_at", { ascending: false })
    .limit(150);
  const rows = data ?? [];
  if (!rows.length) return <p className="text-sm text-slate-500">Ainda não foram enviadas mensagens.</p>;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {rows.map((n) => (
        <li key={n.id} className="py-3">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium">{NOTIFICATION_EVENTS[n.event as NotificationEvent] ?? n.event}</span> → {(n.recipient as unknown as { full_name: string } | null)?.full_name ?? n.phone}
                <span className="block text-xs text-slate-500">
                  {fmtDateTime(n.created_at)}
                  {n.sent_at ? ` · enviada ${fmtDateTime(n.sent_at)}` : ""}
                  {n.delivered_at ? ` · entregue ${fmtDateTime(n.delivered_at)}` : ""}
                  {n.read_at ? ` · lida ${fmtDateTime(n.read_at)}` : ""}
                  {n.attempts > 1 ? ` · ${n.attempts} tentativas` : ""}
                </span>
              </span>
              <Badge tone={TONE[n.status as NotificationStatus]}>{NOTIFICATION_STATUS_LABELS[n.status as NotificationStatus]}</Badge>
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs">{n.preview}</pre>
            {n.wa_message_id && <p className="mt-1 break-all font-mono text-[11px] text-slate-500">ID Meta: {n.wa_message_id}</p>}
            {n.last_error && <p className="mt-1 text-xs text-red-600">{n.last_error}</p>}
          </details>
        </li>
      ))}
    </ul>
  );
}
