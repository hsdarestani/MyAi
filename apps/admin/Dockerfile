FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat && corepack enable
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile=false \
 && pnpm --filter @moones/shared build \
 && pnpm --filter @moones/config build \
 && pnpm --filter @moones/admin build
CMD ["pnpm","--filter","@moones/admin","start"]
