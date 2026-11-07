import { ORDER_STATUS_LABELS, PRIORITY_LABELS, type OrderStatus, type Priority } from "@/lib/ops/labels";
import { Badge } from "@/components/admin/ui";

export const ORDER_TONE: Record<OrderStatus, "slate" | "sky" | "amber" | "green" | "red"> = {
  em_avaliacao: "slate",
  aguarda_orcamento: "amber",
  aguarda_aprovacao: "amber",
  aprovada: "sky",
  planeada: "sky",
  em_execucao: "sky",
  suspensa: "amber",
  concluida: "green",
  entregue: "green",
  cancelada: "red",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const tone = { baixa: "slate", media: "sky", alta: "amber", urgente: "red" } as const;
  return <Badge tone={tone[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}
