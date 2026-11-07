"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { saveClient, saveVessel } from "@/lib/ops/actions/registry";
import { uploadAttachment } from "@/lib/ops/actions/files";
import { fmtDate } from "@/lib/ops/time";
import { shrinkImage } from "./shrink-image";
import { saveOrder } from "@/lib/ops/actions/orders";
import { INTERVENTION_LABELS, INTERVENTION_TYPES, PRIORITIES, PRIORITY_LABELS, REGISTRATION_DOC_CAPTION, VESSEL_TYPE_LABELS, VESSEL_TYPES, type InterventionType, type Priority, type VesselType } from "@/lib/ops/labels";
import { useOps } from "./context";
import { Area, Button, Choice, FormError, Input, Modal } from "./ui";
import { useOpsAction } from "./use-action";

/* ------------------------------ Clientes ------------------------------ */

export type ClientValues = {
  id?: string;
  name: string;
  legal_name: string | null;
  nif: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contact_person: string | null;
  notes: string | null;
};

const emptyClient: ClientValues = { name: "", legal_name: "", nif: "", phone: "", email: "", address: "", contact_person: "", notes: "" };

export function ClientFormButton({ initial, label = "Novo cliente", onCreated }: { initial?: ClientValues; label?: string; onCreated?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ClientValues>(initial ?? emptyClient);
  const { pending, error, run } = useOpsAction();
  const set = (patch: Partial<ClientValues>) => setV((c) => ({ ...c, ...patch }));
  return (
    <>
      <Button variant={initial ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {!initial && <Plus className="size-4" />} {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={initial ? "Editar cliente" : "Novo cliente"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveClient(v), (d) => {
              setOpen(false);
              if (!initial) setV(emptyClient);
              onCreated?.(d.id);
            });
          }}
        >
          <Input label="Nome" required value={v.name} onChange={(x) => set({ name: x })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Designação social" value={v.legal_name} onChange={(x) => set({ legal_name: x })} />
            <Input label="NIF" value={v.nif} onChange={(x) => set({ nif: x })} />
            <Input label="Telefone" type="tel" value={v.phone} onChange={(x) => set({ phone: x })} />
            <Input label="Email" type="email" value={v.email} onChange={(x) => set({ email: x })} />
            <Input label="Responsável / contacto" value={v.contact_person} onChange={(x) => set({ contact_person: x })} />
            <Input label="Morada" value={v.address} onChange={(x) => set({ address: x })} />
          </div>
          <Area label="Observações" value={v.notes} onChange={(x) => set({ notes: x })} />
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------ Embarcações ------------------------------ */

export type VesselValues = {
  id?: string;
  client_id: string;
  name: string;
  vessel_type: VesselType;
  registration: string | null;
  manufacturer: string | null;
  model: string | null;
  hull_type: string | null;
  length_m: number | string | null;
  propulsion: string | null;
  location: string | null;
  notes: string | null;
};

export function VesselFormButton({
  clients,
  initial,
  defaultClientId,
  label = "Nova embarcação",
  registrationDoc,
}: {
  clients: { id: string; name: string }[];
  initial?: VesselValues;
  defaultClientId?: string;
  label?: string;
  /** Documento de registo da matrícula já carregado (edição). */
  registrationDoc?: { url: string | null; created_at: string } | null;
}) {
  const empty: VesselValues = {
    client_id: defaultClientId ?? "",
    name: "",
    vessel_type: "recreio",
    registration: "",
    manufacturer: "",
    model: "",
    hull_type: "",
    length_m: "",
    propulsion: "",
    location: "",
    notes: "",
  };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<VesselValues>(initial ?? empty);
  const [doc, setDoc] = useState<File | null>(null);
  const { pending, error, run } = useOpsAction();
  const set = (patch: Partial<VesselValues>) => setV((c) => ({ ...c, ...patch }));

  async function save() {
    const saved = await saveVessel({ ...v, length_m: v.length_m === "" ? null : v.length_m });
    if (!saved.ok || !doc) return saved;
    const fd = new FormData();
    fd.set("file", await shrinkImage(doc));
    fd.set("entity_type", "vessel");
    fd.set("entity_id", saved.data.id);
    fd.set("caption", REGISTRATION_DOC_CAPTION);
    const up = await uploadAttachment(fd);
    if (!up.ok) return { ok: false as const, error: `A embarcação foi guardada, mas o documento de registo não foi carregado: ${up.error}` };
    return saved;
  }
  return (
    <>
      <Button variant={initial ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {!initial && <Plus className="size-4" />} {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={initial ? "Editar embarcação" : "Nova embarcação"} wide>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(save, () => {
              setOpen(false);
              setDoc(null);
              if (!initial) setV(empty);
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Choice
              label="Proprietário (cliente)"
              required
              value={v.client_id}
              placeholder="— Escolher —"
              onChange={(x) => set({ client_id: x })}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input label="Nome" required value={v.name} onChange={(x) => set({ name: x })} />
            <Choice label="Tipo" value={v.vessel_type} onChange={(x) => set({ vessel_type: x })} options={VESSEL_TYPES.map((t) => ({ value: t, label: VESSEL_TYPE_LABELS[t] }))} />
            <Input label="Matrícula" value={v.registration} onChange={(x) => set({ registration: x })} />
            <Input label="Fabricante" value={v.manufacturer} onChange={(x) => set({ manufacturer: x })} />
            <Input label="Modelo" value={v.model} onChange={(x) => set({ model: x })} />
            <Input label="Tipo de casco" value={v.hull_type} placeholder="Alumínio, fibra, aço…" onChange={(x) => set({ hull_type: x })} />
            <Input label="Comprimento (m)" type="number" step="0.01" min="0" value={v.length_m} onChange={(x) => set({ length_m: x })} />
            <Input label="Localização" value={v.location} onChange={(x) => set({ location: x })} />
          </div>
          <div className="rounded-lg border border-dashed border-slate-300 p-3">
            <label className="block text-sm font-medium text-slate-700" htmlFor="vessel-registration-doc">
              Documento de registo da matrícula
            </label>
            <p className="mt-0.5 text-xs text-slate-500">Fotografia ou PDF do certificado/livrete de registo (até 10 MB). No telemóvel pode tirar a fotografia na hora.</p>
            {registrationDoc && (
              <p className="mt-2 flex items-center gap-1.5 text-sm">
                <FileText className="size-4 text-slate-500" aria-hidden />
                {registrationDoc.url ? (
                  <a href={registrationDoc.url} target="_blank" rel="noopener noreferrer" className="underline">
                    Documento actual
                  </a>
                ) : (
                  "Documento actual"
                )}
                <span className="text-xs text-slate-500">carregado a {fmtDate(registrationDoc.created_at)} · escolha outro ficheiro para o substituir</span>
              </p>
            )}
            <input
              id="vessel-registration-doc"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setDoc(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </div>
          <Input label="Motorização" value={v.propulsion} placeholder="Ex.: 2× Suzuki DF300" onChange={(x) => set({ propulsion: x })} />
          <Area label="Observações" value={v.notes} onChange={(x) => set({ notes: x })} />
          <FormError error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------ Obras ------------------------------ */

export type OrderValues = {
  id?: string;
  client_id: string;
  vessel_id: string;
  intervention_type: InterventionType;
  title: string;
  description: string | null;
  location: string | null;
  manager_id: string | null;
  team_id: string | null;
  start_date: string | null;
  due_date: string | null;
  priority: Priority;
};

export function OrderForm({
  clients,
  vessels,
  managers,
  teams,
  initial,
  onDone,
}: {
  clients: { id: string; name: string }[];
  vessels: { id: string; name: string; code: string; client_id: string }[];
  managers: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  initial?: OrderValues;
  onDone?: () => void;
}) {
  const router = useRouter();
  const { href } = useOps();
  const [v, setV] = useState<OrderValues>(
    initial ?? {
      client_id: "",
      vessel_id: "",
      intervention_type: "diagnostico",
      title: "",
      description: "",
      location: "",
      manager_id: null,
      team_id: null,
      start_date: "",
      due_date: "",
      priority: "media",
    },
  );
  const { pending, error, run } = useOpsAction();
  const set = (patch: Partial<OrderValues>) => setV((c) => ({ ...c, ...patch }));
  const clientVessels = vessels.filter((x) => x.client_id === v.client_id);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveOrder({ ...v, manager_id: v.manager_id || null, team_id: v.team_id || null }), (d) => {
          if (onDone) onDone();
          else router.push(href(`/obras/${d.id}`));
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice label="Cliente" required value={v.client_id} placeholder="— Escolher cliente —" onChange={(x) => set({ client_id: x, vessel_id: "" })} options={clients.map((c) => ({ value: c.id, label: c.name }))} />
        <Choice
          label="Embarcação"
          required
          value={v.vessel_id}
          placeholder={v.client_id ? (clientVessels.length ? "— Escolher embarcação —" : "Este cliente não tem embarcações") : "Escolha primeiro o cliente"}
          onChange={(x) => set({ vessel_id: x })}
          options={clientVessels.map((x) => ({ value: x.id, label: `${x.code} · ${x.name}` }))}
        />
      </div>
      <Input label="Título da obra" required value={v.title} placeholder="Ex.: Reparação e soldadura do casco" onChange={(x) => set({ title: x })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Choice label="Tipo de intervenção" value={v.intervention_type} onChange={(x) => set({ intervention_type: x })} options={INTERVENTION_TYPES.map((t) => ({ value: t, label: INTERVENTION_LABELS[t] }))} />
        <Choice label="Prioridade" value={v.priority} onChange={(x) => set({ priority: x })} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
        <Input label="Local de execução" value={v.location} onChange={(x) => set({ location: x })} placeholder="Estaleiro, marina…" />
        <Choice label="Responsável técnico" value={v.manager_id ?? ""} placeholder="— Sem responsável —" onChange={(x) => set({ manager_id: x || null })} options={managers.map((m) => ({ value: m.id, label: m.name }))} />
        <Choice label="Equipa" value={v.team_id ?? ""} placeholder="— Sem equipa —" onChange={(x) => set({ team_id: x || null })} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Início" type="date" value={v.start_date} onChange={(x) => set({ start_date: x })} />
          <Input label="Prazo" type="date" value={v.due_date} onChange={(x) => set({ due_date: x })} />
        </div>
      </div>
      <Area label="Descrição / diagnóstico" rows={4} value={v.description} onChange={(x) => set({ description: x })} />
      <FormError error={error} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          {initial ? "Guardar alterações" : "Criar ordem de serviço"}
        </Button>
      </div>
    </form>
  );
}

export function OrderEditButton(props: Omit<Parameters<typeof OrderForm>[0], "onDone">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Editar obra</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Editar obra" wide>
        <OrderForm {...props} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
