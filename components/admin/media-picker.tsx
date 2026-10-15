"use client";

import { useEffect, useRef, useState } from "react";
import { Film, ImageIcon, Loader2, Search, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { createVideoUpload, finalizeVideoUpload, listMedia, uploadImage } from "@/lib/media/actions";
import type { MediaItem } from "@/lib/media/types";
import type { MediaRef } from "@/lib/cms/schema";
import { Button, cx, Modal, Notice } from "./ui";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/svg+xml";
const VIDEO_ACCEPT = "video/mp4,video/webm";

/** Envia um ficheiro (imagem via servidor; vídeo directamente para o Storage). */
export async function uploadFile(file: File, folder: string): Promise<{ ok: true; item: MediaItem } | { ok: false; error: string }> {
  if (file.type.startsWith("video/")) {
    const prep = await createVideoUpload({ name: file.name, size: file.size, type: file.type, folder });
    if (!prep.ok) return { ok: false, error: prep.error };
    const supabase = createClient();
    const { error } = await supabase.storage.from("media").uploadToSignedUrl(prep.data.path, prep.data.token, file, {
      contentType: file.type,
    });
    if (error) return { ok: false, error: `Falha no envio do vídeo: ${error.message}` };
    const done = await finalizeVideoUpload({ path: prep.data.path, name: file.name, size: file.size, type: file.type, folder });
    return done.ok ? { ok: true, item: done.data } : { ok: false, error: done.error };
  }
  const form = new FormData();
  form.set("file", file);
  form.set("folder", folder);
  const result = await uploadImage(form);
  return result.ok ? { ok: true, item: result.data } : { ok: false, error: result.error };
}

function MediaLibraryModal({
  open,
  onClose,
  onSelect,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
  kind: "image" | "video";
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    listMedia().then((result) => {
      if (cancelled) return;
      if (result.ok) setItems(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    const result = await uploadFile(file, kind === "video" ? "videos" : "geral");
    setUploading(false);
    if (!result.ok) return setError(result.error);
    onSelect(result.item);
  };

  const filtered = (items ?? []).filter(
    (i) =>
      i.kind === kind &&
      (!query || `${i.originalName ?? ""} ${i.alt} ${i.folder}`.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <Modal open={open} onClose={onClose} title={kind === "video" ? "Escolher vídeo" : "Escolher imagem"} wide>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar por nome, pasta ou descrição"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500"
          />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={kind === "video" ? VIDEO_ACCEPT : IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => onUpload(e.target.files?.[0])}
        />
        <Button variant="primary" onClick={() => inputRef.current?.click()} loading={uploading}>
          {!uploading && <Upload className="size-4" />}
          Carregar {kind === "video" ? "vídeo" : "imagem"}
        </Button>
      </div>
      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {items === null ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          Ainda não existem {kind === "video" ? "vídeos" : "imagens"} na biblioteca. Carregue o primeiro ficheiro.
        </p>
      ) : (
        <ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="group block w-full overflow-hidden rounded-lg border border-slate-200 text-left hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <div className="relative aspect-square bg-slate-100">
                  {item.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.alt} className="size-full object-cover" loading="lazy" />
                  ) : (
                    <video src={item.url} className="size-full object-cover" muted preload="metadata" />
                  )}
                </div>
                <p className="truncate px-2 py-1.5 text-xs text-slate-600">{item.originalName ?? item.folder}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Campo de imagem: pré-visualização, escolher da biblioteca, texto alternativo. */
export function MediaField({
  label,
  value,
  onChange,
  hint,
  withAlt = true,
}: {
  label: string;
  value: MediaRef;
  onChange: (value: MediaRef) => void;
  hint?: string;
  withAlt?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-3 sm:flex-row">
        <div className="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 sm:w-48">
          {value.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt={value.alt} className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-8 text-slate-300" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              {value.url ? "Substituir imagem" : "Escolher imagem"}
            </Button>
            {value.url && (
              <Button size="sm" variant="ghost" onClick={() => onChange({ url: "", alt: "", mediaId: null })}>
                <X className="size-3.5" /> Remover
              </Button>
            )}
          </div>
          {withAlt && value.url && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Texto alternativo (descrição para acessibilidade e SEO)</label>
              <input
                value={value.alt}
                maxLength={250}
                onChange={(e) => onChange({ ...value, alt: e.target.value })}
                className={cx(
                  "w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-sky-500",
                  value.alt ? "border-slate-300" : "border-amber-300 bg-amber-50",
                )}
                placeholder="Ex.: Embarcação a navegar ao pôr-do-sol"
              />
            </div>
          )}
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
      {open && <MediaLibraryModal
        open={open}
        kind="image"
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          onChange({ url: item.url, alt: value.alt || item.alt, mediaId: item.id });
          setOpen(false);
        }}
      />}
    </div>
  );
}

export function VideoField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-3 sm:flex-row">
        <div className="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 sm:w-48">
          {value ? <video src={value} className="size-full object-cover" muted preload="metadata" /> : <Film className="size-8 text-slate-300" />}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              {value ? "Substituir vídeo" : "Escolher vídeo"}
            </Button>
            {value && (
              <Button size="sm" variant="ghost" onClick={() => onChange("")}>
                <X className="size-3.5" /> Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500">{hint ?? "MP4 ou WebM, até 50 MB. O vídeo é reproduzido sem som e em ciclo."}</p>
        </div>
      </div>
      {open && <MediaLibraryModal
        open={open}
        kind="video"
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          onChange(item.url);
          setOpen(false);
        }}
      />}
    </div>
  );
}
