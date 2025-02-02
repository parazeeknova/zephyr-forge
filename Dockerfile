FROM oven/bun:latest

WORKDIR /app

RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lockb ./

RUN bun install

COPY . .

RUN mkdir -p /app/data

VOLUME ["/app/data"]

CMD ["bun", "run", "start"]