"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Mail, Phone, Trash2 } from "lucide-react";
import { deleteMessage, updateMessage } from "@/lib/admin/actions";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, cx, Notice, Select } from "./ui";

export type Message = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: "novo" | "em_curso" | "respondido" | "arquivado";
  notes: string | null;
  created_at: string;
};

export const STATUS_LABELS: Record<Message["status"], string> = {
  novo: "Novo",
  em_curso: "Em curso",
  respondido: "Respondido",
  arquivado: "Arquivado",
};
const STATUS_TONES = { novo: "sky", em_curso: "amber", respondido: "green", arquivado: "slate" } as const;

export function MessageRow({ message, canDelete }: { message: Message; canDelete: boolean }) {
  const [open, setOpen] = useState(message.status === "novo");
  const [status, setStatus] = useState(message.status);
  const [notes, setNotes] = useState(message.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (nextStatus = status) =>
    startTransition(async () => {
      const r = await updateMessage(message.id, { status: nextStatus, notes });
      setError(r.ok ? null : r.error);
    });

  return (
    <li className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-4 px-5 py-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cx("font-medium", message.status === "novo" && "text-slate-900")}>{message.subject}</p>
            <Badge tone={STATUS_TONES[message.status]}>{STATUS_LABELS[message.status]}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {message.name} · {formatDateTime(message.created_at)}
          </p>
        </div>
        <ChevronDown className={cx("mt-1 size-4 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-100 px-5 py-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`} className="inline-flex items-center gap-1.5 text-sky-700 hover:underline">
              <Mail className="size-4" /> {message.email}
            </a>
            {message.phone && (
              <a href={`tel:${message.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1.5 text-sky-700 hover:underline">
                <Phone className="size-4" /> {message.phone}
              </a>
            )}
          </div>
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{message.message}</p>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Estado"
              value={status}
              onChange={(v) => {
                setStatus(v);
                save(v);
              }}
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value: value as Message["status"], label }))}
            />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`notes-${message.id}`}>
                Notas internas
              </label>
              <textarea
                id={`notes-${message.id}`}
                value={notes}
                maxLength={2000}
                rows={2}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </div>
          </div>
          <div className="flex justify-between">
            <Button size="sm" onClick={() => save()} loading={pending}>
              Guardar notas
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  window.confirm("Eliminar definitivamente esta mensagem?") &&
                  startTransition(async () => {
                    const r = await deleteMessage(message.id);
                    if (!r.ok) setError(r.error);
                  })
                }
              >
                <Trash2 className="size-3.5" /> Eliminar
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
