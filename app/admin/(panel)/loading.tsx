import { Loader2 } from "lucide-react";

// Fronteira de Suspense abaixo do layout do painel: ao navegar entre páginas, a barra lateral
// mantém-se e só o conteúdo mostra o indicador enquanto os dados (sempre no pedido) carregam.
export default function PanelLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
      <Loader2 className="size-6 animate-spin" aria-label="A carregar" />
    </div>
  );
}
