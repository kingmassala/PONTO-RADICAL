import type { CmsLink, SiteDocument } from "@/lib/cms/schema";
import { isStoreActive } from "@/lib/cms/validate";

export type ResolvedLink = {
  href: string;
  label: string;
  newTab: boolean;
  style: CmsLink["style"];
};

/**
 * Transforma um link do CMS num destino real. Devolve null quando o botão não
 * deve aparecer (desactivado, secção oculta/inexistente ou loja desactivada),
 * para que o website nunca mostre links inválidos.
 */
export function resolveLink(link: CmsLink, doc: SiteDocument): ResolvedLink | null {
  if (!link.enabled || !link.label) return null;
  const base = { label: link.label, style: link.style };
  switch (link.type) {
    case "anchor": {
      const target = doc.sections.find((s) => s.anchor === link.anchor && s.visible);
      return target ? { ...base, href: `#${target.anchor}`, newTab: false } : null;
    }
    case "external":
      return link.url ? { ...base, href: link.url, newTab: link.newTab } : null;
    case "store":
      return isStoreActive(doc) ? { ...base, href: doc.store.url!, newTab: doc.store.openInNewTab } : null;
  }
}

/** Botão «Loja Online» configurado em «Loja Online». */
export function storeLink(doc: SiteDocument): ResolvedLink | null {
  if (!isStoreActive(doc)) return null;
  return {
    href: doc.store.url!,
    label: doc.store.label || "Loja Online",
    newTab: doc.store.openInNewTab,
    style: "primary",
  };
}

export function navItems(doc: SiteDocument) {
  return doc.sections
    .filter((s) => s.visible && s.showInNav && s.navLabel)
    .map((s) => ({ href: `#${s.anchor}`, label: s.navLabel }));
}
