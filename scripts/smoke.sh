#!/bin/bash
# Checks the whole dev stack through Caddy on :8000. Exits non-zero on the first failure.
BASE=${BASE:-http://localhost:8000}
fail=0

check() {
  local name="$1" url="$2" want="$3" body
  body=$(curl -fsS --max-time 10 "$url" 2>/dev/null) || { echo "✗ $name ($url unreachable)"; fail=1; return; }
  if [[ "$body" == *"$want"* ]]; then echo "✓ $name"; else echo "✗ $name (missing: $want)"; fail=1; fi
}

check "api health" "$BASE/api/health" '{"ok":true,"db":true}'
check "api config" "$BASE/api/config" 'supabaseAnonKey'
check "supabase via /sb" "$BASE/sb/auth/v1/health" 'GoTrue'
check "web" "$BASE/" '<app-root'

exit $fail
