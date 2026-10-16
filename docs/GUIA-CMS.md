# Guia do painel de administração

Endereço: **https://<domínio>/admin**

Este guia é para quem gere o website no dia-a-dia. Não é preciso saber programar.

---

## A regra de ouro: Guardar → Pré-visualizar → Publicar

1. **Editar** — altere textos, imagens ou definições em qualquer página do painel.
2. **Guardar rascunho** — o botão azul no fundo da página. A alteração fica guardada, mas **o website público não muda**.
3. **Pré-visualizar** — no topo do painel. Abre o website exactamente como vai ficar, com uma faixa amarela.
4. **Publicar** — no topo do painel. O website público passa a mostrar o rascunho de imediato.

A barra do topo indica sempre o estado:

- 🟠 **Existem alterações por publicar** — há rascunho guardado que ainda não está online;
- 🟢 **Website actualizado** — o website público é igual ao rascunho.

Antes de publicar, o painel verifica o conteúdo. **Erros** (por ex. um botão que aponta para uma secção que já não
existe, ou a loja activa sem endereço) impedem a publicação até serem corrigidos. **Avisos** (por ex. imagem sem
texto alternativo) não impedem.

Se várias pessoas editarem ao mesmo tempo, o painel não deixa que uma grave por cima da outra sem saber: aparece
a mensagem «O conteúdo foi alterado entretanto». Recarregue a página e repita a alteração.

---

## Secções do menu lateral

### Visão Geral
Resumo do website, pedidos de reserva novos, próximas reservas confirmadas, verificação de erros, últimas
publicações e estado da Loja Online.

### Conteúdos
Todos os textos do website pela ordem em que aparecem. Clique numa secção para a editar.

### Secções
A página é uma sequência de secções. Aqui pode:

- **reordenar** com as setas ↑ ↓;
- **ocultar/mostrar** (ícone do olho) — a secção deixa de aparecer, mas não é apagada;
- **mostrar no menu** (ícone ☰);
- **duplicar** e **eliminar**;
- **Adicionar secção** a partir de modelos: Hero, Texto e imagem, Imagem e texto, Montra de marcas, Galeria editorial,
  Banner de imagem, Banner de vídeo, Colunas de destaques, Chamada para acção, Contactos, Texto em movimento e
  **Experiências e reservas** (cartões dos serviços, com filtros e pedido de reserva; pode limitar a secção a
  algumas categorias).

Ao editar uma secção pode mudar textos, imagens, botões, cor de fundo, nome no menu e **âncora** (o endereço da
secção, por ex. `#marcas`). Se mudar a âncora, os botões que apontavam para ela são actualizados automaticamente.

### Marcas
Garmin, Sea-Dog Line, Star brite, Rule e Duotone Kiteboarding, e outras que queira acrescentar. Para cada marca:
nome, logótipo, especialização, descrição, imagem de destaque, site oficial e visibilidade. A ordem altera-se com as
setas. Uma marca nova começa oculta até a completar.

### Serviços (experiências reserváveis)
Passeios de barco, actividades (aulas de kitesurf, pesca, jet ski…) e qualquer outro serviço que se possa reservar.
Os serviços visíveis aparecem na secção **Experiências e reservas** do website, por esta ordem, com filtros por
categoria e o botão de pedido de reserva.

Na lista pode **reordenar** (↑ ↓), **ocultar/mostrar** (olho), **ligar/desligar pedidos de reserva** (calendário),
**duplicar** e **eliminar**. Um serviço novo começa oculto até o completar. Para cada serviço:

- **nome**, **categoria**, **endereço** (cria a ligação directa `https://<domínio>/#reservar-<endereço>`, útil para
  partilhar no WhatsApp ou nas redes sociais — abre logo o pedido de reserva desse serviço);
- **resumo** (cartão) e **descrição completa**;
- **fotografias** (a primeira é a do cartão);
- **duração**, **preço «a partir de»** em kwanzas, por pessoa ou por grupo (vazio = «sob consulta»), **mínimo e
  máximo de pessoas** por reserva;
- **dias da semana** e **horários de partida** — são indicativos: limitam o que o cliente pode pedir (sem horários,
  aparece «A combinar»), mas não há reserva automática; é a equipa que confirma;
- **ponto de encontro**, **o que está incluído** e **requisitos** (um item por linha).

Ao lado da lista:

- **Categorias** — renomear, reordenar, acrescentar ou remover (só se nenhum serviço a usar);
- **Pedidos de reserva** — ligar/desligar todos os pedidos, antecedência mínima e até quando se aceitam pedidos,
  condições de pagamento (mostradas no formulário), mensagem após o envio e a ligação para continuar no WhatsApp
  (precisa do número de WhatsApp em **Contactos**).

Como todo o conteúdo, as alterações aos serviços ficam no rascunho até **Publicar**.

> Os quatro serviços iniciais (pôr-do-sol, pesca, kitesurf, dia na ilha) são **exemplos**: reveja preços, horários,
> pontos de encontro e fotografias antes de aceitar reservas reais.

### Reservas
Pedidos enviados pelo website. O número de pedidos novos aparece no menu e na **Visão Geral**, que mostra também as
próximas reservas confirmadas.

- **Caixa de entrada** — filtros por estado (Novo, Confirmado, Nova data proposta, Recusado, Concluído, Cancelado).
- **Agenda** — calendário do mês com os pedidos por dia; clique num pedido para o abrir.

Em cada pedido: serviço, data, hora, pessoas, contactos e observações do cliente, e a **referência** (ex.: `7B3F9CA2`)
que o cliente também recebe. Pode:

- **Confirmar**, **Propor outra data** (indique a data e a hora propostas) ou **Recusar**;
- responder por **WhatsApp** ou **email** com uma mensagem já escrita conforme o estado;
- registar o **valor acordado**, o estado do **pagamento** e **notas internas**.

O pagamento é feito depois da confirmação (transferência, Multicaixa Express ou no local) — o website não cobra nada.
Os dados enviados pelo cliente não podem ser alterados no painel; mudanças de estado ficam no registo de actividade.
Só administradores eliminam pedidos.

### Biblioteca Multimédia
Todas as imagens e vídeos.

- **Carregar ficheiros**: JPG, PNG, WebP e SVG até 10 MB; vídeos MP4 e WebM até 50 MB.
- Clique num ficheiro para editar o **texto alternativo** (descrição da imagem — importante para acessibilidade e
  Google), mudar a pasta, **substituir** o ficheiro ou eliminá-lo.
- Um ficheiro em uso no rascunho ou no website publicado não pode ser eliminado.
- Ao **substituir** uma imagem, todas as secções que a usam no rascunho passam a usar a nova; publique para aplicar.

Dicas: fotografias horizontais com pelo menos 2400 px de largura para fundos; comprima as fotos antes de carregar
(por ex. em squoosh.app). O website gera automaticamente versões optimizadas para cada ecrã.

### Aparência
Cores (principal, secundária, destaque, escura, fundos e texto), combinação de tipografia, estilo dos títulos e forma
dos botões, com pré-visualização ao vivo. O painel avisa quando o contraste entre cores dificulta a leitura.

### Menu e Botões
Nomes dos itens do menu, logótipo (imagem ou texto), estilo do cabeçalho, botão do cabeçalho e links do rodapé.
A ordem do menu segue a ordem das secções.

Cada botão tem: texto, destino (**secção da página**, **endereço externo** ou **Loja Online**) e estilo.

### Contactos
Telefones, WhatsApp, email, morada, link do mapa, horário e redes sociais. Campos vazios não aparecem no website.

### Loja Online
Configuração do botão para a loja **Quicksell** (plataforma externa). Enquanto não houver endereço, a loja fica
desactivada e o botão não aparece em lado nenhum. Ver «Ligar a loja Quicksell» em `docs/INSTALACAO.md`.

### SEO
Título e descrição para o Google (com pré-visualização), palavras-chave, endereço do website e imagem de partilha
para redes sociais.

### Publicações e Histórico
Lista de todas as publicações. Para cada uma pode **Ver** (pré-visualização dessa versão) ou **Restaurar** (copia-a
para o rascunho; depois publique). É a forma de desfazer uma publicação.

O botão **Descartar** no topo apaga as alterações não publicadas e volta ao conteúdo que está online.

### Mensagens
Pedidos enviados pelo formulário de contacto: nome, email, telefone, assunto, mensagem e data. Altere o estado
(Novo, Em curso, Respondido, Arquivado) e acrescente notas internas. O número de mensagens novas aparece no menu.

### Utilizadores (só administradores)
Convidar pessoas por email e definir o papel:

| Papel | Pode |
| --- | --- |
| **Editor** | Editar todos os conteúdos, imagens, serviços, aparência, loja e SEO; publicar; tratar mensagens e reservas |
| **Administrador** | Tudo o que o editor faz, mais gerir utilizadores, eliminar mensagens e pedidos de reserva e ver o registo de actividade |
| **Sem acesso** | Não entra no painel |

### Definições
Nome do website, o seu nome, alteração da palavra-passe e (administradores) registo de actividade.

---

## O que precisa de programador

O painel cobre conteúdos, imagens, marcas, secções a partir dos modelos, aparência, botões, contactos, loja e SEO.
É necessária intervenção no código para:

- novos tipos de secção ou layouts diferentes dos modelos existentes;
- novas funcionalidades (por ex. blog, área de clientes, pagamentos online — a tabela de reservas já tem os campos
  de pagamento preparados);
- alterações de estrutura técnica, domínio ou integrações externas novas.

## Segurança

- Use uma palavra-passe longa e única; nunca a partilhe — convide cada pessoa com a sua conta.
- Termine sessão em computadores partilhados (canto inferior esquerdo do painel).
- Retire o acesso a quem deixar a equipa em **Utilizadores → Sem acesso**.
