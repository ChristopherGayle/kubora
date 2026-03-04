# ── Mexxie API — Docker Image ──────────────────────────────────────
# Supports both local QuestDB and cloud PostgreSQL automatically.
# Build: docker build -t mexxie-api ./mexxie-api
# Run:   docker run -p 3001:3001 -e QUESTDB_URL=http://questdb:9000 mexxie-api

FROM node:20-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

CMD ["node", "server.js"]
