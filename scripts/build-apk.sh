#!/bin/bash
# Builds dist/jaeng-debug.apk (plan 7, spec 8.4): the web app for the APK, the Capacitor sync, then
# Gradle inside the jaeng-android image. The APK opens on the address given here; the reader can
# change it in the app (/server), so a new IP does not need a new build.
#   bash scripts/build-apk.sh http://192.168.1.143:8000
set -euo pipefail
cd "$(dirname "$0")/.."

server="${1:-}"
if [ -z "$server" ]; then
  server="http://$(hostname -I | awk '{print $1}'):8000"
  echo "build-apk: no address given, using $server" >&2
fi
case "$server" in http://*|https://*) ;; *) echo "build-apk: the address must start with http:// or https://" >&2; exit 1 ;; esac
server="${server%/}"

if ! docker image inspect jaeng-android > /dev/null 2>&1; then
  echo "build-apk: building the jaeng-android image (first time only, a few minutes)"
  docker build --network host -t jaeng-android infra/android
fi

docker compose up -d web > /dev/null
docker compose exec -T web npx ng build --configuration android

# the address the app starts with, next to index.html (the app reads it when the reader has saved none)
printf '{"server":"%s"}\n' "$server" > apps/web/www-android/server.json

# the launcher icon and splash are generated from apps/web/resources (drawn by
# apps/web/scripts/build-app-icons.mjs) and committed; redo them only when the drawings are newer
if [ apps/web/resources/icon-only.png -nt apps/web/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png ]; then
  docker compose exec -T web npx @capacitor/assets generate --android
fi

docker compose exec -T web npx cap sync android

# Gradle includes the Capacitor plugins' native projects from ../node_modules, which lives in the web
# container's volume (not on /mnt/d), so that volume is mounted next to the android folder. It runs as
# root because Gradle writes build/ folders into those packages; /mnt/d ignores file owners.
docker run --rm --dns 1.1.1.1 --dns 8.8.8.8 \
  -v "$PWD/apps/web/android":/web/android -v "${COMPOSE_PROJECT_NAME:-jaeng}_web_node_modules":/web/node_modules \
  -v jaeng_gradle:/gradle -w /web/android \
  jaeng-android ./gradlew assembleDebug --no-daemon

mkdir -p dist
cp apps/web/android/app/build/outputs/apk/debug/app-debug.apk dist/jaeng-debug.apk
echo
echo "build-apk: dist/jaeng-debug.apk ($(du -h dist/jaeng-debug.apk | cut -f1)), starts on $server"
