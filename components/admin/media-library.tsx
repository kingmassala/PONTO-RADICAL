"use client";

import { useRef, useState, useTransition } from "react";
import { Copy, Film, RefreshCw, Trash2, Upload } from "lucide-react";
import { deleteMedia, replaceImage, updateMediaDetails } from "@/lib/media/actions";
import type { MediaItem } from "@/lib/media/types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { uploadFile } from "./media-picker";
import { Badge, Button, cx, EmptyState, Modal, Notice, Select, TextInput } from "./ui";

export function MediaLibrary({ items }: { items: MediaItem[] }) {
  const [folder, setFolder] = useState("todas");
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [uploadFolder, setUploadFolder] = useState("geral");
  const [progress, setProgress] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ tone: "error" | "success"; text: string }[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const folders = Array.from(new Set(items.map((i) => i.folder))).sort();
  const visible = items.filter((i) => (folder === "todas" || i.folder === folder) && (kind === "all" || i.kind === kind));

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const results: { tone: "error" | "success"; text: string }[] = [];
    for (const [index, file] of Array.from(files).entries()) {
      setProgress(`A carregar ${index + 1} de ${files.length}: ${file.name}`);
      const r = await uploadFile(file, uploadFolder);
      results.push(r.ok ? { tone: "success", text: `${file.name} carregado.` } : { tone: "error", text: `${file.name}: ${r.error}` });
    }
    setProgress(null);
    setMessages(results);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="w-44">
            <Select
              label="Pasta"
              value={folder}
              onChange={setFolder}
              options={[{ value: "todas", label: "Todas as pastas" }, ...folders.map((f) => ({ value: f, label: f }))]}
            />
          </div>
          <div className="w-40">
            <Select
              label="Tipo"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "Todos" },
                { value: "image", label: "Imagens" },
                { value: "video", label: "Vídeos" },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <TextInput label="Carregar para a pasta" value={uploadFolder} maxLength={40} onChange={setUploadFolder} />
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/svg+xml,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button variant="primary" onClick={() => inputRef.current?.click()} loading={Boolean(progress)}>
            {!progress && <Upload className="size-4" />} Carregar ficheiros
          </Button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Formatos aceites: JPG, PNG, WebP e SVG (até 10 MB) · MP4 e WebM (até 50 MB). As imagens são optimizadas
        automaticamente para cada ecrã no website.
      </p>

      {progress && <Notice tone="info">{progress}</Notice>}
      {messages.map((m, i) => (
        <Notice key={i} tone={m.tone}>
          {m.text}
        </Notice>
      ))}

      {visible.length === 0 ? (
        <EmptyState title="Sem ficheiros">Carregue imagens ou vídeos para os usar nas secções do website.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item)}
                className="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <div className="relative aspect-square bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
                  {item.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.alt} loading="lazy" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-slate-800 text-white">
                      <Film className="size-8" />
                    </div>
                  )}
                  {!item.alt && item.kind === "image" && (
                    <span className="absolute left-2 top-2">
                      <Badge tone="amber">Sem descrição</Badge>
                    </span>
                  )}
                </div>
                <div className="px-3 py-2">
                  <p className="truncate text-xs font-medium text-slate-700">{item.originalName ?? item.id}</p>
                  <p className="text-xs text-slate-500">
                    {item.folder} · {formatBytes(item.size)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && <MediaDetails key={selected.id} item={items.find((i) => i.id === selected.id) ?? selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function MediaDetails({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const [alt, setAlt] = useState(item.alt);
  const [folder, setFolder] = useState(item.folder);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const replaceRef = useRef<HTMLInputElement>(null);

  const save = () =>
    startTransition(async () => {
      const r = await updateMediaDetails(item.id, { alt, folder });
      setMessage(r.ok ? { tone: "success", text: "Detalhes guardados." } : { tone: "error", text: r.error });
    });

  const replace = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    startTransition(async () => {
      const r = await replaceImage(item.id, form);
      setMessage(
        r.ok
          ? { tone: "success", text: "Imagem substituída. O rascunho foi actualizado; publique para aplicar no website." }
          : { tone: "error", text: r.error },
      );
    });
  };

  const remove = () => {
    if (!window.confirm("Eliminar definitivamente este ficheiro?")) return;
    startTransition(async () => {
      const r = await deleteMedia(item.id);
      if (r.ok) onClose();
      else setMessage({ tone: "error", text: r.error });
    });
  };

  return (
    <Modal open title="Detalhes do ficheiro" onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex items-center justify-center overflow-hidden rounded-lg bg-slate-100">
          {item.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.alt} className="max-h-[60vh] w-auto object-contain" />
          ) : (
            <video src={item.url} controls className="max-h-[60vh] w-full" />
          )}
        </div>
        <div className="space-y-4">
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Nome original</dt>
            <dd className="truncate">{item.originalName ?? "—"}</dd>
            <dt className="text-slate-500">Tipo</dt>
            <dd>{item.mimeType}</dd>
            <dt className="text-slate-500">Tamanho</dt>
            <dd>{formatBytes(item.size)}</dd>
            {item.width && (
              <>
                <dt className="text-slate-500">Dimensões</dt>
                <dd>
                  {item.width} × {item.height} px
                </dd>
              </>
            )}
            <dt className="text-slate-500">Carregado</dt>
            <dd>{formatDateTime(item.createdAt)}</dd>
          </dl>
          <TextInput
            label="Texto alternativo"
            value={alt}
            maxLength={250}
            onChange={setAlt}
            hint="Descreva a imagem para pessoas com deficiência visual e para o Google."
          />
          <TextInput label="Pasta" value={folder} maxLength={40} onChange={setFolder} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={save} loading={pending}>
              Guardar detalhes
            </Button>
            <Button onClick={() => navigator.clipboard.writeText(item.url)}>
              <Copy className="size-4" /> Copiar endereço
            </Button>
          </div>
          <div className={cx("flex flex-wrap gap-2 border-t border-slate-100 pt-4")}>
            {item.kind === "image" && (
              <>
                <input ref={replaceRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(e) => replace(e.target.files?.[0])} />
                <Button onClick={() => replaceRef.current?.click()} disabled={pending}>
                  <RefreshCw className="size-4" /> Substituir ficheiro
                </Button>
              </>
            )}
            <Button variant="danger" onClick={remove} disabled={pending}>
              <Trash2 className="size-4" /> Eliminar
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Só é possível eliminar ficheiros que não estejam a ser usados no rascunho nem no website publicado.
          </p>
        </div>
      </div>
    </Modal>
  );
}
