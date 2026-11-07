import type { Metadata } from "next";
import Link from "next/link";
import { requireOpsPage } from "@/lib/ops/auth";
import { getMembers, getOrders, getTasks } from "@/lib/ops/queries";
import { loadIncidents } from "@/lib/ops/loaders";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { OPEN_ORDER_STATUSES } from "@/lib/ops/labels";
import { cx } from "@/lib/cx";
import { IncidentFormButton, IncidentList } from "@/components/ops/field";

export const metadata: Metadata = { title: "Ocorrências" };
export const instant = false;

export default async function OcorrenciasPage({ searchParams }: PageProps<"/gestao/ocorrencias">) {
  const user = await requireOpsPage();
  const sp = (await searchParams) as { todas?: string; nova?: string };
  const base = await getOpsBase();
  const h = (p: string) => joinBase(base, p);
  const [incidents, orders, tasks, members] = await Promise.all([
    loadIncidents({ open: sp.todas !== "1" }),
    getOrders({ status: OPEN_ORDER_STATUSES }),
    getTasks({ openOnly: true, userId: user.role === "tecnico" ? user.id : undefined }),
    getMembers(),
  ]);
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ocorrências e feedback do terreno</h1>
          <p className="mt-1 text-sm text-slate-500">Factores externos que afectam os trabalhos: meteorologia, materiais, transporte, acessos, segurança…</p>
        </div>
        <IncidentFormButton
          orders={orders.map((o) => ({ id: o.id, label: `${o.number} · ${o.title}` }))}
          tasks={tasks.map((t) => ({ id: t.id, label: `${t.code} · ${t.title}`, work_order_id: t.work_order_id }))}
          openInitially={sp.nova === "1"}
        />
      </div>
      <nav className="mb-4 flex gap-1.5">
        <Link href={h("/ocorrencias")} className={cx("rounded-full px-3 py-1.5 text-sm", sp.todas !== "1" ? "bg-black text-white" : "bg-white ring-1 ring-slate-200")}>
          Em aberto
        </Link>
        <Link href={h("/ocorrencias?todas=1")} className={cx("rounded-full px-3 py-1.5 text-sm", sp.todas === "1" ? "bg-black text-white" : "bg-white ring-1 ring-slate-200")}>
          Todas
        </Link>
      </nav>
      <IncidentList incidents={incidents} people={members.filter((m) => m.active).map((m) => ({ id: m.user_id, name: m.full_name }))} />
    </>
  );
}
