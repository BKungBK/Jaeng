#!/bin/bash
# Puts the app on a public https address with a Cloudflare quick tunnel (plan 7; spec 9.2), so the
# phone reaches it from any network with no firewall changes. Needs no account and no install on
# Windows: cloudflared runs from its official Docker image inside the stack's network.
#   bash scripts/tunnel.sh        (Ctrl+C closes the tunnel; the address stops working at once)
#
# It points at :8100, the production build (run scripts/build-web.sh first), not at the dev server.
# The address is new on every run: set it in the app (About > Server settings) or build the APK for it:
#   bash scripts/build-apk.sh https://<the address>
#
# While it runs the whole stack's :8100 is on the internet, demo data only (the stack has no real
# users). The demo quick-login is switched off for that time and back on when the tunnel closes.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME=jaeng-tunnel
IMAGE=cloudflare/cloudflared:latest

[ -f .env ] || { echo "tunnel: .env is missing (run: bash scripts/dev-up.sh)" >&2; exit 1; }
[ -f apps/web/www/index.html ] || { echo "tunnel: no production build yet (run: bash scripts/build-web.sh)" >&2; exit 1; }
curl -sf http://localhost:8100/ > /dev/null || { echo "tunnel: nothing answers on :8100 (run: bash scripts/dev-up.sh)" >&2; exit 1; }

quick_login=$(grep -E '^DEV_QUICK_LOGIN=' .env | head -n1 | cut -d= -f2- || true)

set_quick_login() {
  sed -i "s/^DEV_QUICK_LOGIN=.*/DEV_QUICK_LOGIN=$1/" .env
  docker compose up -d --force-recreate api > /dev/null
  for _ in $(seq 1 30); do curl -sf http://localhost:8000/api/health > /dev/null && return 0; sleep 2; done
  echo "tunnel: the API did not come back in 60 s; see: docker compose logs api" >&2
}

cleanup() {
  trap - EXIT INT TERM
  docker rm -f "$NAME" > /dev/null 2>&1 || true
  if [ "$quick_login" != "false" ]; then
    echo; echo "tunnel: closed; demo quick-login back on"
    set_quick_login "${quick_login:-false}"
  fi
}
trap cleanup EXIT INT TERM

[ "$quick_login" = "false" ] || set_quick_login false

docker rm -f "$NAME" > /dev/null 2>&1 || true
shown=""
docker run --rm --name "$NAME" --dns 1.1.1.1 --dns 8.8.8.8 --network supabase_network_jaeng \
  "$IMAGE" tunnel --no-autoupdate --url http://caddy:8100 2>&1 | while IFS= read -r line; do
  echo "$line"
  if [ -z "$shown" ] && [[ "$line" =~ (https://[a-z0-9-]+\.trycloudflare\.com) ]]; then
    shown=1
    echo
    echo "=============================================================="
    echo "  public address: ${BASH_REMATCH[1]}"
    echo "  APK:            bash scripts/build-apk.sh ${BASH_REMATCH[1]}"
    echo "  Ctrl+C closes the tunnel"
    echo "=============================================================="
    echo
  fi
done
