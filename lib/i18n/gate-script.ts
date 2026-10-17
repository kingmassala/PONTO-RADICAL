import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, LOCALES, localePath, type Locale } from "./config";

/**
 * Corre antes de a página ser desenhada: se a língua já foi escolhida, marca o
 * <html> (o CSS esconde o ecrã de entrada) e, quem abre a página inicial em
 * português («/») com outra língua guardada, segue para a sua língua. Os links
 * directos para /es, /fr ou /en são sempre respeitados.
 */
export function languageGateScript(locale: Locale): string {
  const paths = Object.fromEntries(LOCALES.map((l) => [l, localePath(l)]));
  const isDefaultHome = locale === DEFAULT_LOCALE;
  return `(function(){try{var l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});var p=${JSON.stringify(paths)};if(!l||!p[l])return;document.documentElement.dataset.prLocale=l;if(${isDefaultHome}&&l!==${JSON.stringify(DEFAULT_LOCALE)}&&!location.hash&&location.pathname==="/")location.replace(p[l]);}catch(e){}})();`;
}
