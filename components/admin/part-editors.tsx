"use client";

import { ArrowDown, ArrowUp, ExternalLink, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { saveDraftPart, saveMenu } from "@/lib/cms/actions";
import { FONT_PAIRING_OPTIONS } from "@/lib/cms/theme";
import type { Appearance, SiteDocument, StoreConfig } from "@/lib/cms/schema";
import { emptyLink } from "@/lib/cms/templates";
import { SaveBar, useDraftEditor } from "./draft-editor";
import { LinkEditor, type AnchorOption } from "./link-editor";
import { MediaField } from "./media-picker";
import { Badge, Button, Card, cx, Field, Notice, Select, TextArea, TextInput, Toggle } from "./ui";

/* ------------------------------ Contactos ------------------------------ */

export function ContactEditor({ value }: { value: SiteDocument["contact"] }) {
  const editor = useDraftEditor(value, (v, r) => saveDraftPart("contact", v, r));
  const c = editor.value;
  const set = (patch: Partial<typeof c>) => editor.update((cur) => ({ ...cur, ...patch }));
  const setSocial = (key: keyof typeof c.social, v: string) => editor.update((cur) => ({ ...cur, social: { ...cur.social, [key]: v } }));
  return (
    <div className="space-y-6">
      <Card title="Contactos" description="Mostrados na secção de contactos e no rodapé. Campos vazios não aparecem no website.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Telefone principal" value={c.phone} maxLength={40} onChange={(v) => set({ phone: v })} />
          <TextInput label="Telefone alternativo" value={c.phoneSecondary} maxLength={40} onChange={(v) => set({ phoneSecondary: v })} />
          <TextInput label="WhatsApp" value={c.whatsapp} maxLength={40} placeholder="+244 9xx xxx xxx" onChange={(v) => set({ whatsapp: v })} />
          <TextInput label="Email" type="email" value={c.email} maxLength={254} onChange={(v) => set({ email: v })} />
        </div>
        <TextArea label="Morada" value={c.address} maxLength={300} rows={2} onChange={(v) => set({ address: v })} />
        <TextInput
          label="Link do mapa"
          value={c.mapUrl}
          placeholder="https://maps.app.goo.gl/…"
          onChange={(v) => set({ mapUrl: v })}
          hint="Opcional. Ao clicar na morada abre este link."
        />
        <TextInput label="Horário" value={c.hours} maxLength={200} onChange={(v) => set({ hours: v })} />
      </Card>
      <Card title="Redes sociais" description="Endereços completos (https://…). Deixe vazio para ocultar.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Instagram" value={c.social.instagram} onChange={(v) => setSocial("instagram", v)} />
          <TextInput label="Facebook" value={c.social.facebook} onChange={(v) => setSocial("facebook", v)} />
          <TextInput label="LinkedIn" value={c.social.linkedin} onChange={(v) => setSocial("linkedin", v)} />
          <TextInput label="YouTube" value={c.social.youtube} onChange={(v) => setSocial("youtube", v)} />
          <TextInput label="TikTok" value={c.social.tiktok} onChange={(v) => setSocial("tiktok", v)} />
        </div>
      </Card>
      <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
    </div>
  );
}

/* ------------------------------ Loja Online ------------------------------ */

function validStoreUrl(url: string | null) {
  return Boolean(url && /^https:\/\/[^\s]+\.[^\s]+/i.test(url));
}

export function StoreEditor({ value }: { value: StoreConfig }) {
  const editor = useDraftEditor(value, (v, r) => saveDraftPart("store", { ...v, url: v.url?.trim() ? v.url.trim() : null }, r));
  const s = editor.value;
  const set = (patch: Partial<StoreConfig>) => editor.update((cur) => ({ ...cur, ...patch }));
  const urlValid = validStoreUrl(s.url);
  const urlError = s.url && !urlValid ? "Introduza um endereço completo que comece por https://" : undefined;
  const willShow = s.enabled && urlValid;

  return (
    <div className="space-y-6">
      <Notice tone="info" title="A loja online funciona na plataforma Quicksell, separada deste website.">
        Aqui configura apenas o botão «Loja Online». Enquanto a loja estiver desactivada, o botão não aparece em nenhum
        lugar do website, por isso nunca são mostrados links inválidos.
      </Notice>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Ligação à Quicksell">
            <TextInput
              label="Endereço da loja (URL)"
              value={s.url ?? ""}
              placeholder="https://…"
              onChange={(v) => set({ url: v })}
              error={urlError}
              hint="Cole aqui o endereço fornecido pela Quicksell quando estiver disponível."
            />
            <Toggle
              label="Activar Loja Online"
              description={urlValid ? "Mostra o botão no website depois de publicar." : "Só pode ser activada com um endereço válido."}
              checked={s.enabled}
              onChange={(v) => set({ enabled: v && urlValid })}
            />
            {s.enabled && !urlValid && <Notice tone="error">A loja não pode estar activa sem um endereço válido.</Notice>}
          </Card>
          <Card title="Botão">
            <TextInput label="Texto do botão" value={s.label} maxLength={40} onChange={(v) => set({ label: v })} />
            <Toggle label="Abrir numa nova janela" checked={s.openInNewTab} onChange={(v) => set({ openInNewTab: v })} />
            <Toggle label="Mostrar no cabeçalho (menu)" checked={s.showInHeader} onChange={(v) => set({ showInHeader: v })} />
            <Toggle label="Mostrar na abertura (Hero)" checked={s.showInHero} onChange={(v) => set({ showInHero: v })} />
            <p className="text-xs text-slate-500">
              Também pode usar a loja como destino de qualquer botão do website, escolhendo «Loja Online» no destino.
            </p>
          </Card>
        </div>
        <Card title="Pré-visualização do botão">
          <div className="flex min-h-32 items-center justify-center rounded-lg bg-[#07141C] p-6">
            {willShow ? (
              <a
                href={s.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/70 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white"
              >
                <ShoppingBag className="size-4" /> {s.label || "Loja Online"}
              </a>
            ) : (
              <p className="text-center text-xs text-white/60">Botão oculto (loja desactivada)</p>
            )}
          </div>
          <div className="text-sm">
            Estado:{" "}
            {willShow ? <Badge tone="green">Activa (após publicar)</Badge> : <Badge tone="amber">Desactivada</Badge>}
          </div>
          {urlValid && (
            <a href={s.url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-sky-700 hover:underline">
              Testar endereço <ExternalLink className="size-3.5" />
            </a>
          )}
        </Card>
      </div>
      <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
    </div>
  );
}

/* ---------------------------------- SEO ---------------------------------- */

export function SeoEditor({ value }: { value: SiteDocument["seo"] }) {
  const editor = useDraftEditor(value, (v, r) => saveDraftPart("seo", v, r));
  const s = editor.value;
  const set = (patch: Partial<typeof s>) => editor.update((cur) => ({ ...cur, ...patch }));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="Motores de pesquisa">
          <TextInput
            label="Título da página"
            value={s.title}
            maxLength={70}
            onChange={(v) => set({ title: v })}
            hint={`${s.title.length}/70 caracteres · ideal entre 50 e 60.`}
          />
          <TextArea
            label="Descrição"
            value={s.description}
            maxLength={200}
            onChange={(v) => set({ description: v })}
            hint={`${s.description.length}/200 caracteres · ideal entre 120 e 160.`}
          />
          <TextInput
            label="Palavras-chave"
            value={s.keywords}
            maxLength={300}
            onChange={(v) => set({ keywords: v })}
            hint="Separadas por vírgulas."
          />
          <TextInput
            label="Endereço do website"
            value={s.siteUrl}
            placeholder="https://www.pontoradical.ao"
            onChange={(v) => set({ siteUrl: v })}
            hint="Usado nas partilhas em redes sociais."
          />
        </Card>
        <Card title="Partilha em redes sociais">
          <MediaField label="Imagem de partilha" value={s.ogImage} onChange={(v) => set({ ogImage: v })} hint="Recomendado: 1200 × 630 px, JPG ou PNG." />
        </Card>
      </div>
      <Card title="Pré-visualização no Google">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="truncate text-xs text-emerald-800">{s.siteUrl || "https://www.pontoradical.ao"}</p>
          <p className="mt-1 line-clamp-2 text-lg leading-snug text-[#1a0dab]">{s.title || "Título da página"}</p>
          <p className="mt-1 line-clamp-3 text-sm text-slate-600">{s.description || "Descrição da página…"}</p>
        </div>
      </Card>
      <div className="lg:col-span-3">
        <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
      </div>
    </div>
  );
}

/* ------------------------------- Aparência ------------------------------- */

const COLOR_FIELDS: { key: keyof Appearance["colors"]; label: string; hint: string }[] = [
  { key: "primary", label: "Cor principal", hint: "Fundos de destaque e sobreposições." },
  { key: "secondary", label: "Cor secundária", hint: "Antetítulos e detalhes." },
  { key: "accent", label: "Cor de destaque", hint: "Botões principais e realces." },
  { key: "dark", label: "Cor escura", hint: "Cabeçalho, rodapé e secções escuras." },
  { key: "background", label: "Fundo", hint: "Fundo das secções claras." },
  { key: "surface", label: "Fundo alternativo", hint: "Secções claras alternadas." },
  { key: "text", label: "Texto", hint: "Cor do texto em fundos claros." },
];

/** Contraste WCAG entre duas cores hexadecimais. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

export function AppearanceEditor({ value }: { value: Appearance }) {
  const editor = useDraftEditor(value, (v, r) => saveDraftPart("appearance", v, r));
  const a = editor.value;
  const setColor = (key: keyof Appearance["colors"], v: string) =>
    editor.update((cur) => ({ ...cur, colors: { ...cur.colors, [key]: v } }));
  const setHeadings = (patch: Partial<Appearance["headings"]>) => editor.update((cur) => ({ ...cur, headings: { ...cur.headings, ...patch } }));
  const setButtons = (patch: Partial<Appearance["buttons"]>) => editor.update((cur) => ({ ...cur, buttons: { ...cur.buttons, ...patch } }));
  const fonts = FONT_PAIRING_OPTIONS[a.fontPairing];
  const allHex = Object.values(a.colors).every(isHex);
  const textContrast = allHex ? contrast(a.colors.text, a.colors.background) : 0;
  const buttonContrast = allHex ? contrast("#FFFFFF", a.colors.accent) : 0;
  const radius = { square: "0px", rounded: "10px", pill: "999px" }[a.buttons.shape];

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <Card title="Cores" description="Paleta usada em todo o website.">
          <div className="grid gap-4 sm:grid-cols-2">
            {COLOR_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={isHex(a.colors[f.key]) ? a.colors[f.key] : "#000000"}
                    onChange={(e) => setColor(f.key, e.target.value.toUpperCase())}
                    className="h-9 w-12 cursor-pointer rounded border border-slate-300"
                    aria-label={f.label}
                  />
                  <input
                    value={a.colors[f.key]}
                    onChange={(e) => setColor(f.key, e.target.value)}
                    maxLength={7}
                    className={cx(
                      "w-28 rounded-lg border px-2.5 py-2 font-mono text-sm uppercase outline-none focus:border-sky-500",
                      isHex(a.colors[f.key]) ? "border-slate-300" : "border-red-400",
                    )}
                    aria-label={`${f.label} (hexadecimal)`}
                  />
                </div>
              </Field>
            ))}
          </div>
          {allHex && (textContrast < 4.5 || buttonContrast < 3) && (
            <Notice tone="warning" title="Atenção à legibilidade">
              {textContrast < 4.5 && <p>O contraste entre o texto e o fundo é baixo ({textContrast.toFixed(1)}:1; mínimo recomendado 4.5:1).</p>}
              {buttonContrast < 3 && <p>O texto branco dos botões tem pouco contraste com a cor de destaque ({buttonContrast.toFixed(1)}:1).</p>}
            </Notice>
          )}
        </Card>
        <Card title="Tipografia">
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(FONT_PAIRING_OPTIONS) as Appearance["fontPairing"][]).map((key) => {
              const option = FONT_PAIRING_OPTIONS[key];
              const selected = a.fontPairing === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => editor.update((cur) => ({ ...cur, fontPairing: key }))}
                  aria-pressed={selected}
                  className={cx(
                    "rounded-xl border p-4 text-left transition",
                    selected ? "border-sky-500 ring-2 ring-sky-500/20" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <p className="text-2xl" style={{ fontFamily: option.heading }}>
                    {option.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500" style={{ fontFamily: option.body }}>
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Peso dos títulos"
              value={a.headings.weight}
              onChange={(v) => setHeadings({ weight: v })}
              options={[
                { value: "400", label: "Normal" },
                { value: "500", label: "Médio" },
                { value: "600", label: "Semi-negrito" },
                { value: "700", label: "Negrito" },
                { value: "800", label: "Extra negrito" },
              ]}
            />
            <Select
              label="Espaçamento"
              value={a.headings.tracking}
              onChange={(v) => setHeadings({ tracking: v })}
              options={[
                { value: "tight", label: "Apertado" },
                { value: "normal", label: "Normal" },
                { value: "wide", label: "Largo" },
              ]}
            />
            <Select
              label="Tamanho"
              value={a.headings.scale}
              onChange={(v) => setHeadings({ scale: v })}
              options={[
                { value: "compact", label: "Compacto" },
                { value: "standard", label: "Padrão" },
                { value: "dramatic", label: "Expressivo" },
              ]}
            />
          </div>
          <Toggle label="Títulos em maiúsculas" checked={a.headings.uppercase} onChange={(v) => setHeadings({ uppercase: v })} />
        </Card>
        <Card title="Botões">
          <Select
            label="Forma"
            value={a.buttons.shape}
            onChange={(v) => setButtons({ shape: v })}
            options={[
              { value: "pill", label: "Arredondados (cápsula)" },
              { value: "rounded", label: "Cantos suaves" },
              { value: "square", label: "Rectos" },
            ]}
          />
          <Toggle label="Texto dos botões em maiúsculas" checked={a.buttons.uppercase} onChange={(v) => setButtons({ uppercase: v })} />
        </Card>
      </div>

      <div className="lg:col-span-2">
        <div className="sticky top-20 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6" style={{ background: isHex(a.colors.dark) ? a.colors.dark : "#000", color: "#fff" }}>
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-70">Pré-visualização</p>
            <p
              className="mt-3 text-3xl leading-none"
              style={{
                fontFamily: fonts.heading,
                fontWeight: Number(a.headings.weight),
                textTransform: a.headings.uppercase ? "uppercase" : "none",
              }}
            >
              Equipamento para quem vive o mar
            </p>
            <div className="mt-5 flex flex-wrap gap-2" style={{ fontFamily: fonts.body }}>
              <span
                className="px-4 py-2 text-xs font-semibold tracking-wider"
                style={{ background: a.colors.accent, borderRadius: radius, textTransform: a.buttons.uppercase ? "uppercase" : "none" }}
              >
                Botão principal
              </span>
              <span
                className="border px-4 py-2 text-xs font-semibold tracking-wider"
                style={{ borderRadius: radius, textTransform: a.buttons.uppercase ? "uppercase" : "none" }}
              >
                Secundário
              </span>
            </div>
          </div>
          <div className="p-6" style={{ background: a.colors.background, color: a.colors.text, fontFamily: fonts.body }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: a.colors.secondary }}>
              Antetítulo
            </p>
            <p
              className="mt-2 text-2xl leading-tight"
              style={{ fontFamily: fonts.heading, fontWeight: Number(a.headings.weight), textTransform: a.headings.uppercase ? "uppercase" : "none" }}
            >
              Título de secção
            </p>
            <p className="mt-2 text-sm opacity-75">Texto corrido com a tipografia escolhida, para avaliar a leitura.</p>
          </div>
          <div className="flex">
            {COLOR_FIELDS.map((f) => (
              <span key={f.key} className="h-6 flex-1" style={{ background: isHex(a.colors[f.key]) ? a.colors[f.key] : "#fff" }} title={f.label} />
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
      </div>
    </div>
  );
}

/* ------------------------------ Menu e Botões ------------------------------ */

type MenuValue = {
  navigation: SiteDocument["navigation"];
  footer: SiteDocument["footer"];
  nav: { id: string; title: string; anchor: string; visible: boolean; showInNav: boolean; navLabel: string }[];
};

export function MenuEditor({ value, anchors, storeEnabled }: { value: MenuValue; anchors: AnchorOption[]; storeEnabled: boolean }) {
  const editor = useDraftEditor(value, (v, r) =>
    saveMenu({ navigation: v.navigation, footer: v.footer, nav: v.nav.map(({ id, showInNav, navLabel }) => ({ id, showInNav, navLabel })) }, r),
  );
  const m = editor.value;
  const setNav = (patch: Partial<MenuValue["navigation"]>) => editor.update((cur) => ({ ...cur, navigation: { ...cur.navigation, ...patch } }));
  const setFooter = (patch: Partial<MenuValue["footer"]>) => editor.update((cur) => ({ ...cur, footer: { ...cur.footer, ...patch } }));
  const setItem = (id: string, patch: Partial<MenuValue["nav"][number]>) =>
    editor.update((cur) => ({ ...cur, nav: cur.nav.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  const moveLink = (i: number, d: number) =>
    editor.update((cur) => {
      const links = [...cur.footer.links];
      const t = i + d;
      if (t < 0 || t >= links.length) return cur;
      [links[i], links[t]] = [links[t], links[i]];
      return { ...cur, footer: { ...cur.footer, links } };
    });

  return (
    <div className="space-y-6">
      <Card title="Itens do menu" description="A ordem do menu segue a ordem das secções (altere em «Secções»).">
        <ul className="divide-y divide-slate-100">
          {m.nav.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className={cx("truncate text-sm font-medium", !item.visible && "text-slate-400")}>{item.title}</p>
                <p className="font-mono text-xs text-slate-500">
                  #{item.anchor}
                  {!item.visible && " · secção oculta"}
                </p>
              </div>
              <input
                value={item.navLabel}
                maxLength={40}
                onChange={(e) => setItem(item.id, { navLabel: e.target.value })}
                placeholder="Nome no menu"
                aria-label={`Nome no menu para ${item.title}`}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 sm:w-48"
              />
              <div className="sm:w-40">
                <Toggle label="No menu" checked={item.showInNav} onChange={(v) => setItem(item.id, { showInNav: v })} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Cabeçalho">
        <TextInput
          label="Nome / logótipo em texto"
          value={m.navigation.logoText}
          maxLength={60}
          onChange={(v) => setNav({ logoText: v })}
          hint="Usado quando não existe imagem de logótipo."
        />
        <MediaField
          label="Logótipo (opcional)"
          value={m.navigation.logo}
          onChange={(v) => setNav({ logo: v })}
          hint="Use uma versão clara (branca) do logótipo, em SVG ou PNG transparente."
        />
        <Select
          label="Estilo do cabeçalho"
          value={m.navigation.headerStyle}
          onChange={(v) => setNav({ headerStyle: v })}
          options={[
            { value: "transparent", label: "Transparente sobre a imagem de abertura" },
            { value: "solid", label: "Sempre com fundo escuro" },
          ]}
        />
        <LinkEditor label="Botão do cabeçalho" value={m.navigation.ctaButton} onChange={(v) => setNav({ ctaButton: v })} anchors={anchors} storeEnabled={storeEnabled} />
      </Card>

      <Card title="Rodapé">
        <TextArea label="Frase do rodapé" value={m.footer.tagline} maxLength={300} rows={2} onChange={(v) => setFooter({ tagline: v })} />
        <TextInput label="Direitos de autor" value={m.footer.copyright} maxLength={160} onChange={(v) => setFooter({ copyright: v })} />
        <Toggle label="Mostrar ícones das redes sociais" checked={m.footer.showSocial} onChange={(v) => setFooter({ showSocial: v })} />
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Links adicionais no rodapé</p>
          {m.footer.links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex-1">
                <LinkEditor
                  label={`Link ${i + 1}`}
                  value={link}
                  onChange={(v) => setFooter({ links: m.footer.links.map((x, j) => (j === i ? v : x)) })}
                  anchors={anchors}
                  storeEnabled={storeEnabled}
                />
              </div>
              <div className="flex flex-col gap-1 pt-2">
                <Button size="sm" variant="ghost" aria-label="Mover para cima" onClick={() => moveLink(i, -1)} disabled={i === 0}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Mover para baixo" onClick={() => moveLink(i, 1)} disabled={i === m.footer.links.length - 1}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Remover link" onClick={() => setFooter({ links: m.footer.links.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {m.footer.links.length < 8 && (
            <Button size="sm" onClick={() => setFooter({ links: [...m.footer.links, emptyLink({ enabled: true, type: "external", style: "ghost" })] })}>
              <Plus className="size-3.5" /> Adicionar link
            </Button>
          )}
        </div>
      </Card>

      <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
    </div>
  );
}

/* ------------------------------ Definições do site ------------------------------ */

export function SiteSettingsEditor({ value }: { value: SiteDocument["settings"] }) {
  const editor = useDraftEditor(value, (v, r) => saveDraftPart("settings", v, r));
  return (
    <div>
      <Card title="Website">
        <TextInput
          label="Nome do website"
          value={editor.value.siteName}
          maxLength={80}
          onChange={(v) => editor.update((cur) => ({ ...cur, siteName: v }))}
          required
        />
      </Card>
      <SaveBar dirty={editor.dirty} pending={editor.pending} saved={editor.saved} error={editor.error} onSave={editor.submit} />
    </div>
  );
}
