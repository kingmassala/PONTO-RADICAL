import "server-only";
import { headers } from "next/headers";
import { GESTAO_PREFIX, isGestaoHost, joinBase } from "./base";

/** Base dos links da gestão para o pedido actual ("" no subdomínio, "/gestao" no domínio principal). */
export async function getOpsBase(): Promise<string> {
  const h = await headers();
  return isGestaoHost(h.get("x-forwarded-host") ?? h.get("host")) ? "" : GESTAO_PREFIX;
}

export async function opsPath(path: string): Promise<string> {
  return joinBase(await getOpsBase(), path);
}

/** Origem pública do pedido (para links em emails de recuperação). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
