import type { CmsLink, MediaRef, Section, SectionType } from "./schema";

export const emptyMedia = (): MediaRef => ({ url: "", alt: "", mediaId: null });

export const emptyLink = (overrides: Partial<CmsLink> = {}): CmsLink => ({
  enabled: false,
  label: "",
  type: "anchor",
  anchor: "",
  url: "",
  newTab: false,
  style: "primary",
  ...overrides,
});

export type TemplateKey =
  | "hero"
  | "text_image"
  | "image_text"
  | "brands"
  | "gallery"
  | "banner"
  | "video"
  | "features"
  | "cta"
  | "contact"
  | "marquee"
  | "services";

type Template = {
  key: TemplateKey;
  type: SectionType;
  label: string;
  description: string;
  anchor: string;
  create: (base: { id: string; anchor: string }) => Section;
};

const common = { visible: true, showInNav: false, navLabel: "" } as const;

export const SECTION_TEMPLATES: Template[] = [
  {
    key: "hero",
    type: "hero",
    label: "Hero",
    description: "Abertura em ecrã inteiro com imagem ou vídeo, título e botões.",
    anchor: "inicio",
    create: (base) => ({
      ...base,
      ...common,
      type: "hero",
      background: "dark",
      eyebrow: "",
      title: "Novo título de destaque",
      subtitle: "",
      mediaKind: "image",
      image: emptyMedia(),
      videoUrl: "",
      overlayColor: "dark",
      overlayOpacity: 45,
      align: "left",
      height: "full",
      showBrandStrip: true,
      primaryButton: emptyLink(),
      secondaryButton: emptyLink({ style: "secondary" }),
    }),
  },
  {
    key: "text_image",
    type: "split",
    label: "Texto e imagem",
    description: "Texto à esquerda e fotografia à direita.",
    anchor: "sobre",
    create: (base) => ({
      ...base,
      ...common,
      type: "split",
      background: "light",
      imagePosition: "right",
      eyebrow: "",
      title: "Novo título",
      body: "<p>Escreva aqui o texto desta secção.</p>",
      image: emptyMedia(),
      stats: [],
      button: emptyLink(),
    }),
  },
  {
    key: "image_text",
    type: "split",
    label: "Imagem e texto",
    description: "Fotografia à esquerda e texto à direita.",
    anchor: "destaque",
    create: (base) => ({
      ...base,
      ...common,
      type: "split",
      background: "surface",
      imagePosition: "left",
      eyebrow: "",
      title: "Novo título",
      body: "<p>Escreva aqui o texto desta secção.</p>",
      image: emptyMedia(),
      stats: [],
      button: emptyLink(),
    }),
  },
  {
    key: "brands",
    type: "brands",
    label: "Montra de marcas",
    description: "Apresenta as marcas geridas em «Marcas».",
    anchor: "marcas",
    create: (base) => ({
      ...base,
      ...common,
      type: "brands",
      background: "dark",
      eyebrow: "",
      title: "As nossas marcas",
      intro: "",
      layout: "editorial",
    }),
  },
  {
    key: "gallery",
    type: "gallery",
    label: "Galeria editorial",
    description: "Conjunto de fotografias em mosaico ou grelha.",
    anchor: "galeria",
    create: (base) => ({
      ...base,
      ...common,
      type: "gallery",
      background: "light",
      eyebrow: "",
      title: "Galeria",
      intro: "",
      layout: "mosaic",
      items: [],
    }),
  },
  {
    key: "banner",
    type: "banner",
    label: "Banner de imagem",
    description: "Fotografia em largura total com título sobreposto.",
    anchor: "banner",
    create: (base) => ({
      ...base,
      ...common,
      type: "banner",
      background: "dark",
      eyebrow: "",
      title: "Novo banner",
      subtitle: "",
      image: emptyMedia(),
      overlayOpacity: 40,
      height: "tall",
      button: emptyLink(),
    }),
  },
  {
    key: "video",
    type: "video",
    label: "Banner de vídeo",
    description: "Vídeo em largura total, em silêncio e em ciclo.",
    anchor: "video",
    create: (base) => ({
      ...base,
      ...common,
      type: "video",
      background: "dark",
      eyebrow: "",
      title: "Novo vídeo",
      subtitle: "",
      videoUrl: "",
      poster: emptyMedia(),
      overlayOpacity: 40,
      button: emptyLink(),
    }),
  },
  {
    key: "features",
    type: "features",
    label: "Colunas de destaques",
    description: "Lista de serviços ou vantagens em 2, 3 ou 4 colunas.",
    anchor: "solucoes",
    create: (base) => ({
      ...base,
      ...common,
      type: "features",
      background: "surface",
      eyebrow: "",
      title: "Novos destaques",
      intro: "",
      columns: 3,
      items: [
        { icon: "compass", logo: { url: "", alt: "", mediaId: null }, title: "Destaque 1", text: "" },
        { icon: "anchor", logo: { url: "", alt: "", mediaId: null }, title: "Destaque 2", text: "" },
        { icon: "waves", logo: { url: "", alt: "", mediaId: null }, title: "Destaque 3", text: "" },
      ],
    }),
  },
  {
    key: "cta",
    type: "cta",
    label: "Chamada para acção",
    description: "Frase forte com um ou dois botões.",
    anchor: "cta",
    create: (base) => ({
      ...base,
      ...common,
      type: "cta",
      background: "primary",
      title: "Pronto para a próxima aventura?",
      text: "",
      primaryButton: emptyLink(),
      secondaryButton: emptyLink({ style: "secondary" }),
    }),
  },
  {
    key: "contact",
    type: "contact",
    label: "Contactos",
    description: "Informação de contacto e formulário (dados em «Contactos»).",
    anchor: "contactos",
    create: (base) => ({
      ...base,
      ...common,
      type: "contact",
      background: "light",
      eyebrow: "",
      title: "Fale connosco",
      intro: "",
      showForm: true,
      formTitle: "Envie-nos uma mensagem",
      successMessage: "Obrigado. Recebemos a sua mensagem e entraremos em contacto brevemente.",
    }),
  },
];

SECTION_TEMPLATES.push({
  key: "marquee",
  type: "marquee",
  label: "Texto em movimento",
  description: "Palavras gigantes a deslizar pelo ecrã, entre secções.",
  anchor: "faixa",
  create: (base) => ({
    ...base,
    ...common,
    type: "marquee",
    background: "accent",
    items: ["Navegar", "Pescar", "Velejar", "Voar"],
    style: "mixed",
    speed: "normal",
    direction: "left",
    tilted: true,
  }),
});

SECTION_TEMPLATES.push({
  key: "services",
  type: "services",
  label: "Experiências e reservas",
  description: "Cartões dos serviços (passeios, actividades) com filtros e pedido de reserva.",
  anchor: "experiencias",
  create: (base) => ({
    ...base,
    ...common,
    type: "services",
    background: "light",
    eyebrow: "Experiências",
    title: "Reserve a sua *experiência* no mar",
    intro: "",
    categoryIds: [],
    showFilters: true,
    buttonLabel: "Pedir reserva",
    note: "",
  }),
});

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  hero: "Hero",
  split: "Texto e imagem",
  brands: "Montra de marcas",
  gallery: "Galeria editorial",
  banner: "Banner de imagem",
  video: "Banner de vídeo",
  features: "Colunas de destaques",
  cta: "Chamada para acção",
  contact: "Contactos",
  marquee: "Texto em movimento",
  services: "Experiências e reservas",
};

/** Gera uma âncora única a partir de uma sugestão. */
export function uniqueAnchor(suggestion: string, existing: string[]): string {
  const base =
    suggestion
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "seccao";
  let candidate = base;
  let n = 2;
  while (existing.includes(candidate)) candidate = `${base}-${n++}`;
  return candidate;
}
