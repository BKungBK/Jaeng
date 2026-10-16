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

tmp=$(mktemp)
while IFS= read -r l || [ -n "$l" ]; do
  case "$l" in
    SUPABASE_ANON_KEY=*) echo "SUPABASE_ANON_KEY=$anon" ;;
    SUPABASE_SERVICE_ROLE_KEY=*) echo "SUPABASE_SERVICE_ROLE_KEY=$service" ;;
    SUPABASE_JWT_SECRET=*) echo "SUPABASE_JWT_SECRET=$jwt" ;;
    *) echo "$l" ;;
  esac
done < .env.example > "$tmp"
mv "$tmp" .env
echo "gen-env: wrote .env ($(grep -c '=' .env) keys)"
