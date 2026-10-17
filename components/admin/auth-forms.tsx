"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { requestPasswordReset, setNewPassword, signIn, type AuthFormState } from "@/lib/auth-actions";
import { Notice } from "./ui";

const input =
  "mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-2 focus:ring-black/10";
const submit =
  "flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4">
      {notice && <Notice tone="warning">{notice}</Notice>}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input name="email" type="email" required autoComplete="username" className={input} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Palavra-passe
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      <button type="submit" disabled={pending} className={submit}>
        {pending && <Loader2 className="size-4 animate-spin" />} Entrar
      </button>
      <p className="text-center text-sm">
        <Link href="/admin/recuperar" className="font-medium text-black underline-offset-2 hover:underline">
          Esqueceu-se da palavra-passe?
        </Link>
      </p>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <button type="submit" disabled={pending} className={submit}>
        {pending && <Loader2 className="size-4 animate-spin" />} Enviar link de recuperação
      </button>
      <p className="text-center text-sm">
        <Link href="/admin/login" className="font-medium text-black underline-offset-2 hover:underline">
          Voltar ao início de sessão
        </Link>
      </p>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(setNewPassword, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <label className="block text-sm font-medium text-slate-700">
        Nova palavra-passe
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={input} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Confirmar palavra-passe
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={input} />
      </label>
      <p className="text-xs text-slate-500">Mínimo de 10 caracteres. Recomendamos uma frase longa e única.</p>
      <button type="submit" disabled={pending} className={submit}>
        {pending && <Loader2 className="size-4 animate-spin" />} Guardar palavra-passe
      </button>
    </form>
  );
}
