#!/bin/bash
# The demo scenario in a real browser (plan 8, Task 13): bash scripts/e2e.sh [--project desktop|mobile] [-- playwright args]
# Resets the demo data first, then runs Playwright in its own image. Do not run it together with
# scripts/test.sh: WSL has 4 GB and both are heavy.
#
# The image tag must match @playwright/test in e2e/package.json. `--network host` reaches the stack's
# published port 8000 as localhost from inside the container (checked: it does on this WSL setup).
set -euo pipefail
cd "$(dirname "$0")/.."

PW_VERSION="1.64.1"
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"

args=()
keep="${E2E_KEEP_DATA:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --project) args+=("--project=$2"); shift 2 ;;
    --keep) keep=1; shift ;; # do not reset the demo data first
    --perf) export PERF=1; shift ;; # also run e2e/tests/perf.spec.ts (frame times, takes minutes)
    --) shift ;;
    *) args+=("$1"); shift ;;
  esac
done

curl -fsS -m 5 http://localhost:8000/api/health > /dev/null || { echo "the stack is not up: bash scripts/dev-up.sh"; exit 1; }
# a reset that fails halfway leaves an empty database (seen once: "error running container"): try once more, then stop
[ "$keep" = "1" ] || bash scripts/reset-db.sh || { echo "reset failed, trying once more"; sleep 10; bash scripts/reset-db.sh; }

# Faster reruns: the install runs only when package-lock.json differs from the copy stamped in node_modules.
# E2E_CPUS caps the browser's CPU (it renders the map on the CPU), so a run in the background leaves the
# machine usable: E2E_CPUS=2 is the default; E2E_CPUS=6 for a quick run while nobody is working.
docker run --rm --network host --ipc host --dns 1.1.1.1 --dns 8.8.8.8 --cpus "${E2E_CPUS:-2}" \
  -e BASE_URL="${BASE_URL:-http://localhost:8000}" -e CI=1 -e PERF="${PERF:-}" \
  -v "$PWD":/repo -w /repo/e2e "$IMAGE" \
  sh -c 'cmp -s package-lock.json node_modules/.lock-stamp || { npm ci --no-audit --no-fund >/dev/null && cp package-lock.json node_modules/.lock-stamp; } && npx playwright test "$@"' sh "${args[@]}"
