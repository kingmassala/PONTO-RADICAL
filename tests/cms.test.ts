/**
 * Testes da lógica do CMS: esquema, validação de links/âncoras, Loja Online,
 * limpeza de HTML (XSS) e validação de ficheiros.
 *
 * Executar: npm run test:cms
 */
import assert from "node:assert/strict";
import { siteDocumentSchema, type SiteDocument } from "../lib/cms/schema";
import { SEED_CONTENT } from "../lib/cms/seed-content";
import { sanitizeDocument, sanitizeRichText } from "../lib/cms/sanitize";
import { checkDocument, hasErrors, isStoreActive } from "../lib/cms/validate";
import { SECTION_TEMPLATES, uniqueAnchor } from "../lib/cms/templates";
import { navItems, resolveLink, storeLink } from "../components/site/links";
import { detectImageType, svgIsSafe } from "../lib/media/files";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}
const clone = (): SiteDocument => structuredClone(SEED_CONTENT);

console.log("CMS");

test("conteúdo inicial é válido e sem erros", () => {
  const doc = siteDocumentSchema.parse(SEED_CONTENT);
  assert.equal(hasErrors(checkDocument(doc)), false, JSON.stringify(checkDocument(doc).filter((i) => i.level === "error")));
});

test("Loja Online desactivada por omissão e oculta no website", () => {
  const doc = clone();
  assert.equal(doc.store.enabled, false);
  assert.equal(doc.store.url, null);
  assert.equal(isStoreActive(doc), false);
  assert.equal(storeLink(doc), null);
  assert.equal(resolveLink({ enabled: true, label: "Loja", type: "store", anchor: "", url: "", newTab: true, style: "primary" }, doc), null);
});

test("Loja Online activa com URL válido mostra o botão", () => {
  const doc = clone();
  doc.store = { ...doc.store, enabled: true, url: "https://loja.exemplo.com" };
  assert.equal(isStoreActive(doc), true);
  assert.equal(storeLink(doc)?.href, "https://loja.exemplo.com");
});

test("Loja activa sem URL é erro que impede publicação", () => {
  const doc = clone();
  doc.store.enabled = true;
  assert.ok(checkDocument(doc).some((i) => i.level === "error" && i.href === "/admin/loja"));
});

test("URL da loja inválido ou não https é rejeitado pelo esquema", () => {
  for (const url of ["http://loja.exemplo.com", "javascript:alert(1)", "loja"]) {
    const doc = clone();
    doc.store.url = url;
    assert.equal(siteDocumentSchema.safeParse(doc).success, false, url);
  }
});

test("botão para secção inexistente é erro; secção oculta esconde o botão", () => {
  const doc = clone();
  const hero = doc.sections[0];
  if (hero.type !== "hero") throw new Error("hero esperado");
  hero.primaryButton.anchor = "nao-existe";
  assert.ok(checkDocument(doc).some((i) => i.level === "error" && i.message.includes("nao-existe")));

  const doc2 = clone();
  doc2.sections.find((s) => s.anchor === "marcas")!.visible = false;
  const hero2 = doc2.sections[0];
  if (hero2.type !== "hero") throw new Error();
  assert.equal(resolveLink(hero2.primaryButton, doc2), null);
  assert.ok(!navItems(doc2).some((n) => n.href === "#marcas"));
});

test("âncoras repetidas são erro", () => {
  const doc = clone();
  doc.sections[1].anchor = doc.sections[2].anchor;
  assert.ok(checkDocument(doc).some((i) => i.level === "error" && i.message.includes("mais de uma secção")));
});

test("links javascript: são rejeitados", () => {
  const doc = clone();
  doc.navigation.ctaButton = { ...doc.navigation.ctaButton, type: "external", url: "javascript:alert(1)" };
  assert.equal(siteDocumentSchema.safeParse(doc).success, false);
  const doc2 = clone();
  doc2.brands[0].externalUrl = "javascript:alert(1)";
  assert.equal(siteDocumentSchema.safeParse(doc2).success, false);
});

test("cores só em formato hexadecimal (sem injecção de CSS)", () => {
  const doc = clone();
  doc.appearance.colors.primary = "red;} body{display:none";
  assert.equal(siteDocumentSchema.safeParse(doc).success, false);
});

test("texto rico: remove scripts, eventos e protocolos perigosos", () => {
  const dirty = `<p onclick="x()">Olá <script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">mau</a> <a href="https://garmin.com">bom</a></p><iframe src="https://evil"></iframe><style>*{}</style>`;
  const clean = sanitizeRichText(dirty);
  assert.ok(!/script|onerror|onclick|iframe|style|javascript:|<img/i.test(clean), clean);
  assert.ok(clean.includes('href="https://garmin.com"'));
  assert.ok(clean.includes('rel="noopener noreferrer"'));
});

test("sanitizeDocument limpa descrições de marcas e textos de secções", () => {
  const doc = clone();
  doc.brands[0].description = "<p>ok</p><script>alert(1)</script>";
  const split = doc.sections.find((s) => s.type === "split");
  if (split?.type !== "split") throw new Error();
  split.body = '<p onmouseover="x">texto</p>';
  const clean = sanitizeDocument(doc);
  assert.equal(clean.brands[0].description, "<p>ok</p>");
  const cleanSplit = clean.sections.find((s) => s.type === "split");
  assert.equal(cleanSplit?.type === "split" && cleanSplit.body, "<p>texto</p>");
});

test("todos os modelos de secção geram secções válidas", () => {
  const doc = clone();
  for (const t of SECTION_TEMPLATES) {
    doc.sections.push(t.create({ id: `t-${t.key}`, anchor: uniqueAnchor(t.anchor, doc.sections.map((s) => s.anchor)) }));
  }
  const parsed = siteDocumentSchema.safeParse(doc);
  assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3)));
  assert.equal(new Set(doc.sections.map((s) => s.anchor)).size, doc.sections.length, "âncoras únicas");
});

test("uniqueAnchor normaliza acentos e evita duplicados", () => {
  assert.equal(uniqueAnchor("Soluções Náuticas", []), "solucoes-nauticas");
  assert.equal(uniqueAnchor("marcas", ["marcas", "marcas-2"]), "marcas-3");
});

test("detecção de tipo de imagem pelos bytes (não pela extensão)", () => {
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(detectImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), "image/svg+xml");
  assert.equal(detectImageType(new TextEncoder().encode("<html><script>")), null);
  assert.equal(detectImageType(new TextEncoder().encode("MZ executável")), null);
});

test("SVG com código ou referências externas é rejeitado", () => {
  assert.equal(svgIsSafe('<svg><rect width="1" height="1"/></svg>'), true);
  assert.equal(svgIsSafe('<svg><use href="#a"/></svg>'), true);
  for (const bad of [
    "<svg><script>alert(1)</script></svg>",
    '<svg onload="alert(1)"></svg>',
    '<svg><a href="javascript:alert(1)">x</a></svg>',
    "<svg><foreignObject><iframe/></foreignObject></svg>",
    '<svg><image href="https://evil.example/x.png"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>',
  ]) {
    assert.equal(svgIsSafe(bad), false, bad);
  }
});

console.log(`\n${passed} testes passaram.`);
