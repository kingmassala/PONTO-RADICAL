import { BRAND_TAGLINE } from "@/lib/brand";
import { BrandLockup, BrandMark } from "./brand";

export function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-12">
      {/* Símbolo da marca em grande, como marca de água. */}
      <BrandMark className="pointer-events-none absolute -right-40 -top-24 size-[38rem] text-white/[0.04]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-9">
          <BrandLockup size="lg" subtitle={BRAND_TAGLINE} />
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Painel de administração</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="pr-logo-type mt-8 text-center text-xs font-semibold text-white/70">We share the same passion</p>
      </div>
    </div>
  );
}
