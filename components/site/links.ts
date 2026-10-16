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
    case "store": {
      const target = storeTarget(doc);
      return target ? { ...base, href: target.href, newTab: target.newTab } : null;
    }
  }
}

const STORE_WHATSAPP_MESSAGE = "Olá! Gostaria de saber que produtos têm disponíveis na loja.";

/**
 * Destino dos botões da loja: a Quicksell quando está activa; enquanto o link não
 * existir (e «whenNoLink» for «contact»), o WhatsApp ou a secção de contactos.
 */
export function storeTarget(doc: SiteDocument): { href: string; newTab: boolean; pending: boolean } | null {
  if (isStoreActive(doc)) return { href: doc.store.url!, newTab: doc.store.openInNewTab, pending: false };
  if (doc.store.whenNoLink !== "contact") return null;
  const whatsapp = doc.contact.whatsapp.replace(/[^0-9]/g, "");
  if (whatsapp) {
    return { href: `https://wa.me/${whatsapp}?text=${encodeURIComponent(STORE_WHATSAPP_MESSAGE)}`, newTab: true, pending: true };
  }
  const contact = doc.sections.find((s) => s.type === "contact" && s.visible);
  return contact ? { href: `#${contact.anchor}`, newTab: false, pending: true } : null;
}

/** Botão «Loja Online» configurado em «Loja Online». */
export function storeLink(doc: SiteDocument): ResolvedLink | null {
  const target = storeTarget(doc);
  if (!target) return null;
  return { href: target.href, newTab: target.newTab, label: doc.store.label || "Loja Online", style: "primary" };
}

export function navItems(doc: SiteDocument) {
  return doc.sections
    .filter((s) => s.visible && s.showInNav && s.navLabel)
    .map((s) => ({ href: `#${s.anchor}`, label: s.navLabel }));
}
