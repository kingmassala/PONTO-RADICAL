"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Ban, CheckCircle2, FileSignature, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { cancelDelivery, createDelivery, deleteDelivery, markDeliverySigned, updateDelivery } from "@/lib/deliveries/actions";
import {
  DEFAULT_RECIPIENT,
  DELIVERY_STATUS_LABELS,
  formatDeliveryDate,
  formatQuantity,
  summarizeItems,
  UNITS,
  type Delivery,
  type DeliveryStatus,
} from "@/lib/deliveries/rules";
import { Badge, Button, cx, Field, Modal, Notice, TextArea, TextInput } from "./ui";

const STATUS_TONE: Record<DeliveryStatus, "amber" | "green" | "slate"> = { emitida: "amber", assinada: "green", anulada: "slate" };

type ItemForm = { description: string; reference: string; quantity: string; unit: string; notes: string };
type HeaderForm = { delivery_date: string; recipient: string; reference: string; delivered_by: string; received_by: string; notes: string };

const blankItem = (): ItemForm => ({ description: "", reference: "", quantity: "1", unit: "un", notes: "" });

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20";

export function DeliveriesBoard({
  deliveries,
  canDelete,
  defaultDeliveredBy,
  today,
}: {
  deliveries: Delivery[];
  canDelete: boolean;
  defaultDeliveredBy: string;
  today: string;
}) {
  const [tab, setTab] = useState<"guias" | "materiais">("guias");
  const [editing, setEditing] = useState<Delivery | "new" | null>(null);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<"todas" | DeliveryStatus>("todas");

  const materials = useMemo(() => {
    const names = new Set<string>();
    for (const d of deliveries) for (const it of d.items) names.add(it.description);
    return [...names].sort((a, b) => a.localeCompare(b, "pt"));
  }, [deliveries]);

  const inRange = deliveries.filter((d) => d.delivery_date >= from && d.delivery_date <= to);
  const summary = summarizeItems(inRange);
  const list = deliveries.filter((d) => status === "todas" || d.status === status);
  const pendingSign = deliveries.filter((d) => d.status === "emitida").length;

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
          {(
            [
              ["guias", "Guias de saída"],
              ["materiais", "Controlo por material"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={cx("rounded-md px-3 py-1.5 text-sm", tab === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Nova saída de material
        </Button>
      </div>

      {pendingSign > 0 && tab === "guias" && (
        <div className="mb-6">
          <Notice tone="warning" title={`${pendingSign} guia(s) por assinar.`}>
            Imprima a guia, recolha as assinaturas («Entreguei — Ponto Radical» e «Recebi — Promarine») e marque-a como assinada.
          </Notice>
        </div>
      )}

      {tab === "guias" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["todas", "emitida", "assinada", "anulada"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={cx("rounded-full px-3 py-1.5 text-sm", status === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}
              >
                {s === "todas" ? "Todas" : DELIVERY_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="font-medium text-slate-900">Sem saídas de material</p>
              <p className="mt-2 text-sm text-slate-500">Registe o material entregue à Promarine; a guia sai pronta a imprimir, com os campos de assinatura.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((d) => (
                <DeliveryRow key={d.id} delivery={d} canDelete={canDelete} onEdit={() => setEditing(d)} />
              ))}
            </ul>
          )}
        </>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-4 py-3">
            <Field label="De" htmlFor="mat-from">
              <input id="mat-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Até" htmlFor="mat-to">
              <input id="mat-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} />
            </Field>
            <p className="pb-2 text-sm text-slate-500">
              {inRange.filter((d) => d.status !== "anulada").length} guia(s) no período (sem as anuladas).
            </p>
          </header>
          {summary.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Sem materiais fornecidos neste período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Material</th>
                    <th className="px-4 py-2 text-right font-medium">Quantidade fornecida</th>
                    <th className="px-4 py-2 font-medium">Unidade</th>
                    <th className="px-4 py-2 text-right font-medium">Linhas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.map((s) => (
                    <tr key={`${s.description}|${s.unit}`}>
                      <td className="px-4 py-2.5 text-slate-900">{s.description}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatQuantity(s.quantity)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{s.unit}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{s.deliveries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal
        wide
        open={editing !== null}
        title={editing === "new" ? "Nova saída de material" : `Corrigir ${editing?.number ?? ""}`}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <DeliveryForm
            key={editing === "new" ? "new" : editing.id}
            delivery={editing === "new" ? null : editing}
            defaultDeliveredBy={defaultDeliveredBy}
            today={today}
            materials={materials}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}

function DeliveryRow({ delivery: d, canDelete, onEdit }: { delivery: Delivery; canDelete: boolean; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "Erro."));
    });

  return (
    <li className={cx("rounded-xl border bg-white p-4 shadow-sm", d.status === "emitida" ? "border-amber-200" : "border-slate-200")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-900">{d.number}</span>
            <Badge tone={STATUS_TONE[d.status]}>{DELIVERY_STATUS_LABELS[d.status]}</Badge>
            <span className="text-sm text-slate-500">{formatDeliveryDate(d.delivery_date)}</span>
          </div>
          <p className="mt-1 text-sm text-slate-700">
            Para <strong>{d.recipient}</strong>
            {d.reference && <> · {d.reference}</>} · entregue por {d.delivered_by}
            {d.received_by && <> · recebido por {d.received_by}</>}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {d.items.map((it) => (
              <li key={it.id ?? it.description} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {formatQuantity(it.quantity)} {it.unit} · {it.description}
              </li>
            ))}
          </ul>
          {d.status === "anulada" && d.cancelled_reason && <p className="mt-2 text-xs text-slate-500">Motivo da anulação: {d.cancelled_reason}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/admin/guia/${d.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg bg-black px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            <Printer className="size-3.5" /> Guia (imprimir / PDF)
          </Link>
          {d.status === "emitida" && (
            <>
              <Button size="sm" onClick={onEdit} disabled={pending}>
                <Pencil className="size-3.5" /> Corrigir
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => {
                  const name = prompt("Nome de quem recebeu na Promarine (como na assinatura):", d.received_by ?? "");
                  if (name !== null) run(() => markDeliverySigned(d.id, name));
                }}
              >
                <FileSignature className="size-3.5" /> Marcar como assinada
              </Button>
            </>
          )}
          {d.status !== "anulada" && (
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => {
                const reason = prompt(`Motivo da anulação da guia ${d.number}:`);
                if (reason !== null) run(() => cancelDelivery(d.id, reason));
              }}
            >
              <Ban className="size-3.5" /> Anular
            </Button>
          )}
          {canDelete && d.status === "emitida" && (
            <Button
              size="sm"
              variant="danger"
              aria-label={`Apagar ${d.number}`}
              disabled={pending}
              onClick={() => {
                if (confirm(`Apagar a guia ${d.number}, criada por engano? Esta acção não pode ser desfeita (o número não é reutilizado).`))
                  run(() => deleteDelivery(d.id));
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {d.status === "assinada" && d.signed_at && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="size-3.5" /> Assinada — registado em{" "}
          {new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(d.signed_at))}
        </p>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </li>
  );
}

function DeliveryForm({
  delivery,
  defaultDeliveredBy,
  today,
  materials,
  onDone,
}: {
  delivery: Delivery | null;
  defaultDeliveredBy: string;
  today: string;
  materials: string[];
  onDone: () => void;
}) {
  const [header, setHeader] = useState<HeaderForm>(() => ({
    delivery_date: delivery?.delivery_date ?? today,
    recipient: delivery?.recipient ?? DEFAULT_RECIPIENT,
    reference: delivery?.reference ?? "",
    delivered_by: delivery?.delivered_by ?? defaultDeliveredBy,
    received_by: delivery?.received_by ?? "",
    notes: delivery?.notes ?? "",
  }));
  const [items, setItems] = useState<ItemForm[]>(() =>
    delivery?.items.length
      ? delivery.items.map((it) => ({ description: it.description, reference: it.reference ?? "", quantity: String(it.quantity), unit: it.unit, notes: it.notes ?? "" }))
      : [blankItem()],
  );
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; details?: string[] } | null>(null);
  const setH = <K extends keyof HeaderForm>(k: K, v: string) => setHeader((h) => ({ ...h, [k]: v }));
  const setItem = (i: number, k: keyof ItemForm, v: string) => setItems((list) => list.map((it, j) => (j === i ? { ...it, [k]: v } : it)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      header,
      items: items
        .filter((it) => it.description.trim())
        .map((it) => ({ ...it, quantity: Number(String(it.quantity).replace(",", ".")) })),
    };
    start(async () => {
      const r = delivery ? await updateDelivery(delivery.id, payload) : await createDelivery(payload);
      if (!r.ok) {
        setError({ text: r.error, details: r.details });
        return;
      }
      // Guia nova: abre logo o documento para imprimir e assinar.
      if (!delivery && r.data) router.push(`/admin/guia/${(r.data as { id: string }).id}`);
      else onDone();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data *" htmlFor="dl-date">
          <input id="dl-date" type="date" required value={header.delivery_date} onChange={(e) => setH("delivery_date", e.target.value)} className={inputCls} />
        </Field>
        <TextInput label="Para (empresa)" required value={header.recipient} onChange={(v) => setH("recipient", v)} maxLength={120} />
        <TextInput label="Referência / obra" value={header.reference} onChange={(v) => setH("reference", v)} maxLength={160} placeholder="Ex.: OS-2026-0012 · Lancha Kianda" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Entreguei — Ponto Radical (nome)" required value={header.delivered_by} onChange={(v) => setH("delivered_by", v)} maxLength={120} />
        <TextInput
          label="Recebi — Promarine (nome)"
          value={header.received_by}
          onChange={(v) => setH("received_by", v)}
          maxLength={120}
          hint="Pode ficar em branco e ser escrito à mão na guia."
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Materiais *</p>
        <datalist id="dl-materials">
          {materials.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="w-8 pb-1.5 font-medium">#</th>
                <th className="pb-1.5 font-medium">Material</th>
                <th className="w-32 pb-1.5 font-medium">Referência</th>
                <th className="w-24 pb-1.5 font-medium">Quantidade</th>
                <th className="w-24 pb-1.5 font-medium">Unidade</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="align-top">
                  <td className="py-1 pr-2 pt-3 text-xs text-slate-400">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Material ${i + 1}`}
                      list="dl-materials"
                      value={it.description}
                      maxLength={200}
                      onChange={(e) => setItem(i, "description", e.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input aria-label={`Referência ${i + 1}`} value={it.reference} maxLength={80} onChange={(e) => setItem(i, "reference", e.target.value)} className={inputCls} />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Quantidade ${i + 1}`}
                      inputMode="decimal"
                      value={it.quantity}
                      onChange={(e) => setItem(i, "quantity", e.target.value)}
                      className={cx(inputCls, "text-right")}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input aria-label={`Unidade ${i + 1}`} list="dl-units" value={it.unit} maxLength={20} onChange={(e) => setItem(i, "unit", e.target.value)} className={inputCls} />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      aria-label={`Retirar linha ${i + 1}`}
                      disabled={items.length === 1}
                      onClick={() => setItems((list) => list.filter((_, j) => j !== i))}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="dl-units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
        <Button size="sm" className="mt-2" onClick={() => setItems((list) => [...list, blankItem()])}>
          <Plus className="size-3.5" /> Acrescentar material
        </Button>
      </div>

      <TextArea label="Observações (aparecem na guia)" value={header.notes} onChange={(v) => setH("notes", v)} maxLength={2000} rows={2} />

      {error && (
        <Notice tone="error" title={error.text}>
          {error.details && (
            <ul className="list-disc pl-4">
              {error.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={pending}>
          {delivery ? "Guardar correcções" : "Emitir guia"}
        </Button>
      </div>
    </form>
  );
}
