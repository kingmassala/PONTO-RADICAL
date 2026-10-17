import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { getPublishedSite } from "@/lib/cms/published";
import { localizeDoc } from "@/lib/i18n/content";
import { DEFAULT_LOCALE, LOCALE_INFO, LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { SITE_URL } from "@/lib/supabase/env";
import { getPublishedPosts } from "@/lib/blog/queries";
import { blogPath, localizePost, readingMinutes } from "@/lib/blog/schema";
import { formatPostDate } from "@/lib/blog/format";
import { SiteFrame } from "../site-renderer";
import { storeLink } from "../links";
import { CmsImage, Eyebrow, RichText } from "../primitives";
import { BlogExplorer } from "./blog-explorer";
import { PostCard } from "./post-card";
import { ShareButtons } from "./share-buttons";

/** Endereço desta página do blog em cada língua (selector de língua e hreflang). */
const pathsFor = (slug?: string) => Object.fromEntries(LOCALES.map((l) => [l, blogPath(l, slug)])) as Record<Locale, string>;

/* -------------------------------- Metadados -------------------------------- */

export async function blogIndexMetadata(locale: Locale): Promise<Metadata> {
  const { doc: source } = await getPublishedSite();
  const doc = localizeDoc(source, locale);
  const m = getMessages(locale);
  const title = `${m.blog.title} | ${doc.settings.siteName}`;
  return {
    title,
    description: m.blog.intro,
    metadataBase: new URL(doc.seo.siteUrl || SITE_URL),
    alternates: {
      canonical: blogPath(locale),
      languages: { ...Object.fromEntries(LOCALES.map((l) => [LOCALE_INFO[l].htmlLang, blogPath(l)])), "x-default": blogPath(DEFAULT_LOCALE) },
    },
    openGraph: {
      title,
      description: m.blog.intro,
      siteName: doc.settings.siteName,
      locale: LOCALE_INFO[locale].og,
      type: "website",
      url: blogPath(locale),
      images: [{ url: doc.seo.ogImage.url || "/brand/og-ponto-radical.png", width: 1200, height: 630, alt: doc.settings.siteName }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export async function blogPostMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const [{ doc: source }, posts] = await Promise.all([getPublishedSite(), getPublishedPosts()]);
  const found = posts.find((p) => p.slug === slug);
  if (!found) return { title: source.settings.siteName };
  const post = localizePost(found, locale);
  const doc = localizeDoc(source, locale);
  const title = `${post.title} | ${doc.settings.siteName}`;
  return {
    title,
    description: post.excerpt || undefined,
    metadataBase: new URL(doc.seo.siteUrl || SITE_URL),
    alternates: {
      canonical: blogPath(locale, slug),
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [LOCALE_INFO[l].htmlLang, blogPath(l, slug)])),
        "x-default": blogPath(DEFAULT_LOCALE, slug),
      },
    },
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      siteName: doc.settings.siteName,
      locale: LOCALE_INFO[locale].og,
      type: "article",
      url: blogPath(locale, slug),
      publishedTime: post.publishedAt ?? undefined,
      images: [{ url: post.cover.url || doc.seo.ogImage.url || "/brand/og-ponto-radical.png", alt: post.cover.alt || post.title }],
    },
    twitter: { card: "summary_large_image" },
  };
}

/* --------------------------------- Páginas --------------------------------- */

function BlogHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <section className="pr-tone-dark relative overflow-clip bg-dark text-white">
      {/* Símbolo da marca em grande, como marca de água. */}
      <svg viewBox="226 66 801 801" aria-hidden className="pr-spin pointer-events-none absolute -right-24 -top-16 size-[28rem] text-white/[0.05] sm:size-[40rem]">
        <circle cx="626.5" cy="466" r="383.5" fill="none" stroke="currentColor" strokeWidth="32" />
        <g fill="currentColor">
          <path d="M486 238H690A98.75 98.75 0 0 1 690 435.5H639Z" />
          <path d="M480.5 435.5H639L829 683H480.5Z" />
        </g>
      </svg>
      <div className="relative mx-auto max-w-[90rem] px-5 pb-16 pt-36 sm:px-8 sm:pb-24 sm:pt-44 lg:px-12">
        <div className="pr-load-fade">
          <Eyebrow tone="dark">{eyebrow}</Eyebrow>
        </div>
        <h1 className="pr-heading pr-display pr-load-fade max-w-[12ch]" style={{ ["--d" as string]: "0.1s" }}>
          {title}
        </h1>
        <p className="pr-load-fade mt-8 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl" style={{ ["--d" as string]: "0.3s" }}>
          {intro}
        </p>
      </div>
    </section>
  );
}

/** Página com todos os artigos publicados. */
export async function BlogIndexPage({ locale }: { locale: Locale }) {
  const [{ doc: source }, all] = await Promise.all([getPublishedSite(), getPublishedPosts()]);
  const doc = localizeDoc(source, locale);
  const m = getMessages(locale);
  const posts = all.map((p) => localizePost(p, locale));
  // Destaque: o artigo marcado como destaque mais recente ou, sem nenhum, o mais recente.
  const lead = posts.find((p) => p.featured) ?? posts[0];
  const rest = posts.filter((p) => p !== lead);

  return (
    <SiteFrame doc={doc} locale={locale} base={localePath(locale)} paths={pathsFor()} headerStyle="transparent">
      <BlogHero eyebrow={m.blog.eyebrow} title={m.blog.title} intro={m.blog.intro} />
      <section className="bg-background py-16 text-ink sm:py-24 lg:py-32">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
          {lead ? (
            <>
              <PostCard post={lead} locale={locale} m={m} featured priority />
              {rest.length > 0 && (
                <div className="mt-20 border-t border-ink/10 pt-14 sm:mt-28 sm:pt-20">
                  <BlogExplorer posts={rest} locale={locale} />
                </div>
              )}
            </>
          ) : (
            <p className="text-lg text-ink/60">{m.blog.empty}</p>
          )}
        </div>
      </section>
    </SiteFrame>
  );
}

/** Página de um artigo. */
export async function BlogPostPage({ locale, slug }: { locale: Locale; slug: string }) {
  const [{ doc: source }, all] = await Promise.all([getPublishedSite(), getPublishedPosts()]);
  const found = all.find((p) => p.slug === slug);
  if (!found) notFound();
  const doc = localizeDoc(source, locale);
  const m = getMessages(locale);
  const post = localizePost(found, locale);
  const home = localePath(locale);
  const store = storeLink(doc, locale, home);
  // «Continue a ler»: primeiro da mesma categoria, depois os mais recentes.
  const others = all.filter((p) => p.id !== post.id);
  const related = [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)]
    .slice(0, 3)
    .map((p) => localizePost(p, locale));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.cover.url || undefined,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt,
    inLanguage: LOCALE_INFO[locale].htmlLang,
    author: { "@type": post.authorName ? "Person" : "Organization", name: post.authorName || doc.settings.siteName },
    publisher: { "@type": "Organization", name: doc.settings.siteName },
    mainEntityOfPage: `${doc.seo.siteUrl || SITE_URL}${blogPath(locale, post.slug)}`,
  };

  return (
    <SiteFrame doc={doc} locale={locale} base={home} paths={pathsFor(post.slug)} headerStyle="transparent">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article>
        <header className="pr-tone-dark relative flex min-h-[78svh] items-end overflow-clip bg-dark text-white">
          {post.cover.url && (
            <div className="pr-parallax absolute inset-0">
              <CmsImage media={post.cover} priority sizes="100vw" className="object-cover" />
            </div>
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
          <div className="relative mx-auto w-full max-w-[90rem] px-5 pb-14 pt-36 sm:px-8 sm:pb-20 lg:px-12">
            <a
              href={blogPath(locale)}
              className="pr-load-fade mb-10 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/75 transition hover:text-white"
            >
              <ArrowLeft aria-hidden className="size-4" /> {m.blog.back}
            </a>
            <p className="pr-load-fade mb-6">
              <span className="rounded-full bg-white px-3.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-black">
                {m.blog.categories[post.category]}
              </span>
            </p>
            <h1 className="pr-heading pr-load-fade max-w-[22ch] text-[clamp(2.2rem,5.6vw,5.4rem)] leading-[0.98]" style={{ ["--d" as string]: "0.1s" }}>
              {post.title}
            </h1>
            <p
              className="pr-load-fade mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70"
              style={{ ["--d" as string]: "0.25s" }}
            >
              <time dateTime={post.publishedAt ?? undefined}>{formatPostDate(post.publishedAt, locale)}</time>
              <span aria-hidden>·</span>
              <span>{m.blog.minutes(readingMinutes(post.body))}</span>
              {post.authorName && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {m.blog.by} {post.authorName}
                  </span>
                </>
              )}
            </p>
          </div>
        </header>

        <div className="bg-background py-14 text-ink sm:py-20 lg:py-28">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            {post.excerpt && <p className="pr-scroll-reveal text-xl leading-relaxed text-ink/80 sm:text-2xl">{post.excerpt}</p>}
            <RichText html={post.body} className="pr-article mt-10 text-lg leading-[1.8] text-ink/85" />

            {post.gallery.filter((g) => g.url).length > 0 && (
              <figure className="mt-14">
                <figcaption className="pr-eyebrow mb-5 text-ink/50">{m.blog.gallery}</figcaption>
                <ul className="grid grid-cols-2 gap-3 sm:gap-4">
                  {post.gallery
                    .filter((g) => g.url)
                    .map((g, i) => (
                      <li key={`${g.url}-${i}`} className={`relative overflow-clip rounded-2xl bg-dark ${i % 3 === 0 ? "col-span-2 aspect-[16/9]" : "aspect-square"}`}>
                        <CmsImage media={g} sizes="(min-width: 768px) 48rem, 100vw" className="object-cover" />
                      </li>
                    ))}
                </ul>
              </figure>
            )}

            <div className="mt-14 flex flex-wrap items-center justify-between gap-6 border-t border-ink/10 pt-8">
              <ShareButtons title={post.title} />
              <a href={blogPath(locale)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-ink/70 hover:text-ink">
                <ArrowLeft aria-hidden className="size-4" /> {m.blog.back}
              </a>
            </div>

            {store && (
              <aside className="pr-tone-dark pr-scroll-reveal mt-14 flex flex-col gap-6 rounded-[2rem] bg-dark p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
                <p className="pr-heading max-w-sm text-2xl leading-tight">{m.blog.storeTitle}</p>
                <a
                  href={store.href}
                  {...(store.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="pr-btn pr-btn-primary shrink-0"
                >
                  <ShoppingBag aria-hidden className="size-4" />
                  {m.blog.storeButton}
                </a>
              </aside>
            )}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="bg-surface py-16 text-ink sm:py-24 lg:py-28">
          <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-14">
              <h2 className="pr-heading pr-h3 text-[clamp(1.8rem,3.4vw,3rem)]">{m.blog.related}</h2>
              <a href={blogPath(locale)} className="text-xs font-bold uppercase tracking-[0.2em] text-ink/70 underline-offset-4 hover:text-ink hover:underline">
                {m.blog.allPosts}
              </a>
            </div>
            <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.id}>
                  <PostCard post={p} locale={locale} m={m} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </SiteFrame>
  );
}

/** Endereços pré-gerados no build (pelo menos um, exigido pelo Cache Components; «_» dá 404). */
export async function blogSlugParams(): Promise<{ slug: string }[]> {
  const posts = await getPublishedPosts();
  return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: "_" }];
}
