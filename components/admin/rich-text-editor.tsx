"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading3, Italic, Link2, List, ListOrdered, Quote, Unlink } from "lucide-react";
import { cx } from "./ui";

/** Editor de texto rico simples (negrito, itálico, listas, links, subtítulos). */
export function RichTextEditor({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
  hint?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: { openOnClick: false, autolink: true, protocols: ["mailto", "tel"] },
      }),
    ],
    content: value,
    editorProps: {
      attributes: { class: "px-3 py-2.5 text-sm leading-relaxed text-slate-800", "aria-label": label },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  const tool = (active: boolean) =>
    cx("rounded p-1.5 text-slate-600 hover:bg-slate-100", active && "bg-slate-200 text-slate-900");

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Endereço do link (https://…, mailto:… ou tel:…)", previous ?? "https://");
    if (url === null) return;
    if (url === "" || url === "https://") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
      window.alert("Use um endereço que comece por https://, mailto: ou tel:");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
      <div className="rte overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
        <div className="flex flex-wrap gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1" role="toolbar" aria-label="Formatação">
          <button type="button" title="Negrito" aria-label="Negrito" className={tool(!!editor?.isActive("bold"))} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold className="size-4" />
          </button>
          <button type="button" title="Itálico" aria-label="Itálico" className={tool(!!editor?.isActive("italic"))} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic className="size-4" />
          </button>
          <button type="button" title="Subtítulo" aria-label="Subtítulo" className={tool(!!editor?.isActive("heading"))} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="size-4" />
          </button>
          <button type="button" title="Lista" aria-label="Lista" className={tool(!!editor?.isActive("bulletList"))} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List className="size-4" />
          </button>
          <button type="button" title="Lista numerada" aria-label="Lista numerada" className={tool(!!editor?.isActive("orderedList"))} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="size-4" />
          </button>
          <button type="button" title="Citação" aria-label="Citação" className={tool(!!editor?.isActive("blockquote"))} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote className="size-4" />
          </button>
          <button type="button" title="Inserir link" aria-label="Inserir link" className={tool(!!editor?.isActive("link"))} onClick={setLink}>
            <Link2 className="size-4" />
          </button>
          {editor?.isActive("link") && (
            <button type="button" title="Remover link" aria-label="Remover link" className={tool(false)} onClick={() => editor.chain().focus().unsetLink().run()}>
              <Unlink className="size-4" />
            </button>
          )}
        </div>
        <EditorContent editor={editor} />
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
