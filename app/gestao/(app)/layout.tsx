import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { requireOpsPage } from "@/lib/ops/auth";
import { getOpsBase, opsPath } from "@/lib/ops/server-base";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/ops/roles";
import { OpsProvider } from "@/components/ops/context";
import { OpsShell } from "@/components/ops/shell";
import { RegisterServiceWorker } from "@/components/ops/pwa";

export default function OpsAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-slate-400">
          <Loader2 className="size-6 animate-spin" aria-label="A carregar" />
        </div>
      }
    >
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireOpsPage();
  if (user.mustChangePassword) redirect(await opsPath("/nova-palavra-passe?obrigatoria=1"));
  const supabase = await createClient();
  const [base, incidents, expenses, quotes] = await Promise.all([
    getOpsBase(),
    supabase.from("ops_incidents").select("id", { count: "exact", head: true }).in("status", ["aberta", "em_analise"]).in("urgency", ["alto", "critico"]),
    can.approveExpenses(user.role)
      ? supabase.from("ops_expenses").select("id", { count: "exact", head: true }).eq("approval", "pendente")
      : Promise.resolve({ count: 0 }),
    can.approveQuotes(user.role) ? supabase.from("ops_quotes").select("id", { count: "exact", head: true }).eq("status", "submetido") : Promise.resolve({ count: 0 }),
  ]);
  return (
    <OpsProvider value={{ base, role: user.role, userId: user.id, fullName: user.fullName }}>
      <RegisterServiceWorker />
      <OpsShell counts={{ incidents: incidents.count ?? 0, approvals: (expenses.count ?? 0) + (quotes.count ?? 0) }}>{children}</OpsShell>
    </OpsProvider>
  );
}
