"use client";

import { useState } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { createClientAccess, resetClientAccessPassword, setClientAccessActive } from "@/lib/ops/actions/portal";
import { fmtDateTime } from "@/lib/ops/time";
import { TempPassword } from "./admin";
import { Badge, Button, Choice, FormError, Input, Modal, Notice } from "./ui";
import { useOpsAction } from "./use-action";

export type ClientAccessView = { user_id: string; full_name: string; email: string; active: boolean; must_change_password: boolean; last_seen_at: string | null };

export function ClientAccessPanel({ clientId, clientName, defaultEmail, accesses, canEdit, portalUrl }: { clientId: string; clientName: string; defaultEmail: string | null; accesses: ClientAccessView[]; canEdit: boolean; portalUrl: string }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);
  const empty = { full_name: "", email: defaultEmail ?? "", mode: "password" as "password" | "invite" };
  const [v, setV] = useState(empty);
  const { pending, error, run } = useOpsAction();
  const close = () => {
    setOpen(false);
    setTemp(null);
    setInvited(false);
    setV(empty);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        O cliente entra em <span className="font-mono text-xs">{portalUrl}</span> e vê as suas embarcações, o progresso das obras, os trabalhos realizados e só as fotografias que a equipa partilhar. Não vê custos, notas internas nem horas.
      </p>
      {accesses.length === 0 ? (
        <p className="text-sm text-slate-500">Ainda ninguém de {clientName} tem acesso.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {accesses.map((a) => (
            <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">
                  {a.full_name} {!a.active && <Badge tone="red">Desactivado</Badge>} {a.must_change_password && a.active && <Badge tone="amber">Primeiro acesso pendente</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  {a.email} · {a.last_seen_at ? `último acesso ${fmtDateTime(a.last_seen_at)}` : "ainda não entrou"}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1.5">
                  {a.active && (
                    <Button size="sm" onClick={() => run(() => resetClientAccessPassword(a.user_id), (d) => { setTemp(d.temporaryPassword); setOpen(true); })} loading={pending}>
                      <KeyRound className="size-3.5" /> Nova palavra-passe
                    </Button>
                  )}
                  <Button size="sm" onClick={() => run(() => setClientAccessActive(a.user_id, !a.active))} loading={pending}>
                    {a.active ? "Desactivar" : "Reactivar"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!open && <FormError error={error} />}
      {canEdit && (
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="size-4" /> Dar acesso ao portal
        </Button>
      )}
      <Modal open={open} onClose={close} title={temp ? "Acesso criado" : "Dar acesso ao portal do cliente"}>
        {temp ? (
          <TempPassword value={temp} onClose={close} who="ao cliente" />
        ) : invited ? (
          <div className="space-y-4">
            <Notice tone="success">Convite enviado por email. O cliente define a palavra-passe pelo link recebido.</Notice>
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
              run(() => createClientAccess({ ...v, client_id: clientId }), (d) => (d.temporaryPassword ? setTemp(d.temporaryPassword) : setInvited(true)));
            }}
          >
            <Input label="Nome da pessoa" required value={v.full_name} onChange={(x) => setV({ ...v, full_name: x })} placeholder="Ex.: Comandante da embarcação" />
            <Input label="Email" type="email" required value={v.email} onChange={(x) => setV({ ...v, email: x })} />
            <Choice
              label="Como entra pela primeira vez"
              value={v.mode}
              onChange={(x) => setV({ ...v, mode: x })}
              options={[
                { value: "password", label: "Palavra-passe temporária (entregue por si)" },
                { value: "invite", label: "Convite por email (requer SMTP no Supabase)" },
              ]}
            />
            <p className="text-xs text-slate-500">Se o email já tiver conta (por ex. no website), a palavra-passe actual mantém-se.</p>
            <FormError error={error} />
            <div className="flex justify-end gap-2">
              <Button onClick={close}>Cancelar</Button>
              <Button type="submit" variant="primary" loading={pending}>
                Criar acesso
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
