"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarCheck, CalendarOff, CheckCircle2, Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  addService,
  deleteService,
  duplicateService,
  reorderServices,
  saveDraftPart,
  saveService,
  saveServiceCategories,
  setServiceFlags,
} from "@/lib/cms/actions";
import type { BookingSettings, Service, ServiceCategory } from "@/lib/cms/schema";
import { formatDuration, formatPeople, formatPrice, WEEKDAY_LABELS } from "@/lib/booking/rules";
import { SaveBar, useDraftAction, useDraftEditor } from "./draft-editor";
import { MediaField } from "./media-picker";
import { RichTextEditor } from "./rich-text-editor";
import { Badge, Button, Card, cx, Field, Notice, Select, TextArea, TextInput, Toggle } from "./ui";
import { emptyMedia } from "@/lib/cms/templates";

type Act = (fn: (r: number) => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (data: unknown) => void) => void;

function useAct(): [Act, boolean, string | null] {
  const run = useDraftAction();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act: Act = (fn, after) => {
    setError(null);
    startTransition(async () => {
      const result = await run(fn);
      if (!result.ok) setError(result.error ?? "Erro inesperado.");
      else after?.(result.data);
    });
  };
  return [act, pending, error];
}

/* ------------------------------ Lista ------------------------------ */

export function ServicesManager({ services, categories }: { services: Service[]; categories: ServiceCategory[] }) {
  const router = useRouter();
  const [act, pending, error] = useAct();
  const [name, setName] = useState("");

  const move = (i: number, d: number) => {
    const ids = services.map((s) => s.id);
    const t = i + d;
    if (t < 0 || t >= ids.length) return;
    [ids[i], ids[t]] = [ids[t], ids[i]];
    act((r) => reorderServices(ids, r));
  };

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}
      {services.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Ainda não existem serviços. Adicione o primeiro passeio ou actividade abaixo.
        </div>
      )}
      <ol className={cx("grid gap-3", pending && "pointer-events-none opacity-60")}>
        {services.map((s, i) => {
          const image = s.gallery.find((g) => g.url);
          const category = categories.find((c) => c.id === s.categoryId)?.label ?? "Sem categoria";
          return (
            <li key={s.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" aria-label="Mover para cima" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Mover para baixo" disabled={i === services.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-4" />
                </Button>
              </div>
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cx("font-medium", !s.visible && "text-slate-400")}>{s.name}</p>
                <p className="truncate text-sm text-slate-500">
                  {category} · {[formatDuration(s.durationMinutes), formatPeople(s), formatPrice(s) ?? "preço sob consulta"].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {!s.visible && <Badge tone="amber">Oculto</Badge>}
                {s.visible && !s.bookable && <Badge tone="slate">Sem reservas</Badge>}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={s.visible ? "Ocultar serviço" : "Mostrar serviço"}
                  title={s.visible ? "Ocultar serviço" : "Mostrar serviço"}
                  onClick={() => act((r) => setServiceFlags(s.id, { visible: !s.visible }, r))}
                >
                  {s.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={s.bookable ? "Deixar de aceitar pedidos" : "Aceitar pedidos de reserva"}
                  title={s.bookable ? "Aceita pedidos de reserva (clique para desligar)" : "Não aceita pedidos (clique para ligar)"}
                  onClick={() => act((r) => setServiceFlags(s.id, { bookable: !s.bookable }, r))}
                >
                  {s.bookable ? <CalendarCheck className="size-4" /> : <CalendarOff className="size-4" />}
                </Button>
                <Button size="sm" variant="ghost" aria-label="Duplicar serviço" title="Duplicar" onClick={() => act((r) => duplicateService(s.id, r))}>
                  <Copy className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  aria-label="Eliminar serviço"
                  onClick={() =>
                    window.confirm(`Eliminar o serviço «${s.name}»? Os pedidos de reserva já recebidos mantêm-se em «Reservas».`) &&
                    act((r) => deleteService(s.id, r))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
                <Link
                  href={`/admin/servicos/${s.id}`}
                  className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="size-3.5" /> Editar
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
      <Card title="Adicionar serviço" description="Um passeio de barco, uma actividade, uma aula… qualquer experiência que se possa reservar.">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              (r) => addService(name, r),
              (data) => {
                setName("");
                router.push(`/admin/servicos/${(data as { id: string }).id}`);
              },
            );
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Ex.: Passeio de jet ski"
            aria-label="Nome do novo serviço"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <Button type="submit" variant="primary" disabled={!name.trim()} loading={pending}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </form>
        <p className="text-xs text-slate-500">O novo serviço fica oculto até completar a informação e o tornar visível.</p>
      </Card>
    </div>
  );
}

/* ---------------------------- Categorias ---------------------------- */

function InlineSave({ editor }: { editor: { dirty: boolean; pending: boolean; saved: boolean; error: { message: string; details?: string[] } | null; submit: () => void } }) {
  return (
    <div className="space-y-3">
      {editor.error && (
        <Notice tone="error" title={editor.error.message}>
          {editor.error.details && (
            <ul className="list-disc pl-4">
              {editor.error.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {editor.dirty ? (
            <span className="font-medium text-amber-700">Alterações por guardar.</span>
          ) : editor.saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="size-3.5" /> Guardado no rascunho.
            </span>
          ) : null}
        </p>
        <Button size="sm" variant="primary" onClick={editor.submit} loading={editor.pending} disabled={!editor.dirty}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

export function CategoriesEditor({ categories, usage }: { categories: ServiceCategory[]; usage: Record<string, number> }) {
  const editor = useDraftEditor(categories, (v, r) => saveServiceCategories(v, r));
  const list = editor.value;
  const set = (next: ServiceCategory[]) => editor.setValue(next);
  return (
    <Card title="Categorias" description="Usadas nos filtros do website (ex.: Passeios de barco, Actividades).">
      <ul className="space-y-2">
        {list.map((c, i) => {
          const count = c.id ? (usage[c.id] ?? 0) : 0;
          return (
            <li key={c.id || `new-${i}`} className="flex items-center gap-2">
              <input
                value={c.label}
                maxLength={40}
                aria-label={`Nome da categoria ${i + 1}`}
                onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
              />
              <span className="w-16 shrink-0 text-right text-xs text-slate-400">{count} serv.</span>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Mover para cima"
                disabled={i === 0}
                onClick={() => {
                  const next = [...list];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  set(next);
                }}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Remover categoria"
                title={count > 0 ? "Em uso — mude primeiro a categoria dos serviços" : "Remover"}
                disabled={count > 0 || list.length <= 1}
                onClick={() => set(list.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>
      {list.length < 20 && (
        <Button size="sm" onClick={() => set([...list, { id: "", label: "Nova categoria" }])}>
          <Plus className="size-3.5" /> Adicionar categoria
        </Button>
      )}
      <InlineSave editor={editor} />
    </Card>
  );
}

/* ------------------------- Definições de reservas ------------------------- */

export function BookingSettingsEditor({ value, hasWhatsapp }: { value: BookingSettings; hasWhatsapp: boolean }) {
  const editor = useDraftEditor(value, (v, r) => saveDraftPart("booking", v, r));
  const b = editor.value;
  const set = (patch: Partial<BookingSettings>) => editor.update((cur) => ({ ...cur, ...patch }));
  return (
    <Card title="Pedidos de reserva" description="Regras gerais do formulário de reserva do website.">
      <Toggle
        label="Aceitar pedidos de reserva"
        description="Desligado, os serviços continuam visíveis mas o formulário dá lugar a um convite para contactar."
        checked={b.enabled}
        onChange={(v) => set({ enabled: v })}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="Antecedência mínima (dias)" value={b.minNoticeDays} min={0} max={60} onChange={(v) => set({ minNoticeDays: v ?? 0 })} />
        <NumberInput label="Reservas até (dias)" value={b.maxAdvanceDays} min={7} max={730} onChange={(v) => set({ maxAdvanceDays: v ?? 180 })} />
      </div>
      <TextArea
        label="Condições de pagamento"
        value={b.paymentInfo}
        maxLength={600}
        rows={3}
        onChange={(v) => set({ paymentInfo: v })}
        hint="Mostradas no formulário e na confirmação. Ex.: transferência, Multicaixa Express ou no local."
      />
      <TextArea label="Mensagem após o envio" value={b.successMessage} maxLength={400} rows={2} onChange={(v) => set({ successMessage: v })} />
      <Toggle
        label="Oferecer continuação no WhatsApp"
        description={
          hasWhatsapp ? "Depois do envio, o cliente pode abrir o WhatsApp com a referência do pedido já escrita." : "Defina primeiro o número de WhatsApp em «Contactos»."
        }
        checked={b.whatsappFollowUp}
        onChange={(v) => set({ whatsappFollowUp: v })}
      />
      <InlineSave editor={editor} />
    </Card>
  );
}

/* ------------------------------ Editor ------------------------------ */

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  hint?: React.ReactNode;
}) {
  const below = value !== null && min !== undefined && value < min;
  return (
    <TextInput
      label={label}
      type="number"
      value={value === null ? "" : String(value)}
      placeholder={placeholder}
      hint={hint}
      error={below ? `Mínimo: ${min}` : undefined}
      onChange={(v) => {
        if (v.trim() === "") return onChange(null);
        const n = Math.round(Number(v));
        // Só se limita o máximo ao escrever; valores abaixo do mínimo são assinalados ao guardar.
        if (Number.isFinite(n)) onChange(Math.min(max ?? n, Math.max(0, n)));
      }}
    />
  );
}

const lines = (value: string) =>
  value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function ListArea({ label, value, onChange, hint, max = 20 }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string; max?: number }) {
  // Texto livre enquanto se escreve; a lista é derivada linha a linha.
  const [text, setText] = useState(value.join("\n"));
  return (
    <TextArea
      label={label}
      value={text}
      rows={4}
      hint={hint ?? "Um item por linha."}
      onChange={(v) => {
        setText(v);
        onChange(lines(v).slice(0, max));
      }}
    />
  );
}

/** Mostra a hora como HH:MM ao escrever (aceita 9, 930, 9h30, 09:30). */
function normaliseSlot(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const padded = digits.length <= 2 ? `${digits.padStart(2, "0")}00` : digits.padStart(4, "0").slice(0, 4);
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

export function ServiceEditor({ service, categories }: { service: Service; categories: ServiceCategory[] }) {
  const editor = useDraftEditor(service, (v, r) => saveService(v, r));
  const s = editor.value;
  const set = (patch: Partial<Service>) => editor.update((cur) => ({ ...cur, ...patch }));
  const [newSlot, setNewSlot] = useState("");
  const hours = Math.floor(s.durationMinutes / 60);
  const minutes = s.durationMinutes % 60;

  const addSlot = () => {
    const slot = normaliseSlot(newSlot);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot) || s.timeSlots.includes(slot)) return;
    set({ timeSlots: [...s.timeSlots, slot].sort() });
    setNewSlot("");
  };

  return (
    <div>
      <Link href="/admin/servicos" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Todos os serviços
      </Link>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">{s.name || "Serviço"}</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Informação">
            <TextInput label="Nome" value={s.name} maxLength={120} onChange={(v) => set({ name: v })} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Categoria"
                value={s.categoryId}
                onChange={(v) => set({ categoryId: v })}
                options={[
                  ...(categories.some((c) => c.id === s.categoryId) ? [] : [{ value: s.categoryId, label: "— escolha —" }]),
                  ...categories.map((c) => ({ value: c.id, label: c.label })),
                ]}
              />
              <TextInput
                label="Endereço (ligação directa)"
                value={s.slug}
                maxLength={80}
                onChange={(v) => set({ slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                hint={
                  <>
                    Abre o pedido de reserva em <span className="font-mono">/#reservar-{s.slug}</span>
                  </>
                }
              />
            </div>
            <TextArea
              label="Resumo (cartão)"
              value={s.summary}
              maxLength={300}
              rows={2}
              onChange={(v) => set({ summary: v })}
              hint="Uma ou duas frases que aparecem no cartão do serviço."
            />
            <RichTextEditor label="Descrição completa" value={s.description} onChange={(v) => set({ description: v })} />
          </Card>

          <Card title={`Fotografias (${s.gallery.length}/12)`} description="A primeira é a imagem do cartão. Recomendado: fotografias verticais ou 4:3, mín. 1600 px.">
            {s.gallery.map((img, i) => (
              <div key={i} className="space-y-2 rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Fotografia {i + 1}</p>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Mover para cima"
                      disabled={i === 0}
                      onClick={() => {
                        const g = [...s.gallery];
                        [g[i - 1], g[i]] = [g[i], g[i - 1]];
                        set({ gallery: g });
                      }}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Remover fotografia" onClick={() => set({ gallery: s.gallery.filter((_, j) => j !== i) })}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <MediaField label="Imagem" value={img} onChange={(v) => set({ gallery: s.gallery.map((x, j) => (j === i ? v : x)) })} />
              </div>
            ))}
            {s.gallery.length < 12 && (
              <Button size="sm" onClick={() => set({ gallery: [...s.gallery, emptyMedia()] })}>
                <Plus className="size-3.5" /> Adicionar fotografia
              </Button>
            )}
          </Card>

          <Card title="Duração, preço e grupo">
            <div className="grid gap-4 sm:grid-cols-4">
              <NumberInput label="Duração (horas)" value={hours} min={0} max={336} onChange={(v) => set({ durationMinutes: (v ?? 0) * 60 + minutes })} />
              <NumberInput label="e minutos" value={minutes} min={0} max={59} onChange={(v) => set({ durationMinutes: hours * 60 + (v ?? 0) })} />
              <NumberInput label="Mínimo de pessoas" value={s.minPeople} min={1} max={500} onChange={(v) => set({ minPeople: v ?? 1 })} />
              <NumberInput label="Máximo por reserva" value={s.maxPeople} min={1} max={500} onChange={(v) => set({ maxPeople: v ?? 1 })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberInput
                label="Preço «a partir de» (Kz)"
                value={s.priceFrom}
                min={0}
                max={1_000_000_000}
                placeholder="Vazio = sob consulta"
                onChange={(v) => set({ priceFrom: v })}
                hint={s.priceFrom !== null ? `Mostrado como «desde ${formatPrice(s)}».` : "Sem preço, o website mostra «sob consulta»."}
              />
              <Select
                label="O preço é por"
                value={s.priceUnit}
                onChange={(v) => set({ priceUnit: v })}
                options={[
                  { value: "pessoa", label: "Pessoa" },
                  { value: "grupo", label: "Grupo / embarcação" },
                ]}
              />
            </div>
            {s.minPeople > s.maxPeople && <Notice tone="warning">O mínimo de pessoas é maior do que o máximo.</Notice>}
          </Card>

          <Card title="Dias e horários" description="Indicativos: limitam o que o cliente pode pedir. A disponibilidade real é confirmada pela equipa.">
            <Field label="Dias da semana">
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = s.weekdays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ weekdays: on ? s.weekdays.filter((x) => x !== d) : [...s.weekdays, d].sort() })}
                      className={cx(
                        "rounded-full border px-3 py-1.5 text-sm",
                        on ? "border-sky-500 bg-sky-50 font-medium text-sky-800" : "border-slate-300 text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {WEEKDAY_LABELS[d]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {s.weekdays.length === 0 ? "Nenhum dia seleccionado = todos os dias." : `${s.weekdays.length} dia(s) por semana.`}
              </p>
            </Field>
            <Field label="Horários de partida">
              <div className="flex flex-wrap items-center gap-2">
                {s.timeSlots.map((slot) => (
                  <span key={slot} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm font-medium tabular-nums">
                    {slot}
                    <button
                      type="button"
                      aria-label={`Remover ${slot}`}
                      onClick={() => set({ timeSlots: s.timeSlots.filter((x) => x !== slot) })}
                      className="rounded-full p-1 text-slate-500 hover:bg-slate-200"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  value={newSlot}
                  onChange={(e) => setNewSlot(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSlot();
                    }
                  }}
                  placeholder="09:00"
                  aria-label="Novo horário (HH:MM)"
                  className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
                />
                <Button size="sm" onClick={addSlot} disabled={s.timeSlots.length >= 12}>
                  <Plus className="size-3.5" /> Horário
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Sem horários, o cliente vê «A combinar».</p>
            </Field>
          </Card>

          <Card title="Detalhes">
            <TextInput label="Ponto de encontro" value={s.meetingPoint} maxLength={300} onChange={(v) => set({ meetingPoint: v })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <ListArea label="O que está incluído" value={s.included} onChange={(v) => set({ included: v })} />
              <ListArea label="Requisitos e recomendações" value={s.requirements} onChange={(v) => set({ requirements: v })} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Visibilidade">
            <Toggle label="Mostrar no website" checked={s.visible} onChange={(v) => set({ visible: v })} />
            <Toggle
              label="Aceitar pedidos de reserva"
              description="Desligado, o serviço aparece mas o cliente é convidado a contactar."
              checked={s.bookable}
              onChange={(v) => set({ bookable: v })}
            />
            <p className="text-xs text-slate-500">A ordem dos serviços altera-se na lista de serviços.</p>
          </Card>
          <Card title="Resumo">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Duração</dt>
                <dd>{formatDuration(s.durationMinutes) ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Grupo</dt>
                <dd>{formatPeople(s)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Preço</dt>
                <dd>{formatPrice(s) ? `desde ${formatPrice(s)}` : "sob consulta"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Dias</dt>
                <dd className="text-right">{s.weekdays.length === 0 ? "Todos" : s.weekdays.map((d) => WEEKDAY_LABELS[d].slice(0, 3)).join(", ")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Horários</dt>
                <dd>{s.timeSlots.join(", ") || "A combinar"}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
      <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
    </div>
  );
}
