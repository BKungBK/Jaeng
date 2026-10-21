#!/bin/bash
# Checks dist/jaeng-debug.apk (plan 7): the package, the permissions the report flow needs, the bundled
# web app and no service worker. Runs inside the jaeng-android image (aapt2 lives there).
set -uo pipefail
cd "$(dirname "$0")/.."

APK=dist/jaeng-debug.apk
[ -f "$APK" ] || { echo "check-apk: $APK is missing (run: bash scripts/build-apk.sh)" >&2; exit 1; }

report=$(docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/dist":/dist jaeng-android bash -c '
  aapt2=$(ls "$ANDROID_HOME"/build-tools/*/aapt2 | tail -n1)
  "$aapt2" dump badging /dist/jaeng-debug.apk
  echo "=== manifest"
  "$aapt2" dump xmltree --file AndroidManifest.xml /dist/jaeng-debug.apk
  echo "=== files"
  unzip -Z1 /dist/jaeng-debug.apk
  echo "=== server.json"
  unzip -p /dist/jaeng-debug.apk assets/public/server.json 2> /dev/null || true
')

fail=0
# (a here-string, not a pipe: `grep -q` quits early and pipefail would count printf's SIGPIPE as a miss)
has() { # has <label> <extended regex>
  if grep -Eq "$2" <<<"$report"; then echo "✓ $1"; else echo "✗ $1"; fail=1; fi
}
lacks() {
  if grep -Eq "$2" <<<"$report"; then echo "✗ $1"; fail=1; else echo "✓ $1"; fi
}

has "package th.jaeng.app" "package: name='th.jaeng.app'"
has "label แจ้ง" "application-label:'แจ้ง'"
for p in INTERNET CAMERA ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION; do
  has "permission $p" "uses-permission: name='android.permission.$p'"
done
has "cleartext traffic allowed" "usesCleartextTraffic.*(true|0xffffffff)"
has "web app bundled" "^assets/public/index.html$"
# server.json is optional (a build without an address); when it is there it must hold one
if grep -Eq "^assets/public/server.json$" <<<"$report"; then
  has "server.json holds an address" '"server" ?: ?"https?://'
else
  echo "- no server.json: the app asks for the address on first start"
fi
has "map assets bundled" "^assets/public/assets/geo/mask.json$"
lacks "no service worker" "^assets/public/(ngsw-worker.js|ngsw.json)$"
exit $fail
