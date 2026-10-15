"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { addBrand, deleteBrand, reorderBrands, saveBrand } from "@/lib/cms/actions";
import type { Brand } from "@/lib/cms/schema";
import { SaveBar, useDraftAction, useDraftEditor } from "./draft-editor";
import { MediaField } from "./media-picker";
import { RichTextEditor } from "./rich-text-editor";
import { Badge, Button, Card, cx, Notice, TextInput, Toggle } from "./ui";

export function BrandsManager({ brands }: { brands: Brand[] }) {
  const run = useDraftAction();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const act = (fn: (r: number) => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (data: unknown) => void) => {
    setError(null);
    startTransition(async () => {
      const result = await run(fn);
      if (!result.ok) setError(result.error ?? "Erro inesperado.");
      else after?.(result.data);
    });
  };

  const move = (i: number, d: number) => {
    const ids = brands.map((b) => b.id);
    const t = i + d;
    if (t < 0 || t >= ids.length) return;
    [ids[i], ids[t]] = [ids[t], ids[i]];
    act((r) => reorderBrands(ids, r));
  };

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}
      <ol className={cx("grid gap-3", pending && "pointer-events-none opacity-60")}>
        {brands.map((b, i) => (
          <li key={b.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" aria-label="Mover para cima" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Mover para baixo" disabled={i === brands.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" />
              </Button>
            </div>
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
              {b.heroImage.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.heroImage.url} alt="" className="size-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cx("font-medium", !b.visible && "text-slate-400")}>{b.name}</p>
              <p className="truncate text-sm text-slate-500">{b.specialisation || "Sem especialização definida"}</p>
            </div>
            <div className="flex items-center gap-1">
              {!b.visible && <Badge tone="amber">Oculta</Badge>}
              <Button
                size="sm"
                variant="ghost"
                aria-label={b.visible ? "Ocultar marca" : "Mostrar marca"}
                title={b.visible ? "Ocultar marca" : "Mostrar marca"}
                onClick={() => act((r) => saveBrand({ ...b, visible: !b.visible }, r))}
              >
                {b.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600"
                aria-label="Eliminar marca"
                onClick={() => window.confirm(`Eliminar a marca «${b.name}»?`) && act((r) => deleteBrand(b.id, r))}
              >
                <Trash2 className="size-4" />
              </Button>
              <Link
                href={`/admin/marcas/${b.id}`}
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="size-3.5" /> Editar
              </Link>
            </div>
          </li>
        ))}
      </ol>
      <Card title="Adicionar marca">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              (r) => addBrand(name, r),
              (data) => {
                setName("");
                router.push(`/admin/marcas/${(data as { id: string }).id}`);
              },
            );
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Nome da marca"
            aria-label="Nome da nova marca"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <Button type="submit" variant="primary" disabled={!name.trim()} loading={pending}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </form>
        <p className="text-xs text-slate-500">A nova marca fica oculta até completar a informação e a tornar visível.</p>
      </Card>
    </div>
  );
}

export function BrandEditor({ brand }: { brand: Brand }) {
  const editor = useDraftEditor(brand, (v, r) => saveBrand(v, r));
  const b = editor.value;
  const set = (patch: Partial<Brand>) => editor.update((cur) => ({ ...cur, ...patch }));
  return (
    <div>
      <Link href="/admin/marcas" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Todas as marcas
      </Link>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">{b.name || "Marca"}</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Informação">
            <TextInput label="Nome da marca" value={b.name} maxLength={80} onChange={(v) => set({ name: v })} required />
            <TextInput
              label="Especialização"
              value={b.specialisation}
              maxLength={160}
              onChange={(v) => set({ specialisation: v })}
              hint="Ex.: Electrónica marítima e navegação"
            />
            <RichTextEditor label="Descrição" value={b.description} onChange={(v) => set({ description: v })} />
            <TextInput
              label="Site oficial (opcional)"
              value={b.externalUrl}
              placeholder="https://"
              onChange={(v) => set({ externalUrl: v })}
            />
          </Card>
          <Card title="Imagens">
            <MediaField label="Logótipo" value={b.logo} onChange={(v) => set({ logo: v })} hint="SVG ou PNG transparente, versão clara. Sem logótipo, é mostrado o nome." />
            <MediaField label="Imagem de destaque" value={b.heroImage} onChange={(v) => set({ heroImage: v })} hint="Fotografia horizontal (16:10), mín. 1600 px de largura." />
          </Card>
        </div>
        <Card title="Visibilidade">
          <Toggle label="Mostrar no website" checked={b.visible} onChange={(v) => set({ visible: v })} />
          <p className="text-xs text-slate-500">A ordem das marcas altera-se na lista de marcas.</p>
        </Card>
      </div>
      <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
    </div>
  );
}
