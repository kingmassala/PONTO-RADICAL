import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, EyeOff } from "lucide-react";
import { getDraft } from "@/lib/cms/draft";
import { SECTION_TYPE_LABELS } from "@/lib/cms/templates";
import { stripHtml } from "@/lib/cms/sanitize";
import { PageHeader } from "@/components/admin/page-header";
import type { Section } from "@/lib/cms/schema";

export const metadata: Metadata = { title: "Conteúdos" };

function summary(s: Section): string {
  switch (s.type) {
    case "hero":
    case "banner":
    case "video":
      return s.subtitle;
    case "split":
      return stripHtml(s.body);
    case "cta":
      return s.text;
    case "features":
      return s.items.map((i) => i.title).join(" · ");
    case "gallery":
      return `${s.items.length} fotografia(s)`;
    default:
      return "intro" in s ? s.intro : "";
  }
}

export default async function ContentsPage() {
  const { doc } = await getDraft();
  const others = [
    { title: "Marcas", text: doc.brands.map((b) => b.name).join(" · "), href: "/admin/marcas" },
    { title: "Serviços (experiências)", text: doc.services.map((s) => s.name).join(" · "), href: "/admin/servicos" },
    { title: "Contactos e redes sociais", text: [doc.contact.phone, doc.contact.email, doc.contact.address].filter(Boolean).join(" · "), href: "/admin/contactos" },
    { title: "Cabeçalho e rodapé", text: doc.footer.tagline, href: "/admin/menu" },
    { title: "SEO", text: doc.seo.title, href: "/admin/seo" },
  ];
  return (
    <>
      <PageHeader
        title="Conteúdos"
        description="Todos os textos e imagens do website, organizados pela ordem em que aparecem. Clique para editar."
      />
      <ol className="space-y-3">
        {doc.sections.map((s, i) => (
          <li key={s.id}>
            <Link
              href={`/admin/seccoes/${s.id}`}
              className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300"
            >
              <span className="mt-0.5 text-sm tabular-nums text-slate-400">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-sky-700">
                  {SECTION_TYPE_LABELS[s.type]} · #{s.anchor}
                  {!s.visible && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                      <EyeOff className="size-3" /> oculta
                    </span>
                  )}
                </p>
                <p className="mt-1 font-medium text-slate-900">{s.type === "marquee" ? s.items.join(" · ") : s.title.replace(/\*/g, "")}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{summary(s)}</p>
              </div>
              <ArrowRight className="mt-1 size-4 text-slate-300 group-hover:text-sky-600" />
            </Link>
          </li>
        ))}
      </ol>
      <h2 className="mb-3 mt-10 text-sm font-semibold text-slate-700">Outros conteúdos</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {others.map((o) => (
          <Link key={o.href} href={o.href} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-sky-300">
            <p className="font-medium text-slate-900">{o.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{o.text || "—"}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
