# Sincro

Gestao de catalogo, estoque e anuncios no Mercado Livre para **um unico
vendedor** (uso pessoal, sem multi-tenant).

O Sincro e a fonte de verdade dos produtos: os anuncios nascem aqui, sao
publicados no ML pela API, e todo pedido recebido volta como baixa de estoque
no banco.

## Stack

NestJS + TypeScript, PostgreSQL (TypeORM com migrations), Redis + BullMQ.

## Como subir

```bash
cp .env.example .env      # preencha ML_CLIENT_ID e ML_CLIENT_SECRET
docker compose up -d      # Postgres + Redis
npm install
npm run migration:run
npm run start:dev
```

### Sem Docker (Windows)

O `docker-compose.yml` continua sendo o caminho mais simples, mas nao e o
unico. Se nao houver Docker na maquina:

**Redis** -- build nativo portatil, sem instalador e sem privilegio de
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
espaco quebra o parser de configuracao do Redis. Nao e um servico -- precisa
ser iniciado de novo a cada reboot.

**PostgreSQL** -- com uma instalacao ja existente, basta criar o papel e o
banco (o instalador padrao usa `scram-sha-256`, entao vai pedir a senha do
superusuario):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE USER sincro WITH PASSWORD 'sua-senha';"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE sincro OWNER sincro;"
```

Depois e o fluxo normal: `npm run migration:run` e `npm run start:dev`.

### O OAuth exige HTTPS

O Mercado Livre nao aceita `http://` no URI de redirect cadastrado no
DevCenter, entao o callback precisa chegar por um tunel HTTPS:

```powershell
cloudflared tunnel --url http://localhost:3000
```

A URL `https://XXX.trycloudflare.com` que ele imprime muda a cada execucao, e
tres coisas precisam concordar exatamente: o campo do DevCenter, o
`ML_REDIRECT_URI` do `.env` e o tunel em execucao. Como o `.env` so e lido no
boot -- e o watch mode observa `src/`, nao o `.env` -- suba o tunel **antes**
da aplicacao; inverter a ordem produz um `redirect_uri mismatch` que parece
erro de configuracao do ML.

O tunel serve para uma unica autorizacao. Depois que os tokens estao em
`ml_credentials`, o Sincro nunca mais precisa de URL publica, porque a
sincronizacao e por polling e nao por webhook.

### Credenciais do Mercado Livre

Crie a aplicacao em <https://developers.mercadolivre.com.br/devcenter> e
cadastre como **URI de redirect** exatamente o valor de `ML_REDIRECT_URI`
(padrao: `http://localhost:3000/ml/auth/callback`).

Depois, com a API no ar, abra no navegador:

```
http://localhost:3000/ml/auth/login
```

Autorize a aplicacao. O ML redireciona de volta e as credenciais ficam salvas
em `ml_credentials`. **Isso e feito uma unica vez** -- a partir dai o job de
renovacao mantem o `access_token` valido sozinho.

Confira quando quiser em `GET /ml/auth/status`.

## Fluxo completo (do cadastro ao pedido)

### 1. Descobrir a categoria

```http
GET /ml/categories/predict?titulo=Camiseta basica algodao masculina
```

Devolve as sugestoes do `category_predictor`. Escolha um `category_id`.

### 2. Ver o que a categoria exige

```http
GET /ml/categories/MLB31603/attributes?apenasObrigatorios=true
```

Cada atributo vem com `obrigatorio`, `valoresPermitidos` e `usadoEmVariacoes`
(quando `true`, o atributo entra na combinacao da variacao -- cor, tamanho --
e nao nos atributos do item).

### 3. Enviar as imagens

```http
POST /ml/pictures/upload      (multipart, campo "file")
```

O backend so repassa o binario para `POST /pictures/items/upload` do ML --
nada e gravado em disco nem hospedado em outro lugar. Guarde o `id` retornado.

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

O produto e o anuncio sao criados em **rascunho**; nada foi ao ML ainda. Se a
categoria ja estiver definida, os atributos obrigatorios sao conferidos aqui --
o erro aparece no cadastro, nao na publicacao.

Anuncio **sem** variacoes: mande uma unica entrada em `variacoes` com
`"atributos": []`.

### 5. Publicar

```http
POST /products/{listingId}/publish
```

Monta o payload completo, chama `POST /items` e grava `ml_item_id` e o
`ml_variation_id` de cada variacao. Sem esses ids nao ha como sincronizar
estoque depois.

### 6. Operacao do dia a dia

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
| `order-polling` | `ORDER_POLLING_CRON` (5 min) | Busca pedidos novos, registra e da baixa no estoque. |

Polling em vez de webhook: com menos de 20 anuncios, uma janela de 5 min basta
e evita ter que expor um endpoint publico so para receber notificacao do ML.

## Como o estoque se mantem coerente

Tres decisoes sustentam isso:

- **O banco decide, o ML espelha.** Toda escrita de estoque no ML manda o
  valor **absoluto**, nunca um delta. Reenviar a mesma sincronizacao duas
  vezes nao desconta duas vezes -- entao repetir depois de uma falha e seguro.
- **Alteracao manual so vale se o ML aceitar.** `PUT .../stock` grava, tenta
  propagar e **reverte o banco** se o ML recusar. Divergencia silenciosa entre
  os dois lados e o que faz vender o que nao existe.
- **Baixa por pedido nao e revertida.** A venda ja aconteceu e o proprio ML ja
  descontou do lado dele; o push serve so para reconciliar. Se ele falhar, o
  banco continua correto e o proximo polling reconcilia.

A idempotencia do polling vem do indice unico
`(ml_order_id, ml_item_id, ml_variation_id)` mais a flag `estoque_baixado`:
o mesmo item do mesmo pedido nunca e descontado duas vezes, ainda que apareca
em varias rodadas. Pedido cancelado depois de descontado devolve o estoque.

Detalhe importante em `PUT /items/{id}`: o ML trata `variations` como estado
completo -- variacao ausente do payload e **removida** do anuncio. Por isso
toda atualizacao reenvia o conjunto inteiro de variacoes, nunca so a que mudou.

## Como as credenciais se mantem coerentes

O ML rotaciona o `refresh_token` a cada renovacao: o antigo morre no instante
em que o novo e emitido. Perder uma escrita significa ficar com um token ja
morto e ter que refazer o OAuth na mao. Duas protecoes, que cobrem coisas
diferentes:

- **Renovacoes nunca rodam em paralelo.** Chamadas concorrentes compartilham a
  mesma renovacao em voo, em vez de queimar duas rotacoes.
- **Toda escrita de credencial e serializada**, inclusive a do callback do
  OAuth -- que nao e uma renovacao. Sem isso, refazer o `/ml/auth/login`
  enquanto o job de renovacao roda perde a escrita de um dos dois lados.

Alem da fila, a renovacao faz **compare-and-set**: se o `refresh_token`
armazenado mudou enquanto ela falava com o ML, o resultado dela nasceu velho e
e descartado em silencio (so log), devolvendo ao chamador o par mais recente.
A fila tem timeout curto -- um chamador travado nao segura o job de token para
sempre; quem nao consegue a vez tenta no proximo ciclo.

Vale notar que a **primeira** autorizacao e imune por outro motivo: sem linha
em `ml_credentials`, os dois jobs saem cedo (`sem-credenciais`) e nao ha com
quem competir. A janela real e a re-autorizacao.

## Schema

| Tabela | Papel |
| --- | --- |
| `ml_credentials` | Tokens do OAuth. Uma linha so, garantida por constraint. |
| `products` | Produto interno (SKU, nome, descricao). |
| `ml_listings` | Anuncio: `ml_item_id`, categoria, status, atributos, imagens. |
| `ml_variations` | Combinacao vendavel: `atributos` JSONB, preco, estoque. |
| `orders` | Item de pedido vindo do ML + controle da baixa. |

`atributos` e JSONB porque as combinacoes validas mudam por categoria --
cor/tamanho como colunas fixas quebraria na primeira categoria que usa outro
eixo (voltagem, sabor, capacidade).

## Testes

```bash
npm test
```

Cobrem o que quebra silenciosamente: idempotencia do polling, estorno de
cancelamento, reversao de estoque quando o ML recusa, montagem do payload de
publicacao, reenvio integral das variacoes e a concorrencia em torno das
credenciais.

## Comandos

```bash
npm run start:dev        # desenvolvimento (watch)
npm run build            # compila para dist/
npm run migration:run    # aplica as migrations
npm run migration:revert # desfaz a ultima
npm test                 # testes
```
