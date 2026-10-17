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
  const key = JSON.stringify(LOCALE_STORAGE_KEY);
  // localStorage, ou o cookie de reserva gravado por rememberLocale().
  return `(function(){try{var l=null;try{l=localStorage.getItem(${key});}catch(e){}if(!l){var m=document.cookie.match(new RegExp("(?:^|; )"+${key}+"=([a-z]{2})"));l=m&&m[1];}var p=${JSON.stringify(paths)};if(!l||!p[l])return;document.documentElement.dataset.prLocale=l;if(${isDefaultHome}&&l!==${JSON.stringify(DEFAULT_LOCALE)}&&!location.hash&&location.pathname==="/")location.replace(p[l]);}catch(e){}})();`;
}
