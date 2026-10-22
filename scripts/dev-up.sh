#!/bin/bash
# Starts Supabase and the app stack, then waits until the smoke test passes. Safe to run twice.
set -euo pipefail
cd "$(dirname "$0")/.."

mail=$(bash scripts/mail-mode.sh status | head -1)
if [[ "$mail" == *Resend* ]] && ! grep -qs '^RESEND_API_KEY=.\+' supabase/.env; then
  echo "dev-up: login codes are set to Resend but supabase/.env has no RESEND_API_KEY (see: bash scripts/mail-mode.sh)" >&2
fi
npx supabase start > /dev/null
bash scripts/gen-env.sh
docker compose up -d

echo "waiting for the stack (first run installs packages and can take a few minutes)..."
for _ in $(seq 1 90); do
  if bash scripts/smoke.sh > /dev/null 2>&1; then
    bash scripts/smoke.sh
    echo
    echo "แจ้ง:      http://localhost:8000"
    echo "Mailpit:   http://localhost:54324   ($mail)"
    exit 0
  fi
  sleep 2
done

bash scripts/smoke.sh || true
echo "dev-up: stack did not become healthy in 180 s; see: docker compose logs" >&2
exit 1
