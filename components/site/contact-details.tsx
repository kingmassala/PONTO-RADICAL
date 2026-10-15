import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { SiteDocument } from "@/lib/cms/schema";

const tel = (v: string) => `tel:${v.replace(/[^0-9+]/g, "")}`;

export function ContactDetails({ contact, tone }: { contact: SiteDocument["contact"]; tone: "light" | "dark" }) {
  const muted = tone === "dark" ? "text-white/60" : "text-ink/55";
  const rows = [
    contact.phone && { icon: Phone, label: "Telefone", value: contact.phone, href: tel(contact.phone) },
    contact.phoneSecondary && { icon: Phone, label: "Telefone", value: contact.phoneSecondary, href: tel(contact.phoneSecondary) },
    contact.whatsapp && {
      icon: MessageCircle,
      label: "WhatsApp",
      value: contact.whatsapp,
      href: `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`,
    },
    contact.email && { icon: Mail, label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    contact.address && { icon: MapPin, label: "Morada", value: contact.address, href: contact.mapUrl || undefined },
    contact.hours && { icon: Clock, label: "Horário", value: contact.hours },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];

  return (
    <ul className="mt-12 space-y-6">
      {rows.map((row, i) => {
        const Icon = row.icon;
        const external = row.href?.startsWith("http");
        return (
          <li key={i} className="flex gap-4">
            <Icon aria-hidden className="mt-1 size-5 shrink-0 text-accent" strokeWidth={1.5} />
            <div>
              <p className={`pr-eyebrow ${muted}`}>{row.label}</p>
              {row.href ? (
                <a
                  href={row.href}
                  className="mt-1 block text-lg underline-offset-4 hover:underline"
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {row.value}
                </a>
              ) : (
                <p className="mt-1 text-lg">{row.value}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
