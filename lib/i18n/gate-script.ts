import { GATE_SKIP_KEY, GATE_VIEWS_KEY_OLD } from "./config";

/**
 * Corre antes de a página ser desenhada. O ecrã de entrada aparece em todos os carregamentos
 * (incluindo ao actualizar a página ou voltar a abrir o site) — pedido do cliente em 25/11/2026.
 * Só é saltado no carregamento que se segue a escolher outra língua (marca de uso único em
 * sessionStorage, gravada por skipNextGate()).
 * Esconder = marcar o <html> com data-pr-locale (o CSS esconde .pr-gate).
 */
export function languageGateScript(): string {
  const skip = JSON.stringify(GATE_SKIP_KEY);
  const old = JSON.stringify(GATE_VIEWS_KEY_OLD);
  return `(function(){try{localStorage.removeItem(${old});}catch(e){}try{if(sessionStorage.getItem(${skip})){sessionStorage.removeItem(${skip});document.documentElement.dataset.prLocale="1";}}catch(e){}})();`;
}
