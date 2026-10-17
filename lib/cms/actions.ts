"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDraft } from "./draft";
import { errorResult, friendlyDbError, type ActionResult } from "./errors";
import { PUBLISHED_TAG } from "./published";
import { sanitizeDocument } from "./sanitize";
import {
  brandSchema,
  DOCUMENT_KEYS,
  sectionSchema,
  serviceCategorySchema,
  serviceSchema,
  siteDocumentSchema,
  type SiteDocument,
  type SiteDocumentKey,
} from "./schema";
import { SECTION_TEMPLATES, type TemplateKey, uniqueAnchor, emptyMedia } from "./templates";
import { checkDocument, hasErrors, type Issue } from "./validate";

type Mutator = (doc: SiteDocument) => SiteDocument;

/**
 * Aplica uma alteração ao rascunho: valida o documento completo, limpa o HTML
 * e grava com controlo de revisão (evita sobrepor alterações de outra pessoa).
 */
async function mutateDraft(expectedRevision: number, summary: string, mutate: Mutator): Promise<ActionResult<{ revision: number }>> {
  try {
    await requireStaff();
    const draft = await getDraft();
    if (draft.revision !== expectedRevision) {
      return { ok: false, error: friendlyDbError("revision_conflict") };
    }
    const next = sanitizeDocument(siteDocumentSchema.parse(mutate(structuredClone(draft.doc))));

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_draft", {
      p_content: next,
      p_expected_revision: expectedRevision,
      p_summary: summary,
    });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, data: { revision: data as number } };
  } catch (error) {
    return errorResult(error);
  }
}

const SUMMARIES: Record<SiteDocumentKey, string> = {
  settings: "Definições",
  appearance: "Aparência",
  navigation: "Menu e botões",
  sections: "Secções",
  brands: "Marcas",
  services: "Serviços",
  serviceCategories: "Categorias de serviços",
  booking: "Definições de reservas",
  contact: "Contactos",
  store: "Loja Online",
  seo: "SEO",
  footer: "Rodapé",
  translations: "Traduções",
};

/** Substitui uma parte do documento (ex.: «store», «seo», «appearance»). */
export async function saveDraftPart(key: SiteDocumentKey, value: unknown, revision: number) {
  if (!DOCUMENT_KEYS.includes(key)) return { ok: false as const, error: "Parte do documento desconhecida." };
  const partSchema = siteDocumentSchema.shape[key];
  const parsed = partSchema.safeParse(value);
  if (!parsed.success) return errorResult(parsed.error);
  return mutateDraft(revision, SUMMARIES[key], (doc) => ({ ...doc, [key]: parsed.data }));
}

/* ----------------------------- Secções ----------------------------- */

export async function saveSection(value: unknown, revision: number) {
  const parsed = sectionSchema.safeParse(value);
  if (!parsed.success) return errorResult(parsed.error);
  const section = parsed.data;
  return mutateDraft(revision, `Secção ${section.anchor}`, (doc) => {
    const index = doc.sections.findIndex((s) => s.id === section.id);
    if (index === -1) throw new Error("A secção já não existe.");
    if (doc.sections.some((s) => s.id !== section.id && s.anchor === section.anchor)) {
      throw new Error(`A âncora «#${section.anchor}» já é usada por outra secção.`);
    }
    const previousAnchor = doc.sections[index].anchor;
    doc.sections[index] = section;
    return previousAnchor !== section.anchor ? renameAnchor(doc, previousAnchor, section.anchor) : doc;
  });
}

/** Mantém os botões válidos quando a âncora de uma secção muda. */
function renameAnchor(doc: SiteDocument, from: string, to: string): SiteDocument {
  const json = JSON.stringify(doc);
  const updated = JSON.parse(json, (key, value) => {
    if (value && typeof value === "object" && value.type === "anchor" && value.anchor === from && "label" in value) {
      return { ...value, anchor: to };
    }
    return value;
  });
  return updated as SiteDocument;
}

export async function addSection(templateKey: TemplateKey, revision: number, afterId?: string) {
  const template = SECTION_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return { ok: false as const, error: "Modelo desconhecido." };
  const id = `sec-${crypto.randomUUID().slice(0, 8)}`;
  const result = await mutateDraft(revision, `Nova secção (${template.label})`, (doc) => {
    const anchor = uniqueAnchor(template.anchor, doc.sections.map((s) => s.anchor));
    const section = template.create({ id, anchor });
    const index = afterId ? doc.sections.findIndex((s) => s.id === afterId) : -1;
    if (index === -1) doc.sections.push(section);
    else doc.sections.splice(index + 1, 0, section);
    return doc;
  });
  return result.ok ? { ok: true as const, data: { ...result.data, id } } : result;
}

export async function duplicateSection(id: string, revision: number) {
  const newId = `sec-${crypto.randomUUID().slice(0, 8)}`;
  const result = await mutateDraft(revision, "Duplicar secção", (doc) => {
    const index = doc.sections.findIndex((s) => s.id === id);
    if (index === -1) throw new Error("A secção já não existe.");
    const copy = structuredClone(doc.sections[index]);
    copy.id = newId;
    copy.anchor = uniqueAnchor(copy.anchor, doc.sections.map((s) => s.anchor));
    copy.showInNav = false;
    doc.sections.splice(index + 1, 0, copy);
    return doc;
  });
  return result.ok ? { ok: true as const, data: { ...result.data, id: newId } } : result;
}

export async function deleteSection(id: string, revision: number) {
  return mutateDraft(revision, "Eliminar secção", (doc) => {
    const section = doc.sections.find((s) => s.id === id);
    if (!section) throw new Error("A secção já não existe.");
    doc.sections = doc.sections.filter((s) => s.id !== id);
    // Desactiva botões que apontavam para a secção eliminada.
    return JSON.parse(JSON.stringify(doc), (key, value) => {
      if (value && typeof value === "object" && value.type === "anchor" && value.anchor === section.anchor && "label" in value) {
        return { ...value, enabled: false };
      }
      return value;
    }) as SiteDocument;
  });
}

export async function reorderSections(orderedIds: string[], revision: number) {
  const ids = z.array(z.string()).parse(orderedIds);
  return mutateDraft(revision, "Reordenar secções", (doc) => {
    if (ids.length !== doc.sections.length || !doc.sections.every((s) => ids.includes(s.id))) {
      throw new Error("A lista de secções mudou entretanto. Recarregue a página.");
    }
    doc.sections = ids.map((id) => doc.sections.find((s) => s.id === id)!);
    return doc;
  });
}

export async function setSectionFlags(id: string, flags: { visible?: boolean; showInNav?: boolean }, revision: number) {
  const parsed = z.object({ visible: z.boolean().optional(), showInNav: z.boolean().optional() }).parse(flags);
  return mutateDraft(revision, "Visibilidade de secção", (doc) => {
    const section = doc.sections.find((s) => s.id === id);
    if (!section) throw new Error("A secção já não existe.");
    Object.assign(section, parsed);
    return doc;
  });
}

/** Menu: cabeçalho, rodapé e itens de navegação (nome e visibilidade no menu). */
export async function saveMenu(input: unknown, revision: number) {
  const parsed = z
    .object({
      navigation: siteDocumentSchema.shape.navigation,
      footer: siteDocumentSchema.shape.footer,
      nav: z.array(z.object({ id: z.string(), showInNav: z.boolean(), navLabel: z.string().trim().max(40) })),
    })
    .safeParse(input);
  if (!parsed.success) return errorResult(parsed.error);
  const { navigation, footer, nav } = parsed.data;
  return mutateDraft(revision, "Menu e botões", (doc) => {
    for (const item of nav) {
      const section = doc.sections.find((s) => s.id === item.id);
      if (section) Object.assign(section, { showInNav: item.showInNav, navLabel: item.navLabel });
    }
    return { ...doc, navigation, footer };
  });
}

/* ------------------------------ Marcas ------------------------------ */

export async function saveBrand(value: unknown, revision: number) {
  const parsed = brandSchema.safeParse(value);
  if (!parsed.success) return errorResult(parsed.error);
  const brand = parsed.data;
  return mutateDraft(revision, `Marca ${brand.name}`, (doc) => {
    const index = doc.brands.findIndex((b) => b.id === brand.id);
    if (index === -1) throw new Error("A marca já não existe.");
    doc.brands[index] = brand;
    return doc;
  });
}

export async function addBrand(name: string, revision: number) {
  const cleanName = z.string().trim().min(1, "Indique o nome da marca").max(80).parse(name);
  const id = `brand-${crypto.randomUUID().slice(0, 8)}`;
  const result = await mutateDraft(revision, `Nova marca ${cleanName}`, (doc) => {
    doc.brands.push({
      id,
      name: cleanName,
      logo: emptyMedia(),
      specialisation: "",
      description: "",
      heroImage: emptyMedia(),
      externalUrl: "",
      visible: false,
      authorized: false,
    });
    return doc;
  });
  return result.ok ? { ok: true as const, data: { ...result.data, id } } : result;
}

export async function deleteBrand(id: string, revision: number) {
  return mutateDraft(revision, "Eliminar marca", (doc) => {
    doc.brands = doc.brands.filter((b) => b.id !== id);
    return doc;
  });
}

export async function reorderBrands(orderedIds: string[], revision: number) {
  const ids = z.array(z.string()).parse(orderedIds);
  return mutateDraft(revision, "Reordenar marcas", (doc) => {
    if (ids.length !== doc.brands.length || !doc.brands.every((b) => ids.includes(b.id))) {
      throw new Error("A lista de marcas mudou entretanto. Recarregue a página.");
    }
    doc.brands = ids.map((id) => doc.brands.find((b) => b.id === id)!);
    return doc;
  });
}

/* ----------------------------- Serviços ----------------------------- */

export async function saveService(value: unknown, revision: number) {
  const parsed = serviceSchema.safeParse(value);
  if (!parsed.success) return errorResult(parsed.error);
  const service = parsed.data;
  return mutateDraft(revision, `Serviço ${service.name}`, (doc) => {
    const index = doc.services.findIndex((s) => s.id === service.id);
    if (index === -1) throw new Error("O serviço já não existe.");
    if (doc.services.some((s) => s.id !== service.id && s.slug === service.slug)) {
      throw new Error(`O endereço «${service.slug}» já é usado por outro serviço.`);
    }
    if (!doc.serviceCategories.some((c) => c.id === service.categoryId)) {
      throw new Error("Escolha uma categoria existente.");
    }
    doc.services[index] = service;
    return doc;
  });
}

export async function addService(name: string, revision: number) {
  const cleanName = z.string().trim().min(1, "Indique o nome do serviço").max(120).parse(name);
  const id = `srv-${crypto.randomUUID().slice(0, 8)}`;
  const result = await mutateDraft(revision, `Novo serviço ${cleanName}`, (doc) => {
    doc.services.push({
      id,
      name: cleanName,
      slug: uniqueAnchor(cleanName, doc.services.map((s) => s.slug)),
      categoryId: doc.serviceCategories[0]?.id ?? "",
      summary: "",
      description: "",
      gallery: [],
      durationMinutes: 120,
      priceFrom: null,
      priceUnit: "pessoa",
      minPeople: 1,
      maxPeople: 8,
      meetingPoint: "",
      included: [],
      requirements: [],
      weekdays: [],
      timeSlots: [],
      visible: false,
      bookable: true,
    });
    return doc;
  });
  return result.ok ? { ok: true as const, data: { ...result.data, id } } : result;
}

export async function duplicateService(id: string, revision: number) {
  const newId = `srv-${crypto.randomUUID().slice(0, 8)}`;
  const result = await mutateDraft(revision, "Duplicar serviço", (doc) => {
    const index = doc.services.findIndex((s) => s.id === id);
    if (index === -1) throw new Error("O serviço já não existe.");
    const copy = structuredClone(doc.services[index]);
    copy.id = newId;
    copy.name = `${copy.name} (cópia)`.slice(0, 120);
    copy.slug = uniqueAnchor(copy.slug, doc.services.map((s) => s.slug));
    copy.visible = false;
    doc.services.splice(index + 1, 0, copy);
    return doc;
  });
  return result.ok ? { ok: true as const, data: { ...result.data, id: newId } } : result;
}

export async function deleteService(id: string, revision: number) {
  return mutateDraft(revision, "Eliminar serviço", (doc) => {
    doc.services = doc.services.filter((s) => s.id !== id);
    return doc;
  });
}

export async function reorderServices(orderedIds: string[], revision: number) {
  const ids = z.array(z.string()).parse(orderedIds);
  return mutateDraft(revision, "Reordenar serviços", (doc) => {
    if (ids.length !== doc.services.length || !doc.services.every((s) => ids.includes(s.id))) {
      throw new Error("A lista de serviços mudou entretanto. Recarregue a página.");
    }
    doc.services = ids.map((id) => doc.services.find((s) => s.id === id)!);
    return doc;
  });
}

export async function setServiceFlags(id: string, flags: { visible?: boolean; bookable?: boolean }, revision: number) {
  const parsed = z.object({ visible: z.boolean().optional(), bookable: z.boolean().optional() }).parse(flags);
  return mutateDraft(revision, "Visibilidade de serviço", (doc) => {
    const service = doc.services.find((s) => s.id === id);
    if (!service) throw new Error("O serviço já não existe.");
    Object.assign(service, parsed);
    return doc;
  });
}

/** Categorias: renomear, acrescentar, reordenar e remover (só se não estiverem em uso). */
export async function saveServiceCategories(value: unknown, revision: number) {
  const parsed = z
    .array(z.object({ id: z.string().trim().max(40), label: serviceCategorySchema.shape.label }))
    .min(1, "Tem de existir pelo menos uma categoria.")
    .max(20)
    .safeParse(value);
  if (!parsed.success) return errorResult(parsed.error);
  return mutateDraft(revision, "Categorias de serviços", (doc) => {
    const used: string[] = [];
    const categories = parsed.data.map((c) => {
      // Categorias novas chegam sem identificador: gera-se a partir do nome.
      const id = c.id || uniqueAnchor(c.label, [...doc.serviceCategories.map((x) => x.id), ...used]);
      used.push(id);
      return { id, label: c.label };
    });
    for (const service of doc.services) {
      if (!categories.some((c) => c.id === service.categoryId)) {
        throw new Error(`A categoria do serviço «${service.name}» não pode ser removida enquanto estiver em uso.`);
      }
    }
    doc.serviceCategories = categories;
    // Secções que filtravam categorias removidas deixam de as referir.
    for (const section of doc.sections) {
      if (section.type === "services") {
        section.categoryIds = section.categoryIds.filter((id) => categories.some((c) => c.id === id));
      }
    }
    return doc;
  });
}

/* ---------------------- Publicação e histórico ---------------------- */

export async function publishDraft(
  revision: number,
  note: string,
): Promise<ActionResult<{ versionId: number }> | { ok: false; error: string; issues: Issue[] }> {
  try {
    await requireStaff();
    const draft = await getDraft();
    if (draft.revision !== revision) return { ok: false, error: friendlyDbError("revision_conflict") };

    const issues = checkDocument(draft.doc);
    if (hasErrors(issues)) {
      return { ok: false, error: "Corrija os erros assinalados antes de publicar.", issues };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("publish_site", {
      p_expected_revision: revision,
      p_note: z.string().max(300).parse(note ?? ""),
    });
    if (error) return { ok: false, error: friendlyDbError(error.message) };

    // Expira de imediato a cache do website público.
    updateTag(PUBLISHED_TAG);
    refresh();
    return { ok: true, data: { versionId: data as number } };
  } catch (error) {
    return errorResult(error);
  }
}

export async function restoreVersion(versionId: number): Promise<ActionResult<{ revision: number }>> {
  try {
    await requireStaff();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("restore_version_to_draft", {
      p_version_id: z.number().int().positive().parse(versionId),
    });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, data: { revision: data as number } };
  } catch (error) {
    return errorResult(error);
  }
}

/** Descarta o rascunho, voltando ao conteúdo actualmente publicado. */
export async function discardDraft(): Promise<ActionResult<{ revision: number }>> {
  try {
    await requireStaff();
    const supabase = await createClient();
    const { data: state } = await supabase.from("site_state").select("published_version_id").eq("id", 1).maybeSingle();
    if (!state?.published_version_id) return { ok: false, error: "Ainda não existe nenhuma versão publicada." };
    return restoreVersion(state.published_version_id);
  } catch (error) {
    return errorResult(error);
  }
}
