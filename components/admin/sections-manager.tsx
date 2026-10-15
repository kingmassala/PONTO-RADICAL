"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Menu as MenuIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { addSection, deleteSection, duplicateSection, reorderSections, setSectionFlags } from "@/lib/cms/actions";
import { SECTION_TEMPLATES, type TemplateKey } from "@/lib/cms/templates";
import { useDraftAction } from "./draft-editor";
import { Badge, Button, cx, Modal, Notice } from "./ui";

export type SectionSummary = {
  id: string;
  anchor: string;
  title: string;
  typeLabel: string;
  visible: boolean;
  showInNav: boolean;
  navLabel: string;
};

export function SectionsManager({ sections }: { sections: SectionSummary[] }) {
  const run = useDraftAction();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const act = (fn: (revision: number) => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (data: unknown) => void) => {
    setError(null);
    startTransition(async () => {
      const result = await run(fn);
      if (!result.ok) setError(result.error ?? "Erro inesperado.");
      else after?.(result.data);
    });
  };

  const move = (index: number, delta: number) => {
    const ids = sections.map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    act((r) => reorderSections(ids, r));
  };

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      <ol className={cx("space-y-2", pending && "pointer-events-none opacity-60")}>
        {sections.map((s, i) => (
          <li key={s.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" aria-label="Mover para cima" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Mover para baixo" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" />
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={cx("truncate font-medium", !s.visible && "text-slate-400 line-through")}>{s.title}</p>
                <Badge>{s.typeLabel}</Badge>
                {!s.visible && <Badge tone="amber">Oculta</Badge>}
                {s.visible && s.showInNav && <Badge tone="sky">No menu: {s.navLabel || "—"}</Badge>}
              </div>
              <p className="mt-0.5 font-mono text-xs text-slate-500">#{s.anchor}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act((r) => setSectionFlags(s.id, { visible: !s.visible }, r))}
                aria-label={s.visible ? "Ocultar secção" : "Mostrar secção"}
                title={s.visible ? "Ocultar secção" : "Mostrar secção"}
              >
                {s.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act((r) => setSectionFlags(s.id, { showInNav: !s.showInNav }, r))}
                aria-label={s.showInNav ? "Retirar do menu" : "Mostrar no menu"}
                title={s.showInNav ? "Retirar do menu" : "Mostrar no menu"}
                className={s.showInNav ? "text-sky-700" : ""}
              >
                <MenuIcon className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" title="Duplicar" aria-label="Duplicar secção" onClick={() => act((r) => duplicateSection(s.id, r))}>
                <Copy className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                title="Eliminar"
                aria-label="Eliminar secção"
                className="text-red-600"
                onClick={() => {
                  if (window.confirm(`Eliminar a secção «${s.title}»? Pode recuperá-la mais tarde no histórico de publicações.`)) {
                    act((r) => deleteSection(s.id, r));
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
              <Link
                href={`/admin/seccoes/${s.id}`}
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="size-3.5" /> Editar
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <Button variant="primary" onClick={() => setAdding(true)}>
        <Plus className="size-4" /> Adicionar secção
      </Button>

      <Modal open={adding} onClose={() => setAdding(false)} title="Adicionar secção a partir de um modelo" wide>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTION_TEMPLATES.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  act(
                    (r) => addSection(t.key as TemplateKey, r),
                    (data) => {
                      setAdding(false);
                      router.push(`/admin/seccoes/${(data as { id: string }).id}`);
                    },
                  )
                }
                className="h-full w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-sky-400 hover:bg-sky-50/40"
              >
                <p className="font-medium text-slate-900">{t.label}</p>
                <p className="mt-1 text-sm text-slate-500">{t.description}</p>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">A nova secção é adicionada no fim da página e pode ser reordenada depois.</p>
      </Modal>
    </div>
  );
}
