"use client";

import { createContext, useContext } from "react";
import { joinBase } from "@/lib/ops/base";
import type { OpsRole } from "@/lib/ops/roles";

type OpsContextValue = { base: string; role: OpsRole; userId: string; fullName: string };

const OpsContext = createContext<OpsContextValue>({ base: "/gestao", role: "tecnico", userId: "", fullName: "" });

export function OpsProvider({ value, children }: { value: OpsContextValue; children: React.ReactNode }) {
  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps() {
  const ctx = useContext(OpsContext);
  return { ...ctx, href: (path: string) => joinBase(ctx.base, path) };
}
