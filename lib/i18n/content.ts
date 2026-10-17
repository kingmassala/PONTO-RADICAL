import type { Section, SiteDocument } from "@/lib/cms/schema";
import { DEFAULT_LOCALE, type Locale, type TranslatedLocale } from "./config";

/**
 * Tradução do conteúdo do CMS. O documento continua a ser editado em português;
 * as traduções ficam em `doc.translations[língua]` como um mapa «chave → texto».
 * A chave identifica o campo pelo id do elemento (secção, marca, serviço…), por
 * isso reordenar secções ou marcas não estraga as traduções.
 */

/** Campos de texto traduzíveis (por nome). */
const TEXT_FIELDS = new Set([
  "title",
  "subtitle",
  "eyebrow",
  "text",
  "body",
  "intro",
  "label",
  "navLabel",
  "caption",
  "alt",
  "description",
  "summary",
  "note",
  "buttonLabel",
  "formTitle",
  "successMessage",
  "paymentInfo",
  "specialisation",
  "name",
  "meetingPoint",
  "tagline",
  "copyright",
  "keywords",
  "hours",
  "address",
  "brandsTitle",
  "brandsText",
]);
/** Listas de textos traduzíveis. */
const TEXT_LISTS = new Set(["items", "included", "requirements"]);
/** Campos com HTML (texto rico): «body» das secções e «description» das marcas e serviços. */
const isRich = (part: string, field: string) => field === "body" || (field === "description" && (part === "brands" || part === "services"));

/** Partes do documento com texto visível no website. */
const PARTS = ["navigation", "sections", "brands", "services", "serviceCategories", "booking", "contact", "store", "seo", "footer"] as const;

export type TextEntry = {
  key: string;
  value: string;
  /** Agrupamento para o painel (ex.: «Secção #sobre»). */
  group: string;
  /** Nome legível do campo (ex.: «title», «items.2»). */
  field: string;
  rich: boolean;
};

type Visit = (key: string, value: string, field: string, rich: boolean, set: (v: string) => void) => void;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function walk(node: unknown, path: string[], field: string[], visit: Visit, part: string) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      const id = isRecord(item) && typeof item.id === "string" ? item.id : String(i);
      walk(item, [...path, id], [...field, String(i)], visit, part);
    });
    return;
  }
  if (!isRecord(node)) return;
  for (const [k, v] of Object.entries(node)) {
    // Os nomes das marcas são nomes próprios: nunca se traduzem.
    if (part === "brands" && k === "name") continue;
    if (typeof v === "string" && TEXT_FIELDS.has(k)) {
      if (v.trim()) visit([...path, k].join("."), v, [...field.slice(1), k].join("."), isRich(part, k), (t) => (node[k] = t));
    } else if (Array.isArray(v) && TEXT_LISTS.has(k) && v.every((x) => typeof x === "string")) {
      v.forEach((s: string, i) => {
        if (s.trim()) visit([...path, k, String(i)].join("."), s, [...field.slice(1), k, String(i)].join("."), false, (t) => (v[i] = t));
      });
    } else if (typeof v === "object" && v !== null) {
      walk(v, [...path, k], [...field, k], visit, part);
    }
  }
}

function sectionGroup(section: Section): string {
  return `Secção #${section.anchor}${section.navLabel ? ` («${section.navLabel}»)` : ""}`;
}

const PART_LABELS: Record<(typeof PARTS)[number], string> = {
  navigation: "Menu e botões",
  sections: "Secções",
  brands: "Marcas",
  services: "Serviços",
  serviceCategories: "Categorias de serviços",
  booking: "Reservas",
  contact: "Contactos",
  store: "Loja Online",
  seo: "SEO",
  footer: "Rodapé",
};

/** Todos os textos traduzíveis do documento, pela ordem em que aparecem. */
export function collectTexts(doc: SiteDocument): TextEntry[] {
  const out: TextEntry[] = [];
  for (const part of PARTS) {
    const value = doc[part];
    if (part === "sections" || part === "brands" || part === "services") {
      for (const item of value as { id: string }[]) {
        const group =
          part === "sections"
            ? sectionGroup(item as Section)
            : part === "brands"
              ? `Marca «${(item as SiteDocument["brands"][number]).name}»`
              : `Serviço «${(item as SiteDocument["services"][number]).name}»`;
        walk(item, [part, item.id], [part], (key, v, field, rich) => out.push({ key, value: v, group, field, rich }), part);
      }
    } else {
      walk(value, [part], [part], (key, v, field, rich) => out.push({ key, value: v, group: PART_LABELS[part], field, rich }), part);
    }
  }
  return out;
}

/** Documento com as traduções da língua aplicadas (os campos sem tradução ficam em português). */
export function localizeDoc(doc: SiteDocument, locale: Locale): SiteDocument {
  if (locale === DEFAULT_LOCALE) return doc;
  const map = doc.translations[locale as TranslatedLocale] ?? {};
  if (Object.keys(map).length === 0) return doc;
  const copy = structuredClone(doc);
  for (const part of PARTS) {
    walk(
      copy[part],
      [part],
      [part],
      (key, _v, _f, _r, set) => {
        const t = map[key];
        if (t && t.trim()) set(t);
      },
      part,
    );
  }
  return copy;
}

/** Percentagem de textos traduzidos numa língua. */
export function translationProgress(doc: SiteDocument, locale: TranslatedLocale): { done: number; total: number } {
  const entries = collectTexts(doc);
  const map = doc.translations[locale] ?? {};
  return { done: entries.filter((e) => map[e.key]?.trim()).length, total: entries.length };
}
