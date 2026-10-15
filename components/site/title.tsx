import { tokenizeTitle } from "@/lib/cms/text";

/**
 * Título com destaque (*palavra* → itálico serifado na cor de destaque) e
 * animação palavra a palavra: «load» ao abrir a página, «scroll» ao entrar no ecrã.
 */
export function Title({
  text,
  as: Tag = "h2",
  className,
  animate = "scroll",
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  animate?: "load" | "scroll" | "none";
}) {
  const tokens = tokenizeTitle(text);
  const mode = animate === "load" ? "pr-load-words" : animate === "scroll" ? "pr-scroll-words" : "";
  return (
    <Tag className={`pr-heading ${mode} ${className ?? ""}`} aria-label={text.replace(/\*/g, "")}>
      {tokens.map((t, i) => (
        <span key={i} aria-hidden>
          <span className="pr-word">
            <span style={{ ["--i" as string]: i }} className={t.accent ? "pr-accent" : undefined}>
              {t.word}
            </span>
          </span>
          {i < tokens.length - 1 && !tokens[i + 1].glued ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}
