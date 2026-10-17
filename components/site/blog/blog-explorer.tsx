"use client";

import { useState } from "react";
import { BLOG_CATEGORIES, type BlogCategory, type BlogPost } from "@/lib/blog/schema";
import type { Locale } from "@/lib/i18n/config";
import { useMessages } from "../i18n";
import { PostCard } from "./post-card";

/** Grelha de artigos da página do blog, com filtro por categoria (só as categorias com artigos). */
export function BlogExplorer({ posts, locale }: { posts: BlogPost[]; locale: Locale }) {
  const m = useMessages();
  const [category, setCategory] = useState<BlogCategory | "all">("all");
  const used = BLOG_CATEGORIES.filter((c) => posts.some((p) => p.category === c));
  const shown = category === "all" ? posts : posts.filter((p) => p.category === category);
  const chip = (active: boolean) =>
    `rounded-full border px-5 py-2.5 text-xs font-bold uppercase tracking-[0.18em] transition-colors duration-300 ${
      active ? "border-ink bg-ink text-background" : "border-ink/15 text-ink/70 hover:border-ink hover:text-ink"
    }`;

  return (
    <div>
      {used.length > 1 && (
        <div role="group" aria-label={m.blog.filter} className="mb-10 flex flex-wrap gap-2 sm:mb-14">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")} className={chip(category === "all")}>
            {m.blog.all}
          </button>
          {used.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chip(category === c)}>
              {m.blog.categories[c]}
            </button>
          ))}
        </div>
      )}
      <ul className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {shown.map((post) => (
          <li key={post.id}>
            <PostCard post={post} locale={locale} m={m} />
          </li>
        ))}
      </ul>
    </div>
  );
}
