FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile=false && pnpm --filter @moones/admin build
CMD ["pnpm","--filter","@moones/admin","start"]
