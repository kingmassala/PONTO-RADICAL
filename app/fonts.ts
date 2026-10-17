import {
  Barlow,
  Barlow_Condensed,
  Bricolage_Grotesque,
  Cormorant_Garamond,
  Fraunces,
  Hanken_Grotesk,
  Inter,
  Instrument_Serif,
  Jost,
  Manrope,
  Unbounded,
} from "next/font/google";

// Combinação principal «Radical»: carregada de imediato.
export const unbounded = Unbounded({ subsets: ["latin"], weight: ["400", "500", "700", "800", "900"], variable: "--font-unbounded", display: "swap" });
export const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

// Combinação «Geométrico» (próxima do texto do logótipo): carregada de imediato.
export const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap" });

// Painel de administração.
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Combinações alternativas (só descarregadas se escolhidas em «Aparência»).
export const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap", preload: false });
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", preload: false });
export const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });
export const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow", display: "swap", preload: false });
export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-barlow-condensed",
  display: "swap",
  preload: false,
});
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
  preload: false,
});

export const fontVariables = [unbounded, hanken, instrumentSerif, jost, inter, bricolage, fraunces, manrope, barlow, barlowCondensed, cormorant]
  .map((f) => f.variable)
  .join(" ");
