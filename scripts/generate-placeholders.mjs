// Gera ilustrações provisórias (SVG) para o conteúdo inicial.
// Devem ser substituídas por fotografias reais na Biblioteca Multimédia.
import { writeFileSync } from "node:fs";

const W = 1600, H = 1000;
function waves(y, color, amp, count, opacity) {
  let d = `M0 ${y}`;
  const step = W / count;
  for (let i = 0; i < count; i++) {
    const x = i * step;
    d += ` Q ${x + step / 4} ${y - amp} ${x + step / 2} ${y} T ${x + step} ${y}`;
  }
  d += ` L ${W} ${H} L 0 ${H} Z`;
  return `<path d="${d}" fill="${color}" opacity="${opacity}"/>`;
}
function scene({ sky, sun, sea, extra = "" }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${sun}" stop-opacity="1"/><stop offset="1" stop-color="${sun}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="${W * 0.68}" cy="${H * 0.52}" r="260" fill="url(#sun)" opacity="0.85"/>
<circle cx="${W * 0.68}" cy="${H * 0.52}" r="70" fill="${sun}" opacity="0.9"/>
${waves(H * 0.58, sea[0], 6, 18, 1)}
${waves(H * 0.66, sea[1], 10, 12, 0.9)}
${waves(H * 0.78, sea[2], 16, 8, 0.9)}
${waves(H * 0.9, sea[3], 22, 6, 0.95)}
${extra}
</svg>`;
}
const boat = (x, y, s, c) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><path d="M-120 0 L120 0 L90 34 L-100 34 Z"/><rect x="-40" y="-36" width="70" height="36" rx="4"/><rect x="-5" y="-90" width="5" height="56"/></g>`;
const kite = (x, y, c) =>
  `<g transform="translate(${x} ${y})"><path d="M-150 0 Q 0 -90 150 0 Q 0 -40 -150 0 Z" fill="${c}"/><path d="M-150 0 L 40 330 M150 0 L 40 330" stroke="#0b1a24" stroke-width="2" opacity="0.6"/><g transform="translate(40 330)" fill="#0b1a24"><circle cx="0" cy="-26" r="9"/><path d="M-6 -16 L6 -16 L10 14 L-10 14 Z"/><path d="M-50 22 L50 22 L46 30 L-46 30 Z"/></g></g>`;

const files = {
  "hero.svg": scene({ sky: ["#0b2233", "#c9744a"], sun: "#ffc48a", sea: ["#24485c", "#1a3a4d", "#12303f", "#0b2230"], extra: boat(420, 610, 0.9, "#0a1720") }),
  "sobre.svg": scene({ sky: ["#9cc7d6", "#f0e3cf"], sun: "#fff3d6", sea: ["#5e95a8", "#3f7a90", "#2c6378", "#1f4c5e"], extra: boat(800, 640, 1.6, "#f7f5f0") + `<rect x="0" y="760" width="${W}" height="40" fill="#5b4636"/><g fill="#4a3829">${Array.from({ length: 9 }, (_, i) => `<rect x="${60 + i * 190}" y="760" width="22" height="240"/>`).join("")}</g>` }),
  "aventura.svg": scene({ sky: ["#1f7a8c", "#bfe3e6"], sun: "#ffffff", sea: ["#2f8fa0", "#1f7a8c", "#17647a", "#0e4b5e"], extra: kite(560, 230, "#f26b1d") }),
  "brand-garmin.svg": scene({ sky: ["#06121a", "#1c3b4f"], sun: "#7fd3e8", sea: ["#123345", "#0e2a3a", "#0a2130", "#061823"], extra: `<g transform="translate(560 300)" fill="none" stroke="#7fd3e8" stroke-width="3" opacity="0.7"><circle r="80"/><circle r="160"/><circle r="240"/><path d="M0 0 L 230 -70"/></g>` }),
  "brand-seadog.svg": scene({ sky: ["#c7d2d8", "#eef1f2"], sun: "#ffffff", sea: ["#8aa3b0", "#6f8b99", "#56717f", "#3f5865"], extra: `<g transform="translate(800 470)" fill="#dfe5e8" stroke="#8796a0" stroke-width="6"><path d="M-260 0 L260 0 L230 40 L-230 40 Z"/><rect x="-60" y="-70" width="120" height="70" rx="30"/></g>` }),
  "brand-starbrite.svg": scene({ sky: ["#0e3b52", "#5aa6c0"], sun: "#ffffff", sea: ["#2a7f9c", "#1d6a86", "#145670", "#0c445a"], extra: `<g fill="#ffffff" opacity="0.85">${Array.from({ length: 14 }, (_, i) => `<circle cx="${120 + i * 105}" cy="${150 + ((i * 53) % 160)}" r="${3 + (i % 3)}"/>`).join("")}</g>` + boat(900, 600, 1.4, "#ffffff") }),
  "brand-rule.svg": scene({ sky: ["#24323a", "#6c7f87"], sun: "#ffd27a", sea: ["#3b5560", "#2f4852", "#243b44", "#192d35"], extra: `<g transform="translate(560 520)" fill="#f26b1d"><rect x="-70" y="-120" width="140" height="160" rx="22"/><rect x="-14" y="-170" width="28" height="60" rx="6" fill="#d8dee1"/></g>` }),
  "brand-duotone.svg": scene({ sky: ["#ff9b54", "#ffe0b8"], sun: "#fff6e0", sea: ["#3aa5b5", "#2a8fa0", "#1f7a8c", "#13606f"], extra: kite(520, 200, "#0e3b52") }),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(new URL(`../public/seed/${name}`, import.meta.url), svg);
console.log("Gerados:", Object.keys(files).join(", "));
