import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { SiteDocument } from "@/lib/cms/schema";
import type { Messages } from "@/lib/i18n/messages";

const tel = (v: string) => `tel:${v.replace(/[^0-9+]/g, "")}`;

export function ContactDetails({ contact, tone, m }: { contact: SiteDocument["contact"]; tone: "light" | "dark"; m: Messages }) {
  const muted = tone === "dark" ? "text-white/60" : "text-ink/55";
  const rows = [
    contact.phone && { icon: Phone, label: m.contact.phone, value: contact.phone, href: tel(contact.phone) },
    contact.phoneSecondary && { icon: Phone, label: m.contact.phone, value: contact.phoneSecondary, href: tel(contact.phoneSecondary) },
    contact.whatsapp && {
      icon: MessageCircle,
      label: m.contact.whatsapp,
      value: contact.whatsapp,
      href: `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`,
    },
    contact.email && { icon: Mail, label: m.contact.email, value: contact.email, href: `mailto:${contact.email}` },
    contact.address && { icon: MapPin, label: m.contact.address, value: contact.address, href: contact.mapUrl || undefined },
    contact.hours && { icon: Clock, label: m.contact.hours, value: contact.hours },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];

  return (
    <ul className={`mt-12 border-t ${tone === "dark" ? "border-white/15" : "border-ink/15"}`}>
      {rows.map((row, i) => {
        const Icon = row.icon;
        const external = row.href?.startsWith("http");
        const content = (
          <>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
              <Icon aria-hidden className="size-5" strokeWidth={1.6} />
            </span>
            <span className="flex-1">
              <span className={`pr-eyebrow block ${muted}`}>{row.label}</span>
              <span className="mt-1 block text-lg font-medium sm:text-xl">{row.value}</span>
            </span>
            {row.href && (
              <span aria-hidden className="text-2xl transition-transform duration-300 group-hover:-rotate-45 group-hover:text-accent">
                →
              </span>
            )}
          </>
        );
        return (
          <li key={i} className={`border-b ${tone === "dark" ? "border-white/15" : "border-ink/15"}`}>
            {row.href ? (
              <a href={row.href} className="group flex items-center gap-5 py-5" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {content}
              </a>
            ) : (
              <div className="group flex items-center gap-5 py-5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
