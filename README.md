# Sincro

![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Backend](https://img.shields.io/badge/backend-NestJS-E0234E?logo=nestjs&logoColor=white)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Database](https://img.shields.io/badge/database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Queue](https://img.shields.io/badge/queue-Redis%20%2B%20BullMQ-DC382D?logo=redis&logoColor=white)
![License](https://img.shields.io/badge/license-private-lightgrey)

Gestão de catálogo, estoque e anúncios no Mercado Livre para **um único
vendedor** — uso pessoal, sem multi-tenant, sem contas de outros usuários,
sem faturamento.

O Sincro é a fonte de verdade dos produtos: os anúncios nascem aqui, são
publicados no Mercado Livre pela API, e todo pedido recebido volta como baixa
de estoque no banco. Nenhuma decisão de estoque é tomada no painel do ML —
é sempre o Sincro quem manda o valor absoluto.

## Arquitetura

```
┌──────────────────────┐        HTTP (JSON)        ┌───────────────────────────┐
│   frontend/ (SPA)     │ ─────────────────────────▶│   backend (raiz do repo)  │
│   Vite + React        │◀───────────────────────── │   NestJS                  │
└──────────────────────┘                             └─────────────┬─────────────┘
                                                                     │
                                        ┌────────────────────────────┼────────────────────────────┐
                                        │                            │                            │
                                 ┌──────▼──────┐            ┌────────▼────────┐          ┌─────────▼─────────┐
                                 │ PostgreSQL   │            │  Redis + BullMQ  │          │ API do Mercado    │
                                 │ (TypeORM)    │            │  (jobs)          │          │ Livre (OAuth+REST)│
                                 └─────────────┘            └─────────────────┘          └────────────────────┘
```

O backend é a única coisa que fala com o Mercado Livre e com o banco; o
frontend só conversa com o backend. Em desenvolvimento, o Vite faz proxy de
`/api/*` para `http://localhost:3000/*` (ver `frontend/vite.config.ts`) — o
backend não tem prefixo global de rota.

## Stack

**Backend** (raiz do repo)
- [NestJS](https://nestjs.com/) + TypeScript
- PostgreSQL via [TypeORM](https://typeorm.io/) (migrations, sem `synchronize`)
- Redis + [BullMQ](https://docs.bullmq.io/) para os jobs de renovação de token e polling de pedidos
- `class-validator` / `class-transformer` para validação de entrada

**Frontend** (`frontend/`)
- [Vite](https://vite.dev/) + React 19 + TypeScript
- Tailwind CSS v4 (tokens de design via `@theme` em `src/index.css` — sem hex solto em componente)
- [TanStack Query](https://tanstack.com/query) para estado de servidor
- React Router para navegação client-side
- Tipografia: Proxima Nova (a do Mercado Livre; licenciada, auto-hospedada assim que os `.woff2` estiverem em `frontend/src/assets/fonts/`). Até lá, o mesmo fallback que o próprio ML usa: `-apple-system, Helvetica, Roboto, Arial` — sem CDN de fonte

## Como rodar do zero

Pré-requisitos: Node 20+, PostgreSQL, Redis (local ou via Docker).

```bash
cp .env.example .env      # preencha ML_CLIENT_ID e ML_CLIENT_SECRET
docker compose up -d      # Postgres + Redis
npm install
npm run migration:run
npm run start:dev         # backend em http://localhost:3000
```

Frontend, em outro terminal:

```bash
cd frontend
npm install
npm run dev                # SPA em http://localhost:5173, com proxy /api -> :3000
```

### Sem Docker (Windows)

O `docker-compose.yml` continua sendo o caminho mais simples, mas não é o
único. Se não houver Docker na máquina:

**Redis** — build nativo portátil, sem instalador e sem privilégio de
administrador (o MSI do Memurai falha sob o sandbox do winget com
`SFXCA: Failed to create temp directory`):

```powershell
# baixar Redis-<versao>-Windows-x64-msys2.zip de
# https://github.com/redis-windows/redis-windows/releases
# e extrair, por exemplo, em %LOCALAPPDATA%\Redis
cd "$env:LOCALAPPDATA\Redis\Redis-8.10.1-Windows-x64-msys2"
.\redis-server.exe --port 6379 --appendonly yes
```

Rode a partir da pasta do Redis: passar `--dir` com um caminho que contenha
espaço quebra o parser de configuração do Redis. Não é um serviço — precisa
ser iniciado de novo a cada reboot.

**PostgreSQL** — com uma instalação já existente, basta criar o papel e o
banco (o instalador padrão usa `scram-sha-256`, então vai pedir a senha do
superusuário):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE USER sincro WITH PASSWORD 'sua-senha';"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE sincro OWNER sincro;"
```

Ou, em um passo só:

```powershell
.\scripts\setup-postgres.ps1
```

O script cria o papel e o banco (idempotente), alinha o `DB_PASSWORD` do `.env`
com a senha que definiu e aplica as migrations. Ele existe porque essa senha
precisa ser idêntica nos dois lugares: quando divergem, a falha só aparece
depois, como erro de autenticação do `migration:run`, que não menciona o
`.env`.

### O OAuth exige HTTPS

O Mercado Livre não aceita `http://` no URI de redirect cadastrado no
DevCenter, então o callback precisa chegar por um túnel HTTPS:

```powershell
cloudflared tunnel --url http://localhost:3000
```

A URL `https://XXX.trycloudflare.com` que ele imprime muda a cada execução, e
três coisas precisam concordar exatamente: o campo do DevCenter, o
`ML_REDIRECT_URI` do `.env` e o túnel em execução. Como o `.env` só é lido no
boot — e o watch mode observa `src/`, não o `.env` — suba o túnel **antes**
da aplicação; inverter a ordem produz um `redirect_uri mismatch` que parece
erro de configuração do ML.

O túnel serve para uma única autorização. Depois que os tokens estão em
`ml_credentials`, o Sincro nunca mais precisa de URL pública, porque a
sincronização é por polling e não por webhook.

### Credenciais do Mercado Livre

Crie a aplicação em <https://developers.mercadolivre.com.br/devcenter> e
cadastre como **URI de redirect** exatamente o valor de `ML_REDIRECT_URI`
(padrão: `http://localhost:3000/ml/auth/callback`).

Depois, com a API no ar, abra no navegador:

```
http://localhost:3000/ml/auth/login
```

Autorize a aplicação. O ML redireciona de volta e as credenciais ficam salvas
em `ml_credentials`. **Isso é feito uma única vez** — a partir daí o job de
renovação mantém o `access_token` válido sozinho.

Confira quando quiser em `GET /ml/auth/status`.

## Decisões de arquitetura

Resumo das decisões não óbvias — a razão de cada uma, com mais detalhe, está
nas seções indicadas.

| Decisão | Por quê |
| --- | --- |
| Uso pessoal, sem multi-tenant | Um vendedor, uma linha em `ml_credentials`, nenhuma noção de conta/usuário no schema. Simplifica autenticação, autorização e todo o modelo de dados. |
| OAuth com PKCE (Authorization Code + S256) | Exigência do Mercado Livre para apps públicos; `code_verifier`/`code_challenge` vivem em memória (`ml-auth.service.ts`), não persistidos — o fluxo é de uso único por autorização. |
| Polling em vez de webhook | Ver [Jobs](#jobs). Com menos de 20 anúncios, uma janela de 5 min basta e evita expor endpoint público só para notificação do ML. |
| Banco decide, ML espelha (estoque) | Ver [Como o estoque se mantém coerente](#como-o-estoque-se-mantém-coerente). Toda escrita no ML manda valor absoluto — idempotente por construção. |
| Fila + compare-and-set nas credenciais | Ver [Como as credenciais se mantêm coerentes](#como-as-credenciais-se-mantêm-coerentes). O `refresh_token` do ML morre na hora em que um novo é emitido; perder uma escrita concorrente exigiria refazer OAuth manualmente. |
| Atributos como JSONB | Ver [Schema](#schema). Combinações válidas (cor/tamanho/voltagem/sabor...) mudam por categoria do ML — colunas fixas quebrariam na primeira categoria diferente. |
| Tokens de design no Tailwind, não hex solto | Todo componente do frontend usa cores/espaçamento/tipografia definidos uma vez em `frontend/src/index.css` (`@theme`). Consistência visual entre telas sem precisar reler cada componente. |

## Fluxo completo (do cadastro ao pedido)

### 1. Descobrir a categoria

```http
GET /ml/categories/predict?titulo=Camiseta basica algodao masculina
```

Devolve as sugestões do `category_predictor`. Escolha um `category_id`.

### 2. Ver o que a categoria exige

```http
GET /ml/categories/MLB31603/attributes?apenasObrigatorios=true
```

Cada atributo vem com `obrigatorio`, `valoresPermitidos` e `usadoEmVariacoes`
(quando `true`, o atributo entra na combinação da variação — cor, tamanho —
e não nos atributos do item).

### 3. Enviar as imagens

```http
POST /ml/pictures/upload      (multipart, campo "file")
```

O backend só repassa o binário para `POST /pictures/items/upload` do ML —
nada é gravado em disco nem hospedado em outro lugar. Guarde o `id` retornado.

### 4. Cadastrar o produto (rascunho)

```http
POST /products
```

```json
{
  "sku": "CAM-001",
  "nome": "Camiseta basica",
  "descricao": "Algodao penteado 30.1",
  "categoriaId": "MLB31603",
  "pictureIds": ["988543-MLA..."],
  "atributos": [{ "id": "BRAND", "value_name": "Generica" }],
  "variacoes": [
    {
      "sku": "CAM-001-AZ-M",
      "atributos": [
        { "id": "COLOR", "name": "Cor", "value_name": "Azul" },
        { "id": "SIZE", "name": "Tamanho", "value_name": "M" }
      ],
      "preco": 99.9,
      "estoque": 10
    }
  ]
}
```

O produto e o anúncio são criados em **rascunho**; nada foi ao ML ainda. Se a
categoria já estiver definida, os atributos obrigatórios são conferidos aqui
— o erro aparece no cadastro, não na publicação.

Anúncio **sem** variações: mande uma única entrada em `variacoes` com
`"atributos": []`.

### 5. Publicar

```http
POST /products/{listingId}/publish
```

Monta o payload completo, chama `POST /items` e grava `ml_item_id` e o
`ml_variation_id` de cada variação. Sem esses ids não há como sincronizar
estoque depois.

### 6. Operação do dia a dia

```http
PUT  /products/variations/{variationId}/stock   { "estoque": 7 }
PUT  /products/variations/stock                 { "itens": [...] }
POST /products/{listingId}/sync
GET  /dashboard
GET  /dashboard/listings
GET  /dashboard/alerts
GET  /orders
POST /orders/sync
```

## Jobs

| Job | Cron (`.env`) | O que faz |
| --- | --- | --- |
| `token-refresh` | `TOKEN_REFRESH_CRON` (15 min) | Renova o `access_token` quando falta menos que `TOKEN_REFRESH_SKEW_SECONDS` para vencer. O token do ML dura ~6h. |
| `order-polling` | `ORDER_POLLING_CRON` (5 min) | Busca pedidos novos, registra e dá baixa no estoque. |

## Como o estoque se mantém coerente

Três decisões sustentam isso:

- **O banco decide, o ML espelha.** Toda escrita de estoque no ML manda o
  valor **absoluto**, nunca um delta. Reenviar a mesma sincronização duas
  vezes não desconta duas vezes — então repetir depois de uma falha é seguro.
- **Alteração manual só vale se o ML aceitar.** `PUT .../stock` grava, tenta
  propagar e **reverte o banco** se o ML recusar. Divergência silenciosa entre
  os dois lados é o que faz vender o que não existe.
- **Baixa por pedido não é revertida.** A venda já aconteceu e o próprio ML já
  descontou do lado dele; o push serve só para reconciliar. Se ele falhar, o
  banco continua correto e o próximo polling reconcilia.

A idempotência do polling vem do índice único
`(ml_order_id, ml_item_id, ml_variation_id)` mais a flag `estoque_baixado`:
o mesmo item do mesmo pedido nunca é descontado duas vezes, ainda que apareça
em várias rodadas. Pedido cancelado depois de descontado devolve o estoque.

Detalhe importante em `PUT /items/{id}`: o ML trata `variations` como estado
completo — variação ausente do payload é **removida** do anúncio. Por isso
toda atualização reenvia o conjunto inteiro de variações, nunca só a que mudou.

## Como as credenciais se mantêm coerentes

O ML rotaciona o `refresh_token` a cada renovação: o antigo morre no instante
em que o novo é emitido. Perder uma escrita significa ficar com um token já
morto e ter que refazer o OAuth na mão. Duas proteções, que cobrem coisas
diferentes:

- **Renovações nunca rodam em paralelo.** Chamadas concorrentes compartilham a
  mesma renovação em voo, em vez de queimar duas rotações.
- **Toda escrita de credencial é serializada**, inclusive a do callback do
  OAuth — que não é uma renovação. Sem isso, refazer o `/ml/auth/login`
  enquanto o job de renovação roda perde a escrita de um dos dois lados.

Além da fila, a renovação faz **compare-and-set**: se o `refresh_token`
armazenado mudou enquanto ela falava com o ML, o resultado dela nasceu velho e
é descartado em silêncio (só log), devolvendo ao chamador o par mais recente.
A fila tem timeout curto — um chamador travado não segura o job de token para
sempre; quem não consegue a vez tenta no próximo ciclo.

Vale notar que a **primeira** autorização é imune por outro motivo: sem linha
em `ml_credentials`, os dois jobs saem cedo (`sem-credenciais`) e não há com
quem competir. A janela real é a re-autorização.

## Schema

| Tabela | Papel |
| --- | --- |
| `ml_credentials` | Tokens do OAuth. Uma linha só, garantida por constraint. |
| `products` | Produto interno (SKU, nome, descrição). |
| `ml_listings` | Anúncio: `ml_item_id`, categoria, status, atributos, imagens. |
| `ml_variations` | Combinação vendável: `atributos` JSONB, preço, estoque. |
| `orders` | Item de pedido vindo do ML + controle da baixa. |

`atributos` é JSONB porque as combinações válidas mudam por categoria —
cor/tamanho como colunas fixas quebraria na primeira categoria que usa outro
eixo (voltagem, sabor, capacidade).

## Estrutura de pastas

```
Sincro/
├── src/                          # backend (NestJS)
│   ├── mercado-livre/            # tudo que fala com a API do ML: auth (OAuth+PKCE),
│   │                             #   categories, items, orders, pictures
│   ├── products/                 # domínio interno: Product, Listing, Variation
│   ├── orders/                   # pedidos sincronizados do ML
│   ├── dashboard/                # leituras agregadas (visão geral, listings, alertas)
│   ├── jobs/                     # processors BullMQ (token-refresh, order-polling)
│   └── database/                 # data-source + migrations
│
└── frontend/                     # SPA (Vite + React)
    └── src/
        ├── api/                  # clientes HTTP tipados, um arquivo por recurso
        ├── components/
        │   ├── ui/                #   primitives (Button, Badge, StatusDot) — só tokens
        │   ├── layout/            #   Header
        │   ├── dashboard/         #   StatTile, AlertRow, ConnectionStatus
        │   └── product/           #   ProductCard
        ├── hooks/                # TanStack Query (useDashboard, useAnuncios...)
        ├── pages/                # uma página por rota
        ├── lib/                  # format.ts, utils.ts (cn)
        └── index.css             # tokens de design (@theme, paleta clara do Andes) + tabela WCAG
```

## Testes

```bash
npm test
```

Cobrem o que quebra silenciosamente: idempotência do polling, estorno de
cancelamento, reversão de estoque quando o ML recusa, montagem do payload de
publicação, reenvio integral das variações e a concorrência em torno das
credenciais.

## Comandos

Backend (raiz):

```bash
npm run start:dev        # desenvolvimento (watch)
npm run build            # compila para dist/
npm run migration:run    # aplica as migrations
npm run migration:revert # desfaz a última
npm test                 # testes
```

Frontend (`frontend/`):

```bash
npm run dev              # servidor de desenvolvimento (proxy /api -> :3000)
npm run build             # typecheck (tsc -b) + build de produção
npm run preview           # serve o build de produção localmente
```

## Status atual do projeto

**Backend** — completo e validado contra a API real do Mercado Livre: OAuth
com PKCE, cadastro de produto com variações, upload de imagem, publicação de
anúncio, pausa/reativação, sincronização de estoque/preço e polling de
pedidos com baixa de estoque. Coberto por testes (`npm test`).

**Frontend** — em construção, ainda **não validado contra o backend real**
nesta máquina (falta subir Postgres/Redis/`.env` — ver
[suposições pendentes](#frontend--suposições-pendentes-de-validação) abaixo).
Cada tela é testada isoladamente contra respostas mockadas.

| Tela | Estado |
| --- | --- |
| Design system (tokens Tailwind, fontes, `Header`/`Button`/`Badge`/`StatusDot`/`ProductCard`) | ✅ Pronto |
| Dashboard (`GET /dashboard`) | ✅ Pronto — testado contra mock, 3 estados (conectado/desconectado/sem alertas) |
| Roteamento (`react-router-dom`, nav do `Header`) | ✅ Pronto |
| Anúncios (`GET /dashboard/listings` + publicar/pausar/reativar) | 🚧 Cliente de API e hooks prontos (`api/listings.ts`, `hooks/useAnuncios.ts`); tela ainda não montada |
| Pedidos (`GET /orders`, `POST /orders/sync`) | ⏳ Não iniciado |
| Cadastro de produto (categoria → atributos → imagens → variações → `POST /products`) | ⏳ Não iniciado |

## Frontend — suposições pendentes de validação

O frontend está sendo construído tela por tela contra respostas **mockadas**,
sem subir Postgres/Redis/`.env` nesta máquina. Cada suposição sobre o formato
de uma resposta — tipo de campo, presença de relação aninhada, nome exato de
enum — fica registrada aqui conforme o código que a usa é escrito. Quando o
backend real subir, isto vira o checklist de conferência: mais rápido que
reler cada componente pra lembrar o que foi suposto.

Cada entrada diz a fonte: **lida no código-fonte** (alta confiança, mas nunca
testada por HTTP de verdade) ou **adivinhada** (baixa confiança). Só entram
aqui endpoints que já têm código real consumindo-os — nada especulativo sobre
telas que ainda não existem (ver tabela de status acima).

Convenção geral, válida pra tudo que já existe: nenhuma rota tem prefixo
global (`app.setGlobalPrefix` não é chamado em `main.ts`) — todas as chamadas
do frontend assumem `/dashboard`, `/products`, `/orders`... direto na raiz.
**Lida no código-fonte.**

### `GET /dashboard` (usado em `pages/Dashboard.tsx`)

- `totais.*` chegam como `number` no JSON (o `faturamento30Dias` passa por
  `Number(...toFixed(2))` no backend antes de sair). **Lida no código-fonte.**
- `conexaoMl.expiraEm` serializa como string ISO (é `Date` no backend, mas
  vira string ao cruzar HTTP/JSON). **Lida no código-fonte**, nunca testada
  contra a serialização real do Nest.
- `alertas[].sku` pode ser `null` (variação sem SKU); a tela usa
  `sku ?? variationId` como rótulo. **Lida no código-fonte.**
- `alertas[].descricaoAtributos` sempre vem como string (nunca vazio/null) —
  o backend usa `"unica"` para variação sem combinação. **Lida no código-fonte.**

### `GET /dashboard/listings`, `POST /products/:id/publish`, `PUT /products/:id/status`

(cliente pronto em `api/listings.ts` + `hooks/useAnuncios.ts`; a tela de
Anúncios ainda não consome esses hooks)

- Usa `/dashboard/listings` em vez de `GET /products` porque já vem agregado:
  `estoqueTotal`, `precoMinimo`, `temEstoqueBaixo`, `semEstoque` são
  calculados no backend (inclusive o limite de estoque baixo, que é config do
  servidor) — o frontend não reimplementa essa conta. **Decisão de design.**
- `precoMinimo` é `number | null` (null quando a listing não tem variações
  com preço). **Lida no código-fonte.**
- `status` é um dos 5 valores de `ListingStatus`: `rascunho | ativo | pausado
  | encerrado | erro`. **Lida no código-fonte** — ainda sem mapeamento pra
  badge porque a tela não existe.
- `permalink` e `ultimoErro` são `string | null`. **Lida no código-fonte.**
- `publicarListing`/`alterarStatusListing` devolvem a `Listing` completa
  (mesmo shape de `GET /products/:id`, com `product` e `variations`
  populados). **Lida no código-fonte.**

---

Conforme Pedidos e Cadastro de produto forem construídos, este arquivo ganha
uma seção por endpoint novo consumido, na mesma convenção acima.
