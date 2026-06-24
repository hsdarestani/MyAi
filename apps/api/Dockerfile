FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile=false && pnpm --filter @moones/db generate && pnpm --filter @moones/api build
CMD ["sh","-c","pnpm --filter @moones/db migrate && pnpm --filter @moones/db seed && pnpm --filter @moones/api start"]
