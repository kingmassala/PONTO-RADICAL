"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Bell, Camera, Eye, EyeOff, FileText, Loader2, Trash2, Wrench } from "lucide-react";
import { createCorrectiveTask, reportIncident, reviewDailyReport, saveDailyReport, updateIncident } from "@/lib/ops/actions/field";
import { deleteAttachment, shareAttachment, uploadAttachment } from "@/lib/ops/actions/files";
import { cancelReminder, saveReminder } from "@/lib/ops/actions/tasks";
import { setOrderStatus } from "@/lib/ops/actions/orders";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  REPORT_STATUS_LABELS,
  URGENCIES,
  URGENCY_LABELS,
  type IncidentCategory,
  type IncidentStatus,
  type OrderStatus,
  type ReportStatus,
  type Urgency,
} from "@/lib/ops/labels";
import { can } from "@/lib/ops/roles";
import { fmtDate, fmtDateTime, todayLuanda } from "@/lib/ops/time";
import { cx } from "@/lib/cx";
import { useOps } from "./context";
import { Area, Badge, Button, Card, Choice, EmptyState, FormError, Input, Modal, PeoplePicker, Toggle } from "./ui";
import { useOpsAction } from "./use-action";

/* ------------------------------ Estado da obra ------------------------------ */

export function OrderStatusControl({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const { role } = useOps();
  const { pending, error, run } = useOpsAction();
  if (!can.manage(role)) return null;
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-slate-500" htmlFor="order-status">
        Estado
      </label>
      <select
        id="order-status"
        value={status}
        disabled={pending}
        onChange={(e) => run(() => setOrderStatus(orderId, e.target.value))}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="size-4 animate-spin text-slate-400" />}
      {error && <span className="text-xs text-red-600">{error.message}</span>}
    </div>
  );
}

/* ------------------------------ Anexos ------------------------------ */

/** Reduz fotografias no telemóvel (máx. 2000 px, JPEG 82%) antes de enviar: poupa dados móveis. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export type AttachmentView = {
  id: string;
  mime_type: string;
  caption: string | null;
  url: string | null;
  created_at: string;
  uploaded_by: string | null;
  entity_type?: string;
  entity_id?: string;
  client_visible?: boolean;
  /** Tarefa associada (galeria da obra). */
  label?: string | null;
};

/** Tipos de anexos que podem ser partilhados no portal do cliente (só fotografias). */
const SHAREABLE = ["work_order", "task", "report", "vessel"];

export function Attachments({
  entityType,
  entityId,
  workOrderId,
  items,
  canUpload = true,
  compact,
  tasks,
  allowShare = true,
}: {
  entityType: string;
  entityId: string;
  workOrderId: string | null;
  items: AttachmentView[];
  canUpload?: boolean;
  compact?: boolean;
  /** Permite associar o envio a uma tarefa da obra. */
  tasks?: { id: string; label: string }[];
  /** Mostra o botão «Partilhar com o cliente» às chefias. */
  allowShare?: boolean;
}) {
  const { userId, role } = useOps();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [taskId, setTaskId] = useState("");
  const [caption, setCaption] = useState("");
  const { run } = useOpsAction();
  const canShare = allowShare && can.manage(role);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    for (const [i, original] of Array.from(files).entries()) {
      setBusy(`A enviar ${i + 1}/${files.length}…`);
      const file = await shrinkImage(original);
      const fd = new FormData();
      fd.set("file", file);
      fd.set("entity_type", taskId ? "task" : entityType);
      fd.set("entity_id", taskId || entityId);
      if (workOrderId) fd.set("work_order_id", workOrderId);
      if (caption.trim()) fd.set("caption", caption.trim());
      const r = await uploadAttachment(fd);
      if (!r.ok) {
        setErr(`${original.name}: ${r.error}`);
        break;
      }
    }
    setBusy(null);
    setCaption("");
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className={cx("grid gap-2", compact ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6")}>
          {items.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" className="block aspect-square">
                {a.mime_type.startsWith("image/") && a.mime_type !== "image/heic" && a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.caption ?? "Fotografia"} className="size-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-slate-500">
                    <FileText className="size-6" /> {a.mime_type === "application/pdf" ? "PDF" : "HEIC"}
                  </span>
                )}
              </a>
              <p className="truncate px-1.5 pt-1 text-[10px] text-slate-500" title={[a.caption, a.label].filter(Boolean).join(" · ") || undefined}>
                {a.caption || a.label || fmtDateTime(a.created_at)}
              </p>
              <div className="flex items-center justify-between gap-1 px-1.5 pb-1">
                <span className="truncate text-[10px] text-slate-400">{a.caption || a.label ? fmtDateTime(a.created_at) : ""}</span>
                {canShare && a.mime_type.startsWith("image/") && SHAREABLE.includes(a.entity_type ?? entityType) ? (
                  <button
                    type="button"
                    onClick={() => run(() => shareAttachment(a.id, !a.client_visible))}
                    className={cx(
                      "flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium",
                      a.client_visible ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-300",
                    )}
                    aria-pressed={Boolean(a.client_visible)}
                    title={a.client_visible ? "Visível no portal do cliente. Clique para deixar de partilhar." : "Partilhar no portal do cliente"}
                  >
                    {a.client_visible ? <Eye className="size-3" aria-hidden /> : <EyeOff className="size-3" aria-hidden />}
                    {a.client_visible ? "Cliente" : "Partilhar"}
                  </button>
                ) : (
                  a.client_visible && <span className="text-[10px] font-medium text-emerald-700">Cliente</span>
                )}
              </div>
              {(a.uploaded_by === userId || role === "admin" || role === "gestor") && (
                <button
                  type="button"
                  onClick={() => run(() => deleteAttachment(a.id))}
                  className="absolute right-1 top-1 hidden rounded bg-white/90 p-1 text-red-600 group-hover:block"
                  aria-label="Remover ficheiro"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && !compact && <p className="text-sm text-slate-500">Sem fotografias ou documentos.</p>}
      {canUpload && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          {tasks && tasks.length > 0 && (
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Associar a uma tarefa">
              <option value="">Obra em geral</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          {!compact && (
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Legenda (opcional)" aria-label="Legenda" className="w-48 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />
          )}
          <Button size="sm" onClick={() => input.current?.click()} disabled={Boolean(busy)}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            {busy ?? "Fotografia / documento"}
          </Button>
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Relatórios diários ------------------------------ */

export type ReportView = {
  id: string;
  report_date: string;
  work_order_id: string;
  orderNumber: string;
  user_id: string;
  author: string;
  location: string | null;
  activities: string;
  hours: number;
  materials_used: string | null;
  tasks_done: string | null;
  tasks_pending: string | null;
  difficulties: string | null;
  notes: string | null;
  status: ReportStatus;
  review_note: string | null;
  attachments: AttachmentView[];
};

export function ReportFormButton({ orders, defaultOrderId, report, openInitially }: { orders: { id: string; label: string }[]; defaultOrderId?: string; report?: ReportView; openInitially?: boolean }) {
  const empty = {
    report_date: todayLuanda(),
    work_order_id: defaultOrderId ?? (orders.length === 1 ? orders[0].id : ""),
    location: "",
    activities: "",
    hours: "8",
    materials_used: "",
    tasks_done: "",
    tasks_pending: "",
    difficulties: "",
    notes: "",
  };
  const [open, setOpen] = useState(Boolean(openInitially));
  const [v, setV] = useState(
    report
      ? {
          report_date: report.report_date,
          work_order_id: report.work_order_id,
          location: report.location ?? "",
          activities: report.activities,
          hours: String(report.hours),
          materials_used: report.materials_used ?? "",
          tasks_done: report.tasks_done ?? "",
          tasks_pending: report.tasks_pending ?? "",
          difficulties: report.difficulties ?? "",
          notes: report.notes ?? "",
        }
      : empty,
  );
  const [savedId, setSavedId] = useState<string | null>(null);
  const { pending, error, run } = useOpsAction();
  const set = (patch: Partial<typeof v>) => setV((c) => ({ ...c, ...patch }));
  return (
    <>
      <Button variant={report ? "secondary" : "primary"} size={report ? "sm" : "md"} onClick={() => setOpen(true)}>
        <FileText className="size-4" /> {report ? "Corrigir e reenviar" : "Novo relatório diário"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={report ? "Corrigir relatório" : "Relatório diário de obra"} wide>
        {savedId && !report ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Relatório submetido. Pode anexar fotografias do trabalho realizado.</p>
            <Attachments entityType="report" entityId={savedId} workOrderId={v.work_order_id} items={[]} />
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => { setOpen(false); setSavedId(null); setV(empty); }}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveDailyReport({ ...v, id: report?.id, hours: Number(v.hours) }), (d) => {
                if (report) setOpen(false);
                else setSavedId(d.id);
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Choice label="Obra" required value={v.work_order_id} placeholder="— Escolher obra —" onChange={(x) => set({ work_order_id: x })} options={orders.map((o) => ({ value: o.id, label: o.label }))} />
              <Input label="Data" type="date" required value={v.report_date} onChange={(x) => set({ report_date: x })} />
              <Input label="Horas trabalhadas" type="number" inputMode="decimal" min="0" max="24" step="0.25" value={v.hours} onChange={(x) => set({ hours: x })} />
            </div>
            <Input label="Local de trabalho" value={v.location} onChange={(x) => set({ location: x })} placeholder="Estaleiro, cais, a bordo…" />
            <Area label="Actividades executadas" required rows={4} value={v.activities} onChange={(x) => set({ activities: x })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Area label="Tarefas concluídas" value={v.tasks_done} onChange={(x) => set({ tasks_done: x })} />
              <Area label="Tarefas pendentes" value={v.tasks_pending} onChange={(x) => set({ tasks_pending: x })} />
              <Area label="Materiais utilizados" value={v.materials_used} onChange={(x) => set({ materials_used: x })} />
              <Area label="Dificuldades" value={v.difficulties} onChange={(x) => set({ difficulties: x })} />
            </div>
            <Area label="Observações" value={v.notes} onChange={(x) => set({ notes: x })} />
            <FormError error={error} />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" loading={pending}>
                Submeter relatório
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

const REPORT_TONE = { submetido: "sky", validado: "green", correccao: "amber" } as const;

export function ReportList({ reports, orders }: { reports: ReportView[]; orders: { id: string; label: string }[] }) {
  const { role, userId } = useOps();
  const { pending, error, run } = useOpsAction();
  const [reviewing, setReviewing] = useState<ReportView | null>(null);
  const [note, setNote] = useState("");
  if (!reports.length) return <EmptyState title="Sem relatórios">Os relatórios submetidos pelos técnicos aparecem aqui.</EmptyState>;
  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
      {reports.map((r) => (
        <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {fmtDate(r.report_date)} · {r.author}
              </p>
              <p className="text-xs text-slate-500">
                {r.orderNumber}
                {r.location ? ` · ${r.location}` : ""} · {r.hours} h
              </p>
            </div>
            <Badge tone={REPORT_TONE[r.status]}>{REPORT_STATUS_LABELS[r.status]}</Badge>
          </header>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Actividades" value={r.activities} wide />
            <Detail label="Concluídas" value={r.tasks_done} />
            <Detail label="Pendentes" value={r.tasks_pending} />
            <Detail label="Materiais" value={r.materials_used} />
            <Detail label="Dificuldades" value={r.difficulties} />
            <Detail label="Observações" value={r.notes} wide />
          </dl>
          {r.review_note && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Supervisão: {r.review_note}</p>}
          <div className="mt-3">
            <Attachments entityType="report" entityId={r.id} workOrderId={r.work_order_id} items={r.attachments} canUpload={r.user_id === userId && r.status !== "validado"} compact />
          </div>
          <footer className="mt-3 flex flex-wrap gap-2">
            {can.manage(role) && r.status !== "validado" && (
              <>
                <Button size="sm" variant="primary" loading={pending} onClick={() => run(() => reviewDailyReport(r.id, "validado"))}>
                  Validar
                </Button>
                <Button size="sm" onClick={() => setReviewing(r)}>
                  Pedir correcção
                </Button>
              </>
            )}
            {r.user_id === userId && r.status === "correccao" && <ReportFormButton orders={orders} report={r} />}
          </footer>
        </article>
      ))}
      <Modal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title="Pedir correcção">
        <Area label="O que deve ser corrigido" value={note} onChange={setNote} required />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setReviewing(null)}>Cancelar</Button>
          <Button variant="primary" loading={pending} onClick={() => reviewing && run(() => reviewDailyReport(reviewing.id, "correccao", note), () => { setReviewing(null); setNote(""); })}>
            Enviar pedido
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Detail({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-700">{value}</dd>
    </div>
  );
}

/* ------------------------------ Ocorrências ------------------------------ */

export type IncidentView = {
  id: string;
  occurred_at: string;
  work_order_id: string;
  orderNumber: string;
  task_id: string | null;
  taskLabel: string | null;
  reporter: string;
  reporter_id: string;
  owner_id: string | null;
  owner: string | null;
  location: string | null;
  category: IncidentCategory;
  description: string;
  impact: string | null;
  urgency: Urgency;
  proposed_measures: string | null;
  status: IncidentStatus;
  corrective_task_id: string | null;
  resolution_note: string | null;
  attachments: AttachmentView[];
};

export const URGENCY_TONE = { baixo: "slate", medio: "sky", alto: "amber", critico: "red" } as const;

export function IncidentFormButton({ orders, tasks, defaultOrderId, openInitially }: { orders: { id: string; label: string }[]; tasks: { id: string; label: string; work_order_id: string | null }[]; defaultOrderId?: string; openInitially?: boolean }) {
  const empty = {
    work_order_id: defaultOrderId ?? (orders.length === 1 ? orders[0].id : ""),
    task_id: "",
    category: "meteorologia" as IncidentCategory,
    urgency: "medio" as Urgency,
    location: "",
    description: "",
    impact: "",
    proposed_measures: "",
  };
  const [open, setOpen] = useState(Boolean(openInitially));
  const [v, setV] = useState(empty);
  const [savedId, setSavedId] = useState<string | null>(null);
  const { pending, error, run } = useOpsAction();
  const set = (patch: Partial<typeof v>) => setV((c) => ({ ...c, ...patch }));
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <AlertTriangle className="size-4" /> Comunicar problema
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Comunicar ocorrência" wide>
        {savedId ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Ocorrência registada{v.urgency === "critico" ? " e responsáveis notificados" : ""}. Pode anexar fotografias.
            </p>
            <Attachments entityType="incident" entityId={savedId} workOrderId={v.work_order_id} items={[]} />
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => { setOpen(false); setSavedId(null); setV(empty); }}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => reportIncident({ ...v, task_id: v.task_id || null }), (d) => setSavedId(d.id));
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Choice label="Obra" required value={v.work_order_id} placeholder="— Escolher obra —" onChange={(x) => set({ work_order_id: x, task_id: "" })} options={orders.map((o) => ({ value: o.id, label: o.label }))} />
              <Choice label="Tarefa afectada" value={v.task_id} placeholder="— Nenhuma em particular —" onChange={(x) => set({ task_id: x })} options={tasks.filter((t) => t.work_order_id === v.work_order_id).map((t) => ({ value: t.id, label: t.label }))} />
              <Choice label="Categoria" value={v.category} onChange={(x) => set({ category: x })} options={INCIDENT_CATEGORIES.map((c) => ({ value: c, label: INCIDENT_CATEGORY_LABELS[c] }))} />
              <Choice label="Urgência" value={v.urgency} onChange={(x) => set({ urgency: x })} options={URGENCIES.map((u) => ({ value: u, label: URGENCY_LABELS[u] }))} />
            </div>
            {v.urgency === "critico" && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Uma ocorrência crítica notifica de imediato a administração, a direcção e os gestores por WhatsApp.</p>}
            <Input label="Local" value={v.location} onChange={(x) => set({ location: x })} />
            <Area label="Descrição" required value={v.description} onChange={(x) => set({ description: x })} placeholder="O que aconteceu?" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Area label="Impacto nos trabalhos" value={v.impact} onChange={(x) => set({ impact: x })} />
              <Area label="Medidas propostas" value={v.proposed_measures} onChange={(x) => set({ proposed_measures: x })} />
            </div>
            <FormError error={error} />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" loading={pending}>
                Registar ocorrência
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function IncidentList({ incidents, people }: { incidents: IncidentView[]; people: { id: string; name: string }[] }) {
  const { role, userId, href } = useOps();
  const { pending, error, run } = useOpsAction();
  const [editing, setEditing] = useState<IncidentView | null>(null);
  const [v, setV] = useState<{ status: IncidentStatus; owner_id: string; resolution_note: string }>({ status: "aberta", owner_id: "", resolution_note: "" });
  if (!incidents.length) return <EmptyState title="Sem ocorrências">Nenhum problema registado.</EmptyState>;
  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}
      {incidents.map((i) => (
        <article key={i.id} className={cx("rounded-xl border bg-white p-4", i.urgency === "critico" && ["aberta", "em_analise"].includes(i.status) ? "border-red-300" : "border-slate-200")}>
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{INCIDENT_CATEGORY_LABELS[i.category]}</p>
              <p className="text-xs text-slate-500">
                {fmtDateTime(i.occurred_at)} · {i.orderNumber}
                {i.taskLabel ? ` · ${i.taskLabel}` : ""} · por {i.reporter}
              </p>
            </div>
            <div className="flex gap-1.5">
              <Badge tone={URGENCY_TONE[i.urgency]}>{URGENCY_LABELS[i.urgency]}</Badge>
              <Badge tone={i.status === "resolvida" || i.status === "encerrada" ? "green" : "slate"}>{INCIDENT_STATUS_LABELS[i.status]}</Badge>
            </div>
          </header>
          <p className="mt-2 whitespace-pre-wrap text-sm">{i.description}</p>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {i.impact && <Detail label="Impacto" value={i.impact} />}
            {i.proposed_measures && <Detail label="Medidas propostas" value={i.proposed_measures} />}
            {i.owner && <Detail label="Responsável pela resolução" value={i.owner} />}
            {i.resolution_note && <Detail label="Resolução" value={i.resolution_note} />}
          </dl>
          <div className="mt-3">
            <Attachments entityType="incident" entityId={i.id} workOrderId={i.work_order_id} items={i.attachments} canUpload={i.reporter_id === userId || can.manage(role)} compact />
          </div>
          <footer className="mt-3 flex flex-wrap gap-2">
            {(can.manage(role) || i.owner_id === userId) && (
              <Button size="sm" onClick={() => { setEditing(i); setV({ status: i.status, owner_id: i.owner_id ?? "", resolution_note: i.resolution_note ?? "" }); }}>
                Actualizar
              </Button>
            )}
            {can.manage(role) && !i.corrective_task_id && (
              <Button size="sm" loading={pending} onClick={() => run(() => createCorrectiveTask(i.id))}>
                <Wrench className="size-3.5" /> Criar tarefa correctiva
              </Button>
            )}
            {i.corrective_task_id && (
              <a href={href(`/obras/${i.work_order_id}?tab=tarefas`)} className="text-sm text-slate-600 underline">
                Ver tarefa correctiva
              </a>
            )}
          </footer>
        </article>
      ))}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Actualizar ocorrência">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (editing) run(() => updateIncident({ id: editing.id, ...v, owner_id: v.owner_id || null }), () => setEditing(null));
          }}
        >
          <Choice label="Estado" value={v.status} onChange={(x) => setV({ ...v, status: x })} options={(Object.keys(INCIDENT_STATUS_LABELS) as IncidentStatus[]).map((s) => ({ value: s, label: INCIDENT_STATUS_LABELS[s] }))} />
          {can.manage(role) && <Choice label="Responsável pela resolução" value={v.owner_id} placeholder="— Ninguém —" onChange={(x) => setV({ ...v, owner_id: x })} options={people.map((p) => ({ value: p.id, label: p.name }))} />}
          <Area label="Nota de resolução" value={v.resolution_note} onChange={(x) => setV({ ...v, resolution_note: x })} />
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------ Lembretes ------------------------------ */

export type ReminderView = {
  id: string;
  title: string;
  message: string | null;
  send_at: string;
  lead_minutes: number;
  repeat: string;
  status: string;
  recipients: string[];
  taskLabel: string | null;
  orderNumber: string | null;
};

export function ReminderPanel({
  reminders,
  people,
  tasks,
  orderId,
  orders,
  whatsappActive,
}: {
  reminders: ReminderView[];
  people: { id: string; name: string; hint?: string }[];
  tasks: { id: string; label: string; work_order_id: string | null }[];
  orderId?: string;
  orders?: { id: string; label: string }[];
  whatsappActive: boolean;
}) {
  const { role } = useOps();
  const [open, setOpen] = useState(false);
  const empty = { work_order_id: orderId ?? "", task_id: "", title: "", message: "", recipients: [] as string[], send_at: "", lead_minutes: "0", repeat: "nenhuma", repeat_until: "", cancel_when_done: true };
  const [v, setV] = useState(empty);
  const { pending, error, run } = useOpsAction();
  const names = new Map(people.map((p) => [p.id, p.name]));
  const toIso = (local: string) => (local ? new Date(`${local}:00+01:00`).toISOString() : "");
  const manage = can.manage(role);
  return (
    <Card
      title="Lembretes WhatsApp"
      description="Enviados automaticamente pelo servidor à hora definida (hora de Angola), mesmo com a plataforma fechada."
      actions={
        manage ? (
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            <Bell className="size-3.5" /> Novo lembrete
          </Button>
        ) : null
      }
    >
      {!whatsappActive && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">O envio por WhatsApp está desactivado ou por configurar. Os lembretes ficam guardados mas não são enviados até ser activado em Administração.</p>}
      {reminders.length === 0 ? (
        <p className="text-sm text-slate-500">Sem lembretes.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {reminders.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-slate-500">
                  {fmtDateTime(r.send_at)}
                  {r.lead_minutes ? ` (aviso ${r.lead_minutes} min antes)` : ""} · {r.repeat === "nenhuma" ? "uma vez" : r.repeat === "diaria" ? "diário" : "semanal"} · para{" "}
                  {r.recipients.map((x) => names.get(x) ?? "—").join(", ")}
                  {r.taskLabel ? ` · ${r.taskLabel}` : r.orderNumber ? ` · ${r.orderNumber}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={r.status === "activo" ? "sky" : r.status === "concluido" ? "green" : "slate"}>{r.status === "activo" ? "Activo" : r.status === "concluido" ? "Concluído" : "Cancelado"}</Badge>
                {manage && r.status === "activo" && (
                  <Button size="sm" variant="ghost" onClick={() => run(() => cancelReminder(r.id))}>
                    Cancelar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo lembrete" wide>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveReminder({
                  ...v,
                  task_id: v.task_id || null,
                  work_order_id: v.work_order_id || null,
                  send_at: toIso(v.send_at),
                  repeat_until: v.repeat_until ? toIso(v.repeat_until) : null,
                  lead_minutes: Number(v.lead_minutes),
                }),
              () => {
                setOpen(false);
                setV(empty);
              },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {orders && !orderId && <Choice label="Obra" value={v.work_order_id} placeholder="— Escolher —" onChange={(x) => setV({ ...v, work_order_id: x, task_id: "" })} options={orders.map((o) => ({ value: o.id, label: o.label }))} />}
            <Choice label="Tarefa (opcional)" value={v.task_id} placeholder="— Obra em geral —" onChange={(x) => setV({ ...v, task_id: x })} options={tasks.filter((t) => !v.work_order_id || t.work_order_id === v.work_order_id).map((t) => ({ value: t.id, label: t.label }))} />
            <Input label="Assunto" required value={v.title} onChange={(x) => setV({ ...v, title: x })} placeholder="Ex.: Confirmar entrega das chapas" />
            <Input label="Data e hora" type="datetime-local" required value={v.send_at} onChange={(x) => setV({ ...v, send_at: x })} />
            <Choice
              label="Antecedência"
              value={v.lead_minutes}
              onChange={(x) => setV({ ...v, lead_minutes: x })}
              options={[
                { value: "0", label: "À hora indicada" },
                { value: "15", label: "15 minutos antes" },
                { value: "60", label: "1 hora antes" },
                { value: "180", label: "3 horas antes" },
                { value: "1440", label: "1 dia antes" },
              ]}
            />
            <Choice
              label="Repetição"
              value={v.repeat}
              onChange={(x) => setV({ ...v, repeat: x })}
              options={[
                { value: "nenhuma", label: "Não repetir" },
                { value: "diaria", label: "Todos os dias" },
                { value: "semanal", label: "Todas as semanas" },
              ]}
            />
            {v.repeat !== "nenhuma" && <Input label="Repetir até" type="datetime-local" value={v.repeat_until} onChange={(x) => setV({ ...v, repeat_until: x })} />}
          </div>
          <Input label="Mensagem (opcional)" value={v.message} onChange={(x) => setV({ ...v, message: x })} />
          <PeoplePicker label="Destinatários" people={people} value={v.recipients} onChange={(ids) => setV({ ...v, recipients: ids })} />
          <Toggle label="Cancelar automaticamente quando a tarefa estiver concluída" checked={v.cancel_when_done} onChange={(x) => setV({ ...v, cancel_when_done: x })} />
          <p className="text-xs text-slate-500">Só recebem mensagens os colaboradores com número WhatsApp e consentimento registados.</p>
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={pending}>
              Agendar
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
