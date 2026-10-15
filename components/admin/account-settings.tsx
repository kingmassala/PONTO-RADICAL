"use client";

import { useState, useTransition } from "react";
import { changeOwnPassword, updateOwnName } from "@/lib/admin/actions";
import { Button, Card, Notice, TextInput } from "./ui";

export function AccountSettings({ email, fullName }: { email: string; fullName: string | null }) {
  const [name, setName] = useState(fullName ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const saveName = () =>
    startTransition(async () => {
      const r = await updateOwnName(name);
      setMessage(r.ok ? { tone: "success", text: "Nome actualizado." } : { tone: "error", text: r.error });
    });

  const savePassword = () => {
    if (password !== confirm) return setMessage({ tone: "error", text: "As palavras-passe não coincidem." });
    startTransition(async () => {
      const r = await changeOwnPassword(password);
      if (r.ok) {
        setPassword("");
        setConfirm("");
      }
      setMessage(r.ok ? { tone: "success", text: "Palavra-passe alterada." } : { tone: "error", text: r.error });
    });
  };

  return (
    <Card title="A minha conta" description={email}>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextInput label="Nome" value={name} maxLength={120} onChange={setName} />
        </div>
        <Button onClick={saveName} loading={pending}>
          Guardar nome
        </Button>
      </div>
      <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <TextInput label="Nova palavra-passe" type="password" value={password} onChange={setPassword} hint="Mínimo de 10 caracteres." />
        <TextInput label="Confirmar palavra-passe" type="password" value={confirm} onChange={setConfirm} />
      </div>
      <Button onClick={savePassword} loading={pending} disabled={password.length < 10}>
        Alterar palavra-passe
      </Button>
    </Card>
  );
}
