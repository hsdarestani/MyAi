FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat && corepack enable
COPY . .
RUN pnpm install --frozen-lockfile=false \
 && pnpm --filter @moones/db generate \
 && pnpm --filter @moones/shared build \
 && pnpm --filter @moones/config build \
 && pnpm --filter @moones/db build \
 && pnpm --filter @moones/ai build \
 && pnpm --filter @moones/billing build \
 && pnpm --filter @moones/api build
CMD ["sh","-c","pnpm --filter @moones/db exec prisma db push --schema prisma/schema.prisma && pnpm --filter @moones/db seed && pnpm --filter @moones/api start"]
