#!/bin/bash
# Runs every test suite. Web tests run inside the `web` container: its node_modules lives on a
# Linux volume, while loading them from /mnt/d is slow enough to time out Vitest's workers.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0

run() {
  local name="$1"; shift
  echo "=== $name"
  if "$@"; then echo "--- $name: PASS"; else echo "--- $name: FAIL"; fail=1; fi
}

bun_in() {
  docker run --rm --dns 1.1.1.1 --dns 8.8.8.8 --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$PWD":/repo -w "/repo/$1" oven/bun:1 bun test
}

web_tests() {
  docker compose up -d web > /dev/null
  docker compose exec -T web npx ng test --watch=false
}

run "shared" bun_in packages/shared
run "api" bun_in apps/api
run "web" web_tests
run "db" npx supabase test db
run "seed" bash scripts/check-seed.sh

exit $fail
