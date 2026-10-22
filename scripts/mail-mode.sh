#!/bin/bash
# Where login codes go: `resend` (real inboxes, needs RESEND_API_KEY in supabase/.env) or `mailpit`
# (the local inbox at :54324). Edits `enabled` under [auth.email.smtp] in supabase/config.toml; Auth
# reads it at start, so run dev-up.sh (or `npx supabase stop && npx supabase start`) afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."

config=supabase/config.toml

current() {
  awk '/^\[auth\.email\.smtp\]/ { in_block = 1; next } /^\[/ { in_block = 0 } in_block && /^enabled *=/ { print $3; exit }' "$config"
}

case "${1:-status}" in
  resend)
    if ! grep -qs '^RESEND_API_KEY=.\+' supabase/.env; then
      echo "mail-mode: put RESEND_API_KEY=... in supabase/.env first" >&2
      exit 1
    fi
    value=true
    ;;
  mailpit) value=false ;;
  status) value= ;;
  *)
    echo "usage: bash scripts/mail-mode.sh resend|mailpit|status" >&2
    exit 2
    ;;
esac

if [ -n "$value" ]; then
  # only the `enabled` line of the smtp block, not the other `enabled` lines in the file
  sed -i '/^\[auth\.email\.smtp\]/,/^\[/ s/^enabled *=.*/enabled = '"$value"'/' "$config"
fi

if [ "$(current)" = "true" ]; then
  echo "login codes: Resend (real inboxes)"
else
  echo "login codes: Mailpit (http://localhost:54324)"
fi
[ -z "$value" ] || echo "restart Auth to apply: bash scripts/dev-up.sh"
