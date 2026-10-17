import type { CSSProperties } from "react";
import type { Appearance } from "./schema";
import { HEX_COLOR } from "./schema";

/** Combinações de tipografia disponíveis em «Aparência». */
export const FONT_PAIRING_OPTIONS: Record<Appearance["fontPairing"], { label: string; heading: string; body: string; description: string }> = {
  radical: {
    label: "Radical",
    heading: "var(--font-unbounded)",
    body: "var(--font-hanken)",
    description: "Unbounded + Hanken Grotesk · expansiva, ousada e divertida",
  },
  vibrante: {
    label: "Vibrante",
    heading: "var(--font-bricolage)",
    body: "var(--font-hanken)",
    description: "Bricolage Grotesque + Hanken Grotesk · moderna com personalidade",
  },
  editorial: {
    label: "Editorial",
    heading: "var(--font-fraunces)",
    body: "var(--font-inter)",
    description: "Fraunces + Inter · elegante e contemporânea",
  },
  moderno: {
    label: "Moderno",
    heading: "var(--font-manrope)",
    body: "var(--font-inter)",
    description: "Manrope + Inter · limpa e corporativa",
  },
  tecnico: {
    label: "Técnico",
    heading: "var(--font-barlow-condensed)",
    body: "var(--font-barlow)",
    description: "Barlow Condensed + Barlow · desportiva e marítima",
  },
  classico: {
    label: "Clássico",
    heading: "var(--font-cormorant)",
    body: "var(--font-manrope)",
    description: "Cormorant Garamond + Manrope · sofisticada",
  },
};

const TRACKING = { tight: "-0.035em", normal: "-0.01em", wide: "0.04em" } as const;
const SCALE = { compact: "0.85", standard: "1", dramatic: "1.18" } as const;
const RADIUS = { square: "0px", rounded: "10px", pill: "999px" } as const;

function color(value: string, fallback: string) {
  return HEX_COLOR.test(value) ? value : fallback;
}

/** Paleta usada no modo «Preto e branco» (substitui as cores configuradas). */
export const MONOCHROME_COLORS: Appearance["colors"] = {
  primary: "#111111",
  secondary: "#3A3A3A",
  accent: "#0A0A0A",
  background: "#FFFFFF",
  surface: "#EFEFEF",
  text: "#0A0A0A",
  dark: "#000000",
};

/** Converte a configuração visual em variáveis CSS (design tokens). */
export function themeStyle(appearance: Appearance): CSSProperties {
  const c = appearance.monochrome ? MONOCHROME_COLORS : appearance.colors;
  const fonts = FONT_PAIRING_OPTIONS[appearance.fontPairing] ?? FONT_PAIRING_OPTIONS.radical;
  return {
    "--pr-primary": color(c.primary, "#0E3B52"),
    "--pr-secondary": color(c.secondary, "#1F7A8C"),
    "--pr-accent": color(c.accent, "#F26B1D"),
    "--pr-background": color(c.background, "#F7F5F0"),
    "--pr-surface": color(c.surface, "#ECE8DF"),
    "--pr-text": color(c.text, "#0F1B24"),
    "--pr-dark": color(c.dark, "#07141C"),
    "--pr-font-heading": fonts.heading,
    "--pr-font-body": fonts.body,
    "--pr-heading-transform": appearance.headings.uppercase ? "uppercase" : "none",
    "--pr-heading-weight": appearance.headings.weight,
    "--pr-heading-tracking": TRACKING[appearance.headings.tracking],
    "--pr-heading-scale": SCALE[appearance.headings.scale],
    "--pr-radius": RADIUS[appearance.buttons.shape],
    "--pr-button-transform": appearance.buttons.uppercase ? "uppercase" : "none",
  } as CSSProperties;
}
