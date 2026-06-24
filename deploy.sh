#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api pnpm --filter @moones/db migrate
docker compose exec api pnpm --filter @moones/db seed
