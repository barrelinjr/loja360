# Loja 360

Sistema de caixa, estoque e clientes para comércio local. Este repositório é o
esqueleto do MVP — o que a documentação chama de semanas 1 a 4: **PDV
funcionando ponta a ponta**, com estoque e cadastro de clientes atrás dele.

## Rodar

Requisitos: Node 20+, Docker Desktop.

Um comando por linha, **sem comentário na mesma linha** — no CMD do Windows o
`#` vira argumento e quebra o comando.

```
npm install
npm run setup:env
npm run db:up
npx prisma migrate dev --name init
npm run db:seed
```

Depois, **dois terminais**, um em cada:

```
npm run dev:api     terminal 1, http://localhost:4000
npm run dev:web     terminal 2, http://localhost:3000
```

Login do seed: `dono@padariamodelo.com.br` / `loja360` (dono) ou
`caixa@padariamodelo.com.br` / `loja360` (operador).

Abra `/login`, depois `/pdv`.

### Se algo falhar

**`Environment variable not found: DATABASE_URL`** — o `.env` não existe.
Rode `npm run setup:env` (ou, no CMD, `copy .env.example .env`).

**`no such service: #`** — você colou o comando junto com o comentário.
Cole só o comando.

**`docker` não é reconhecido** — instale o Docker Desktop e abra o programa
antes de rodar `npm run db:up`. Sem Docker, dá para usar um Postgres instalado
na máquina ou um banco gratuito na nuvem (Neon, Supabase): basta trocar a
`DATABASE_URL` no `.env` e pular o `db:up`.

**Projeto dentro do OneDrive** — vale mover para um caminho simples, tipo
`C:\dev\loja360`. O OneDrive fica sincronizando `node_modules` e `.next`, o
que deixa tudo lento e às vezes trava arquivo em uso no meio do build.

Para colocar no ar (Easypanel), veja [DEPLOY.md](DEPLOY.md).

## O que existe

| Módulo | Estado |
|---|---|
| Login, papéis (dono / gerente / caixa) | pronto |
| PDV: busca, leitor de código de barras, carrinho, dinheiro/Pix/cartão, troco | pronto |
| Venda transacional com baixa de estoque | pronto |
| Cancelamento de venda com devolução ao estoque | pronto (API) |
| Estoque: ajuste, histórico de movimentos, alerta de reposição | pronto (API) |
| Clientes: cadastro pelo telefone, histórico, pontos | pronto (API) |
| Painel do dia: faturamento, ticket médio, mais vendidos | pronto |
| E-commerce, agenda, automações de WhatsApp, NF-e | não começou |

## Estrutura

```
prisma/schema.prisma     modelo de dados inteiro
prisma/seed.ts           loja de exemplo
apps/api/                Express + TypeScript + Prisma
  src/modules/sales/     coração do sistema: sale.service.ts
apps/web/                Next.js 14 (App Router) + Tailwind
  app/pdv/page.tsx       tela do caixa
```

## Decisões que diferem da documentação

A doc descreve o produto de dois anos. Este repositório é o de quatro semanas.
O que mudou e por quê:

**Dinheiro em centavos, não `Float`.** `0.1 + 0.2` em ponto flutuante não dá
`0.3`. Num sistema de caixa isso vira diferença no fechamento do dia, que é
justamente a coisa que o lojista confere na unha. Preço, total e troco são
inteiros. Quantidade também: milésimos de unidade, para o pão vendido por quilo.

**REST, sem GraphQL.** Duas camadas de API para um time de uma pessoa é custo
sem retorno. GraphQL passa a valer quando houver app mobile e parceiros
consumindo a API — fase 3, não agora.

**Sem Redis, Kubernetes, Elasticsearch, Auth0, DataDog.** Com 5 clientes-piloto,
o Postgres numa VPS aguenta tudo com folga, e cada peça a mais é uma peça a
mais para cair às sete da manhã de um sábado. JWT resolve login. Cache entra
quando houver consulta lenta medida, não antes.

**Estoque com baixa condicional.** O `UPDATE ... WHERE quantidade >= n` recusa
a venda quando dois caixas disputam a última unidade, em vez de deixar o saldo
negativo. É o bug clássico de PDV com mais de uma máquina.

**Nome e preço congelados no item da venda.** Se o produto mudar de preço
amanhã, o cupom de hoje continua correto — e o relatório do mês passado também.

**`tenantId` sempre do token, nunca do corpo da requisição.** É o que impede
uma loja de ler dados da outra. Vale revisar isso em qualquer query nova.

## Próximos passos, na ordem

1. Impressão de cupom (ESC/POS na impressora térmica) — sem isso não roda na padaria.
2. Fechamento de caixa: abertura, sangria, conferência no fim do turno.
3. Pix de verdade (cobrança dinâmica + webhook de confirmação).
4. PDV funcionando sem internet, sincronizando depois. Muda a arquitetura do
   front, então decida cedo se é requisito de venda ou não.
5. Cadastro de produtos pela tela (hoje só pela API) e importação por planilha.
6. NF-e / NFC-e — provavelmente via emissor terceirizado, não integração direta
   com a SEFAZ.
