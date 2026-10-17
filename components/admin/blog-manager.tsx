"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, Eye, EyeOff, FileText, ImageIcon, Plus, Star, Trash2 } from "lucide-react";
import { createPost, deletePost, savePost, setPostStatus } from "@/lib/blog/actions";
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_LABELS,
  blogPath,
  EMPTY_MEDIA,
  slugify,
  type BlogPost,
  type BlogPostInput,
} from "@/lib/blog/schema";
import { LOCALE_INFO, TRANSLATED_LOCALES, type TranslatedLocale } from "@/lib/i18n/config";
import { MediaField } from "./media-picker";
import { RichTextEditor } from "./rich-text-editor";
import { Badge, Button, Card, cx, EmptyState, Modal, Notice, Select, TextArea, TextInput, Toggle } from "./ui";

const dateFmt = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Luanda" });

function StatusBadge({ post }: { post: BlogPost }) {
  if (post.status === "rascunho") return <Badge tone="slate">Rascunho</Badge>;
  if (post.publishedAt && new Date(post.publishedAt) > new Date()) return <Badge tone="amber">Agendado</Badge>;
  return <Badge tone="green">Publicado</Badge>;
}

/* ------------------------------- Lista ------------------------------- */

export function BlogList({ posts }: { posts: BlogPost[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [toDelete, setToDelete] = useState<BlogPost | null>(null);

  const create = () =>
    start(async () => {
      setError(null);
      const result = await createPost(title);
      if (!result.ok) return setError(result.error);
      router.push(`/admin/blog/${result.data.id}`);
    });

  const toggle = (post: BlogPost) =>
    start(async () => {
      setError(null);
      const result = await setPostStatus(post.id, post.status === "publicado" ? "rascunho" : "publicado");
      if (!result.ok) setError(result.error);
    });

  const remove = () =>
    start(async () => {
      if (!toDelete) return;
      const result = await deletePost(toDelete.id);
      if (!result.ok) setError(result.error);
      setToDelete(null);
    });

  return (
    <div className="space-y-6">
      <Card title="Novo artigo" description="Escreva o título; a seguir abre o editor com o texto, a imagem de capa e as traduções.">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <div className="flex-1">
            <TextInput label="Título" value={title} maxLength={200} placeholder="Ex.: Como escolher o óleo certo para o motor fora de borda" onChange={setTitle} />
          </div>
          <Button type="submit" variant="primary" loading={pending} disabled={!title.trim()}>
            <Plus className="size-4" /> Criar artigo
          </Button>
        </form>
      </Card>

      {error && <Notice tone="error" title={error} />}

      {posts.length === 0 ? (
        <EmptyState title="Ainda não há artigos">Crie o primeiro artigo acima. Só aparece no website depois de o publicar.</EmptyState>
      ) : (
        <Card title={`Artigos (${posts.length})`}>
          <ul className="-my-2 divide-y divide-slate-100">
            {posts.map((post) => (
              <li key={post.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <Link href={`/admin/blog/${post.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    {post.cover.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.cover.url} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-5 text-slate-300" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{post.title}</span>
                      {post.featured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Em destaque" />}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <StatusBadge post={post} />
                      <span>{BLOG_CATEGORY_LABELS[post.category]}</span>
                      <span>·</span>
                      <span>{post.publishedAt ? dateFmt.format(new Date(post.publishedAt)) : `criado a ${dateFmt.format(new Date(post.createdAt))}`}</span>
                    </span>
                  </span>
                </Link>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {post.status === "publicado" && (
                    <a
                      href={blogPath("pt", post.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <ExternalLink className="size-3.5" /> Ver
                    </a>
                  )}
                  <Button size="sm" onClick={() => toggle(post)} disabled={pending}>
                    {post.status === "publicado" ? (
                      <>
                        <EyeOff className="size-3.5" /> Despublicar
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" /> Publicar
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Eliminar «${post.title}»`} onClick={() => setToDelete(post)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={Boolean(toDelete)} title="Eliminar artigo" onClose={() => setToDelete(null)}>
        <p className="text-sm text-slate-600">
          Eliminar definitivamente «{toDelete?.title}»? Se estiver publicado, sai do website. As imagens continuam na Biblioteca Multimédia.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button variant="danger" loading={pending} onClick={remove}>
            <Trash2 className="size-4" /> Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------- Editor ------------------------------- */

/** ISO → valor de <input type="datetime-local"> (hora local do browser). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputOf = (p: BlogPost): BlogPostInput => ({
  slug: p.slug,
  category: p.category,
  title: p.title,
  excerpt: p.excerpt,
  body: p.body,
  cover: p.cover,
  gallery: p.gallery,
  translations: p.translations,
  featured: p.featured,
  authorName: p.authorName,
  publishedAt: p.publishedAt,
});

export function BlogEditor({ post }: { post: BlogPost }) {
  const [value, setValue] = useState<BlogPostInput>(() => inputOf(post));
  const [saved, setSaved] = useState<BlogPostInput>(() => inputOf(post));
  const [tab, setTab] = useState<"pt" | TranslatedLocale>("pt");
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  const published = post.status === "publicado";
  const set = (patch: Partial<BlogPostInput>) => {
    setJustSaved(false);
    setValue((v) => ({ ...v, ...patch }));
  };
  const setTr = (l: TranslatedLocale, patch: Partial<BlogPostInput["translations"][TranslatedLocale]>) =>
    set({ translations: { ...value.translations, [l]: { ...value.translations[l], ...patch } } });

  const save = (then?: () => Promise<void>) =>
    start(async () => {
      setError(null);
      const result = await savePost(post.id, value);
      if (!result.ok) return setError({ message: result.error, details: result.details });
      setSaved(value);
      setJustSaved(true);
      await then?.();
    });

  const publishToggle = () =>
    save(async () => {
      const result = await setPostStatus(post.id, published ? "rascunho" : "publicado");
      if (!result.ok) setError({ message: result.error });
    });

  const translatedCount = (l: TranslatedLocale) => ["title", "excerpt", "body"].filter((k) => value.translations[l][k as "title"].trim()).length;

  return (
    <div>
      <Link href="/admin/blog" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Todos os artigos
      </Link>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Blog · <StatusBadge post={post} />
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{value.title || "Sem título"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {published && (
            <a
              href={blogPath("pt", saved.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <ExternalLink className="size-4" /> Ver no website
            </a>
          )}
          <Button variant={published ? "secondary" : "primary"} loading={pending} onClick={publishToggle}>
            {published ? (
              <>
                <EyeOff className="size-4" /> Despublicar
              </>
            ) : (
              <>
                <Eye className="size-4" /> {dirty ? "Guardar e publicar" : "Publicar"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Língua do texto">
            {(["pt", ...TRANSLATED_LOCALES] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={tab === l}
                onClick={() => setTab(l)}
                className={cx(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                  tab === l ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                )}
              >
                {l === "pt" ? "Português" : LOCALE_INFO[l].label}
                {l !== "pt" && <span className={cx("text-xs", tab === l ? "text-white/70" : "text-slate-500")}>{translatedCount(l)}/3</span>}
              </button>
            ))}
          </div>

          {tab === "pt" ? (
            <Card title="Texto do artigo" description="Escrito em português; as outras línguas usam este texto enquanto não forem traduzidas.">
              <TextInput label="Título" value={value.title} maxLength={200} required onChange={(v) => set({ title: v })} />
              <TextArea
                label="Resumo"
                value={value.excerpt}
                maxLength={400}
                rows={3}
                onChange={(v) => set({ excerpt: v })}
                hint="Aparece nos cartões do blog, no início do artigo e na partilha (WhatsApp, Facebook, Google)."
              />
              <RichTextEditor key="body-pt" label="Texto" value={value.body} onChange={(v) => set({ body: v })} hint="Use subtítulos, listas e citações para tornar o texto fácil de ler." />
            </Card>
          ) : (
            <Card
              title={`Tradução — ${LOCALE_INFO[tab].label}`}
              description="Campos vazios mostram o texto em português. Os botões e menus do website já estão traduzidos."
            >
              <TextInput label="Título" value={value.translations[tab].title} maxLength={200} placeholder={value.title} onChange={(v) => setTr(tab, { title: v })} />
              <TextArea label="Resumo" value={value.translations[tab].excerpt} maxLength={400} rows={3} onChange={(v) => setTr(tab, { excerpt: v })} />
              <RichTextEditor key={`body-${tab}`} label={`Texto (${LOCALE_INFO[tab].label})`} value={value.translations[tab].body} onChange={(v) => setTr(tab, { body: v })} />
            </Card>
          )}

          <Card title="Galeria" description="Fotografias opcionais mostradas no fim do artigo (até 12).">
            {value.gallery.map((g, i) => (
              <div key={i} className="relative">
                <MediaField label={`Fotografia ${i + 1}`} value={g} onChange={(m) => set({ gallery: value.gallery.map((x, j) => (j === i ? m : x)) })} />
                <button
                  type="button"
                  onClick={() => set({ gallery: value.gallery.filter((_, j) => j !== i) })}
                  className="absolute right-0 top-0 inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                >
                  <Trash2 className="size-3.5" /> Retirar
                </button>
              </div>
            ))}
            {value.gallery.length < 12 && (
              <Button size="sm" onClick={() => set({ gallery: [...value.gallery, EMPTY_MEDIA] })}>
                <Plus className="size-3.5" /> Adicionar fotografia
              </Button>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Capa">
            <MediaField label="Imagem de capa" value={value.cover} onChange={(cover) => set({ cover })} hint="Horizontal (ex.: 1600 × 1000). Também é a imagem da partilha." />
          </Card>
          <Card title="Publicação">
            <Select
              label="Categoria"
              value={value.category}
              onChange={(category) => set({ category })}
              options={BLOG_CATEGORIES.map((c) => ({ value: c, label: BLOG_CATEGORY_LABELS[c] }))}
            />
            <Toggle
              label="Artigo em destaque"
              description="Aparece em grande no topo da página do blog."
              checked={value.featured}
              onChange={(featured) => set({ featured })}
            />
            <TextInput label="Autor (opcional)" value={value.authorName} maxLength={120} placeholder="Equipa Ponto Radical" onChange={(authorName) => set({ authorName })} />
            <div>
              <label htmlFor="blog-date" className="text-sm font-medium text-slate-700">
                Data do artigo
              </label>
              <input
                id="blog-date"
                type="datetime-local"
                value={toLocalInput(value.publishedAt)}
                onChange={(e) => set({ publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
              <p className="mt-1 text-xs text-slate-500">Vazia = data em que publicar. Uma data futura agenda o artigo: só aparece nesse dia.</p>
            </div>
            <TextInput
              label="Endereço"
              value={value.slug}
              maxLength={120}
              onChange={(v) => set({ slug: slugify(v) || v.toLowerCase() })}
              hint={
                <>
                  <span className="font-mono">/blog/{value.slug || "…"}</span>
                  {value.title && slugify(value.title) !== value.slug && (
                    <>
                      {" · "}
                      <button type="button" className="text-sky-700 underline" onClick={() => set({ slug: slugify(value.title) })}>
                        usar o título
                      </button>
                    </>
                  )}
                </>
              }
            />
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        {error && (
          <div className="mb-3">
            <Notice tone="error" title={error.message}>
              {error.details && (
                <ul className="list-disc pl-4">
                  {error.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </Notice>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {dirty ? (
              <span className="font-medium text-amber-700">Tem alterações por guardar.</span>
            ) : justSaved ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="size-4" /> {published ? "Guardado e actualizado no website." : "Guardado. Publique quando estiver pronto."}
              </span>
            ) : published ? (
              "Publicado: ao guardar, o website é actualizado de imediato."
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <FileText className="size-4" /> Rascunho: só aparece no website depois de publicar.
              </span>
            )}
          </p>
          <Button variant="primary" loading={pending} disabled={!dirty} onClick={() => save()}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
