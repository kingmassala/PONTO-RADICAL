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
import { plainText, tokenizeTitle } from "../lib/cms/text";
import { collectImages } from "../lib/cms/validate";
import { bookingWindow, formatDuration, formatPeople, formatPrice, todayIso, validateBooking, FLEXIBLE_SLOT } from "../lib/booking/rules";
import { collectTexts, localizeDoc } from "../lib/i18n/content";
import { translateServerMessage } from "../lib/i18n/messages";

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

const storeButton = { enabled: true, label: "Loja", type: "store", anchor: "", url: "", newTab: true, style: "primary" } as const;

test("Loja sem link: botões encaminham para os contactos (ou ocultos se assim configurado)", () => {
  const doc = clone();
  assert.equal(doc.store.enabled, false);
  assert.equal(doc.store.url, null);
  assert.equal(isStoreActive(doc), false);
  assert.equal(storeLink(doc)?.href, "#contactos");
  assert.equal(resolveLink(storeButton, doc)?.href, "#contactos");

  doc.contact.whatsapp = "+244 923 000 000";
  assert.ok(storeLink(doc)?.href.startsWith("https://wa.me/244923000000?text="));

  doc.store.whenNoLink = "hide";
  assert.equal(storeLink(doc), null);
  assert.equal(resolveLink(storeButton, doc), null);
});

test("documento antigo sem as opções novas da loja continua válido", () => {
  const doc = clone() as unknown as { store: Record<string, unknown> };
  for (const key of ["whenNoLink", "showInBrands", "brandsTitle", "brandsText"]) delete doc.store[key];
  const parsed = siteDocumentSchema.parse(doc);
  assert.equal(parsed.store.whenNoLink, "contact");
  assert.equal(parsed.store.showInBrands, true);
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
  doc2.sections.find((s) => s.anchor === "experiencias")!.visible = false;
  const hero2 = doc2.sections[0];
  if (hero2.type !== "hero") throw new Error();
  assert.equal(resolveLink(hero2.primaryButton, doc2), null);
  assert.ok(!navItems(doc2).some((n) => n.href === "#experiencias"));
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

test("destaque *palavra* nos títulos: espaços e pontuação correctos", () => {
  const render = (t: string) =>
    tokenizeTitle(t)
      .map((x) => (x.glued ? "" : " ") + (x.accent ? `[${x.word}]` : x.word))
      .join("")
      .trim();
  assert.equal(render("Referências *mundiais*, agora mais perto."), "Referências [mundiais], agora mais perto.");
  assert.equal(render("Com as *marcas certas*."), "Com as [marcas] [certas].");
  assert.equal(render("*Olá* mundo"), "[Olá] mundo");
  assert.equal(render("Sem destaque"), "Sem destaque");
  assert.equal(plainText("A *vida* no mar"), "A vida no mar");
});

test("títulos em chinês: sem espaços, com quebra de linha entre caracteres", () => {
  const tokens = tokenizeTitle("一起*畅享*大海。");
  assert.deepEqual(
    tokens.map((x) => x.word),
    ["一", "起", "畅", "享", "大", "海", "。"],
  );
  // Caracteres chineses: sem espaço mas quebráveis; a pontuação fica colada (não começa linha).
  assert.ok(tokens.slice(1, 6).every((x) => x.joined && !x.glued));
  assert.equal(tokens.at(-1)?.glued, true);
  assert.deepEqual(
    tokens.filter((x) => x.accent).map((x) => x.word),
    ["畅", "享"],
  );
});

test("faixa de texto em movimento e efeitos têm valores por omissão válidos", () => {
  const doc = clone();
  const { effects, ...appearanceWithoutEffects } = doc.appearance;
  void effects;
  const parsed = siteDocumentSchema.parse({ ...doc, appearance: appearanceWithoutEffects });
  assert.deepEqual(parsed.appearance.effects, { customCursor: true, grain: true, animations: true });
  const marquee = doc.sections.find((s) => s.type === "marquee");
  assert.ok(marquee, "seed inclui uma faixa de texto em movimento");
  const empty = clone();
  const m = empty.sections.find((s) => s.type === "marquee");
  if (m?.type !== "marquee") throw new Error();
  m.items = [];
  assert.equal(siteDocumentSchema.safeParse(empty).success, false, "faixa sem palavras é inválida");
});

/* ------------------------- Serviços e reservas ------------------------- */

// Sexta-feira, 16 de Outubro de 2026, 11h00 em Luanda.
const NOW = new Date("2026-10-16T10:00:00Z");
const request = (overrides: Record<string, unknown> = {}) => ({
  serviceId: "srv-por-do-sol",
  date: "2026-10-17", // sábado
  slot: "17:00",
  people: "4",
  name: "Ana Silva",
  email: "ana@example.com",
  phone: "+244 923 000 000",
  notes: "",
  ...overrides,
});

test("seed inclui serviços reserváveis válidos e a secção de experiências", () => {
  const doc = clone();
  assert.ok(doc.services.length >= 4);
  for (const name of ["pôr-do-sol", "Pesca", "kitesurf", "ilha"]) {
    assert.ok(doc.services.some((s) => s.name.toLowerCase().includes(name.toLowerCase())), name);
  }
  assert.equal(new Set(doc.services.map((s) => s.slug)).size, doc.services.length, "endereços únicos");
  assert.ok(doc.services.every((s) => doc.serviceCategories.some((c) => c.id === s.categoryId)));
  const section = doc.sections.find((s) => s.type === "services");
  assert.ok(section?.visible && section.showInNav, "secção visível e no menu");
  assert.equal(doc.navigation.ctaButton.anchor, "experiencias");
});

test("documentos antigos (sem serviços) continuam válidos, com valores por omissão", () => {
  const { services, serviceCategories, booking, ...old } = clone();
  void services;
  void serviceCategories;
  void booking;
  const parsed = siteDocumentSchema.parse(old);
  assert.deepEqual(parsed.services, []);
  assert.ok(parsed.serviceCategories.length >= 2);
  assert.equal(parsed.booking.enabled, true);
});

test("serviços: endereço repetido, categoria inexistente e capacidade incoerente são erros", () => {
  const doc = clone();
  doc.services[1].slug = doc.services[0].slug;
  doc.services[2].categoryId = "nao-existe";
  doc.services[3].minPeople = 20;
  const errors = checkDocument(doc).filter((i) => i.level === "error").map((i) => i.message);
  assert.ok(errors.some((m) => m.includes("mais de um serviço")), "slug");
  assert.ok(errors.some((m) => m.includes("categoria escolhida já não existe")), "categoria");
  assert.ok(errors.some((m) => m.includes("mínimo de pessoas")), "capacidade");
});

test("serviços: horários HH:MM, preço não negativo e descrição limpa", () => {
  const doc = clone();
  doc.services[0].timeSlots = ["25:00"];
  assert.equal(siteDocumentSchema.safeParse(doc).success, false, "hora inválida");
  const doc2 = clone();
  doc2.services[0].priceFrom = -1;
  assert.equal(siteDocumentSchema.safeParse(doc2).success, false, "preço negativo");
  const doc3 = clone();
  doc3.services[0].description = '<p>ok</p><img src=x onerror="alert(1)"><script>x</script>';
  assert.equal(sanitizeDocument(doc3).services[0].description, "<p>ok</p>");
  assert.ok(collectImages(clone()).some((i) => i.where.startsWith("Serviço")), "fotografias dos serviços verificadas");
});

test("pedido de reserva válido é aceite", () => {
  const r = validateBooking(clone(), request(), NOW);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.fieldErrors));
  assert.equal(r.ok && r.data.people, 4);
  assert.equal(r.ok && r.data.service.name, "Passeio de barco ao pôr-do-sol");
});

test("pedido de reserva: datas fora da janela ou em dias sem saídas são rejeitadas", () => {
  const doc = clone();
  assert.equal(todayIso(NOW), "2026-10-16");
  assert.deepEqual(bookingWindow(doc.booking, NOW), { first: "2026-10-17", last: "2027-04-14" });
  const cases: [string, RegExp][] = [
    ["2026-10-16", /antecedência/], // hoje, com 1 dia de antecedência mínima
    ["2026-10-10", /antecedência/],
    ["2026-10-19", /dia da semana/], // segunda-feira
    ["2027-06-01", /ainda não está aberta/],
    ["2026-02-30", /Escolha uma data/],
    ["", /Escolha uma data/],
  ];
  for (const [date, pattern] of cases) {
    const r = validateBooking(doc, request({ date }), NOW);
    assert.ok(!r.ok && pattern.test(r.fieldErrors.date ?? ""), `${date}: ${JSON.stringify(!r.ok && r.fieldErrors)}`);
  }
});

test("pedido de reserva: horário, número de pessoas e contactos validados", () => {
  const doc = clone();
  const slot = validateBooking(doc, request({ slot: "09:00" }), NOW);
  assert.ok(!slot.ok && slot.fieldErrors.slot);
  for (const people of ["1", "11", "2.5", "abc"]) {
    const r = validateBooking(doc, request({ people }), NOW);
    assert.ok(!r.ok && r.fieldErrors.people, people);
  }
  const contact = validateBooking(doc, request({ email: "nao-email", phone: "<script>", name: "A" }), NOW);
  assert.ok(!contact.ok && contact.fieldErrors.email && contact.fieldErrors.phone && contact.fieldErrors.name);
});

test("pedido de reserva: serviço oculto, sem reservas ou reservas desligadas são recusados", () => {
  for (const change of [
    (d: SiteDocument) => (d.services[0].visible = false),
    (d: SiteDocument) => (d.services[0].bookable = false),
    (d: SiteDocument) => (d.booking.enabled = false),
  ]) {
    const doc = clone();
    change(doc);
    const r = validateBooking(doc, request(), NOW);
    assert.ok(!r.ok && r.fieldErrors.serviceId);
  }
  const r = validateBooking(clone(), request({ serviceId: "nao-existe" }), NOW);
  assert.ok(!r.ok && r.fieldErrors.serviceId);
});

test("pedido de reserva: serviço sem horários aceita «A combinar»; todos os dias sem restrição", () => {
  const doc = clone();
  doc.services[0].timeSlots = [];
  doc.services[0].weekdays = [];
  const r = validateBooking(doc, request({ slot: FLEXIBLE_SLOT, date: "2026-10-19" }), NOW);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.fieldErrors));
});

test("formatação de duração e preço", () => {
  assert.equal(formatDuration(0), null);
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(150), "2 h 30 min");
  assert.equal(formatDuration(1440), "1 dia");
  assert.equal(formatPrice({ priceFrom: null, priceUnit: "pessoa" }), null);
  assert.match(formatPrice({ priceFrom: 35000, priceUnit: "pessoa" }) ?? "", /^35\s000 Kz \/ pessoa$/);
});

test("traduções: chaves estáveis por id, aplicadas por língua e nomes de marcas excluídos", () => {
  const doc = clone();
  const entries = collectTexts(doc);
  const hero = doc.sections[0];
  const titleKey = `sections.${hero.id}.title`;
  assert.ok(entries.some((e) => e.key === titleKey));
  assert.ok(!entries.some((e) => e.key.startsWith("brands.") && e.key.endsWith(".name")), "nomes das marcas não se traduzem");
  assert.ok(entries.some((e) => e.rich), "há campos de texto rico");

  doc.translations.en[titleKey] = "Gear up on land.";
  // Reordenar as secções não altera as chaves.
  doc.sections.reverse();
  const titleOf = (d: SiteDocument) => {
    const s = d.sections.find((x) => x.id === hero.id);
    return s && "title" in s ? s.title : undefined;
  };
  const original = titleOf(doc);
  assert.equal(titleOf(localizeDoc(doc, "en")), "Gear up on land.");
  // As outras línguas e o original ficam intactos.
  assert.equal(titleOf(localizeDoc(doc, "pt")), original);
  assert.equal(titleOf(localizeDoc(doc, "fr")), original);
  assert.equal(titleOf(doc), original);
});

test("documento antigo sem traduções continua válido", () => {
  const doc = clone() as unknown as Record<string, unknown>;
  delete doc.translations;
  assert.deepEqual(siteDocumentSchema.parse(doc).translations, { es: {}, fr: {}, en: {}, ru: {}, zh: {} });
});

test("formatação e mensagens do servidor na língua do visitante", () => {
  assert.equal(formatPeople({ minPeople: 2, maxPeople: 8 }, "en"), "2–8 people");
  assert.match(formatPrice({ priceFrom: 35000, priceUnit: "grupo" }, "fr") ?? "", /Kz \/ groupe$/);
  assert.equal(translateServerMessage("es", "Indique o seu nome."), "Indique su nombre.");
  assert.equal(translateServerMessage("en", "Entre 2 e 8 pessoas por reserva."), "Between 2 and 8 people per booking.");
  assert.equal(translateServerMessage("pt", "Indique o seu nome."), "Indique o seu nome.");
});

console.log(`\n${passed} testes passaram.`);
