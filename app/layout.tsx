import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ponto Radical",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // O script do ecrã de entrada marca o <html> (data-pr-locale) antes da hidratação.
    <html lang="pt-PT" className={fontVariables} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
