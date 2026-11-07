"use client";

import { useState } from "react";
import { Copy, KeyRound, Play, Send, UserPlus } from "lucide-react";
import { createMember, resetMemberPassword, runAutomationNow, saveSettings, saveTemplate, sendTestMessage, updateMember, updateMyWhatsapp } from "@/lib/ops/actions/admin";
import { TEMPLATE_EVENT_LABELS } from "@/lib/ops/labels";
import { OPS_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type OpsRole } from "@/lib/ops/roles";
import { Badge, Button, Card, Choice, FormError, Input, Modal, Notice, Toggle } from "./ui";
import { useOpsAction } from "./use-action";

export type MemberRow = {
  user_id: string;
  full_name: string;
  email: string;
  role: OpsRole;
  job_title: string | null;
  active: boolean;
  whatsapp_phone: string | null;
  whatsapp_consent: boolean;
  whatsapp_consent_at: string | null;
};

export function TempPassword({ value, onClose, who = "ao colaborador" }: { value: string; onClose: () => void; who?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <Notice tone="warning" title="Palavra-passe temporária — mostrada só agora">
        Entregue-a pessoalmente {who}. No primeiro acesso, é obrigatório definir uma palavra-passe pessoal.
      </Notice>
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-3 font-mono text-lg tracking-wider">
        <span className="flex-1 select-all">{value}</span>
        <Button size="sm" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); }}>
          <Copy className="size-3.5" /> {copied ? "Copiada" : "Copiar"}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Concluir
        </Button>
      </div>
    </div>
  );
}

export function NewMemberButton() {
  const empty = { full_name: "", email: "", role: "tecnico" as OpsRole, job_title: "", whatsapp_phone: "", whatsapp_consent: false, mode: "password" as "password" | "invite" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(empty);
  const [temp, setTemp] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);
  const { pending, error, run } = useOpsAction();
  const close = () => {
    setOpen(false);
    setTemp(null);
    setInvited(false);
    setV(empty);
  };
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Novo colaborador
      </Button>
      <Modal open={open} onClose={close} title="Novo colaborador" wide>
        {temp ? (
          <TempPassword value={temp} onClose={close} />
        ) : invited ? (
          <div className="space-y-4">
            <Notice tone="success">Convite enviado para {v.email}.</Notice>
            <div className="flex justify-end">
              <Button variant="primary" onClick={close}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => createMember(v), (d) => (d.temporaryPassword ? setTemp(d.temporaryPassword) : setInvited(true)));
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Nome completo" required value={v.full_name} onChange={(x) => setV({ ...v, full_name: x })} />
              <Input label="Email" type="email" required value={v.email} onChange={(x) => setV({ ...v, email: x })} />
              <Choice label="Perfil" value={v.role} onChange={(x) => setV({ ...v, role: x })} options={OPS_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} hint={ROLE_DESCRIPTIONS[v.role]} />
              <Input label="Função" value={v.job_title} onChange={(x) => setV({ ...v, job_title: x })} placeholder="Ex.: Soldador, Mecânico naval" />
              <Input label="WhatsApp" type="tel" value={v.whatsapp_phone} onChange={(x) => setV({ ...v, whatsapp_phone: x })} placeholder="+244923000000" />
              <Choice
                label="Acesso"
                value={v.mode}
                onChange={(x) => setV({ ...v, mode: x })}
                options={[
                  { value: "password", label: "Palavra-passe temporária (mostrada a si)" },
                  { value: "invite", label: "Convite por email (requer SMTP)" },
                ]}
              />
            </div>
            <Toggle
              label="O colaborador aceitou receber notificações de trabalho por WhatsApp"
              description="Registe apenas com o consentimento expresso do colaborador. Ele pode retirá-lo a qualquer momento (na sua conta ou respondendo PARAR)."
              checked={v.whatsapp_consent}
              onChange={(x) => setV({ ...v, whatsapp_consent: x })}
            />
            <FormError error={error} />
            <div className="flex justify-end gap-2">
              <Button onClick={close}>Cancelar</Button>
              <Button type="submit" variant="primary" loading={pending}>
                Criar conta
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function MemberEditButton({ member }: { member: MemberRow }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ ...member, job_title: member.job_title ?? "", whatsapp_phone: member.whatsapp_phone ?? "" });
  const [temp, setTemp] = useState<string | null>(null);
  const { pending, error, run } = useOpsAction();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Editar
      </Button>
      <Modal open={open} onClose={() => { setOpen(false); setTemp(null); }} title={member.full_name} wide>
        {temp ? (
          <TempPassword value={temp} onClose={() => { setOpen(false); setTemp(null); }} />
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => updateMember(v), () => setOpen(false));
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Nome" required value={v.full_name} onChange={(x) => setV({ ...v, full_name: x })} />
              <Choice label="Perfil" value={v.role} onChange={(x) => setV({ ...v, role: x })} options={OPS_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} hint={ROLE_DESCRIPTIONS[v.role]} />
              <Input label="Função" value={v.job_title} onChange={(x) => setV({ ...v, job_title: x })} />
              <Input label="WhatsApp" type="tel" value={v.whatsapp_phone} onChange={(x) => setV({ ...v, whatsapp_phone: x })} placeholder="+244923000000" />
            </div>
            <Toggle label="Conta activa" description="Desactivar impede o início de sessão e remove o acesso aos dados, sem apagar o histórico." checked={v.active} onChange={(x) => setV({ ...v, active: x })} />
            <Toggle label="Consentimento para notificações WhatsApp" checked={v.whatsapp_consent} onChange={(x) => setV({ ...v, whatsapp_consent: x })} />
            <FormError error={error} />
            <div className="flex flex-wrap justify-between gap-2">
              <Button onClick={() => run(() => resetMemberPassword(member.user_id), (d) => setTemp(d.temporaryPassword))} loading={pending}>
                <KeyRound className="size-4" /> Nova palavra-passe temporária
              </Button>
              <div className="flex gap-2">
                <Button onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" loading={pending}>
                  Guardar
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

type SettingsValues = {
  company_name: string;
  default_vat_rate: number;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  weekly_summary_enabled: boolean;
  weekly_summary_dow: number;
  weekly_summary_time: string;
  task_start_lead_minutes: number;
  due_soon_hours: number;
  whatsapp_enabled: boolean;
  max_messages_per_run: number;
};

const DOW = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function SettingsForm({ initial, canSend }: { initial: SettingsValues; canSend: boolean }) {
  const [v, setV] = useState({ ...initial, daily_reminder_time: initial.daily_reminder_time.slice(0, 5), weekly_summary_time: initial.weekly_summary_time.slice(0, 5) });
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useOpsAction();
  const set = (patch: Partial<typeof v>) => {
    setSaved(false);
    setV((c) => ({ ...c, ...patch }));
  };
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveSettings(v), () => setSaved(true));
      }}
    >
      <Card title="Empresa e impostos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome da empresa" value={v.company_name} onChange={(x) => set({ company_name: x })} />
          <Input label="IVA por omissão (%)" type="number" min="0" max="100" step="0.01" value={v.default_vat_rate} onChange={(x) => set({ default_vat_rate: Number(x) })} hint="Angola: taxa geral de 14%. Pode ser alterada em cada despesa ou orçamento." />
        </div>
      </Card>
      <Card title="Notificações WhatsApp e automatização" description="Fuso horário: Africa/Luanda.">
        <Toggle
          label="Enviar notificações WhatsApp"
          description={canSend ? "As credenciais da Meta estão configuradas no servidor." : "Atenção: faltam as credenciais da Meta no servidor. Activar sem elas não envia mensagens."}
          checked={v.whatsapp_enabled}
          onChange={(x) => set({ whatsapp_enabled: x })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Aviso antes do início da tarefa (min)" type="number" min="0" value={v.task_start_lead_minutes} onChange={(x) => set({ task_start_lead_minutes: Number(x) })} />
          <Input label="Aviso de prazo próximo (horas antes)" type="number" min="1" value={v.due_soon_hours} onChange={(x) => set({ due_soon_hours: Number(x) })} />
          <Input label="Máximo de mensagens por execução" type="number" min="1" max="500" value={v.max_messages_per_run} onChange={(x) => set({ max_messages_per_run: Number(x) })} hint="Controla o ritmo de envio (limites da Meta)." />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Toggle label="Lembrete diário" checked={v.daily_reminder_enabled} onChange={(x) => set({ daily_reminder_enabled: x })} />
          <Input label="Hora do lembrete diário" type="time" value={v.daily_reminder_time} onChange={(x) => set({ daily_reminder_time: x })} />
          <span />
          <Toggle label="Resumo semanal" checked={v.weekly_summary_enabled} onChange={(x) => set({ weekly_summary_enabled: x })} />
          <Choice label="Dia do resumo" value={String(v.weekly_summary_dow)} onChange={(x) => set({ weekly_summary_dow: Number(x) })} options={DOW.map((d, i) => ({ value: String(i), label: d }))} />
          <Input label="Hora do resumo" type="time" value={v.weekly_summary_time} onChange={(x) => set({ weekly_summary_time: x })} />
        </div>
      </Card>
      <FormError error={error} />
      {saved && <Notice tone="success">Definições guardadas.</Notice>}
      <Button type="submit" variant="primary" loading={pending}>
        Guardar definições
      </Button>
    </form>
  );
}

export function TemplatesEditor({ templates }: { templates: { event: string; template_name: string; language: string; enabled: boolean }[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {templates.map((t) => (
        <TemplateRow key={t.event} template={t} />
      ))}
    </ul>
  );
}

function TemplateRow({ template }: { template: { event: string; template_name: string; language: string; enabled: boolean } }) {
  const [v, setV] = useState(template);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useOpsAction();
  return (
    <li className="grid items-end gap-2 py-3 sm:grid-cols-[1.4fr_1.4fr_0.6fr_auto_auto]">
      <p className="text-sm font-medium">{TEMPLATE_EVENT_LABELS[template.event] ?? template.event}</p>
      <input value={v.template_name} onChange={(e) => { setSaved(false); setV({ ...v, template_name: e.target.value }); }} aria-label="Nome do modelo" className="rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-sm" />
      <input value={v.language} onChange={(e) => { setSaved(false); setV({ ...v, language: e.target.value }); }} aria-label="Língua" className="rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-sm" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.enabled} onChange={(e) => { setSaved(false); setV({ ...v, enabled: e.target.checked }); }} className="size-4 accent-black" /> Activo
      </label>
      <Button size="sm" loading={pending} onClick={() => run(() => saveTemplate(v), () => setSaved(true))}>
        {saved ? "Guardado" : "Guardar"}
      </Button>
      {error && <p className="text-xs text-red-600 sm:col-span-5">{error.message}</p>}
    </li>
  );
}

export function WhatsappDiagnostics({
  diagnostics,
  members,
  webhookUrl,
  enabled,
}: {
  diagnostics: { accessToken: boolean; phoneNumberId: boolean; appSecret: boolean; verifyToken: boolean; cronSecret: boolean; graphVersion: string };
  members: { id: string; name: string; phone: string }[];
  webhookUrl: string;
  enabled: boolean;
}) {
  const [target, setTarget] = useState(members[0]?.id ?? "");
  const [mode, setMode] = useState<"hello_world" | "template" | "empresa">("hello_world");
  const [result, setResult] = useState<string | null>(null);
  const [auto, setAuto] = useState<string | null>(null);
  const { pending, error, run } = useOpsAction();
  const rows: [string, boolean, string][] = [
    ["WHATSAPP_ACCESS_TOKEN", diagnostics.accessToken, "Token permanente (System User) com whatsapp_business_messaging"],
    ["WHATSAPP_PHONE_NUMBER_ID", diagnostics.phoneNumberId, "Identificador do número empresarial"],
    ["WHATSAPP_APP_SECRET", diagnostics.appSecret, "Valida a assinatura dos webhooks"],
    ["WHATSAPP_VERIFY_TOKEN", diagnostics.verifyToken, "Texto para a Meta validar o webhook"],
    ["CRON_SECRET", diagnostics.cronSecret, "Protege o agendador automático"],
  ];
  return (
    <div className="space-y-6">
      <Card title="Configuração do servidor" description={`Graph API ${diagnostics.graphVersion}. Os valores nunca são mostrados, só se estão definidos.`}>
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map(([k, ok, hint]) => (
            <li key={k} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-mono">{k}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
              <Badge tone={ok ? "green" : "red"}>{ok ? "Definido" : "Em falta"}</Badge>
            </li>
          ))}
        </ul>
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium">URL do webhook a configurar na Meta</p>
          <p className="mt-1 break-all font-mono text-xs">{webhookUrl}</p>
          <p className="mt-1 text-xs text-slate-500">Campos a subscrever: messages (estados de entrega e respostas).</p>
        </div>
        <p className="text-sm">
          Envio de notificações: <Badge tone={enabled ? "green" : "amber"}>{enabled ? "Activado" : "Desactivado"}</Badge>
        </p>
      </Card>
      <Card title="Envio de teste real" description="Envia pela API oficial da Meta e mostra a resposta. O estado (entregue/lida) chega depois pelo webhook e aparece no registo de envios.">
        {members.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum colaborador tem número WhatsApp e consentimento registados.</p>
        ) : (
          <div className="grid items-end gap-3 sm:grid-cols-3">
            <Choice label="Destinatário (com consentimento)" value={target} onChange={setTarget} options={members.map((m) => ({ value: m.id, label: `${m.name} (${m.phone})` }))} />
            <Choice
              label="Mensagem"
              value={mode}
              onChange={setMode}
              options={[
                { value: "hello_world", label: "hello_world (modelo de teste da Meta, en_US)" },
                { value: "template", label: "Modelo das obras (requer aprovação)" },
                { value: "empresa", label: "Modelo das tarefas da empresa (requer aprovação)" },
              ]}
            />
            <Button variant="primary" loading={pending} onClick={() => run(() => sendTestMessage({ user_id: target, mode }), (d) => setResult(`Aceite pela Meta (HTTP ${d.httpStatus}). Identificador: ${d.messageId}`))}>
              <Send className="size-4" /> Enviar teste
            </Button>
          </div>
        )}
        {result && <Notice tone="success">{result}</Notice>}
        <FormError error={error} />
      </Card>
      <Card title="Motor de automatização" description="Corre automaticamente no servidor de 5 em 5 minutos. Pode também executá-lo agora.">
        <Button loading={pending} onClick={() => run(() => runAutomationNow(), (d) => setAuto(JSON.stringify(d, null, 2)))}>
          <Play className="size-4" /> Executar agora
        </Button>
        {auto && <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{auto}</pre>}
      </Card>
    </div>
  );
}

export function MyWhatsappForm({ phone, consent }: { phone: string | null; consent: boolean }) {
  const [v, setV] = useState({ whatsapp_phone: phone ?? "", whatsapp_consent: consent });
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useOpsAction();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateMyWhatsapp(v), () => setSaved(true));
      }}
    >
      <Input label="Número WhatsApp" type="tel" value={v.whatsapp_phone} onChange={(x) => { setSaved(false); setV({ ...v, whatsapp_phone: x }); }} placeholder="+244923000000" />
      <Toggle
        label="Aceito receber notificações de trabalho por WhatsApp"
        description="Novas tarefas, alterações de horário, prazos, lembretes e resumos. Pode retirar o consentimento aqui ou respondendo PARAR a qualquer mensagem."
        checked={v.whatsapp_consent}
        onChange={(x) => { setSaved(false); setV({ ...v, whatsapp_consent: x }); }}
      />
      <FormError error={error} />
      {saved && <Notice tone="success">Preferências guardadas.</Notice>}
      <Button type="submit" variant="primary" loading={pending}>
        Guardar
      </Button>
    </form>
  );
}
