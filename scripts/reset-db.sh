#!/bin/bash
# Recreates the local database from migrations and seed files, then loads the demo data.
set -euo pipefail
cd "$(dirname "$0")/.."
npx supabase db reset
[ -f .env ] || bash scripts/gen-env.sh
docker run --rm --network supabase_network_jaeng --env-file .env \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/repo -w /repo oven/bun:1 bun scripts/seed.ts
