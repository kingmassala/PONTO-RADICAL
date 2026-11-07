import type { Metadata, Viewport } from "next";

const SHARE = {
  title: "Ponto Radical · Gestão de Obras",
  description: "Plataforma de gestão de obras, reparação e manutenção naval da Ponto Radical.",
  image: { url: "/brand/og-gestao.png", width: 1200, height: 630, alt: "Ponto Radical · Gestão de Obras" },
};

export const metadata: Metadata = {
  // Links absolutos para a imagem de partilha (o subdomínio reescreve os caminhos para /gestao).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ponto-radical.vercel.app"),
  title: { default: "Gestão de Obras", template: "%s · Gestão de Obras · Ponto Radical" },
  description: SHARE.description,
  openGraph: { type: "website", siteName: "Ponto Radical", locale: "pt_PT", title: SHARE.title, description: SHARE.description, images: [SHARE.image] },
  twitter: { card: "summary_large_image", title: SHARE.title, description: SHARE.description, images: [SHARE.image.url] },
  robots: { index: false, follow: false },
  manifest: "/gestao/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PR Obras", statusBarStyle: "black" },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function GestaoRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-100 font-sans text-slate-900 antialiased">{children}</div>;
}
