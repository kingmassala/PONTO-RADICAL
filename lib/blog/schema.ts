import { z } from "zod";
import { mediaRefSchema, SLUG, type MediaRef } from "@/lib/cms/schema";
import { DEFAULT_LOCALE, type Locale, type TranslatedLocale } from "@/lib/i18n/config";

/**
 * Blog: artigos sobre produtos, curiosidades e notícias. Cada artigo vive numa linha
 * de `blog_posts` (ver supabase/migrations/20261017000001_blog_posts.sql) com o seu
 * próprio estado, independente da publicação do resto do website.
 */

export const BLOG_CATEGORIES = ["produtos", "curiosidades", "noticias"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

/** Nomes das categorias no painel (o website usa as traduções de lib/i18n/messages.ts). */
export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  produtos: "Produtos",
  curiosidades: "Curiosidades",
  noticias: "Notícias",
};

export const BLOG_STATUSES = ["rascunho", "publicado"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

const text = (max: number) => z.string().trim().max(max).default("");

const translationSchema = z
  .object({ title: text(200), excerpt: text(400), body: z.string().max(100000).default("") })
  .default({ title: "", excerpt: "", body: "" });
export type BlogTranslation = z.infer<typeof translationSchema>;

export const blogTranslationsSchema = z
  .object({ es: translationSchema, fr: translationSchema, en: translationSchema, ru: translationSchema, zh: translationSchema })
  .default({
    es: { title: "", excerpt: "", body: "" },
    fr: { title: "", excerpt: "", body: "" },
    en: { title: "", excerpt: "", body: "" },
    ru: { title: "", excerpt: "", body: "" },
    zh: { title: "", excerpt: "", body: "" },
  });

/** Campos editáveis no painel. */
export const blogPostInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Indique o endereço do artigo")
    .max(120)
    .regex(SLUG, "Use apenas letras minúsculas, números e hífenes"),
  category: z.enum(BLOG_CATEGORIES),
  title: z.string().trim().min(1, "Campo obrigatório").max(200),
  excerpt: text(400),
  body: z.string().max(100000).default(""),
  cover: mediaRefSchema,
  gallery: z.array(mediaRefSchema).max(12).default([]),
  translations: blogTranslationsSchema,
  featured: z.boolean().default(false),
  authorName: text(120),
  /** Data mostrada no artigo (ISO). Vazia = data da primeira publicação. */
  publishedAt: z.string().datetime({ offset: true }).nullable().default(null),
});
export type BlogPostInput = z.infer<typeof blogPostInputSchema>;

export type BlogPost = BlogPostInput & {
  id: string;
  status: BlogStatus;
  createdAt: string;
  updatedAt: string;
};

/** Linha da base de dados → artigo (campos em camelCase, JSON validado). */
export function postFromRow(row: Record<string, unknown>): BlogPost {
  const input = blogPostInputSchema.parse({
    slug: row.slug,
    category: row.category,
    title: row.title,
    excerpt: row.excerpt ?? "",
    body: row.body ?? "",
    cover: row.cover ?? {},
    gallery: row.gallery ?? [],
    translations: row.translations ?? {},
    featured: Boolean(row.featured),
    authorName: row.author_name ?? "",
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
  });
  return {
    ...input,
    id: String(row.id),
    status: row.status === "publicado" ? "publicado" : "rascunho",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Artigo → colunas da base de dados. */
export function rowFromInput(input: BlogPostInput) {
  return {
    slug: input.slug,
    category: input.category,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    cover: input.cover,
    gallery: input.gallery,
    translations: input.translations,
    featured: input.featured,
    author_name: input.authorName || null,
    published_at: input.publishedAt,
  };
}

/** Texto do artigo na língua pedida; cada campo sem tradução fica em português. */
export function localizePost(post: BlogPost, locale: Locale): BlogPost {
  if (locale === DEFAULT_LOCALE) return post;
  const t = post.translations[locale as TranslatedLocale];
  return {
    ...post,
    title: t?.title.trim() || post.title,
    excerpt: t?.excerpt.trim() || post.excerpt,
    body: t?.body.trim() || post.body,
  };
}

/** Endereço amigável a partir do título: «Óleo Motul 2T!» → «oleo-motul-2t». */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Minutos de leitura (≈ 200 palavras por minuto, mínimo 1). */
export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Endereço do blog e de um artigo em cada língua. */
export function blogPath(locale: Locale, slug?: string): string {
  const base = locale === DEFAULT_LOCALE ? "/blog" : `/${locale}/blog`;
  return slug ? `${base}/${slug}` : base;
}

export const EMPTY_MEDIA: MediaRef = { url: "", alt: "", mediaId: null };
