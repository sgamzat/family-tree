# Node 22: служебные скрипты (бэкап, разделение баз) используют встроенный node:sqlite.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE}

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates rclone \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Fewer parallel downloads: a full burst to registry.npmjs.org gets ECONNRESET
# and npm stays silent until the whole attempt gives up.
ENV NODE_OPTIONS=--dns-result-order=ipv4first \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=5000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=30000 \
    NPM_CONFIG_FETCH_TIMEOUT=90000 \
    NPM_CONFIG_MAXSOCKETS=3 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Engine download from binaries.prisma.sh often gets ECONNRESET; retry separately.
RUN --mount=type=cache,target=/root/.npm \
    set -eu; \
    ok=0; \
    for i in 1 2 3 4 5; do \
      echo "npm ci attempt $i"; \
      ( while true; do sleep 20; echo "npm ci still downloading..."; done ) & \
      beat=$!; \
      if npm ci --ignore-scripts --no-audit --no-fund; then \
        kill "$beat" 2>/dev/null || true; \
        wait "$beat" 2>/dev/null || true; \
        ok=1; \
        break; \
      fi; \
      kill "$beat" 2>/dev/null || true; \
      wait "$beat" 2>/dev/null || true; \
      echo "npm ci failed (attempt $i), retrying..."; \
      rm -rf node_modules; \
      sleep $((i * 5)); \
    done; \
    test "$ok" = 1

RUN set -eu; \
    ok=0; \
    for i in 1 2 3 4 5; do \
      echo "prisma generate attempt $i"; \
      if npx prisma generate; then ok=1; break; fi; \
      echo "prisma generate failed (attempt $i), retrying..."; \
      sleep $((i * 10)); \
    done; \
    test "$ok" = 1

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
# Древо и пользователи хранятся отдельно; копии — в /backups.
ENV DATABASE_URL=file:/data/tree/tree.db \
    ACCOUNTS_DIR=/data/accounts \
    BACKUP_DIR=/backups

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
VOLUME ["/data", "/backups"]

ENTRYPOINT ["/docker-entrypoint.sh"]
