import sanitizeHtml from "sanitize-html";
import type { SiteDocument } from "./schema";

/**
 * Subconjunto de HTML permitido nos campos de texto rico.
 * Tudo o resto (scripts, estilos, atributos on*, iframes…) é removido.
 */
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h3", "h4", "blockquote"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    b: "strong",
    i: "em",
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? "");
      return {
        tagName,
        attribs: {
          href: attribs.href ?? "#",
          ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
        },
      };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "a" && !frame.attribs.href,
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html ?? "", RICH_TEXT_OPTIONS).trim();
}

/** Remove qualquer HTML de um texto simples. */
export function stripHtml(value: string): string {
  return sanitizeHtml(value ?? "", { allowedTags: [], allowedAttributes: {} });
}

/** Aplica a limpeza a todos os campos de texto rico do documento. */
export function sanitizeDocument(doc: SiteDocument): SiteDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) =>
      section.type === "split" ? { ...section, body: sanitizeRichText(section.body) } : section,
    ),
    brands: doc.brands.map((brand) => ({ ...brand, description: sanitizeRichText(brand.description) })),
    services: doc.services.map((service) => ({ ...service, description: sanitizeRichText(service.description) })),
  };
}
