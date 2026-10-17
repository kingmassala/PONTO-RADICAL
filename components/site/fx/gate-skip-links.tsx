"use client";

import { useEffect } from "react";
import { skipNextGate } from "../language-switcher";

/**
 * Fora da página inicial (blog), quem clica num link para a página inicial («/#contactos»,
 * logótipo…) já está no website: o ecrã de entrada não volta a aparecer nesse carregamento.
 */
export function GateSkipLinks({ home }: { home: string }) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a) return;
      const url = new URL((a as HTMLAnchorElement).href, location.href);
      if (url.origin === location.origin && url.pathname === new URL(home, location.href).pathname) skipNextGate();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [home]);
  return null;
}
