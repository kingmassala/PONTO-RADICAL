# Ponto Radical — passagem de testemunho

Estado em **17 de Outubro de 2026**. Escrito para continuar o desenvolvimento noutro computador e noutra conta do
Claude sem reconstruir nada. Instruções permanentes: [CLAUDE.md](CLAUDE.md) · instalação:
[SETUP_NEW_COMPUTER.md](SETUP_NEW_COMPUTER.md) · backups: [docs/BACKUP-E-RECUPERACAO.md](docs/BACKUP-E-RECUPERACAO.md).

## 1. Onde está tudo

| Componente | Onde | Estado |
|---|---|---|
| Website público | https://ponto-radical.vercel.app (`/`, `/es`, `/fr`, `/en`, `/ru`, `/zh`) | Online |
| Painel | https://ponto-radical.vercel.app/admin | Online |
| Código | https://github.com/kingmassala/PONTO-RADICAL (ramo `main`) | Actualizado |
| Alojamento | Vercel `kingmassala-s-projects/ponto-radical` (deploy automático a cada push para `main`) | Ligado |
| Base de dados, contas e ficheiros | Supabase, projecto `gchtuvikrcvwxuxzmnty` (Frankfurt, eu-central-1), bucket `media` | Ligado |
| Backups | iCloud Drive › `Backups Ponto Radical/2026-10-17` (privado, fora do GitHub) | Verificado |

Administradores do painel (papel `admin`): `dariomassala@gmail.com` (Dario Massala) e `geral@pontoradical.com`.

Conteúdo: versão publicada n.º **8** («Assinatura com Lifestyle»); rascunho na revisão **10**, igual ao publicado.

## 2. Modelo B — gestão técnica pelo desenvolvedor

- **Desenvolvedor** (Dario, com o Claude): código, novas funcionalidades, deploys, base de dados, chaves e
  variáveis de ambiente, backups, domínios e integrações (GitHub, Vercel, Supabase, Quicksell).
- **Equipa Ponto Radical**: conteúdos no painel (textos, imagens, marcas, serviços, reservas, mensagens), sempre
  com Guardar → Pré-visualizar → Publicar. Não precisa de mexer em código nem nas plataformas.
- Pedidos de alteração chegam ao desenvolvedor; o Claude pode preparar mudanças de conteúdo no rascunho, mas a
  publicação e o deploy são sempre confirmados por quem gere o projecto.

> Esta definição foi documentada a partir da forma como o projecto tem sido gerido; confirmar ou corrigir aqui se o
> «Modelo B» combinado com o cliente tiver outros termos.

## 3. Identidade visual

- **Logótipo oficial**: círculo em contorno com o «R» geométrico + texto «PONTO RADICAL» (com o N estilizado).
  Ficheiros: `public/brand/ponto-radical-mark.svg` (preto), `ponto-radical-mark-white.svg` (branco),
  `ponto-radical-wordmark.png` / `-white.png` (texto, PNG transparente), `og-ponto-radical.png` (imagem de partilha
  1200×630), `app/icon.svg` (favicon). O original enviado pelo cliente era um JPG; o símbolo foi redesenhado em SVG
  com as mesmas proporções. Originais (logótipo oficial e logótipos de marcas enviados): `docs/marca/`.
- **Cores**: modo **preto e branco** ligado (Aparência › Preto e branco): paleta monocromática e fotografias em
  tons de cinzento. As cores originais (azul-petróleo/laranja) continuam guardadas em Aparência.
- **Tipografia**: «Geométrico» = **Jost** (títulos peso 500 e texto). Textos «à logótipo» (assinatura, «WE SHARE
  THE SAME PASSION») em Jost fino, maiúsculas e espaçado (`.pr-logo-type`). Palavras em `*itálico*` nos títulos
  usam Instrument Serif.
- **Assinatura**: «Boating · Water Sports · Camping · Fishing · Lifestyle & Co» (ecrã de entrada, texto do topo
  da abertura, emblema circular, imagem de partilha).
- **Movimento**: animações 3D só em CSS (sem bibliotecas), desligadas com «reduzir movimento».

## 4. Estrutura do website

1. **Ecrã de entrada** (sempre que a página abre ou é actualizada): logótipo a girar em 3D, assinatura, «Escolha a
   sua língua» nas 4 línguas, botões PT/ES/FR/EN e «WE SHARE THE SAME PASSION» a negrito.
2. **Abertura** (`#inicio`): título, assinatura, botões «Reservar experiência» e «Ver a loja e as marcas», emblema
   circular a girar, faixa «Marcas representadas» com logótipos.
3. **Faixa Loja Online** (grande e animada) — leva à loja (ver Pendências).
4. **Quem somos** (`#sobre`).
5. **Marcas** (`#marcas`): bloco «Revendedor autorizado oficial», marcas com detalhe, chamada para a loja.
6. **Experiências** (`#experiencias`): 4 serviços reserváveis com pedido de reserva (a equipa confirma no painel).
7. **Soluções** (`#solucoes`): 7 cartões, incluindo «Instalação profissional de embarcações» com a PROMARINE.
8. Faixa de palavras · **Aventura** · **Galeria** · **Contactos** (formulário que grava na base de dados) · rodapé.

Cabeçalho: logótipo oficial, menu, selector de língua, botão «Loja Online», «Reservar».

### Marcas (21)

- **Revendedor autorizado** (selo + bloco próprio): Garmin, Suzuki Marine, JL Audio, Fusion, Lumishore, Glydus,
  Duotone Kiteboarding, YETI.
- **Outras marcas**: Mystic e ION (logo a seguir à Duotone, sem selo), Sea-Dog Line, Star brite, Rule, Promarine,
  Blue Sea Systems, Perko, Pacer, Ancor, Motul, Seaflo, Osculati.
- Logótipos na Biblioteca Multimédia (pasta `marcas`); vêm dos sites oficiais ou foram enviados pelo cliente
  (Promarine, Fusion, JL Audio, Lumishore, Glydus, Blue Sea, Perko, Pacer, Ancor).

## 5. Painel de administração (`/admin`)

Visão Geral · Conteúdos · Secções · Marcas (com opção «Revendedor autorizado») · Serviços · Reservas (lista e
agenda) · Biblioteca Multimédia · Aparência (cores, tipografia, preto e branco, efeitos) · Menu e Botões · Contactos ·
Loja Online (link Quicksell, faixa animada, botões) · **Traduções** (ES/FR/EN, 230 textos traduzidos em cada) · SEO
(inclui imagem de partilha) · Publicações e Histórico (restaurar versões) · Mensagens · Utilizadores (só admin) ·
Definições. Pré-visualização com escolha de língua e «Ver entrada». Guia: [docs/GUIA-CMS.md](docs/GUIA-CMS.md).

## 6. Decisões tomadas

- CMS próprio (documento JSON + histórico de versões) em vez de um CMS externo.
- Reservas por pedido, sem pagamento online por agora.
- Loja online externa na **Quicksell**; enquanto não houver link, os botões da loja levam ao WhatsApp (se houver
  número) ou à secção de contactos (Loja Online › «Enquanto a loja não estiver activa»).
- Línguas por endereço (`/es`, `/fr`, `/en`, `/ru`, `/zh`) para SEO, com traduções editáveis no painel.
- Ecrã de entrada em todos os carregamentos (pedido do cliente), sem memorizar a língua.
- Backups guardados no iCloud Drive (escolha do cliente), sem cópia das chaves (`.env.local`).

## 7. Pendências

- **Link da Quicksell**: colar em Loja Online e activar quando existir.
- **Contactos reais**: telefone, WhatsApp, email e morada ainda são de exemplo («a confirmar»). Com o WhatsApp
  preenchido, os botões da loja passam a abrir o WhatsApp.
- **Serviços**: os 4 serviços são exemplos (preços, pontos de encontro e textos a confirmar).
- **Marcas**: rever as descrições genéricas (Glydus, Pacer, Promarine, Seaflo, Osculati); faltam os sites de
  Glydus, Pacer e Promarine; as fotografias das marcas novas reutilizam fotos já existentes.
- **Registos de teste** em Mensagens/Reservas («Teste Claude») podem ser apagados no painel.
- **Supabase Auth**: confirmar inscrições desligadas e Site URL/Redirect URLs com o domínio final.
- **Domínio próprio** (ex.: pontoradical.com) ainda não ligado à Vercel; quando ligar, actualizar
  `NEXT_PUBLIC_SITE_URL`, o Site URL do Supabase e o campo «URL do site» em SEO.
- **Plano Supabase**: no plano gratuito não há backups automáticos; considerar o Pro ou repetir o backup manual
  (ver docs/BACKUP-E-RECUPERACAO.md).
- WhatsApp guarda pré-visualizações antigas dos links já partilhados; renova-se sozinho ou com o Facebook
  Sharing Debugger.
