import Link from "next/link";
import { Fragment } from "react";
import { CheckCircle2, Circle, CircleDot, FileImage, PauseCircle } from "lucide-react";
import { ORDER_STATUS_LABELS, type OrderStatus, type TaskStatus } from "@/lib/ops/labels";
import type { PortalPhoto, PortalTask } from "@/lib/ops/portal";
import { fmtDate, fmtDateTime } from "@/lib/ops/time";
import { cx } from "@/lib/cx";
import { ORDER_TONE } from "./order-badges";
import { Badge } from "@/components/admin/ui";

/** Estados das tarefas em linguagem para o cliente. */
export const CLIENT_TASK_LABELS: Record<TaskStatus, string> = {
  por_iniciar: "Por iniciar",
  em_curso: "Em curso",
  suspensa: "Em pausa",
  concluida: "Concluída",
  validada: "Concluída e verificada",
  cancelada: "Cancelada",
};

export function ClientOrderStatus({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-slate-500">
        <span>{label ?? "Progresso"}</span>
        <span className="font-semibold text-slate-900">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progresso"}>
        <div className={cx("h-full rounded-full", value >= 100 ? "bg-emerald-600" : "bg-black")} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function TaskIcon({ status }: { status: TaskStatus }) {
  if (status === "concluida" || status === "validada") return <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />;
  if (status === "em_curso") return <CircleDot className="size-5 shrink-0 text-sky-600" aria-hidden />;
  if (status === "suspensa") return <PauseCircle className="size-5 shrink-0 text-amber-600" aria-hidden />;
  return <Circle className="size-5 shrink-0 text-slate-300" aria-hidden />;
}

export function ClientTaskList({ tasks }: { tasks: PortalTask[] }) {
  if (!tasks.length) return <p className="text-sm text-slate-500">Os trabalhos desta obra ainda estão a ser planeados.</p>;
  const children = new Map<string, PortalTask[]>();
  for (const t of tasks) if (t.parent_id) children.set(t.parent_id, [...(children.get(t.parent_id) ?? []), t]);
  const ids = new Set(tasks.map((t) => t.id));
  const top = tasks.filter((t) => !t.parent_id || !ids.has(t.parent_id));
  const Row = ({ t, sub }: { t: PortalTask; sub?: boolean }) => {
    const done = t.status === "concluida" || t.status === "validada";
    return (
      <li className={cx("flex gap-3 py-3", sub && "pl-8")}>
        <TaskIcon status={t.status} />
        <div className="min-w-0 flex-1">
          <p className={cx("text-sm font-medium", done && "text-slate-600")}>{t.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {CLIENT_TASK_LABELS[t.status]}
            {done && t.completed_at ? ` em ${fmtDate(t.completed_at)}` : t.due_at ? ` · previsto até ${fmtDate(t.due_at)}` : ""}
          </p>
          {!done && t.status !== "por_iniciar" && t.progress > 0 && (
            <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-200" aria-label={`${t.progress}%`}>
              <div className="h-full rounded-full bg-sky-600" style={{ width: `${t.progress}%` }} />
            </div>
          )}
        </div>
      </li>
    );
  };
  return (
    <ul className="divide-y divide-slate-100">
      {top.map((t) => (
        <Fragment key={t.id}>
          <Row t={t} />
          {(children.get(t.id) ?? []).map((c) => (
            <Row key={c.id} t={c} sub />
          ))}
        </Fragment>
      ))}
    </ul>
  );
}

export function ClientGallery({ photos, empty }: { photos: PortalPhoto[]; empty?: string }) {
  if (!photos.length) return <p className="text-sm text-slate-500">{empty ?? "Ainda não há fotografias partilhadas."}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <a href={p.url ?? "#"} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-slate-100">
            {p.url && p.mime_type !== "image/heic" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt={p.caption ?? "Fotografia da obra"} className="size-full object-cover" loading="lazy" />
            ) : (
              <span className="flex size-full items-center justify-center text-slate-400">
                <FileImage className="size-8" aria-hidden />
              </span>
            )}
          </a>
          <div className="px-3 py-2">
            {p.caption && <p className="text-sm">{p.caption}</p>}
            <p className="text-xs text-slate-500">
              {fmtDateTime(p.created_at)}
              {p.task ? ` · ${p.task.replace(/^T\d+ · /, "")}` : ""}
              {p.order_number ? ` · ${p.order_number}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-block text-sm text-slate-600 hover:underline">
      ← {children}
    </Link>
  );
}
