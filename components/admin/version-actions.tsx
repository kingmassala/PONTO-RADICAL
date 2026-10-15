"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { restoreVersion } from "@/lib/cms/actions";
import { useDraftAction } from "./draft-editor";
import { Button } from "./ui";

export function RestoreVersionButton({ versionId }: { versionId: number }) {
  const run = useDraftAction();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        loading={pending}
        onClick={() => {
          if (!window.confirm(`Copiar a versão n.º ${versionId} para o rascunho? As alterações não publicadas do rascunho actual serão substituídas.`)) return;
          startTransition(async () => {
            const r = await run(() => restoreVersion(versionId));
            setMessage(r.ok ? "Copiada para o rascunho. Reveja e publique." : r.error);
          });
        }}
      >
        {!pending && <RotateCcw className="size-3.5" />} Restaurar
      </Button>
      {message && <p className="max-w-56 text-right text-xs text-slate-600">{message}</p>}
    </div>
  );
}
