import type { SectionOf, SiteDocument } from "@/lib/cms/schema";
import { plainText } from "@/lib/cms/text";
import { getPublishedPosts } from "@/lib/blog/queries";
import { blogPath, localizePost } from "@/lib/blog/schema";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { BACKGROUNDS, CmsButton, Eyebrow } from "../primitives";
import { Title } from "../title";
import { PostCard } from "./post-card";

/** Secção «Blog» da página inicial: os artigos publicados mais recentes e o link para o blog. */
export async function BlogSection({ section, m, locale }: { section: SectionOf<"blog">; doc: SiteDocument; m: Messages; locale: Locale }) {
  const bg = BACKGROUNDS[section.background];
  const dark = bg.tone === "dark";
  const posts = (await getPublishedPosts()).slice(0, section.count).map((p) => localizePost(p, locale));
  const button = { href: blogPath(locale), label: section.buttonLabel || m.blog.allPosts, style: "secondary" as const, newTab: false };

  return (
    <section id={section.anchor} aria-label={section.navLabel || plainText(section.title)} className={`${bg.className} relative overflow-clip py-16 sm:py-28 lg:py-40`}>
      <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <div className="pr-scroll-reveal">
              <Eyebrow tone={bg.tone}>{section.eyebrow}</Eyebrow>
            </div>
            <Title text={section.title} className="pr-h2" />
          </div>
          <div className="pr-scroll-reveal flex flex-col gap-6 lg:col-span-4 lg:items-start">
            {section.intro && <p className={`text-lg leading-relaxed ${dark ? "text-white/70" : "text-ink/70"}`}>{section.intro}</p>}
            {posts.length > 0 && (
              <div className="hidden lg:block">
                <CmsButton link={button} tone={bg.tone} magnetic />
              </div>
            )}
          </div>
        </div>

        {posts.length > 0 ? (
          <>
            <ul className="mt-10 grid gap-x-6 gap-y-12 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} locale={locale} m={m} tone={bg.tone} />
                </li>
              ))}
            </ul>
            <div className="mt-12 lg:hidden">
              <CmsButton link={button} tone={bg.tone} />
            </div>
          </>
        ) : (
          <p className={`mt-10 text-lg sm:mt-16 ${dark ? "text-white/60" : "text-ink/60"}`}>{m.blog.empty}</p>
        )}
      </div>
    </section>
  );
}
