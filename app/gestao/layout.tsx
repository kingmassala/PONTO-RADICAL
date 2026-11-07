import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Gestão de Obras", template: "%s · Gestão de Obras · Ponto Radical" },
  description: "Plataforma de gestão de obras, reparação e manutenção naval da Ponto Radical.",
  robots: { index: false, follow: false },
  manifest: "/gestao/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PR Obras", statusBarStyle: "black" },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function GestaoRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-100 font-sans text-slate-900 antialiased">{children}</div>;
}
