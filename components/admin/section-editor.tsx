"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveSection } from "@/lib/cms/actions";
import { FEATURE_ICONS, type Section, type SectionOf } from "@/lib/cms/schema";
import { emptyMedia, SECTION_TYPE_LABELS } from "@/lib/cms/templates";
import { SaveBar, useDraftEditor } from "./draft-editor";
import { LinkEditor, type AnchorOption } from "./link-editor";
import { MediaField, VideoField } from "./media-picker";
import { RichTextEditor } from "./rich-text-editor";
import { Button, Card, Select, Slider, TextArea, TextInput, Toggle } from "./ui";
import { plainText } from "@/lib/cms/text";

const TITLE_HINT = "Dica: coloque *palavras* entre asteriscos para as destacar em itálico na cor de destaque.";

const BACKGROUND_OPTIONS = [
  { value: "light", label: "Claro (fundo principal)" },
  { value: "surface", label: "Claro alternativo" },
  { value: "dark", label: "Escuro" },
  { value: "primary", label: "Cor principal" },
  { value: "accent", label: "Cor de destaque" },
] as const;

const ICON_LABELS: Record<(typeof FEATURE_ICONS)[number], string> = {
  compass: "Bússola",
  anchor: "Âncora",
  waves: "Ondas",
  wind: "Vento",
  ship: "Navio",
  radar: "Radar",
  wrench: "Ferramenta",
  shield: "Escudo",
  sparkles: "Brilho",
  "life-buoy": "Bóia",
  map: "Mapa",
  truck: "Entrega",
  users: "Pessoas",
  sun: "Sol",
};

function move<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function SectionEditor({
  section,
  anchors,
  storeEnabled,
}: {
  section: Section;
  anchors: AnchorOption[];
  storeEnabled: boolean;
}) {
  const editor = useDraftEditor<Section>(section, (value, revision) => saveSection(value, revision));
  const s = editor.value;
  const set = (patch: Partial<Section>) => editor.update((current) => ({ ...current, ...patch }) as Section);
  const linkProps = { anchors, storeEnabled };

  return (
    <div>
      <Link href="/admin/seccoes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Todas as secções
      </Link>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-sky-700">{SECTION_TYPE_LABELS[s.type]}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{("title" in s && plainText(s.title)) || s.navLabel || SECTION_TYPE_LABELS[s.type]}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TypeFields section={s} set={set} linkProps={linkProps} />
        </div>

        <div className="space-y-6">
          <Card title="Publicação e navegação">
            <Toggle label="Secção visível no website" checked={s.visible} onChange={(v) => set({ visible: v })} />
            <Toggle
              label="Mostrar no menu"
              description="Adiciona um link para esta secção no cabeçalho."
              checked={s.showInNav}
              onChange={(v) => set({ showInNav: v })}
            />
            <TextInput label="Nome no menu" value={s.navLabel} maxLength={40} onChange={(v) => set({ navLabel: v })} />
            <TextInput
              label="Âncora (endereço da secção)"
              value={s.anchor}
              maxLength={60}
              onChange={(v) => set({ anchor: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
              hint={
                <>
                  O website abre esta secção em <span className="font-mono">/#{s.anchor}</span>. Se alterar, os botões que
                  apontam para ela são actualizados automaticamente.
                </>
              }
            />
          </Card>
          {s.type !== "hero" && s.type !== "banner" && s.type !== "video" && (
            <Card title="Fundo">
              <Select label="Cor de fundo" value={s.background} onChange={(v) => set({ background: v })} options={[...BACKGROUND_OPTIONS]} />
            </Card>
          )}
        </div>
      </div>

      <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
    </div>
  );
}

type FieldsProps = {
  section: Section;
  set: (patch: Partial<Section>) => void;
  linkProps: { anchors: AnchorOption[]; storeEnabled: boolean };
};

function TypeFields({ section, set, linkProps }: FieldsProps) {
  switch (section.type) {
    case "hero":
      return <HeroFields s={section} set={set} linkProps={linkProps} />;
    case "split":
      return <SplitFields s={section} set={set} linkProps={linkProps} />;
    case "brands":
      return (
        <Card title="Conteúdo" description="As marcas apresentadas são geridas em «Marcas».">
          <TextInput label="Antetítulo" value={section.eyebrow} maxLength={120} onChange={(v) => set({ eyebrow: v })} />
          <TextInput label="Título" value={section.title} maxLength={200} onChange={(v) => set({ title: v })} required hint={TITLE_HINT} />
          <TextArea label="Introdução" value={section.intro} maxLength={1000} onChange={(v) => set({ intro: v })} />
          <Select
            label="Apresentação"
            value={section.layout}
            onChange={(v) => set({ layout: v })}
            options={[
              { value: "editorial", label: "Editorial (lista interactiva com imagem)" },
              { value: "grid", label: "Grelha de cartões" },
            ]}
          />
          <Link href="/admin/marcas" className="inline-block text-sm text-sky-700 hover:underline">
            Gerir marcas →
          </Link>
        </Card>
      );
    case "gallery":
      return <GalleryFields s={section} set={set} />;
    case "banner":
      return (
        <Card title="Conteúdo">
          <TextInput label="Antetítulo" value={section.eyebrow} maxLength={120} onChange={(v) => set({ eyebrow: v })} />
          <TextInput label="Título" value={section.title} maxLength={200} onChange={(v) => set({ title: v })} required hint={TITLE_HINT} />
          <TextArea label="Subtítulo" value={section.subtitle} maxLength={600} onChange={(v) => set({ subtitle: v })} />
          <MediaField label="Fotografia de fundo" value={section.image} onChange={(v) => set({ image: v })} hint="Recomendado: 2400 × 1400 px ou superior." />
          <Slider label="Escurecimento da imagem" value={section.overlayOpacity} max={90} onChange={(v) => set({ overlayOpacity: v })} />
          <Select
            label="Altura"
            value={section.height}
            onChange={(v) => set({ height: v })}
            options={[
              { value: "tall", label: "Alta (quase ecrã inteiro)" },
              { value: "medium", label: "Média" },
            ]}
          />
          <LinkEditor label="Botão" value={section.button} onChange={(v) => set({ button: v })} {...linkProps} />
        </Card>
      );
    case "video":
      return (
        <Card title="Conteúdo">
          <TextInput label="Antetítulo" value={section.eyebrow} maxLength={120} onChange={(v) => set({ eyebrow: v })} />
          <TextInput label="Título" value={section.title} maxLength={200} onChange={(v) => set({ title: v })} required hint={TITLE_HINT} />
          <TextArea label="Subtítulo" value={section.subtitle} maxLength={600} onChange={(v) => set({ subtitle: v })} />
          <VideoField label="Vídeo" value={section.videoUrl} onChange={(v) => set({ videoUrl: v })} />
          <MediaField
            label="Imagem de capa"
            value={section.poster}
            onChange={(v) => set({ poster: v })}
            hint="Mostrada enquanto o vídeo carrega e em ligações lentas."
          />
          <Slider label="Escurecimento" value={section.overlayOpacity} max={90} onChange={(v) => set({ overlayOpacity: v })} />
          <LinkEditor label="Botão" value={section.button} onChange={(v) => set({ button: v })} {...linkProps} />
        </Card>
      );
    case "features":
      return <FeaturesFields s={section} set={set} />;
    case "cta":
      return (
        <Card title="Conteúdo">
          <TextInput label="Título" value={section.title} maxLength={200} onChange={(v) => set({ title: v })} required hint={TITLE_HINT} />
          <TextArea label="Texto" value={section.text} maxLength={800} onChange={(v) => set({ text: v })} />
          <LinkEditor label="Botão principal" value={section.primaryButton} onChange={(v) => set({ primaryButton: v })} {...linkProps} />
          <LinkEditor label="Botão secundário" value={section.secondaryButton} onChange={(v) => set({ secondaryButton: v })} {...linkProps} />
        </Card>
      );
    case "marquee":
      return <MarqueeFields s={section} set={set} />;
    case "contact":
      return (
        <Card title="Conteúdo" description="Telefone, email, morada e redes sociais são editados em «Contactos».">
          <TextInput label="Antetítulo" value={section.eyebrow} maxLength={120} onChange={(v) => set({ eyebrow: v })} />
          <TextInput label="Título" value={section.title} maxLength={200} onChange={(v) => set({ title: v })} required hint={TITLE_HINT} />
          <TextArea label="Introdução" value={section.intro} maxLength={1000} onChange={(v) => set({ intro: v })} />
          <Toggle label="Mostrar formulário de contacto" checked={section.showForm} onChange={(v) => set({ showForm: v })} />
          {section.showForm && (
            <>
              <TextInput label="Título do formulário" value={section.formTitle} maxLength={120} onChange={(v) => set({ formTitle: v })} />
              <TextArea
                label="Mensagem de confirmação"
                value={section.successMessage}
                maxLength={300}
                onChange={(v) => set({ successMessage: v })}
              />
            </>
          )}
          <Link href="/admin/contactos" className="inline-block text-sm text-sky-700 hover:underline">
            Editar informações de contacto →
          </Link>
        </Card>
      );
  }
}

function MarqueeFields({ s, set }: { s: SectionOf<"marquee">; set: FieldsProps["set"] }) {
  return (
    <Card title="Palavras em movimento" description="Palavras curtas funcionam melhor (ex.: Navegar, Pescar, Velejar). O logótipo aparece entre cada palavra.">
      {s.items.map((word, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <TextInput
              label={`Palavra ${i + 1}`}
              value={word}
              maxLength={40}
              onChange={(v) => set({ items: s.items.map((x, j) => (j === i ? v : x)) })}
            />
          </div>
          <Button size="sm" variant="ghost" aria-label="Mover para cima" disabled={i === 0} onClick={() => set({ items: move(s.items, i, -1) })}>
            <ArrowUp className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Remover palavra" disabled={s.items.length <= 1} onClick={() => set({ items: s.items.filter((_, j) => j !== i) })}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {s.items.length < 12 && (
        <Button size="sm" onClick={() => set({ items: [...s.items, "Nova"] })}>
          <Plus className="size-3.5" /> Adicionar palavra
        </Button>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Estilo do texto"
          value={s.style}
          onChange={(v) => set({ style: v })}
          options={[
            { value: "mixed", label: "Alternado (cheio / contorno)" },
            { value: "solid", label: "Cheio" },
            { value: "outline", label: "Só contorno" },
          ]}
        />
        <Select
          label="Velocidade"
          value={s.speed}
          onChange={(v) => set({ speed: v })}
          options={[
            { value: "slow", label: "Lenta" },
            { value: "normal", label: "Normal" },
            { value: "fast", label: "Rápida" },
          ]}
        />
        <Select
          label="Direcção"
          value={s.direction}
          onChange={(v) => set({ direction: v })}
          options={[
            { value: "left", label: "Para a esquerda" },
            { value: "right", label: "Para a direita" },
          ]}
        />
      </div>
      <Toggle label="Faixa inclinada" description="Inclina ligeiramente a faixa, para um efeito mais dinâmico." checked={s.tilted} onChange={(v) => set({ tilted: v })} />
    </Card>
  );
}

function HeroFields({ s, set, linkProps }: { s: SectionOf<"hero"> } & Omit<FieldsProps, "section">) {
  return (
    <>
      <Card title="Textos">
        <TextInput label="Antetítulo" value={s.eyebrow} maxLength={120} onChange={(v) => set({ eyebrow: v })} />
        <TextInput label="Título principal" value={s.title} maxLength={200} onChange={(v) => set({ title: v })} required hint={TITLE_HINT} />
        <TextArea label="Subtítulo" value={s.subtitle} maxLength={600} onChange={(v) => set({ subtitle: v })} />
        <Select
          label="Alinhamento"
          value={s.align}
          onChange={(v) => set({ align: v })}
          options={[
            { value: "left", label: "À esquerda" },
            { value: "center", label: "Centrado" },
          ]}
        />
        <Toggle
          label="Mostrar faixa de marcas"
          description="Faixa animada com os nomes das marcas visíveis, no fundo da abertura."
          checked={s.showBrandStrip}
          onChange={(v) => set({ showBrandStrip: v })}
        />
      </Card>
      <Card title="Imagem ou vídeo de fundo">
        <Select
          label="Tipo de fundo"
          value={s.mediaKind}
          onChange={(v) => set({ mediaKind: v })}
          options={[
            { value: "image", label: "Fotografia" },
            { value: "video", label: "Vídeo" },
          ]}
        />
        <MediaField
          label={s.mediaKind === "video" ? "Imagem de capa do vídeo" : "Fotografia"}
          value={s.image}
          onChange={(v) => set({ image: v })}
          hint="Recomendado: 2400 × 1600 px ou superior, com o assunto principal à direita."
        />
        {s.mediaKind === "video" && <VideoField label="Vídeo" value={s.videoUrl} onChange={(v) => set({ videoUrl: v })} />}
        <Select
          label="Cor da sobreposição"
          value={s.overlayColor}
          onChange={(v) => set({ overlayColor: v })}
          options={[
            { value: "dark", label: "Escura" },
            { value: "primary", label: "Cor principal" },
          ]}
        />
        <Slider label="Intensidade da sobreposição" value={s.overlayOpacity} max={90} onChange={(v) => set({ overlayOpacity: v })} />
        <Select
          label="Altura"
          value={s.height}
          onChange={(v) => set({ height: v })}
          options={[
            { value: "full", label: "Ecrã inteiro" },
            { value: "large", label: "Grande" },
          ]}
        />
      </Card>
      <Card title="Botões">
        <LinkEditor label="Botão principal" value={s.primaryButton} onChange={(v) => set({ primaryButton: v })} {...linkProps} />
        <LinkEditor label="Botão secundário" value={s.secondaryButton} onChange={(v) => set({ secondaryButton: v })} {...linkProps} />
        <p className="text-xs text-slate-500">
          O botão «Loja Online» pode ser mostrado aqui automaticamente — configure em «Loja Online».
        </p>
      </Card>
    </>
  );
}

function SplitFields({ s, set, linkProps }: { s: SectionOf<"split"> } & Omit<FieldsProps, "section">) {
  return (
    <>
      <Card title="Textos">
        <TextInput label="Antetítulo" value={s.eyebrow} maxLength={120} onChange={(v) => set({ eyebrow: v })} />
        <TextInput label="Título" value={s.title} maxLength={200} onChange={(v) => set({ title: v })} required hint={TITLE_HINT} />
        <RichTextEditor label="Texto" value={s.body} onChange={(v) => set({ body: v })} />
      </Card>
      <Card title="Imagem">
        <MediaField label="Fotografia" value={s.image} onChange={(v) => set({ image: v })} hint="Formato vertical (4:5) funciona melhor." />
        <Select
          label="Posição da imagem"
          value={s.imagePosition}
          onChange={(v) => set({ imagePosition: v })}
          options={[
            { value: "right", label: "Texto à esquerda, imagem à direita" },
            { value: "left", label: "Imagem à esquerda, texto à direita" },
          ]}
        />
      </Card>
      <Card title="Números em destaque" description="Até 4 indicadores (ex.: «5» marcas representadas).">
        {s.stats.map((stat, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="w-28">
              <TextInput
                label="Valor"
                value={stat.value}
                maxLength={20}
                onChange={(v) => set({ stats: s.stats.map((x, j) => (j === i ? { ...x, value: v } : x)) })}
              />
            </div>
            <div className="flex-1">
              <TextInput
                label="Descrição"
                value={stat.label}
                maxLength={80}
                onChange={(v) => set({ stats: s.stats.map((x, j) => (j === i ? { ...x, label: v } : x)) })}
              />
            </div>
            <Button size="sm" variant="ghost" aria-label="Remover indicador" onClick={() => set({ stats: s.stats.filter((_, j) => j !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {s.stats.length < 4 && (
          <Button size="sm" onClick={() => set({ stats: [...s.stats, { value: "", label: "" }] })}>
            <Plus className="size-3.5" /> Adicionar indicador
          </Button>
        )}
      </Card>
      <Card title="Botão">
        <LinkEditor label="Botão" value={s.button} onChange={(v) => set({ button: v })} {...linkProps} />
      </Card>
    </>
  );
}

function GalleryFields({ s, set }: { s: SectionOf<"gallery">; set: FieldsProps["set"] }) {
  return (
    <>
      <Card title="Textos">
        <TextInput label="Antetítulo" value={s.eyebrow} maxLength={120} onChange={(v) => set({ eyebrow: v })} />
        <TextInput label="Título" value={s.title} maxLength={200} onChange={(v) => set({ title: v })} required hint={TITLE_HINT} />
        <TextArea label="Introdução" value={s.intro} maxLength={1000} onChange={(v) => set({ intro: v })} />
        <Select
          label="Apresentação"
          value={s.layout}
          onChange={(v) => set({ layout: v })}
          options={[
            { value: "mosaic", label: "Mosaico editorial" },
            { value: "grid", label: "Grelha regular" },
          ]}
        />
      </Card>
      <Card title={`Fotografias (${s.items.length}/24)`}>
        {s.items.map((item, i) => (
          <div key={i} className="space-y-3 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Fotografia {i + 1}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label="Mover para cima" disabled={i === 0} onClick={() => set({ items: move(s.items, i, -1) })}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Mover para baixo" disabled={i === s.items.length - 1} onClick={() => set({ items: move(s.items, i, 1) })}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Remover fotografia" onClick={() => set({ items: s.items.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <MediaField
              label="Imagem"
              value={item.image}
              onChange={(v) => set({ items: s.items.map((x, j) => (j === i ? { ...x, image: v } : x)) })}
            />
            <TextInput
              label="Legenda"
              value={item.caption}
              maxLength={160}
              onChange={(v) => set({ items: s.items.map((x, j) => (j === i ? { ...x, caption: v } : x)) })}
            />
          </div>
        ))}
        {s.items.length < 24 && (
          <Button size="sm" onClick={() => set({ items: [...s.items, { image: emptyMedia(), caption: "" }] })}>
            <Plus className="size-3.5" /> Adicionar fotografia
          </Button>
        )}
      </Card>
    </>
  );
}

function FeaturesFields({ s, set }: { s: SectionOf<"features">; set: FieldsProps["set"] }) {
  return (
    <>
      <Card title="Textos">
        <TextInput label="Antetítulo" value={s.eyebrow} maxLength={120} onChange={(v) => set({ eyebrow: v })} />
        <TextInput label="Título" value={s.title} maxLength={200} onChange={(v) => set({ title: v })} required hint={TITLE_HINT} />
        <TextArea label="Introdução" value={s.intro} maxLength={1000} onChange={(v) => set({ intro: v })} />
        <Select
          label="Colunas (em ecrãs grandes)"
          value={String(s.columns) as "2" | "3" | "4"}
          onChange={(v) => set({ columns: Number(v) as 2 | 3 | 4 })}
          options={[
            { value: "2", label: "2 colunas" },
            { value: "3", label: "3 colunas" },
            { value: "4", label: "4 colunas" },
          ]}
        />
      </Card>
      <Card title={`Destaques (${s.items.length}/12)`}>
        {s.items.map((item, i) => (
          <div key={i} className="space-y-3 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">Destaque {i + 1}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label="Mover para cima" disabled={i === 0} onClick={() => set({ items: move(s.items, i, -1) })}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Mover para baixo" disabled={i === s.items.length - 1} onClick={() => set({ items: move(s.items, i, 1) })}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Remover destaque" onClick={() => set({ items: s.items.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                label="Ícone"
                value={item.icon}
                onChange={(v) => set({ items: s.items.map((x, j) => (j === i ? { ...x, icon: v } : x)) })}
                options={FEATURE_ICONS.map((icon) => ({ value: icon, label: ICON_LABELS[icon] }))}
              />
              <div className="sm:col-span-2">
                <TextInput
                  label="Título"
                  value={item.title}
                  maxLength={120}
                  onChange={(v) => set({ items: s.items.map((x, j) => (j === i ? { ...x, title: v } : x)) })}
                  required
                />
              </div>
            </div>
            <TextArea
              label="Texto"
              value={item.text}
              maxLength={600}
              rows={2}
              onChange={(v) => set({ items: s.items.map((x, j) => (j === i ? { ...x, text: v } : x)) })}
            />
          </div>
        ))}
        {s.items.length < 12 && (
          <Button size="sm" onClick={() => set({ items: [...s.items, { icon: "compass", title: "Novo destaque", text: "" }] })}>
            <Plus className="size-3.5" /> Adicionar destaque
          </Button>
        )}
      </Card>
    </>
  );
}
