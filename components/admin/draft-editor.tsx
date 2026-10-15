"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { Button, Notice } from "./ui";

type SaveResult = { ok: true; data?: unknown } | { ok: false; error: string; details?: string[] };

/**
 * Revisão actual do rascunho. Vem do servidor (layout do painel) e é
 * actualizada imediatamente após cada gravação, para que gravações seguidas
 * não sejam rejeitadas como conflito antes de a página ser actualizada.
 */
const RevisionContext = createContext<{ current: () => number; set: (n: number) => void }>({
  current: () => 0,
  set: () => {},
});

export function RevisionProvider({ revision, children }: { revision: number; children: React.ReactNode }) {
  const ref = useRef(revision);
  useEffect(() => {
    if (revision > ref.current) ref.current = revision;
  }, [revision]);
  const [value] = useState(() => ({
    current: () => ref.current,
    set: (n: number) => {
      if (n > ref.current) ref.current = n;
    },
  }));
  return <RevisionContext.Provider value={value}>{children}</RevisionContext.Provider>;
}

export function useRevision() {
  return useContext(RevisionContext);
}

/** Executa uma acção do rascunho com a revisão actual e regista a nova revisão. */
export function useDraftAction() {
  const revision = useRevision();
  return useCallback(
    async <R extends { ok: boolean; data?: unknown }>(fn: (revision: number) => Promise<R>): Promise<R> => {
      const result = await fn(revision.current());
      const data = result.data as { revision?: number } | undefined;
      if (result.ok && typeof data?.revision === "number") revision.set(data.revision);
      return result;
    },
    [revision],
  );
}

/**
 * Estado local de um formulário que edita parte do rascunho.
 * Mantém o controlo de alterações por guardar e avisa antes de sair da página.
 */
export function useDraftEditor<T>(initial: T, save: (value: T, revision: number) => Promise<SaveResult>) {
  const run = useDraftAction();
  const [value, setValue] = useState<T>(initial);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = useCallback((updater: (draft: T) => T) => {
    setValue((current) => updater(current));
    setDirty(true);
    setSaved(false);
  }, []);

  const submit = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await run((revision) => save(value, revision));
      if (result.ok) {
        setDirty(false);
        setSaved(true);
      } else {
        setError({ message: result.error, details: result.details });
      }
    });
  }, [save, run, value]);

  return { value, setValue: (v: T) => update(() => v), update, dirty, pending, error, saved, submit };
}

export function SaveBar({
  dirty,
  pending,
  saved,
  error,
  onSave,
  label = "Guardar rascunho",
}: {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  error: { message: string; details?: string[] } | null;
  onSave: () => void;
  label?: string;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
      {error && (
        <div className="mb-3">
          <Notice tone="error" title={error.message}>
            {error.details && (
              <ul className="list-disc pl-4">
                {error.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </Notice>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          {dirty ? (
            <span className="font-medium text-amber-700">Tem alterações por guardar.</span>
          ) : saved ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="size-4" /> Guardado no rascunho. Publique para actualizar o website.
            </span>
          ) : (
            "As alterações ficam no rascunho até serem publicadas."
          )}
        </p>
        <Button variant="primary" onClick={onSave} loading={pending} disabled={!dirty}>
          {!pending && <Save className="size-4" />}
          {label}
        </Button>
      </div>
    </div>
  );
}
