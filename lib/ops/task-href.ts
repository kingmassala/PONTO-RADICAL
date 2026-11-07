/** Onde se abre uma tarefa: na ficha da obra ou na lista de tarefas da empresa. */
export function taskHref(t: { work_order_id: string | null }): string {
  return t.work_order_id ? `/obras/${t.work_order_id}?tab=tarefas` : "/tarefas?tipo=empresa";
}
