export function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1B26] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-orange-500 font-bold text-white">PR</span>
          <div>
            <p className="font-semibold text-white">Ponto Radical</p>
            <p className="text-xs text-slate-400">Painel de administração</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-2xl">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
