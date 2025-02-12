FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN sed -i '/"preinstall"/d; /"postinstall"/d; /"prepare"/d' package.json && \
    bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data /app/dist/web/assets \
    && chown -R 1000:1000 /app \
    && chmod -R 755 /app \
    && chmod 777 /app/data

COPY package.json bun.lock ./
RUN sed -i '/"preinstall"/d; /"postinstall"/d; /"prepare"/d' package.json && \
    bun install --frozen-lockfile --production

COPY --from=builder --chown=1000:1000 /app/dist/web /app/dist/web
COPY --from=builder --chown=1000:1000 /app/dist/module /app/dist/module
COPY --from=builder --chown=1000:1000 /app/src/server.js ./src/server.js
COPY --from=builder --chown=1000:1000 /app/src/env.js ./src/env.js

USER 1000
VOLUME /app/data
EXPOSE 3456

CMD ["bun", "src/server.js"]
