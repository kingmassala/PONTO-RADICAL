/** Línguas do website público. O português é a língua original do conteúdo (editado no painel). */
export const LOCALES = ["pt", "es", "fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt";
/** Línguas com tradução no painel («Traduções»). */
export const TRANSLATED_LOCALES = ["es", "fr", "en"] as const satisfies readonly Locale[];
export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];

export const LOCALE_INFO: Record<Locale, { label: string; short: string; htmlLang: string; intl: string; og: string }> = {
  pt: { label: "Português", short: "PT", htmlLang: "pt-PT", intl: "pt-PT", og: "pt_PT" },
  es: { label: "Español", short: "ES", htmlLang: "es", intl: "es-ES", og: "es_ES" },
  fr: { label: "Français", short: "FR", htmlLang: "fr", intl: "fr-FR", og: "fr_FR" },
  en: { label: "English", short: "EN", htmlLang: "en", intl: "en-GB", og: "en_GB" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Endereço da página inicial em cada língua: «/» em português, «/es», «/fr», «/en» nas restantes. */
export function localePath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/" : `/${locale}`;
}

/** Chave no localStorage com a língua escolhida no ecrã de entrada. */
export const LOCALE_STORAGE_KEY = "pr-locale";
