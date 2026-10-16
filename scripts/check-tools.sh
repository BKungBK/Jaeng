#!/bin/bash
# Checks that the WSL toolchain needed for แจ้ง is present.
cd "$(dirname "$0")/.." || exit 1
fail=0

check() {
  local name="$1"; shift
  if out=$("$@" 2>&1); then
    echo "✓ $name: $(echo "$out" | head -n1)"
  else
    echo "✗ $name"
    fail=1
  fi
}

node_major() {
  local v p
  # Must be a Linux node inside WSL, not the Windows node.exe reached through /mnt/c.
  p=$(command -v node) || return 1
  case "$p" in /mnt/*) return 1 ;; esac
  v=$(node -v) || return 1
  v=${v#v}
  [ "${v%%.*}" -ge 22 ] && echo "node v$v"
}

check "docker daemon" docker info --format '{{.ServerVersion}}'
check "docker compose" docker compose version
check "node >= 22" node_major
check "supabase cli" npx --no-install supabase --version

exit $fail
