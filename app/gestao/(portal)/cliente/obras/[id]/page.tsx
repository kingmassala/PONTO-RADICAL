import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalOrder, requirePortalPage } from "@/lib/ops/portal";
import { getOpsBase } from "@/lib/ops/server-base";
import { joinBase } from "@/lib/ops/base";
import { INTERVENTION_LABELS, type InterventionType } from "@/lib/ops/labels";
import { fmtDate } from "@/lib/ops/time";
import { BackLink, ClientGallery, ClientOrderStatus, ClientTaskList, Progress } from "@/components/ops/portal";

export const metadata: Metadata = { title: "Obra" };
export const instant = false;

export default async function PortalOrderPage({ params }: PageProps<"/gestao/cliente/obras/[id]">) {
  const { id } = await params;
  await requirePortalPage();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, base] = await Promise.all([getPortalOrder(id), getOpsBase()]);
  if (!data) notFound();
  const { order, tasks, photos } = data;
  const done = ["concluida", "entregue"].includes(order.status);
  const finished = tasks.filter((t) => t.status === "concluida" || t.status === "validada").length;
  return (
    <>
      <BackLink href={joinBase(base, "/cliente")}>As minhas embarcações</BackLink>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-500">{order.number}</span>
          <ClientOrderStatus status={order.status} />
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{order.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {order.vessel?.name}
          {" · "}
          {INTERVENTION_LABELS[order.intervention_type as InterventionType] ?? order.intervention_type}
        </p>
        {order.description && <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{order.description}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Início</dt>
            <dd>{fmtDate(order.start_date) || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{done ? "Concluída" : "Previsão de conclusão"}</dt>
            <dd>{fmtDate(done ? order.closed_at : order.due_date) || "—"}</dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Progress value={done ? 100 : order.progress} label={`${finished} de ${tasks.length} trabalhos concluídos`} />
          </div>
        </dl>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Trabalhos</h2>
        <ClientTaskList tasks={tasks} />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="mb-3 font-semibold">Fotografias</h2>
        <ClientGallery photos={photos} empty="A equipa ainda não partilhou fotografias desta obra." />
      </section>
    </>
  );
}
