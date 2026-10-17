"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages, type Messages } from "@/lib/i18n/messages";

type LocaleState = {
  locale: Locale;
  /** Esta mesma página nas outras línguas (blog); por omissão, a página inicial de cada língua. */
  paths: Partial<Record<Locale, string>> | null;
};
const LocaleContext = createContext<LocaleState>({ locale: DEFAULT_LOCALE, paths: null });

/** Língua da página para os componentes de cliente (os de servidor recebem-na por props). */
export function LocaleProvider({
  locale,
  paths = null,
  children,
}: {
  locale: Locale;
  paths?: Partial<Record<Locale, string>> | null;
  children: React.ReactNode;
}) {
  return <LocaleContext value={{ locale, paths }}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useMessages(): Messages {
  return getMessages(useContext(LocaleContext).locale);
}

/** Endereço desta página noutra língua, e se é a página inicial (onde aparece o ecrã de entrada). */
export function useLocaleHref(): (l: Locale) => { href: string; home: boolean } {
  const { paths } = useContext(LocaleContext);
  return (l) => (paths?.[l] ? { href: paths[l]!, home: false } : { href: localePath(l), home: true });
}
