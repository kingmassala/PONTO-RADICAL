"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { saveDraftPart } from "@/lib/cms/actions";
import type { SiteDocument } from "@/lib/cms/schema";
import { LOCALE_INFO, TRANSLATED_LOCALES, type TranslatedLocale } from "@/lib/i18n/config";
import type { TextEntry } from "@/lib/i18n/content";
import { SaveBar, useDraftEditor } from "./draft-editor";
import { RichTextEditor } from "./rich-text-editor";
import { Badge, Card, cx, Notice, TextArea, TextInput } from "./ui";

type Translations = SiteDocument["translations"];

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/**
 * Tradução do conteúdo para espanhol, francês e inglês. À esquerda o texto
 * original (português, editado nas outras páginas); à direita a tradução.
 * Campos vazios usam o texto em português no website.
 */
export function TranslationsEditor({ entries, value }: { entries: TextEntry[]; value: Translations }) {
  const keys = useMemo(() => new Set(entries.map((e) => e.key)), [entries]);
  const editor = useDraftEditor(value, (v, r) => {
    // Guarda só as chaves que ainda existem (remove traduções de elementos apagados).
    const clean = Object.fromEntries(
      TRANSLATED_LOCALES.map((l) => [l, Object.fromEntries(Object.entries(v[l]).filter(([k, t]) => keys.has(k) && t.trim()))]),
    ) as Translations;
    return saveDraftPart("translations", clean, r);
  });
  const [locale, setLocale] = useState<TranslatedLocale>("en");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [query, setQuery] = useState("");

  const map = editor.value[locale];
  const set = (key: string, text: string) => editor.update((cur) => ({ ...cur, [locale]: { ...cur[locale], [key]: text } }));

  const q = query.trim().toLowerCase();
  const visible = entries.filter(
    (e) =>
      (!onlyMissing || !map[e.key]?.trim()) &&
      (!q || stripHtml(e.value).toLowerCase().includes(q) || (map[e.key] ?? "").toLowerCase().includes(q) || e.group.toLowerCase().includes(q)),
  );
  const groups = visible.reduce<Record<string, TextEntry[]>>((acc, e) => {
    (acc[e.group] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Notice tone="info" title="O website existe em português, espanhol, francês e inglês.">
        Edite o conteúdo em português nas outras páginas do painel e traduza-o aqui. Um campo sem tradução mostra o texto em português.
        Os textos fixos do website (botões do formulário, calendário, etc.) já estão traduzidos.
      </Notice>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Língua">
        {TRANSLATED_LOCALES.map((l) => {
          const done = entries.filter((e) => editor.value[l][e.key]?.trim()).length;
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={l === locale}
              onClick={() => setLocale(l)}
              className={cx(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                l === locale ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              )}
            >
              {LOCALE_INFO[l].label}
              <span className={cx("text-xs", l === locale ? "text-white/70" : "text-slate-500")}>
                {done}/{entries.length}
              </span>
            </button>
          );
        })}
        <a
          href={`/admin/pre-visualizacao?lingua=${locale}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-sm text-sky-700 hover:underline"
        >
          Pré-visualizar em {LOCALE_INFO[locale].label} <ExternalLink className="size-3.5" />
        </a>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1">
          <TextInput label="Procurar" value={query} placeholder="Texto, secção ou marca…" onChange={setQuery} />
        </div>
        <label className="mb-2 inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="size-4 rounded border-slate-300" />
          Só os que faltam traduzir
        </label>
      </div>

      {Object.keys(groups).length === 0 && <p className="text-sm text-slate-500">Não há textos para mostrar com estes filtros.</p>}

      {Object.entries(groups).map(([group, items]) => (
        <Card key={group} title={group}>
          <div className="divide-y divide-slate-100">
            {items.map((e) => {
              const translated = map[e.key] ?? "";
              return (
                <div key={`${locale}:${e.key}`} className="grid gap-4 py-4 first:pt-0 last:pb-0 lg:grid-cols-2">
                  <div>
                    <p className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {e.field} {!translated.trim() && <Badge tone="amber">Por traduzir</Badge>}
                    </p>
                    {e.rich ? (
                      <div className="pr-rich rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: e.value }} />
                    ) : (
                      <p className="whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">{e.value}</p>
                    )}
                  </div>
                  <div>
                    {e.rich ? (
                      <RichTextEditor label={`${LOCALE_INFO[locale].label}: ${e.field}`} value={translated} onChange={(v) => set(e.key, v)} />
                    ) : e.value.length > 90 ? (
                      <TextArea label={LOCALE_INFO[locale].label} value={translated} rows={3} onChange={(v) => set(e.key, v)} />
                    ) : (
                      <TextInput label={LOCALE_INFO[locale].label} value={translated} onChange={(v) => set(e.key, v)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
    </div>
  );
}
