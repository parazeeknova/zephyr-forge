FROM oven/bun:1 as builder
WORKDIR /app

COPY package.json bun.lock ./
RUN sed -i '/"preinstall"/d; /"postinstall"/d; /"prepare"/d' package.json && \
    bun install --frozen-lockfile

COPY . .

RUN bun run build && \
    echo "Verifying build output:" && \
    ls -la dist/web && \
    ls -la dist/web/assets

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

RUN ls -la /app/dist/web && \
    ls -la /app/dist/web/assets && \
    chmod -R 755 /app/dist/web

ENV NODE_ENV=production

VOLUME /app/data
USER 1000
EXPOSE 3456

CMD ["bun", "src/server.js"]
