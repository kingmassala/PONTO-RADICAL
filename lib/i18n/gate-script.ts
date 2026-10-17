import { GATE_SKIP_KEY } from "./config";

/**
 * Corre antes de a página ser desenhada. O ecrã de entrada aparece em todas as
 * visitas (incluindo ao actualizar a página ou voltar a abrir o site); só é saltado
 * no carregamento que se segue a escolher outra língua (marca de uso único em
 * sessionStorage, gravada por skipNextGate()).
 */
export function languageGateScript(): string {
  const key = JSON.stringify(GATE_SKIP_KEY);
  return `(function(){try{if(sessionStorage.getItem(${key})){sessionStorage.removeItem(${key});document.documentElement.dataset.prLocale="1";}}catch(e){}})();`;
}
