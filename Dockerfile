ARG NODE_IMAGE=node:20-bookworm-slim
FROM ${NODE_IMAGE}

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Engine download from binaries.prisma.sh often gets ECONNRESET; retry separately.
RUN set -eu; \
    ok=0; \
    for i in 1 2 3 4 5; do \
      if npm ci --ignore-scripts; then ok=1; break; fi; \
      echo "npm ci failed (attempt $i), retrying..."; \
      rm -rf node_modules; \
      sleep $((i * 10)); \
    done; \
    test "$ok" = 1

RUN set -eu; \
    ok=0; \
    for i in 1 2 3 4 5; do \
      if npx prisma generate; then ok=1; break; fi; \
      echo "prisma generate failed (attempt $i), retrying..."; \
      sleep $((i * 10)); \
    done; \
    test "$ok" = 1

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/family-tree.db

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
VOLUME /data

ENTRYPOINT ["/docker-entrypoint.sh"]
