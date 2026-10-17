import { ArrowRight } from "lucide-react";
import { blogPath, readingMinutes, type BlogPost } from "@/lib/blog/schema";
import { formatPostDate } from "@/lib/blog/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { CmsImage } from "../primitives";

/** Símbolo da marca como capa quando o artigo ainda não tem imagem. */
function CoverPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-dark">
      <svg viewBox="226 66 801 801" aria-hidden className="size-1/3 text-white/15">
        <circle cx="626.5" cy="466" r="383.5" fill="none" stroke="currentColor" strokeWidth="32" />
        <g fill="currentColor">
          <path d="M486 238H690A98.75 98.75 0 0 1 690 435.5H639Z" />
          <path d="M480.5 435.5H639L829 683H480.5Z" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Cartão de um artigo (secção «Blog», página do blog e «Continue a ler»).
 * `featured` = cartão largo, com a imagem ao lado do texto em ecrãs grandes.
 */
export function PostCard({
  post,
  locale,
  m,
  tone = "light",
  featured = false,
  priority = false,
}: {
  post: BlogPost;
  locale: Locale;
  m: Messages;
  tone?: "light" | "dark";
  featured?: boolean;
  priority?: boolean;
}) {
  const muted = tone === "dark" ? "text-white/60" : "text-ink/60";
  return (
    <a
      href={blogPath(locale, post.slug)}
      className={`group pr-3d-rise block ${featured ? "grid items-center gap-8 lg:grid-cols-12 lg:gap-14" : ""}`}
    >
      <div
        className={`relative overflow-clip rounded-[1.75rem] bg-dark ${featured ? "aspect-[16/11] lg:col-span-7" : "aspect-[4/3]"}`}
      >
        {post.cover.url ? (
          <CmsImage
            media={post.cover}
            priority={priority}
            sizes={featured ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"}
            className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.2,0.75,0.15,1)] group-hover:scale-[1.06]"
          />
        ) : (
          <CoverPlaceholder />
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-black backdrop-blur">
          {m.blog.categories[post.category]}
        </span>
        {featured && (
          <span className="absolute right-4 top-4 rounded-full border border-white/40 bg-black/40 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
            {m.blog.featured}
          </span>
        )}
      </div>
      <div className={featured ? "lg:col-span-5" : ""}>
        <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] ${featured ? "" : "mt-5"} ${muted}`}>
          <time dateTime={post.publishedAt ?? undefined}>{formatPostDate(post.publishedAt, locale)}</time>
          <span aria-hidden>·</span>
          <span>{m.blog.minutes(readingMinutes(post.body))}</span>
        </p>
        <h3 className={`pr-heading mt-3 leading-[1.05] ${featured ? "text-[clamp(1.8rem,3.4vw,3.2rem)]" : "text-[clamp(1.3rem,1.9vw,1.65rem)]"}`}>
          {post.title}
        </h3>
        {post.excerpt && <p className={`mt-4 leading-relaxed ${featured ? "text-lg" : "line-clamp-3"} ${tone === "dark" ? "text-white/70" : "text-ink/70"}`}>{post.excerpt}</p>}
        <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]">
          {m.blog.readMore}
          <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1.5" />
        </span>
      </div>
    </a>
  );
}
