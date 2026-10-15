import type { SiteDocument } from "./schema";
import { SECTION_TYPE_LABELS } from "./templates";

export function anchorOptions(doc: SiteDocument) {
  return doc.sections.map((s) => ({
    anchor: s.anchor,
    label: s.navLabel || ("title" in s ? s.title : "") || SECTION_TYPE_LABELS[s.type],
    visible: s.visible,
  }));
}
