#!/bin/bash
# Writes .env from .env.example plus the keys of the running local Supabase stack.
# Never prints secret values.
set -euo pipefail
cd "$(dirname "$0")/.."

status=$(npx supabase status -o env 2>/dev/null) || {
  echo "gen-env: supabase is not running (run: npx supabase start)" >&2
  exit 1
}

# Reads KEY="value" from the status output; the first key that exists wins.
pick() {
  local k line
  for k in "$@"; do
    line=$(printf '%s\n' "$status" | grep -E "^${k}=" | head -n1 || true)
    if [ -n "$line" ]; then
      line=${line#*=}
      line=${line#\"}
      echo "${line%\"}"
      return 0
    fi
  done
  return 1
}

anon=$(pick ANON_KEY PUBLISHABLE_KEY) || { echo "gen-env: no anon key in status" >&2; exit 1; }
service=$(pick SERVICE_ROLE_KEY SECRET_KEY) || { echo "gen-env: no service key in status" >&2; exit 1; }
jwt=$(pick JWT_SECRET) || { echo "gen-env: no JWT secret in status" >&2; exit 1; }

# DEMO_PASSWORD is every demo account's password, and the phone reaches this server over the LAN, so it
# must not be a published one. Keep the one already in .env (the demo users have it); a missing or the
# old well-known one is replaced by a random one, and then the demo users need reset-db.sh once.
demo=""
if [ -f .env ]; then
  demo=$(grep -E '^DEMO_PASSWORD=' .env | head -n1 | cut -d= -f2- || true)
fi
if [ -z "$demo" ] || [ "$demo" = "jaeng-demo-1234" ]; then
  demo=$(openssl rand -hex 12)
  echo "gen-env: new random DEMO_PASSWORD; run: bash scripts/reset-db.sh (it recreates the demo users with it)"
fi

tmp=$(mktemp)
while IFS= read -r l || [ -n "$l" ]; do
  case "$l" in
    DEMO_PASSWORD=*) echo "DEMO_PASSWORD=$demo" ;;
    SUPABASE_ANON_KEY=*) echo "SUPABASE_ANON_KEY=$anon" ;;
    SUPABASE_SERVICE_ROLE_KEY=*) echo "SUPABASE_SERVICE_ROLE_KEY=$service" ;;
    SUPABASE_JWT_SECRET=*) echo "SUPABASE_JWT_SECRET=$jwt" ;;
    *) echo "$l" ;;
  esac
done < .env.example > "$tmp"
mv "$tmp" .env
echo "gen-env: wrote .env ($(grep -c '=' .env) keys)"
