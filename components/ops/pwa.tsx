"use client";

import { useEffect } from "react";
import { useOps } from "./context";

/** Regista o service worker (instalação como aplicação no telemóvel/computador). */
export function RegisterServiceWorker() {
  const { base } = useOps();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
  }, [base]);
  return null;
}
