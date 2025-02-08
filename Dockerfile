FROM oven/bun:1 as builder

WORKDIR /app

COPY package*.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM oven/bun:1-slim

WORKDIR /app

RUN apt-get update && apt-get install -y sqlite3 curl && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /app/data /app/dist && \
    chown -R 1000:1000 /app && \
    chmod -R 755 /app && \
    chmod 777 /app/data

COPY package*.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server.js ./
COPY --from=builder /app/src/env.js ./

VOLUME ["/app/data"]

USER 1000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/status || exit 1

CMD ["bun", "server.js"]
