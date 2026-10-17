/** Remove a marcação de destaque (*palavra*) para usos em texto simples (SEO, aria, painel). */
export function plainText(value: string): string {
  return (value ?? "").replace(/\*/g, "");
}

/**
 * `glued` = colado à palavra anterior, sem espaço e sem quebra de linha (ex.: pontuação logo a seguir a um destaque).
 * `joined` = sem espaço antes, mas a linha pode quebrar aqui (caracteres chineses, que não usam espaços).
 */
export type TitleToken = { word: string; accent: boolean; glued: boolean; joined?: boolean };

const CJK_CHAR = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const CJK_PUNCT = /[\u3000-\u303F\uFF00-\uFFEF]/;
/** Separa cada caracter chinês (e a pontuação chinesa) do resto da palavra. */
const CJK_SPLIT = /[\u3400-\u9FFF\uF900-\uFAFF]|[\u3000-\u303F\uFF00-\uFFEF]+|[^\u3000-\u303F\u3400-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]+/g;

/** Divide um título em palavras, assinalando as que estão entre *asteriscos*. */
export function tokenizeTitle(value: string): TitleToken[] {
  const tokens: TitleToken[] = [];
  const parts = (value ?? "").split("*");
  for (const [i, part] of parts.entries()) {
    const accent = i % 2 === 1;
    const previousEndsWithSpace = i === 0 || /\s$/.test(parts[i - 1]);
    const words = part.split(/\s+/);
    words.forEach((word, j) => {
      if (!word) return;
      (word.match(CJK_SPLIT) ?? [word]).forEach((piece, k) => {
        const previous = tokens.at(-1)?.word ?? "";
        // A primeira palavra de um troço que não começa por espaço fica colada à anterior.
        const noSpace = k > 0 || (j === 0 && tokens.length > 0 && !previousEndsWithSpace && !/^\s/.test(part));
        if (!noSpace) tokens.push({ word: piece, accent, glued: false });
        else if (CJK_PUNCT.test(piece[0]) || !(CJK_CHAR.test(piece[0]) || CJK_CHAR.test(previous.at(-1) ?? ""))) tokens.push({ word: piece, accent, glued: true });
        else tokens.push({ word: piece, accent, glued: false, joined: true });
      });
    });
  }
  return tokens;
}
