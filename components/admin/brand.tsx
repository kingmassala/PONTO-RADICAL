/** Símbolo oficial da Ponto Radical (o «R» no círculo), em SVG para ficar nítido em qualquer tamanho. Usa a cor do texto. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="226 66 801 801" aria-hidden className={className}>
      <circle cx="626.5" cy="466" r="383.5" fill="none" stroke="currentColor" strokeWidth="32" />
      <g fill="currentColor">
        <path d="M486 238H690A98.75 98.75 0 0 1 690 435.5H639Z" />
        <path d="M480.5 435.5H639L829 683H480.5Z" />
      </g>
    </svg>
  );
}

/** Símbolo + logótipo escrito (branco), para fundos escuros. */
export function BrandLockup({ subtitle, size = "sm" }: { subtitle?: string; size?: "sm" | "lg" }) {
  const lg = size === "lg";
  return (
    <div className={lg ? "flex flex-col items-center text-center" : "flex items-center gap-3"}>
      <BrandMark className={lg ? "size-24 text-white" : "size-9 shrink-0 text-white"} />
      <div className={lg ? "mt-5 flex flex-col items-center" : "min-w-0"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ponto-radical-wordmark-white.png" alt="Ponto Radical" width={641} height={253} className={lg ? "h-auto w-44" : "h-auto w-24"} />
        {subtitle && <p className={lg ? "pr-logo-type mt-3 text-[0.7rem] text-white/60" : "mt-1 text-[0.7rem] text-white/50"}>{subtitle}</p>}
      </div>
    </div>
  );
}
