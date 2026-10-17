"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitContact, type ContactState } from "@/lib/contact/actions";
import { translateServerMessage } from "@/lib/i18n/messages";
import { useLocale, useMessages } from "./i18n";

const initial: ContactState = { status: "idle" };

export function ContactForm({
  title,
  successMessage,
  tone,
  disabled,
}: {
  title: string;
  successMessage: string;
  tone: "light" | "dark";
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(submitContact, initial);
  const locale = useLocale();
  const t = useMessages().form;
  const formRef = useRef<HTMLFormElement>(null);
  // Momento em que o formulário ficou disponível (verificação anti-spam no servidor).
  // Definido após a montagem (não no render) para não divergir do HTML gerado no servidor.
  const startedAt = useRef(0);
  const dark = tone === "dark";

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const field = `w-full border-0 border-b-2 bg-transparent px-0 py-3 text-lg outline-none transition-colors placeholder:opacity-50 focus:ring-0 ${
    dark ? "border-white/20 focus:border-accent" : "border-ink/15 focus:border-accent"
  }`;
  const label = `pr-eyebrow block ${dark ? "text-white/60" : "text-ink/55"}`;
  const err = (name: keyof NonNullable<ContactState["fieldErrors"]>) =>
    state.fieldErrors?.[name] ? (
      <p id={`${name}-error`} className="mt-2 text-sm text-red-600">
        {translateServerMessage(locale, state.fieldErrors[name])}
      </p>
    ) : null;

  if (state.status === "success") {
    return (
      <div role="status" className={`flex h-full flex-col items-start justify-center gap-5 rounded-[2rem] p-10 ${dark ? "bg-white/[0.06]" : "bg-white"}`}>
        <CheckCircle2 aria-hidden className="size-10 text-accent" />
        <p className="pr-heading pr-h3">{successMessage || t.sent}</p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        // Submissão manual: com `action={...}` o React 19 repõe os campos após cada
        // envio, apagando o que foi escrito e o `startedAt` quando há erros de validação.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.set("startedAt", String(startedAt.current));
        startTransition(() => action(data));
      }}
      noValidate
      className={`relative rounded-[2rem] p-8 sm:p-12 ${dark ? "bg-white/[0.06]" : "bg-white shadow-[0_40px_90px_-50px_rgba(5,11,16,0.45)]"}`}
    >
      {title && <h3 className="pr-heading pr-h3 mb-10">{title}</h3>}
      {/* Campo-armadilha para bots: invisível para pessoas e leitores de ecrã. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-name" className={label}>
            {t.name}
          </label>
          <input id="cf-name" name="name" required autoComplete="name" className={field} aria-invalid={!!state.fieldErrors?.name} aria-describedby={state.fieldErrors?.name ? "name-error" : undefined} />
          {err("name")}
        </div>
        <div>
          <label htmlFor="cf-email" className={label}>
            {t.email}
          </label>
          <input id="cf-email" name="email" type="email" required autoComplete="email" className={field} aria-invalid={!!state.fieldErrors?.email} aria-describedby={state.fieldErrors?.email ? "email-error" : undefined} />
          {err("email")}
        </div>
        <div>
          <label htmlFor="cf-phone" className={label}>
            {t.phone}
          </label>
          <input id="cf-phone" name="phone" type="tel" autoComplete="tel" className={field} aria-invalid={!!state.fieldErrors?.phone} />
          {err("phone")}
        </div>
        <div>
          <label htmlFor="cf-subject" className={label}>
            {t.subject}
          </label>
          <input id="cf-subject" name="subject" required className={field} aria-invalid={!!state.fieldErrors?.subject} aria-describedby={state.fieldErrors?.subject ? "subject-error" : undefined} />
          {err("subject")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cf-message" className={label}>
            {t.message}
          </label>
          <textarea id="cf-message" name="message" required rows={5} className={`${field} resize-y`} aria-invalid={!!state.fieldErrors?.message} aria-describedby={state.fieldErrors?.message ? "message-error" : undefined} />
          {err("message")}
        </div>
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="mt-8 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
          {translateServerMessage(locale, state.message)}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
        <p className={`text-xs ${dark ? "text-white/50" : "text-ink/50"}`}>
          {t.privacy}
        </p>
        <button type="submit" disabled={pending || disabled} className="pr-btn pr-btn-primary disabled:opacity-60">
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {disabled ? t.previewDisabled : pending ? t.sending : t.send}
        </button>
      </div>
    </form>
  );
}
