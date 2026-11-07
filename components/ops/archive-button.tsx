"use client";

import { setArchived } from "@/lib/ops/actions/registry";
import { Button } from "./ui";
import { useOpsAction } from "./use-action";

export function ArchiveButton({ kind, id, archived }: { kind: "client" | "vessel"; id: string; archived: boolean }) {
  const { pending, error, run } = useOpsAction();
  return (
    <>
      <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => setArchived(kind, id, !archived))}>
        {archived ? "Reactivar" : "Arquivar"}
      </Button>
      {error && <span className="text-xs text-red-600">{error.message}</span>}
    </>
  );
}
