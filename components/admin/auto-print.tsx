"use client";

import { useEffect } from "react";

/**
 * Define o título do documento (nome sugerido do PDF) e abre a janela de impressão
 * quando a página é aberta com ?pdf=1 («Guardar como PDF» no destino da impressão).
 */
export function AutoPrint({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
    if (new URLSearchParams(window.location.search).get("pdf") === "1") {
      const t = window.setTimeout(() => window.print(), 600);
      return () => window.clearTimeout(t);
    }
  }, [title]);
  return null;
}
