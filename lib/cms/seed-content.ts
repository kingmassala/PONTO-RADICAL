import type { SiteDocument } from "./schema";
import { emptyLink, emptyMedia } from "./templates";

/**
 * Conteúdo inicial do website. É usado APENAS para:
 *  1. gerar supabase/seed.sql (npm run db:seed-sql) e o script npm run db:seed;
 *  2. mostrar o website em desenvolvimento quando o Supabase ainda não está configurado.
 * Depois de configurado, a base de dados é a única fonte de verdade.
 *
 * Contactos marcados com «a confirmar» devem ser substituídos no painel.
 */
export const SEED_CONTENT: SiteDocument = {
  schemaVersion: 1,
  settings: { siteName: "Ponto Radical", language: "pt-PT" },
  appearance: {
    colors: {
      primary: "#0E3B52",
      secondary: "#1F7A8C",
      accent: "#F26B1D",
      background: "#F7F5F0",
      surface: "#ECE8DF",
      text: "#0F1B24",
      dark: "#07141C",
    },
    fontPairing: "tecnico",
    headings: { uppercase: true, weight: "600", tracking: "normal", scale: "standard" },
    buttons: { shape: "pill", uppercase: true },
  },
  navigation: {
    logo: emptyMedia(),
    logoText: "Ponto Radical",
    headerStyle: "transparent",
    ctaButton: { ...emptyLink(), enabled: true, label: "Contactar", type: "anchor", anchor: "contactos" },
  },
  sections: [
    {
      id: "sec-hero",
      type: "hero",
      anchor: "inicio",
      visible: true,
      showInNav: false,
      navLabel: "Início",
      background: "dark",
      eyebrow: "Náutica · Navegação · Aventura",
      title: "Equipamento de confiança para quem vive o mar.",
      subtitle:
        "A Ponto Radical representa em Angola marcas internacionais de referência em electrónica marítima, equipamento de embarcações e desportos de vento.",
      mediaKind: "image",
      image: { url: "/seed/hero.svg", alt: "Linha do horizonte sobre o oceano ao entardecer", mediaId: null },
      videoUrl: "",
      overlayColor: "dark",
      overlayOpacity: 35,
      align: "left",
      height: "full",
      primaryButton: { ...emptyLink(), enabled: true, label: "Descobrir as marcas", anchor: "marcas" },
      secondaryButton: { ...emptyLink(), enabled: true, label: "Fale connosco", anchor: "contactos", style: "secondary" },
    },
    {
      id: "sec-sobre",
      type: "split",
      anchor: "sobre",
      visible: true,
      showInNav: true,
      navLabel: "Sobre",
      background: "light",
      imagePosition: "right",
      eyebrow: "Sobre a Ponto Radical",
      title: "Do cais ao alto mar, com as marcas certas.",
      body:
        "<p>A Ponto Radical nasceu da paixão pelo mar e pela aventura. Reunimos num só ponto as soluções de que navegadores, pescadores, operadores marítimos e praticantes de desportos de vento precisam.</p><p>Trabalhamos com fabricantes reconhecidos internacionalmente e acompanhamos cada cliente na escolha, instalação e manutenção do equipamento, com <strong>aconselhamento técnico especializado</strong>.</p>",
      image: { url: "/seed/sobre.svg", alt: "Embarcação atracada num cais", mediaId: null },
      stats: [
        { value: "5", label: "marcas internacionais representadas" },
        { value: "360°", label: "do equipamento à manutenção" },
      ],
      button: { ...emptyLink(), enabled: true, label: "Ver soluções", anchor: "solucoes", style: "secondary" },
    },
    {
      id: "sec-marcas",
      type: "brands",
      anchor: "marcas",
      visible: true,
      showInNav: true,
      navLabel: "Marcas",
      background: "dark",
      eyebrow: "Marcas representadas",
      title: "Referências mundiais, agora mais perto.",
      intro:
        "Seleccionamos marcas com provas dadas no mar e no vento: fiáveis, duradouras e suportadas por garantia do fabricante.",
      layout: "editorial",
    },
    {
      id: "sec-solucoes",
      type: "features",
      anchor: "solucoes",
      visible: true,
      showInNav: true,
      navLabel: "Soluções",
      background: "surface",
      eyebrow: "Soluções",
      title: "Tudo o que a sua embarcação e a sua aventura pedem.",
      intro: "Do equipamento de navegação aos produtos de manutenção, ajudamos a escolher a solução adequada a cada utilização.",
      columns: 3,
      items: [
        {
          icon: "radar",
          title: "Navegação e electrónica",
          text: "Plotters, sondas, radares, instrumentos e comunicações para navegar com precisão e segurança.",
        },
        {
          icon: "anchor",
          title: "Equipamento de convés",
          text: "Ferragens, dobradiças, cunhos e acessórios em aço inoxidável de grau marítimo.",
        },
        {
          icon: "sparkles",
          title: "Limpeza e manutenção",
          text: "Produtos especializados para proteger casco, convés, metais e estofos do sal e do sol.",
        },
        {
          icon: "life-buoy",
          title: "Bombas e sistemas de bordo",
          text: "Bombas de esgoto, arejadores e sistemas que mantêm a embarcação segura e operacional.",
        },
        {
          icon: "wind",
          title: "Kitesurf e desportos de vento",
          text: "Kites, pranchas, trapézios e acessórios para todos os níveis de prática.",
        },
        {
          icon: "wrench",
          title: "Aconselhamento técnico",
          text: "Apoio na escolha, instalação e manutenção para tirar o máximo partido de cada equipamento.",
        },
      ],
    },
    {
      id: "sec-aventura",
      type: "banner",
      anchor: "aventura",
      visible: true,
      showInNav: true,
      navLabel: "Aventura",
      background: "dark",
      eyebrow: "Aventura",
      title: "O mar começa onde termina a rotina.",
      subtitle:
        "Da pesca desportiva ao kitesurf nas praias de Angola, equipamos quem procura liberdade, adrenalina e horizonte.",
      image: { url: "/seed/aventura.svg", alt: "Praticante de kitesurf sobre as ondas", mediaId: null },
      overlayOpacity: 30,
      height: "tall",
      button: { ...emptyLink(), enabled: true, label: "Planear o meu equipamento", anchor: "contactos" },
    },
    {
      id: "sec-contactos",
      type: "contact",
      anchor: "contactos",
      visible: true,
      showInNav: true,
      navLabel: "Contactos",
      background: "light",
      eyebrow: "Contactos",
      title: "Vamos preparar a sua próxima saída.",
      intro: "Fale com a nossa equipa para pedidos de informação, orçamentos ou apoio técnico.",
      showForm: true,
      formTitle: "Envie-nos uma mensagem",
      successMessage: "Obrigado. Recebemos a sua mensagem e entraremos em contacto brevemente.",
    },
  ],
  brands: [
    {
      id: "brand-garmin",
      name: "Garmin",
      logo: emptyMedia(),
      specialisation: "Electrónica marítima e navegação",
      description:
        "<p>Plotters cartográficos, sondas, radares, piloto automático e instrumentos de bordo para navegar com confiança em qualquer condição.</p>",
      heroImage: { url: "/seed/brand-garmin.svg", alt: "Consola de navegação de uma embarcação", mediaId: null },
      externalUrl: "https://www.garmin.com",
      visible: true,
    },
    {
      id: "brand-sea-dog",
      name: "Sea-Dog Line",
      logo: emptyMedia(),
      specialisation: "Ferragens e equipamento de convés",
      description:
        "<p>Ferragens, dobradiças, cunhos, puxadores e acessórios em aço inoxidável e nylon, concebidos para resistir ao ambiente marinho.</p>",
      heroImage: { url: "/seed/brand-seadog.svg", alt: "Ferragens em aço inoxidável no convés", mediaId: null },
      externalUrl: "https://www.sea-dog.com",
      visible: true,
    },
    {
      id: "brand-star-brite",
      name: "Star brite",
      logo: emptyMedia(),
      specialisation: "Limpeza, protecção e manutenção",
      description:
        "<p>Produtos de limpeza e protecção para casco, convés, metais, vinil e motores, que prolongam a vida e o brilho da embarcação.</p>",
      heroImage: { url: "/seed/brand-starbrite.svg", alt: "Casco brilhante de uma embarcação", mediaId: null },
      externalUrl: "https://www.starbrite.com",
      visible: true,
    },
    {
      id: "brand-rule",
      name: "Rule",
      logo: emptyMedia(),
      specialisation: "Bombas de esgoto e sistemas de bordo",
      description:
        "<p>Bombas de esgoto, interruptores de nível e arejadores, uma referência em fiabilidade para a segurança a bordo.</p>",
      heroImage: { url: "/seed/brand-rule.svg", alt: "Sistema de bombagem de uma embarcação", mediaId: null },
      externalUrl: "https://www.rule-industries.com",
      visible: true,
    },
    {
      id: "brand-duotone",
      name: "Duotone Kiteboarding",
      logo: emptyMedia(),
      specialisation: "Kitesurf e desportos de vento",
      description:
        "<p>Kites, pranchas, barras e trapézios desenvolvidos com atletas de topo, para progredir com segurança e desempenho.</p>",
      heroImage: { url: "/seed/brand-duotone.svg", alt: "Kite colorido sobre o mar", mediaId: null },
      externalUrl: "https://www.duotonesports.com",
      visible: true,
    },
  ],
  contact: {
    phone: "+244 900 000 000 (a confirmar)",
    phoneSecondary: "",
    whatsapp: "",
    email: "",
    address: "Luanda, Angola (morada a confirmar)",
    hours: "Segunda a sexta, 8h00–17h00 · Sábado, 9h00–13h00",
    mapUrl: "",
    social: { instagram: "", facebook: "", linkedin: "", youtube: "", tiktok: "" },
  },
  store: {
    enabled: false,
    url: null,
    label: "Loja Online",
    openInNewTab: true,
    showInHeader: true,
    showInHero: false,
  },
  seo: {
    title: "Ponto Radical | Náutica, navegação e aventura em Angola",
    description:
      "Electrónica marítima, equipamento de convés, manutenção de embarcações e kitesurf. Representantes Garmin, Sea-Dog Line, Star brite, Rule e Duotone em Angola.",
    keywords: "náutica Angola, Garmin, Sea-Dog Line, Star brite, Rule, Duotone, kitesurf, equipamento marítimo, Luanda",
    ogImage: { url: "/seed/hero.svg", alt: "Ponto Radical", mediaId: null },
    siteUrl: "",
  },
  footer: {
    tagline: "Equipamento náutico, navegação e desportos de aventura em Angola.",
    copyright: "© Ponto Radical. Todos os direitos reservados.",
    showSocial: true,
    links: [],
  },
};
