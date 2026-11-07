"use client";

import { useId } from "react";
import { cx } from "@/lib/cx";

export { Badge, Button, Card, EmptyState, Modal, Notice, Select, TextArea, TextInput, Toggle } from "@/components/admin/ui";

const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-black focus:ring-2 focus:ring-black/10 disabled:bg-slate-50";

/** Campo genérico (número, data, data/hora, telefone…) com etiqueta. */
export function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
  placeholder,
  min,
  max,
  step,
  inputMode,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && " *"}
      </label>
      <input
        id={id}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        className={inputClass}
      />
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
  required,
  placeholder,
  hint,
}: {
  label: string;
  value: T | "" | null | undefined;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && " *"}
      </label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Area({ label, value, onChange, rows = 3, required, placeholder }: { label: string; value: string | null | undefined; onChange: (v: string) => void; rows?: number; required?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && " *"}
      </label>
      <textarea id={id} rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, "resize-y")} />
    </div>
  );
}

/** Lista de caixas para escolher várias pessoas. */
export function PeoplePicker({
  label,
  people,
  value,
  onChange,
}: {
  label: string;
  people: { id: string; name: string; hint?: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{label}</legend>
      <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
        {people.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
            <input
              type="checkbox"
              checked={value.includes(p.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((v) => v !== p.id))}
              className="size-4 accent-black"
            />
            <span className="truncate">{p.name}</span>
            {p.hint && <span className="ml-auto shrink-0 text-xs text-slate-400">{p.hint}</span>}
          </label>
        ))}
        {people.length === 0 && <p className="px-2 py-1.5 text-sm text-slate-500">Sem colaboradores.</p>}
      </div>
    </fieldset>
  );
}

export function ProgressBar({ value, tone = "dark", className }: { value: number; tone?: "dark" | "green" | "amber" | "red"; className?: string }) {
  const color = { dark: "bg-black", green: "bg-emerald-600", amber: "bg-amber-500", red: "bg-red-600" }[tone];
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-slate-200", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function FormError({ error }: { error: { message: string; details?: string[] } | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-medium">{error.message}</p>
      {error.details && (
        <ul className="mt-1 list-disc pl-5">
          {error.details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
