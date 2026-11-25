# syntax=docker/dockerfile:1
# Alternativa à Vercel: imagem única com o site e a API (ver DEPLOY.md).

# ---------- dependências ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund && rm -rf .next/cache

# ---------- runtime ----------
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nublue && adduser -S nublue -G nublue
COPY --from=build --chown=nublue:nublue /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/infra ./infra
COPY --from=build /app/package.json /app/next.config.mjs ./
USER nublue
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/status > /dev/null || exit 1
# Aplica migrações pendentes, atualiza o catálogo e inicia o servidor.
CMD ["sh", "-c", "node infra/scripts/migrate.mjs up && node infra/scripts/seed.mjs && npx next start"]
