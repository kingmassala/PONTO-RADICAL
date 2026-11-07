import { GATE_MAX_VIEWS, GATE_SKIP_KEY, GATE_VIEWS_KEY } from "./config";

/**
 * Corre antes de a página ser desenhada e decide se o ecrã de entrada aparece:
 * - não aparece no carregamento que se segue a escolher outra língua (marca de uso único em
 *   sessionStorage, gravada por skipNextGate());
 * - aparece no máximo GATE_MAX_VIEWS vezes por navegador (contador em localStorage); depois disso
 *   o site abre directamente na língua do endereço.
 * Esconder = marcar o <html> com data-pr-locale (o CSS esconde .pr-gate).
 */
export function languageGateScript(): string {
  const skip = JSON.stringify(GATE_SKIP_KEY);
  const views = JSON.stringify(GATE_VIEWS_KEY);
  return `(function(){var d=document.documentElement;try{if(sessionStorage.getItem(${skip})){sessionStorage.removeItem(${skip});d.dataset.prLocale="1";return;}}catch(e){}try{var n=parseInt(localStorage.getItem(${views})||"0",10)||0;if(n>=${GATE_MAX_VIEWS}){d.dataset.prLocale="1";return;}localStorage.setItem(${views},String(n+1));}catch(e){}})();`;
}
