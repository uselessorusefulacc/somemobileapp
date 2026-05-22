FROM oven/bun:1.2-slim
WORKDIR /app
COPY package.json ./
RUN bun install --production
COPY src ./src
EXPOSE 8082
CMD ["bun", "src/relay.ts"]
