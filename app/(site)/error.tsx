"use client";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#07141C] px-6 text-center text-white">
      <p className="text-sm uppercase tracking-[0.3em] text-white/60">Ponto Radical</p>
      <h1 className="text-3xl font-semibold">O website está temporariamente indisponível.</h1>
      <p className="max-w-md text-white/70">Por favor, tente novamente dentro de instantes.</p>
      <button onClick={reset} className="rounded-full bg-[#F26B1D] px-6 py-3 font-semibold">
        Tentar novamente
      </button>
    </main>
  );
}
