# Contexto do build: raiz do repositório (Build path "/" no Easypanel).
FROM node:20-slim AS builder
# Prisma precisa de openssl no Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install

COPY tsconfig.base.json ./
COPY prisma ./prisma
COPY apps/api ./apps/api

RUN npx prisma generate
RUN npm run build --workspace=apps/api

FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000
# As migrações rodam a cada deploy, antes de subir o servidor. `migrate deploy`
# só aplica migrações já commitadas — nunca altera o banco por conta própria.
CMD ["sh", "-c", "npx prisma migrate deploy && node apps/api/dist/server.js"]
