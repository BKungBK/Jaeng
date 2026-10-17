#!/bin/bash
# Downloads the Microsoft Fluent Emoji 3D images (MIT) used by the map and resizes them to 128 px.
# Output: apps/web/src/assets/emoji/<slug>.png plus LICENSE. The slug list matches
# apps/web/src/app/features/map/emoji.ts.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main
OUT=apps/web/src/assets/emoji
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

while IFS='|' read -r slug folder; do
  [ -z "$slug" ] && continue
  file="$(echo "$folder" | tr 'A-Z ' 'a-z_')_3d.png"
  curl -fsSL "$BASE/assets/${folder// /%20}/3D/$file" -o "$TMP/$slug.png"
  npx --yes sharp-cli@5 -i "$TMP/$slug.png" -o "$OUT/$slug.png" resize 128 128 > /dev/null
  echo "✓ $slug"
done <<'EOF'
hole|Hole
light-bulb|Light bulb
droplet|Droplet
water-wave|Water wave
wastebasket|Wastebasket
deciduous-tree|Deciduous tree
warning|Warning
round-pushpin|Round pushpin
hindu-temple|Hindu temple
elephant|Elephant
dragon|Dragon
sauropod|Sauropod
mountain|Mountain
cherry-blossom|Cherry blossom
desert-island|Desert island
palm-tree|Palm tree
umbrella-on-ground|Umbrella on ground
speedboat|Speedboat
passenger-ship|Passenger ship
sailboat|Sailboat
locomotive|Locomotive
airplane|Airplane
compass|Compass
cloud|Cloud
EOF

curl -fsSL "$BASE/LICENSE" -o "$OUT/LICENSE"
