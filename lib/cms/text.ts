/** Remove a marcação de destaque (*palavra*) para usos em texto simples (SEO, aria, painel). */
export function plainText(value: string): string {
  return (value ?? "").replace(/\*/g, "");
}

/** `glued` = colado à palavra anterior, sem espaço (ex.: pontuação logo a seguir a um destaque). */
export type TitleToken = { word: string; accent: boolean; glued: boolean };

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
      // A primeira palavra de um troço que não começa por espaço fica colada à anterior.
      const glued = j === 0 && tokens.length > 0 && !previousEndsWithSpace && !/^\s/.test(part);
      tokens.push({ word, accent, glued });
    });
  }
  return tokens;
}
