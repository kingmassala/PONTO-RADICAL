import { Loader2 } from "lucide-react";

export default function OpsLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
      <Loader2 className="size-6 animate-spin" aria-label="A carregar" />
    </div>
  );
}
