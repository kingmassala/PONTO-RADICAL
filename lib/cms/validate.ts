import type { CmsLink, MediaRef, Section, SiteDocument } from "./schema";
import { SECTION_TEMPLATES } from "./templates";

export type Issue = {
  level: "error" | "warning";
  message: string;
  /** Página do painel onde o problema pode ser corrigido. */
  href: string;
};

type NamedLink = { link: CmsLink; where: string; href: string };

export function sectionLabel(section: Section): string {
  const template = SECTION_TEMPLATES.find((t) => t.type === section.type);
  const name = section.navLabel || ("title" in section ? section.title : "") || template?.label || section.type;
  return `«${name}»`;
}

export function collectLinks(doc: SiteDocument): NamedLink[] {
  const links: NamedLink[] = [
    { link: doc.navigation.ctaButton, where: "Botão do cabeçalho", href: "/admin/menu" },
    ...doc.footer.links.map((link, i) => ({ link, where: `Link ${i + 1} do rodapé`, href: "/admin/menu" })),
  ];
  for (const s of doc.sections) {
    const href = `/admin/seccoes/${s.id}`;
    const where = `Secção ${sectionLabel(s)}`;
    if (s.type === "hero" || s.type === "cta") {
      links.push({ link: s.primaryButton, where: `${where} · botão principal`, href });
      links.push({ link: s.secondaryButton, where: `${where} · botão secundário`, href });
    }
    if (s.type === "split" || s.type === "banner" || s.type === "video") {
      links.push({ link: s.button, where: `${where} · botão`, href });
    }
  }
  return links;
}

export function collectImages(doc: SiteDocument): { ref: MediaRef; where: string; href: string }[] {
  const out: { ref: MediaRef; where: string; href: string }[] = [];
  for (const s of doc.sections) {
    const href = `/admin/seccoes/${s.id}`;
    const where = `Secção ${sectionLabel(s)}`;
    if (s.type === "hero" && s.mediaKind === "image") out.push({ ref: s.image, where, href });
    if (s.type === "split" || s.type === "banner") out.push({ ref: s.image, where, href });
    if (s.type === "video") out.push({ ref: s.poster, where, href });
    if (s.type === "gallery") s.items.forEach((item) => out.push({ ref: item.image, where, href }));
  }
  for (const b of doc.brands) {
    out.push({ ref: b.heroImage, where: `Marca «${b.name}»`, href: `/admin/marcas/${b.id}` });
  }
  return out;
}

/** Verificações de coerência que vão além do esquema (âncoras, links, loja). */
export function checkDocument(doc: SiteDocument): Issue[] {
  const issues: Issue[] = [];

  const anchors = new Map<string, Section>();
  const ids = new Set<string>();
  for (const s of doc.sections) {
    if (ids.has(s.id)) {
      issues.push({ level: "error", message: `Identificador de secção repetido (${s.id}).`, href: "/admin/seccoes" });
    }
    ids.add(s.id);
    if (anchors.has(s.anchor)) {
      issues.push({
        level: "error",
        message: `A âncora «#${s.anchor}» está a ser usada por mais de uma secção.`,
        href: `/admin/seccoes/${s.id}`,
      });
    }
    anchors.set(s.anchor, s);
    if (s.visible && s.showInNav && !s.navLabel) {
      issues.push({
        level: "error",
        message: `Secção ${sectionLabel(s)} aparece no menu mas não tem nome no menu.`,
        href: "/admin/menu",
      });
    }
  }

  if (!doc.sections.some((s) => s.visible)) {
    issues.push({ level: "error", message: "Não existe nenhuma secção visível no website.", href: "/admin/seccoes" });
  }

  for (const { link, where, href } of collectLinks(doc)) {
    if (!link.enabled) continue;
    if (!link.label) {
      issues.push({ level: "error", message: `${where}: falta o texto do botão.`, href });
    }
    if (link.type === "anchor") {
      const target = anchors.get(link.anchor);
      if (!link.anchor || !target) {
        issues.push({
          level: "error",
          message: `${where}: aponta para uma secção que não existe${link.anchor ? ` (#${link.anchor})` : ""}.`,
          href,
        });
      } else if (!target.visible) {
        issues.push({
          level: "warning",
          message: `${where}: aponta para a secção #${link.anchor}, que está oculta. O botão não será mostrado.`,
          href,
        });
      }
    }
    if (link.type === "external" && !link.url) {
      issues.push({ level: "error", message: `${where}: falta o endereço do link.`, href });
    }
    if (link.type === "store" && !isStoreActive(doc)) {
      issues.push({
        level: "warning",
        message: `${where}: aponta para a Loja Online, que está desactivada. O botão fica oculto até a loja ser activada.`,
        href: "/admin/loja",
      });
    }
  }

  if (doc.store.enabled && !doc.store.url) {
    issues.push({
      level: "error",
      message: "A Loja Online está activada mas não tem endereço. Introduza o URL da Quicksell ou desactive a loja.",
      href: "/admin/loja",
    });
  }

  for (const { ref, where, href } of collectImages(doc)) {
    if (ref.url && !ref.alt) {
      issues.push({ level: "warning", message: `${where}: imagem sem texto alternativo (acessibilidade).`, href });
    }
  }

  if (!doc.seo.title || !doc.seo.description) {
    issues.push({ level: "warning", message: "O título ou a descrição SEO estão vazios.", href: "/admin/seo" });
  }

  return issues;
}

export function isStoreActive(doc: Pick<SiteDocument, "store">): boolean {
  return Boolean(doc.store.enabled && doc.store.url && /^https:\/\//i.test(doc.store.url));
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.level === "error");
}
