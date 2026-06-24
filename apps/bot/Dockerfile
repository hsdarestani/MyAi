FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile=false && pnpm --filter @moones/db generate && pnpm --filter @moones/bot build
CMD ["pnpm","--filter","@moones/bot","start"]
