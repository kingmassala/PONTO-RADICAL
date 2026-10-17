"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useMessages } from "../i18n";

/** Partilhar o artigo: WhatsApp, Facebook e copiar o link (o endereço completo é lido no browser). */
export function ShareButtons({ title }: { title: string }) {
  const m = useMessages();
  const [copied, setCopied] = useState(false);
  const url = () => window.location.href.split("#")[0];
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");
  const btn =
    "flex size-12 items-center justify-center rounded-full border border-ink/15 text-ink transition hover:-translate-y-1 hover:border-ink hover:bg-ink hover:text-background";

  return (
    <div className="flex items-center gap-3">
      <span className="pr-eyebrow mr-1 text-ink/50">{m.blog.share}</span>
      <button type="button" className={btn} aria-label="WhatsApp" onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url()}`)}`)}>
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.66-1.6-.91-2.19-.24-.58-.48-.5-.66-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 1 1 7.99 4.42zm8.03-17.45A11.33 11.33 0 0 0 12.04.72C5.78.72.68 5.81.68 12.07c0 2 .52 3.95 1.52 5.67L.58 23.28l5.67-1.49a11.3 11.3 0 0 0 5.79 1.48h.01c6.26 0 11.35-5.09 11.36-11.35 0-3.03-1.18-5.88-3.33-8.02z" />
        </svg>
      </button>
      <button type="button" className={btn} aria-label="Facebook" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`)}>
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
        </svg>
      </button>
      <button
        type="button"
        className={btn}
        aria-label={copied ? m.blog.copied : m.blog.copyLink}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            // Sem acesso à área de transferência: nada a fazer.
          }
        }}
      >
        {copied ? <Check className="size-5" aria-hidden /> : <Link2 className="size-5" aria-hidden />}
      </button>
      <span role="status" className="sr-only">
        {copied ? m.blog.copied : ""}
      </span>
    </div>
  );
}
