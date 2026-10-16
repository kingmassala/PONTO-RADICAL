// Junta classes CSS, ignorando valores falsos. Sem "use client" para poder ser usado
// tanto em componentes de servidor como de cliente.
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
