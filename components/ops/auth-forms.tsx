"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { requestOpsReset, setOpsPassword, signInOps, type OpsAuthState } from "@/lib/ops/actions/auth";
import { joinBase } from "@/lib/ops/base";
import { Notice } from "@/components/admin/ui";

const input = "mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-black focus:ring-2 focus:ring-black/10";
const submit = "flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60";

export function OpsAuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ponto-radical-mark-white.svg" alt="" className="size-16" />
          <p className="mt-4 text-lg font-semibold tracking-[0.12em]">PONTO RADICAL</p>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Gestão de Obras Navais</p>
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-2xl">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function OpsLoginForm({ base, notice }: { base: string; notice?: string }) {
  const [state, action, pending] = useActionState<OpsAuthState, FormData>(signInOps, {});
  return (
    <form action={action} className="space-y-4">
      {notice && <Notice tone="warning">{notice}</Notice>}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="username" className={input} />
      </label>
      <label className="block text-sm font-medium">
        Palavra-passe
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      <button type="submit" disabled={pending} className={submit}>
        {pending && <Loader2 className="size-4 animate-spin" />} Entrar
      </button>
      <p className="text-center text-sm">
        <Link href={joinBase(base, "/recuperar")} className="text-slate-600 underline-offset-4 hover:underline">
          Esqueceu-se da palavra-passe?
        </Link>
      </p>
    </form>
  );
}

export function OpsResetForm({ base }: { base: string }) {
  const [state, action, pending] = useActionState<OpsAuthState, FormData>(requestOpsReset, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <button type="submit" disabled={pending} className={submit}>
        {pending && <Loader2 className="size-4 animate-spin" />} Enviar link de recuperação
      </button>
      <p className="text-center text-sm">
        <Link href={joinBase(base, "/entrar")} className="text-slate-600 hover:underline">
          Voltar ao início de sessão
        </Link>
      </p>
    </form>
  );
}

export function OpsNewPasswordForm({ forced }: { forced?: boolean }) {
  const [state, action, pending] = useActionState<OpsAuthState, FormData>(setOpsPassword, {});
  return (
    <form action={action} className="space-y-4">
      {forced && <Notice tone="info">Por segurança, defina uma palavra-passe pessoal antes de continuar.</Notice>}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <label className="block text-sm font-medium">
        Nova palavra-passe
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={input} />
      </label>
      <label className="block text-sm font-medium">
        Confirmar palavra-passe
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={input} />
      </label>
      <p className="text-xs text-slate-500">Mínimo de 10 caracteres.</p>
      <button type="submit" disabled={pending} className={submit}>
        {pending && <Loader2 className="size-4 animate-spin" />} Guardar palavra-passe
      </button>
    </form>
  );
}
