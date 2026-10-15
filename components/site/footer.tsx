import type { SiteDocument } from "@/lib/cms/schema";
import { navItems, resolveLink, storeLink } from "./links";

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  instagram: (
    <path d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2Zm6.1-8.1a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21.4 8c-.1-1.5-.4-2.9-1.5-4-1.1-1.1-2.5-1.4-4-1.5-1.6-.1-6.3-.1-7.9 0-1.5.1-2.9.4-4 1.5S2.6 6.5 2.5 8c-.1 1.6-.1 6.3 0 7.9.1 1.5.4 2.9 1.5 4s2.5 1.4 4 1.5c1.6.1 6.3.1 7.9 0 1.5-.1 2.9-.4 4-1.5 1.1-1.1 1.4-2.5 1.5-4 .1-1.6.1-6.3 0-7.9Zm-2.1 9.7a3.2 3.2 0 0 1-1.8 1.8c-1.3.5-4.2.4-5.5.4s-4.3.1-5.5-.4a3.2 3.2 0 0 1-1.8-1.8c-.5-1.3-.4-4.2-.4-5.5s-.1-4.3.4-5.5a3.2 3.2 0 0 1 1.8-1.8c1.3-.5 4.2-.4 5.5-.4s4.3-.1 5.5.4a3.2 3.2 0 0 1 1.8 1.8c.5 1.3.4 4.2.4 5.5s.1 4.3-.4 5.5Z" />
  ),
  facebook: <path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v1.9H8v3.2h2.6v8.1h3.3v-8.1h2.6l.4-3.2H14Z" />,
  linkedin: (
    <path d="M6.9 21H3.2V9h3.7v12ZM5 7.4a2.1 2.1 0 1 1 0-4.3 2.1 2.1 0 0 1 0 4.3ZM21 21h-3.7v-5.8c0-1.4 0-3.2-2-3.2s-2.2 1.5-2.2 3.1V21H9.4V9h3.5v1.6h.1a3.9 3.9 0 0 1 3.5-1.9c3.7 0 4.4 2.4 4.4 5.6V21Z" />
  ),
  youtube: (
    <path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.4-1.2.4-3.8.4-3.8s0-2.6-.4-3.8ZM10 14.9V9.1l5 2.9-5 2.9Z" />
  ),
  tiktok: (
    <path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-1.8-2.5V9.7a5.8 5.8 0 1 0 4.9 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z" />
  ),
};

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export function SiteFooter({ doc }: { doc: SiteDocument }) {
  const social = Object.entries(doc.contact.social).filter(([, url]) => url);
  const links = doc.footer.links.map((l) => resolveLink(l, doc)).filter(Boolean);
  const store = storeLink(doc);

  return (
    <footer className="bg-dark text-white">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-4">
              {doc.navigation.logo.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.navigation.logo.url} alt="" className="h-14 w-auto max-w-[200px] object-contain" />
              )}
              <p className="pr-heading text-3xl tracking-[0.12em]">{doc.navigation.logoText || doc.settings.siteName}</p>
            </div>
            {doc.footer.tagline && <p className="mt-5 max-w-sm text-white/65">{doc.footer.tagline}</p>}
            {doc.footer.showSocial && social.length > 0 && (
              <ul className="mt-8 flex gap-3">
                {social.map(([key, url]) => (
                  <li key={key}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${SOCIAL_LABELS[key]} (abre numa nova janela)`}
                      className="flex size-11 items-center justify-center rounded-full border border-white/20 transition hover:border-accent hover:text-accent"
                    >
                      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                        {SOCIAL_ICONS[key]}
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <nav aria-label="Rodapé" className="lg:col-span-3">
            <p className="pr-eyebrow text-white/50">Navegação</p>
            <ul className="mt-5 space-y-3">
              {navItems(doc).map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-white/80 hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
              {store && (
                <li>
                  <a href={store.href} {...(store.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-white/80 hover:text-white">
                    {store.label}
                  </a>
                </li>
              )}
              {links.map((l) => (
                <li key={l!.href + l!.label}>
                  <a href={l!.href} {...(l!.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-white/80 hover:text-white">
                    {l!.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="lg:col-span-4">
            <p className="pr-eyebrow text-white/50">Contactos</p>
            <ul className="mt-5 space-y-3 text-white/80">
              {doc.contact.phone && <li>{doc.contact.phone}</li>}
              {doc.contact.email && (
                <li>
                  <a href={`mailto:${doc.contact.email}`} className="hover:text-white">
                    {doc.contact.email}
                  </a>
                </li>
              )}
              {doc.contact.address && <li>{doc.contact.address}</li>}
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-8 text-sm text-white/45 sm:flex-row sm:justify-between">
          <p>{doc.footer.copyright}</p>
          <a href="#top" className="hover:text-white">
            Voltar ao topo ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
