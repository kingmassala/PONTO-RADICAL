import { NextResponse } from "next/server";

/** Manifesto da aplicação instalável (PWA) da Gestão de Obras. */
export function GET() {
  return NextResponse.json(
    {
      name: "Ponto Radical · Gestão de Obras",
      short_name: "PR Obras",
      description: "Gestão de obras, reparação e manutenção naval.",
      lang: "pt-PT",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#000000",
      theme_color: "#000000",
      icons: [
        { src: "/brand/ponto-radical-mark-white.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } },
  );
}
