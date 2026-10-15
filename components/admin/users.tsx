"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { inviteUser, setUserRole } from "@/lib/admin/actions";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Card, Notice, Select, TextInput } from "./ui";

type Profile = { id: string; email: string; full_name: string | null; role: "admin" | "editor" | null; created_at: string };

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrador" },
  { value: "editor", label: "Editor" },
  { value: "none", label: "Sem acesso" },
] as const;

export function UsersManager({ profiles, currentUserId, canInvite }: { profiles: Profile[]; currentUserId: string; canInvite: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const invite = () =>
    startTransition(async () => {
      const r = await inviteUser({ email, role });
      if (r.ok) setEmail("");
      setMessage(r.ok ? { tone: "success", text: `Convite enviado para ${email}.` } : { tone: "error", text: r.error });
    });

  const changeRole = (id: string, value: string) =>
    startTransition(async () => {
      const r = await setUserRole(id, value === "none" ? null : (value as "admin" | "editor"));
      setMessage(r.ok ? { tone: "success", text: "Permissões actualizadas." } : { tone: "error", text: r.error });
    });

  return (
    <div className="space-y-6">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Card title="Convidar utilizador" description="A pessoa recebe um email para definir a sua palavra-passe.">
        {!canInvite && (
          <Notice tone="warning">Para enviar convites é necessário configurar SUPABASE_SECRET_KEY no servidor.</Notice>
        )}
        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <div className="sm:col-span-2">
            <TextInput label="Email" type="email" value={email} onChange={setEmail} />
          </div>
          <Select
            label="Papel"
            value={role}
            onChange={setRole}
            options={[
              { value: "editor", label: "Editor" },
              { value: "admin", label: "Administrador" },
            ]}
          />
        </div>
        <Button variant="primary" onClick={invite} loading={pending} disabled={!email || !canInvite}>
          <UserPlus className="size-4" /> Enviar convite
        </Button>
        <p className="text-xs text-slate-500">
          <strong>Editor:</strong> edita conteúdos, imagens, aparência e publica. <strong>Administrador:</strong> também gere
          utilizadores, elimina mensagens e consulta o registo de actividade.
        </p>
      </Card>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {profiles.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">
                  {p.full_name || p.email} {p.id === currentUserId && <Badge tone="sky">Você</Badge>}
                </p>
                <p className="text-sm text-slate-500">
                  {p.email} · desde {formatDateTime(p.created_at)}
                </p>
              </div>
              <div className="w-44">
                <Select
                  label="Papel"
                  value={p.role ?? "none"}
                  onChange={(v) => changeRole(p.id, v)}
                  options={ROLE_OPTIONS.map((o) => ({ ...o }))}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
