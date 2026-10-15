"use client";

import type { CmsLink } from "@/lib/cms/schema";
import { Select, TextInput, Toggle } from "./ui";

export type AnchorOption = { anchor: string; label: string; visible: boolean };

/** Editor de botão/link: texto, destino (secção, endereço externo ou loja) e estilo. */
export function LinkEditor({
  label,
  value,
  onChange,
  anchors,
  storeEnabled,
}: {
  label: string;
  value: CmsLink;
  onChange: (value: CmsLink) => void;
  anchors: AnchorOption[];
  storeEnabled: boolean;
}) {
  const set = <K extends keyof CmsLink>(key: K, v: CmsLink[K]) => onChange({ ...value, [key]: v });
  const anchorMissing = value.type === "anchor" && value.anchor && !anchors.some((a) => a.anchor === value.anchor);

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-medium text-slate-700">{label}</legend>
      <Toggle label="Mostrar este botão" checked={value.enabled} onChange={(v) => set("enabled", v)} />
      {value.enabled && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextInput label="Texto do botão" value={value.label} maxLength={80} onChange={(v) => set("label", v)} required />
          <Select
            label="Destino"
            value={value.type}
            onChange={(v) => set("type", v)}
            options={[
              { value: "anchor", label: "Secção desta página" },
              { value: "external", label: "Endereço externo" },
              { value: "store", label: "Loja Online (Quicksell)" },
            ]}
          />
          {value.type === "anchor" && (
            <div className="sm:col-span-2">
              <Select
                label="Secção de destino"
                value={value.anchor}
                onChange={(v) => set("anchor", v)}
                hint={anchorMissing ? "⚠ A secção escolhida já não existe. Escolha outra." : undefined}
                options={[
                  { value: "", label: "— Escolher secção —" },
                  ...anchors.map((a) => ({
                    value: a.anchor,
                    label: `${a.label} (#${a.anchor})${a.visible ? "" : " · oculta"}`,
                  })),
                ]}
              />
            </div>
          )}
          {value.type === "external" && (
            <>
              <div className="sm:col-span-2">
                <TextInput
                  label="Endereço"
                  value={value.url}
                  placeholder="https://…, mailto:… ou tel:…"
                  onChange={(v) => set("url", v)}
                />
              </div>
              <Toggle label="Abrir numa nova janela" checked={value.newTab} onChange={(v) => set("newTab", v)} />
            </>
          )}
          {value.type === "store" && (
            <p className="text-xs text-slate-500 sm:col-span-2">
              Usa o endereço configurado em «Loja Online».{" "}
              {storeEnabled ? "A loja está activa." : "A loja está desactivada: o botão fica oculto até ser activada."}
            </p>
          )}
          <Select
            label="Estilo"
            value={value.style}
            onChange={(v) => set("style", v)}
            options={[
              { value: "primary", label: "Principal (cor de destaque)" },
              { value: "secondary", label: "Secundário (contorno)" },
              { value: "ghost", label: "Link sublinhado" },
            ]}
          />
        </div>
      )}
    </fieldset>
  );
}
