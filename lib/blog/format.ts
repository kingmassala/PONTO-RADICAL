import { LOCALE_INFO, type Locale } from "@/lib/i18n/config";

/** Data do artigo na língua do visitante (fuso de Luanda): «17 de outubro de 2026». */
export function formatPostDate(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Luanda" }).format(
    new Date(iso),
  );
}
