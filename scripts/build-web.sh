#!/bin/bash
# Production build of the web app with its service worker (plan 6, the installable PWA).
# The result lands in apps/web/www; Caddy serves it at http://localhost:8100 next to the dev
# server on :8000. Runs inside the `web` container (its node_modules live on a Linux volume).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d web > /dev/null
docker compose exec -T web npx ng build --configuration production
echo
echo "PWA build: http://localhost:8100"
