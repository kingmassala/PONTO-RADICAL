"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Eye, RotateCcw, Send } from "lucide-react";
import { discardDraft, publishDraft } from "@/lib/cms/actions";
import type { Issue } from "@/lib/cms/validate";
import { useDraftAction } from "./draft-editor";
import { Button, Modal, Notice } from "./ui";

function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-2">
      {issues.map((issue, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className={issue.level === "error" ? "text-red-600" : "text-amber-600"}>{issue.level === "error" ? "●" : "▲"}</span>
          <span className="flex-1 text-slate-700">{issue.message}</span>
          <Link href={issue.href} className="shrink-0 text-sky-700 hover:underline">
            Corrigir
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PublishBar({
  hasUnpublished,
  publishedAt,
  issues,
}: {
  hasUnpublished: boolean;
  publishedAt: string | null;
  issues: Issue[];
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<Issue[] | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const run = useDraftAction();
  const errors = issues.filter((i) => i.level === "error");

  const publish = () => {
    setError(null);
    setServerIssues(null);
    startTransition(async () => {
      const result = await run((revision) => publishDraft(revision, note));
      if (result.ok) {
        setSuccess(result.data.versionId);
        setNote("");
      } else {
        setError(result.error);
        if ("issues" in result) setServerIssues(result.issues);
      }
    });
  };

  const discard = () => {
    if (!window.confirm("Descartar todas as alterações do rascunho e voltar ao conteúdo publicado?")) return;
    startTransition(async () => {
      const result = await run(() => discardDraft());
      if (!result.ok) setError(result.error);
    });
  };

  const published = publishedAt
    ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(publishedAt))
    : null;

  return (
    <div className="sticky top-14 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:top-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2 text-sm">
          {hasUnpublished ? (
            <>
              <span className="size-2 rounded-full bg-amber-500" aria-hidden />
              <span className="font-medium text-slate-800">Existem alterações por publicar</span>
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
              <span className="text-slate-600">Website actualizado{published ? ` · publicado a ${published}` : ""}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {hasUnpublished && publishedAt && (
            <Button size="sm" variant="ghost" onClick={discard} disabled={pending}>
              <RotateCcw className="size-3.5" /> Descartar
            </Button>
          )}
          <a
            href="/admin/pre-visualizacao"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Eye className="size-3.5" /> Pré-visualizar
          </a>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setSuccess(null);
              setError(null);
              setOpen(true);
            }}
            disabled={!hasUnpublished}
          >
            <Send className="size-3.5" /> Publicar
          </Button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Publicar alterações">
        {success ? (
          <div className="space-y-4">
            <Notice tone="success" title={`Publicado com sucesso (versão n.º ${success}).`}>
              As alterações já estão disponíveis no website público.
            </Notice>
            <div className="flex justify-end gap-2">
              <a href="/" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                Ver website
              </a>
              <Button variant="primary" onClick={() => setOpen(false)}>
                <CheckCircle2 className="size-4" /> Concluir
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              O conteúdo do rascunho passa a ser o conteúdo do website público. A versão actual fica guardada no histórico e
              pode ser recuperada a qualquer momento.
            </p>
            {errors.length > 0 && (
              <Notice tone="error" title="Não é possível publicar enquanto existirem erros:">
                <IssueList issues={errors} />
              </Notice>
            )}
            {issues.some((i) => i.level === "warning") && (
              <Notice tone="warning" title="Avisos (não impedem a publicação):">
                <IssueList issues={issues.filter((i) => i.level === "warning")} />
              </Notice>
            )}
            {error && (
              <Notice tone="error" title={error}>
                {serverIssues && <IssueList issues={serverIssues.filter((i) => i.level === "error")} />}
              </Notice>
            )}
            <div>
              <label htmlFor="publish-note" className="mb-1.5 block text-sm font-medium text-slate-700">
                Nota da publicação (opcional)
              </label>
              <input
                id="publish-note"
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: Novas fotografias da secção Aventura"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="primary" onClick={publish} loading={pending} disabled={errors.length > 0}>
                {!pending && <Send className="size-4" />} Publicar agora
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
