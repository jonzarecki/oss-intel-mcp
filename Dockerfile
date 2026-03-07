FROM node:22-slim AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsup.config.ts ./
COPY src/ src/
COPY scripts/ scripts/
RUN pnpm build

FROM node:22-slim

RUN corepack enable
WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

EXPOSE 9847
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
