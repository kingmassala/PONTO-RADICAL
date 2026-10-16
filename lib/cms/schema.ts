import { z } from "zod";

/**
 * Modelo de conteúdos do website Ponto Radical.
 *
 * Todo o conteúdo público vive num documento JSON validado por este esquema.
 * O rascunho (site_draft) e cada versão publicada (site_versions) guardam
 * um documento completo, o que torna a publicação atómica e o histórico
 * restaurável.
 */

const text = (max = 300) => z.string().trim().max(max).default("");
const requiredText = (max = 300) => z.string().trim().min(1, "Campo obrigatório").max(max);

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export const ANCHOR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** URL seguro para imagens/vídeos: caminho local (/...) ou http(s). */
export const safeAssetUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), "URL inválido")
  .refine((v) => !v.startsWith("//"), "URL inválido")
  .default("");

/** URL externo para links: http(s), mailto: ou tel:. */
export const safeLinkUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || /^(https?:\/\/|mailto:|tel:)/i.test(v), "Use um endereço http(s), mailto: ou tel:")
  .default("");

export const mediaRefSchema = z.object({
  url: safeAssetUrl,
  alt: text(250),
  mediaId: z.string().uuid().nullable().default(null),
});
export type MediaRef = z.infer<typeof mediaRefSchema>;

export const linkSchema = z.object({
  enabled: z.boolean().default(true),
  label: text(80),
  /** anchor = secção da página; external = endereço externo; store = Loja Online (Quicksell). */
  type: z.enum(["anchor", "external", "store"]).default("anchor"),
  anchor: z.string().trim().max(60).default(""),
  url: safeLinkUrl,
  newTab: z.boolean().default(false),
  style: z.enum(["primary", "secondary", "ghost"]).default("primary"),
});
export type CmsLink = z.infer<typeof linkSchema>;

export const backgroundSchema = z.enum(["light", "surface", "dark", "primary", "accent"]);
export type SectionBackground = z.infer<typeof backgroundSchema>;

const sectionBase = {
  id: z.string().min(1).max(64),
  anchor: z.string().trim().regex(ANCHOR, "Use apenas letras minúsculas, números e hífenes"),
  visible: z.boolean().default(true),
  showInNav: z.boolean().default(false),
  navLabel: text(40),
  background: backgroundSchema.default("light"),
};

const heroSection = z.object({
  ...sectionBase,
  type: z.literal("hero"),
  eyebrow: text(120),
  title: requiredText(200),
  subtitle: text(600),
  mediaKind: z.enum(["image", "video"]).default("image"),
  image: mediaRefSchema,
  videoUrl: safeAssetUrl,
  overlayColor: z.enum(["dark", "primary"]).default("dark"),
  overlayOpacity: z.number().int().min(0).max(90).default(45),
  align: z.enum(["left", "center"]).default("left"),
  height: z.enum(["full", "large"]).default("full"),
  /** Faixa com os nomes das marcas no fundo da abertura. */
  showBrandStrip: z.boolean().default(true),
  primaryButton: linkSchema,
  secondaryButton: linkSchema,
});

const statSchema = z.object({ value: text(20), label: text(80) });

const splitSection = z.object({
  ...sectionBase,
  type: z.literal("split"),
  imagePosition: z.enum(["left", "right"]).default("right"),
  eyebrow: text(120),
  title: requiredText(200),
  body: text(8000),
  image: mediaRefSchema,
  stats: z.array(statSchema).max(4).default([]),
  button: linkSchema,
});

const brandsSection = z.object({
  ...sectionBase,
  type: z.literal("brands"),
  eyebrow: text(120),
  title: requiredText(200),
  intro: text(1000),
  layout: z.enum(["editorial", "grid"]).default("editorial"),
});

const galleryItem = z.object({ image: mediaRefSchema, caption: text(160) });

const gallerySection = z.object({
  ...sectionBase,
  type: z.literal("gallery"),
  eyebrow: text(120),
  title: requiredText(200),
  intro: text(1000),
  layout: z.enum(["mosaic", "grid"]).default("mosaic"),
  items: z.array(galleryItem).max(24).default([]),
});

const bannerSection = z.object({
  ...sectionBase,
  type: z.literal("banner"),
  eyebrow: text(120),
  title: requiredText(200),
  subtitle: text(600),
  image: mediaRefSchema,
  overlayOpacity: z.number().int().min(0).max(90).default(40),
  height: z.enum(["medium", "tall"]).default("tall"),
  button: linkSchema,
});

const videoSection = z.object({
  ...sectionBase,
  type: z.literal("video"),
  eyebrow: text(120),
  title: requiredText(200),
  subtitle: text(600),
  videoUrl: safeAssetUrl,
  poster: mediaRefSchema,
  overlayOpacity: z.number().int().min(0).max(90).default(40),
  button: linkSchema,
});

export const FEATURE_ICONS = [
  "compass",
  "anchor",
  "waves",
  "wind",
  "ship",
  "radar",
  "wrench",
  "shield",
  "sparkles",
  "life-buoy",
  "map",
  "truck",
  "users",
  "sun",
] as const;

const marqueeSection = z.object({
  ...sectionBase,
  type: z.literal("marquee"),
  items: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
  style: z.enum(["outline", "solid", "mixed"]).default("mixed"),
  speed: z.enum(["slow", "normal", "fast"]).default("normal"),
  direction: z.enum(["left", "right"]).default("left"),
  tilted: z.boolean().default(true),
});

const featureItem = z.object({
  icon: z.enum(FEATURE_ICONS).default("compass"),
  title: requiredText(120),
  text: text(600),
});

const featuresSection = z.object({
  ...sectionBase,
  type: z.literal("features"),
  eyebrow: text(120),
  title: requiredText(200),
  intro: text(1000),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  items: z.array(featureItem).max(12).default([]),
});

const ctaSection = z.object({
  ...sectionBase,
  type: z.literal("cta"),
  title: requiredText(200),
  text: text(800),
  primaryButton: linkSchema,
  secondaryButton: linkSchema,
});

const contactSection = z.object({
  ...sectionBase,
  type: z.literal("contact"),
  eyebrow: text(120),
  title: requiredText(200),
  intro: text(1000),
  showForm: z.boolean().default(true),
  formTitle: text(120),
  successMessage: text(300),
});

/** Experiências / Reservas: cartões dos serviços geridos em «Serviços», com pedido de reserva. */
const servicesSection = z.object({
  ...sectionBase,
  type: z.literal("services"),
  eyebrow: text(120),
  title: requiredText(200),
  intro: text(1000),
  /** Categorias a mostrar (vazio = todas). */
  categoryIds: z.array(z.string().max(40)).max(20).default([]),
  showFilters: z.boolean().default(true),
  buttonLabel: text(40),
  /** Nota curta por baixo dos cartões (ex.: condições de reserva). */
  note: text(300),
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSection,
  splitSection,
  brandsSection,
  gallerySection,
  bannerSection,
  videoSection,
  featuresSection,
  ctaSection,
  contactSection,
  marqueeSection,
  servicesSection,
]);
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

export const brandSchema = z.object({
  id: z.string().min(1).max(64),
  name: requiredText(80),
  logo: mediaRefSchema,
  specialisation: text(160),
  description: text(1200),
  heroImage: mediaRefSchema,
  externalUrl: safeLinkUrl,
  visible: z.boolean().default(true),
});
export type Brand = z.infer<typeof brandSchema>;

/* ------------------------- Serviços e reservas ------------------------- */

export const SLUG = ANCHOR;
export const TIME_SLOT = /^([01]\d|2[0-3]):[0-5]\d$/;

export const serviceCategorySchema = z.object({
  id: z.string().trim().regex(SLUG, "Identificador inválido").max(40),
  label: requiredText(40),
});
export type ServiceCategory = z.infer<typeof serviceCategorySchema>;

export const DEFAULT_SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: "passeios-de-barco", label: "Passeios de barco" },
  { id: "actividades", label: "Actividades" },
  { id: "outros", label: "Outros" },
];

/**
 * Serviço reservável (passeio de barco, actividade, aula…). Os dias e horários
 * são indicativos: o cliente envia um pedido e a equipa confirma no painel.
 */
export const serviceSchema = z.object({
  id: z.string().min(1).max(64),
  name: requiredText(120),
  slug: z.string().trim().regex(SLUG, "Use apenas letras minúsculas, números e hífenes").max(80),
  categoryId: z.string().trim().max(40),
  summary: text(300),
  /** Texto rico (limpo ao gravar e ao mostrar). */
  description: text(8000),
  gallery: z.array(mediaRefSchema).max(12).default([]),
  /** Duração em minutos (0 = não indicada). */
  durationMinutes: z.number().int().min(0).max(14 * 24 * 60).default(0),
  /** Preço «a partir de», em kwanzas (AOA). null = sob consulta. */
  priceFrom: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
  priceUnit: z.enum(["pessoa", "grupo"]).default("pessoa"),
  minPeople: z.number().int().min(1).max(500).default(1),
  maxPeople: z.number().int().min(1).max(500).default(8),
  meetingPoint: text(300),
  included: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  requirements: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  /** Dias da semana disponíveis (0 = domingo … 6 = sábado). Vazio = todos. */
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  /** Horários de partida (HH:MM). Vazio = horário a combinar. */
  timeSlots: z.array(z.string().regex(TIME_SLOT, "Use o formato HH:MM")).max(12).default([]),
  visible: z.boolean().default(true),
  /** Aceita pedidos de reserva (desligar mostra o serviço sem botão de reserva). */
  bookable: z.boolean().default(true),
});
export type Service = z.infer<typeof serviceSchema>;

export const bookingSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** Antecedência mínima, em dias (0 = no próprio dia). */
  minNoticeDays: z.number().int().min(0).max(60).default(1),
  /** Até quantos dias no futuro se aceitam pedidos. */
  maxAdvanceDays: z.number().int().min(7).max(730).default(180),
  successMessage: text(400),
  /** Condições de pagamento mostradas no formulário e na confirmação. */
  paymentInfo: text(600),
  /** Mostrar ligação para continuar a conversa no WhatsApp (se houver número em «Contactos»). */
  whatsappFollowUp: z.boolean().default(true),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  enabled: true,
  minNoticeDays: 1,
  maxAdvanceDays: 180,
  successMessage: "Recebemos o seu pedido. A nossa equipa vai confirmar a disponibilidade e responder em breve.",
  paymentInfo:
    "Não é cobrado nada agora. O pagamento é feito depois da confirmação, por transferência bancária, Multicaixa Express ou no local.",
  whatsappFollowUp: true,
};

export const FONT_PAIRINGS = ["radical", "vibrante", "editorial", "moderno", "tecnico", "classico"] as const;

export const appearanceSchema = z.object({
  colors: z.object({
    primary: z.string().regex(HEX_COLOR),
    secondary: z.string().regex(HEX_COLOR),
    accent: z.string().regex(HEX_COLOR),
    background: z.string().regex(HEX_COLOR),
    surface: z.string().regex(HEX_COLOR),
    text: z.string().regex(HEX_COLOR),
    dark: z.string().regex(HEX_COLOR),
  }),
  fontPairing: z.enum(FONT_PAIRINGS).default("radical"),
  headings: z.object({
    uppercase: z.boolean().default(false),
    weight: z.enum(["400", "500", "600", "700", "800", "900"]).default("800"),
    tracking: z.enum(["tight", "normal", "wide"]).default("tight"),
    scale: z.enum(["compact", "standard", "dramatic"]).default("standard"),
  }),
  buttons: z.object({
    shape: z.enum(["square", "rounded", "pill"]).default("pill"),
    uppercase: z.boolean().default(true),
  }),
  /** Efeitos interactivos do website (todos respeitam «reduzir movimento» do sistema). */
  effects: z
    .object({
      customCursor: z.boolean().default(true),
      grain: z.boolean().default(true),
      animations: z.boolean().default(true),
    })
    .default({ customCursor: true, grain: true, animations: true }),
});
export type Appearance = z.infer<typeof appearanceSchema>;

export const navigationSchema = z.object({
  logo: mediaRefSchema,
  logoText: text(60),
  headerStyle: z.enum(["transparent", "solid"]).default("transparent"),
  ctaButton: linkSchema,
});

export const contactInfoSchema = z.object({
  phone: text(40),
  phoneSecondary: text(40),
  whatsapp: text(40),
  email: z.union([z.literal(""), z.string().trim().email("Email inválido").max(254)]).default(""),
  address: text(300),
  hours: text(200),
  mapUrl: safeLinkUrl,
  social: z.object({
    instagram: safeLinkUrl,
    facebook: safeLinkUrl,
    linkedin: safeLinkUrl,
    youtube: safeLinkUrl,
    tiktok: safeLinkUrl,
  }),
});

export const storeSchema = z.object({
  enabled: z.boolean().default(false),
  url: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => /^https:\/\/[^\s]+\.[^\s]+/i.test(v), "Introduza um endereço https:// válido")
    .nullable()
    .default(null),
  label: text(40),
  openInNewTab: z.boolean().default(true),
  showInHeader: z.boolean().default(true),
  showInHero: z.boolean().default(false),
});
export type StoreConfig = z.infer<typeof storeSchema>;

export const seoSchema = z.object({
  title: text(70),
  description: text(200),
  keywords: text(300),
  ogImage: mediaRefSchema,
  siteUrl: safeLinkUrl,
});

export const footerSchema = z.object({
  tagline: text(300),
  copyright: text(160),
  showSocial: z.boolean().default(true),
  links: z.array(linkSchema).max(8).default([]),
});

export const settingsSchema = z.object({
  siteName: requiredText(80),
  language: z.literal("pt-PT").default("pt-PT"),
});

export const siteDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  settings: settingsSchema,
  appearance: appearanceSchema,
  navigation: navigationSchema,
  sections: z.array(sectionSchema).max(40),
  brands: z.array(brandSchema).max(40),
  services: z.array(serviceSchema).max(60).default([]),
  serviceCategories: z.array(serviceCategorySchema).max(20).default(DEFAULT_SERVICE_CATEGORIES),
  booking: bookingSettingsSchema.default(DEFAULT_BOOKING_SETTINGS),
  contact: contactInfoSchema,
  store: storeSchema,
  seo: seoSchema,
  footer: footerSchema,
});
export type SiteDocument = z.infer<typeof siteDocumentSchema>;
export type SiteDocumentKey = Exclude<keyof SiteDocument, "schemaVersion">;

export const DOCUMENT_KEYS: SiteDocumentKey[] = [
  "settings",
  "appearance",
  "navigation",
  "sections",
  "brands",
  "services",
  "serviceCategories",
  "booking",
  "contact",
  "store",
  "seo",
  "footer",
];
