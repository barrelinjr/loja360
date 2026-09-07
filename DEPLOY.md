# Deploy no Easypanel

Três serviços dentro de um projeto: o banco, a API e o front. O Easypanel
cuida do domínio e do certificado.

## Antes de subir

**1. Gere as migrações e commite.** No seu Windows, com o Postgres local
rodando:

```
npx prisma migrate dev --name init
```

Isso cria `prisma/migrations/`. Essa pasta **precisa ir para o Git** — é ela
que o container aplica no deploy. Sem ela, a API sobe com o banco vazio.

**2. Mande o repositório para o GitHub.** O Easypanel puxa de lá. Repositório
privado funciona; configure o token do GitHub no servidor antes.

**3. Confira que o `.env` não foi commitado.** Ele está no `.gitignore`. As
variáveis de produção vão na aba Environment de cada serviço, não no Git.

## Serviço 1 — Postgres

New Service → Postgres, nome `db`. Defina senha e crie.

Abra **Credentials** e copie a *internal connection URL*. É ela que a API vai
usar — o banco não precisa (nem deve) ter domínio público.

Acrescente `?schema=public` no final se ainda não tiver.

## Serviço 2 — API

New Service → App, nome `api`.

| Campo | Valor |
|---|---|
| Source | GitHub → seu repositório, branch `main` |
| Build path | `/` |
| Builder | Dockerfile |
| Dockerfile path | `apps/api/Dockerfile` |

O build path é a raiz porque o Dockerfile precisa enxergar `prisma/` e o
`package.json` do workspace, que estão fora de `apps/api`.

Environment:

```
DATABASE_URL=<internal connection URL do serviço db>
JWT_SECRET=<32 bytes aleatórios>
API_PORT=4000
CORS_ORIGIN=https://loja.seudominio.com.br
```

Para gerar o segredo:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Domains: `api.seudominio.com.br` → porta **4000**.

Deploy. Nos logs você deve ver as migrações aplicando e depois
`API do Loja 360 em http://localhost:4000`. Teste em
`https://api.seudominio.com.br/health`.

## Serviço 3 — Front

New Service → App, nome `web`.

| Campo | Valor |
|---|---|
| Build path | `/` |
| Builder | Dockerfile |
| Dockerfile path | `apps/web/Dockerfile` |

Environment:

```
API_URL=https://api.seudominio.com.br
```

Domains: `loja.seudominio.com.br` → porta **3000**.

`API_URL` é lida a cada request e injetada na página, não no build. Quer
apontar a mesma imagem para outra loja? Troca a variável e reinicia — sem
rebuild.

## Primeiro acesso

Crie a loja e o usuário. No serviço `api`, abra o terminal do Easypanel:

```
npx tsx prisma/seed.ts
```

Isso cria a padaria de exemplo. **Para um cliente de verdade, edite o seed
antes** ou crie a loja e o dono direto no banco — não deixe
`dono@padariamodelo.com.br / loja360` de pé num sistema em produção.

## O que verificar depois do primeiro deploy

- **Login funciona no navegador.** Se der erro de CORS, o `CORS_ORIGIN` da API
  não bate exatamente com o domínio do front (com `https://`, sem barra no fim).
- **Postgres sem domínio público.** Banco de loja não fica aberto na internet.
- **Backup.** O Easypanel tem template de backup do Postgres para S3. Configure
  antes do primeiro cliente real, não depois. Um PDV sem backup é uma questão
  de tempo.
- **RAM do servidor.** O build do Next consome bem; abaixo de 2 GB o deploy
  pode morrer por falta de memória no meio.

## Atualizando

`git push` na branch conectada. Com auto deploy ligado, o Easypanel reconstrói
sozinho. As migrações novas são aplicadas na subida do container da API.

Migração que apaga ou renomeia coluna merece deploy fora do horário da loja:
o container antigo e o novo convivem por alguns segundos durante o rolling
update do Swarm.
