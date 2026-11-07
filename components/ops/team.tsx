"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { saveTeam } from "@/lib/ops/actions/admin";
import { setHourlyCost } from "@/lib/ops/actions/finance";
import { saveMaterial, saveSupplier } from "@/lib/ops/actions/registry";
import { fmtAoa } from "@/lib/ops/money";
import { Button, Choice, FormError, Input, Modal, PeoplePicker, Toggle } from "./ui";
import { useOpsAction } from "./use-action";

export function HourlyCostEditor({ userId, value }: { userId: string; value: number | null }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value?.toString() ?? "");
  const { pending, error, run } = useOpsAction();
  if (!editing)
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-sm underline-offset-4 hover:underline">
        {value === null ? <span className="text-amber-700">Definir</span> : `${fmtAoa(value)}/h`}
      </button>
    );
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setHourlyCost(userId, Number(v)), () => setEditing(false));
      }}
    >
      <input type="number" min="0" step="0.01" value={v} onChange={(e) => setV(e.target.value)} className="w-28 rounded border border-slate-300 px-2 py-1 text-sm" aria-label="Custo por hora (AOA)" autoFocus />
      <Button type="submit" size="sm" variant="primary" loading={pending}>
        OK
      </Button>
      {error && <span className="text-xs text-red-600">{error.message}</span>}
    </form>
  );
}

export function TeamFormButton({ people, team }: { people: { id: string; name: string }[]; team?: { id: string; name: string; leader_id: string | null; members: string[] } }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: team?.name ?? "", leader_id: team?.leader_id ?? "", members: team?.members ?? [] });
  const { pending, error, run } = useOpsAction();
  return (
    <>
      <Button size="sm" variant={team ? "ghost" : "primary"} onClick={() => setOpen(true)}>
        {team ? "Editar" : (
          <>
            <Plus className="size-3.5" /> Nova equipa
          </>
        )}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={team ? "Editar equipa" : "Nova equipa"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveTeam({ id: team?.id, name: v.name, leader_id: v.leader_id || null, members: v.members }), () => setOpen(false));
          }}
        >
          <Input label="Nome" required value={v.name} onChange={(x) => setV({ ...v, name: x })} placeholder="Ex.: Equipa de soldadura" />
          <Choice label="Chefe de equipa" value={v.leader_id} placeholder="— Nenhum —" onChange={(x) => setV({ ...v, leader_id: x })} options={people.map((p) => ({ value: p.id, label: p.name }))} />
          <PeoplePicker label="Membros" people={people} value={v.members} onChange={(ids) => setV({ ...v, members: ids })} />
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

export function MaterialFormButton({ material }: { material?: { id: string; code: string | null; name: string; unit: string; unit_cost: number; active: boolean } }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ code: material?.code ?? "", name: material?.name ?? "", unit: material?.unit ?? "un", unit_cost: material?.unit_cost?.toString() ?? "", active: material?.active ?? true });
  const { pending, error, run } = useOpsAction();
  return (
    <>
      <Button size="sm" variant={material ? "ghost" : "primary"} onClick={() => setOpen(true)}>
        {material ? "Editar" : (
          <>
            <Plus className="size-3.5" /> Material
          </>
        )}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={material ? "Editar material" : "Novo material"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveMaterial({ ...v, id: material?.id }), () => setOpen(false));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome" required value={v.name} onChange={(x) => setV({ ...v, name: x })} />
            <Input label="Código" value={v.code} onChange={(x) => setV({ ...v, code: x })} />
            <Input label="Unidade" required value={v.unit} onChange={(x) => setV({ ...v, unit: x })} placeholder="un, L, kg, m…" />
            <Input label="Custo unitário (AOA)" type="number" min="0" step="0.01" required value={v.unit_cost} onChange={(x) => setV({ ...v, unit_cost: x })} />
          </div>
          <Toggle label="Activo" checked={v.active} onChange={(x) => setV({ ...v, active: x })} />
          <p className="text-xs text-slate-500">Alterar o custo só afecta consumos futuros: os já registados guardam o custo da altura.</p>
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

export function SupplierFormButton({ supplier }: { supplier?: { id: string; name: string; nif: string | null; phone: string | null; email: string | null } }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: supplier?.name ?? "", nif: supplier?.nif ?? "", phone: supplier?.phone ?? "", email: supplier?.email ?? "" });
  const { pending, error, run } = useOpsAction();
  return (
    <>
      <Button size="sm" variant={supplier ? "ghost" : "primary"} onClick={() => setOpen(true)}>
        {supplier ? "Editar" : (
          <>
            <Plus className="size-3.5" /> Fornecedor
          </>
        )}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={supplier ? "Editar fornecedor" : "Novo fornecedor"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveSupplier({ ...v, id: supplier?.id }), () => setOpen(false));
          }}
        >
          <Input label="Nome" required value={v.name} onChange={(x) => setV({ ...v, name: x })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="NIF" value={v.nif} onChange={(x) => setV({ ...v, nif: x })} />
            <Input label="Telefone" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
            <Input label="Email" type="email" value={v.email} onChange={(x) => setV({ ...v, email: x })} />
          </div>
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
