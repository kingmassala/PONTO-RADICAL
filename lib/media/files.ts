import "server-only";
import { imageSize } from "image-size";

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB (limite do plano gratuito do Supabase)

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
} as const;
export const VIDEO_TYPES = { "video/mp4": "mp4", "video/webm": "webm" } as const;

export type ImageMime = keyof typeof IMAGE_TYPES;

/** Identifica o tipo real do ficheiro pelos primeiros bytes (não confia na extensão). */
export function detectImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 2048)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

export function detectVideoType(bytes: Uint8Array): keyof typeof VIDEO_TYPES | null {
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") return "video/mp4";
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)
    return "video/webm";
  return null;
}

/**
 * SVG pode conter código executável. Rejeitamos qualquer SVG com scripts,
 * handlers de eventos, foreignObject, referências externas ou entidades.
 */
export function svgIsSafe(svg: string): boolean {
  const s = svg.toLowerCase();
  const forbidden = [
    /<script/,
    /\son[a-z]+\s*=/,
    /javascript:/,
    /<foreignobject/,
    /<!entity/,
    /<!doctype/,
    /<iframe/,
    /<embed/,
    /<object/,
    /(xlink:)?href\s*=\s*["']\s*(?!#)(https?:|\/\/|data:)/,
    /@import/,
  ];
  return !forbidden.some((re) => re.test(s));
}

export function readDimensions(bytes: Uint8Array): { width: number | null; height: number | null } {
  try {
    const { width, height } = imageSize(bytes);
    return { width: width ?? null, height: height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

export function safeFolder(folder: unknown): string {
  const value = typeof folder === "string" ? folder : "";
  const cleaned = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "geral";
}

export function buildPath(folder: string, ext: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${folder}/${month}/${crypto.randomUUID()}.${ext}`;
}
