/**
 * A área de gestão funciona em dois endereços com o mesmo código:
 *  - subdomínio (ex.: https://gestao.pontoradical.com/obras) — o next.config reescreve para /gestao/*;
 *  - caminho no domínio principal (ex.: https://ponto-radical.vercel.app/gestao/obras).
 * Os links internos usam a base certa para cada caso.
 */
export const GESTAO_PREFIX = "/gestao";

export function isGestaoHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.split(":")[0].toLowerCase();
  const configured = (process.env.NEXT_PUBLIC_GESTAO_HOST ?? "").toLowerCase();
  return name.startsWith("gestao.") || (configured !== "" && name === configured);
}

export function joinBase(base: string, path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  if (base === "") return path;
  return path === "/" ? base : `${base}${path}`;
}
