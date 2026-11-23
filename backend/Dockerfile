# Nublue API — image for any container host (Render, Fly.io, Railway, Cloud Run...).
# Build from backend/:  docker build -t nublue-api .
# Configuration comes only from environment variables (see .env.example);
# no .env file is copied into the image.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/health" >/dev/null || exit 1

# Migrations run as a separate release step with DATABASE_DIRECT_URL:
#   docker run --rm --env-file prod.env nublue-api node src/db/migrate.js
#   docker run --rm --env-file prod.env nublue-api node src/db/seed-course.js
CMD ["node", "src/server.js"]
