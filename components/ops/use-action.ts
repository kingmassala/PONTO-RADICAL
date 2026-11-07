"use client";

import { useState, useTransition } from "react";
import type { OpsResult } from "@/lib/ops/errors";

/** Executa uma Server Action e guarda erro/estado para o formulário. */
export function useOpsAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  function run<T>(fn: () => Promise<OpsResult<T>>, onOk?: (data: T) => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) onOk?.(r.data);
      else setError({ message: r.error, details: r.details });
    });
  }
  return { pending, error, setError, run };
}
