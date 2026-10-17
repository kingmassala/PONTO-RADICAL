import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { MediaRef, SectionBackground } from "@/lib/cms/schema";
import { sanitizeRichText } from "@/lib/cms/sanitize";
import type { ResolvedLink } from "./links";
import { Magnetic } from "./fx/magnetic";

const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

/** Só optimizamos imagens locais ou do Supabase Storage (configuradas em next.config). */
function canOptimize(url: string) {
  if (url.toLowerCase().split("?")[0].endsWith(".svg")) return false;
  if (url.startsWith("/")) return true;
  try {
    const host = new URL(url).hostname;
    return host === "images.unsplash.com" || (Boolean(SUPABASE_HOST) && host === SUPABASE_HOST);
  } catch {
    return false;
  }
}

export function CmsImage({
  media,
  sizes,
  className,
  priority,
}: {
  media: MediaRef;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  if (!media.url) return null;
  return (
    <Image
      src={media.url}
      alt={media.alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!canOptimize(media.url)}
      className={className ?? "object-cover"}
    />
  );
}

export function CmsButton({
  link,
  tone = "light",
  magnetic,
}: {
  link: ResolvedLink | null;
  tone?: "light" | "dark";
  magnetic?: boolean;
}) {
  if (!link) return null;
  const external = /^https?:\/\//i.test(link.href);
  const cls =
    link.style === "primary"
      ? "pr-btn pr-btn-primary"
      : link.style === "secondary"
        ? `pr-btn pr-btn-secondary ${tone === "dark" ? "text-white" : "text-ink"}`
        : `pr-btn pr-btn-ghost ${tone === "dark" ? "text-white" : "text-ink"}`;
  const button = (
    <a href={link.href} className={cls} {...(link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {link.label}
      {external ? (
        <ArrowUpRight aria-hidden className="pr-btn-arrow size-4" />
      ) : (
        <ArrowRight aria-hidden className="pr-btn-arrow size-4" />
      )}
      {link.newTab && <span className="sr-only"> (abre numa nova janela)</span>}
    </a>
  );
  return magnetic ? <Magnetic>{button}</Magnetic> : button;
}

export function RichText({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  return <div className={`pr-rich ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />;
}

export const BACKGROUNDS: Record<SectionBackground, { className: string; tone: "light" | "dark" }> = {
  light: { className: "bg-background text-ink", tone: "light" },
  surface: { className: "bg-surface text-ink", tone: "light" },
  dark: { className: "pr-tone-dark bg-dark text-white", tone: "dark" },
  primary: { className: "pr-tone-dark bg-primary text-white", tone: "dark" },
  accent: { className: "pr-tone-dark bg-accent text-white", tone: "dark" },
};

export function Eyebrow({ children, tone }: { children: React.ReactNode; tone: "light" | "dark" }) {
  if (!children) return null;
  return (
    <p className={`pr-eyebrow mb-6 flex items-center gap-3 ${tone === "dark" ? "text-white/70" : "text-ink/60"}`}>
      <span aria-hidden className="size-2 rotate-45 bg-accent" />
      {children}
    </p>
  );
}
