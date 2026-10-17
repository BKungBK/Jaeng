#!/bin/bash
# Builds the toy-map geometry for the web app from the OCHA COD-AB provinces (supabase/data).
# Output: apps/web/src/assets/geo/{provinces,land,mask}.json and coast-sdf.{png,json}
set -euo pipefail
cd "$(dirname "$0")/.."
MS="npx --yes mapshaper@0.7.87"
OUT=apps/web/src/assets/geo
mkdir -p "$OUT"

# Provinces: simplified, with a region flag (TH30-TH49 = Isan) for the orange fill.
$MS -i supabase/data/tha_adm1.geojson \
  -simplify 12% keep-shapes \
  -each 'pcode=ADM1_PCODE, name_th=ADM1_TH, region=(+ADM1_PCODE.slice(2) >= 30 && +ADM1_PCODE.slice(2) <= 49) ? "isan" : "other"' \
  -filter-fields pcode,name_th,region \
  -o "$OUT/provinces.json" format=geojson precision=0.001 force

# Land: all provinces dissolved into one outline.
$MS -i "$OUT/provinces.json" -dissolve -o "$OUT/land.json" format=geojson geojson-type=FeatureCollection precision=0.001 force

# Mask: the whole world with Thailand cut out, painted as sea over every other country. Plan 2b
# keeps it on at every zoom, so it is cut from the full-detail outline grown by 300 m: at street
# zoom it must fall short of the street map's coast rather than cover beach roads (the street
# map's own water, tinted to the sea colour, fills the gap).
TMP=$(mktemp -d)
$MS -i supabase/data/tha_adm1.geojson -dissolve -buffer 300 -simplify interval=40 keep-shapes \
  -o "$TMP/land-wide.json" format=geojson geojson-type=FeatureCollection precision=0.00001 force
$MS -i "$TMP/land-wide.json" name=land \
  -rectangle bbox=-180,-85,180,85 name=world \
  -erase land target=world \
  -o "$OUT/mask.json" format=geojson geojson-type=FeatureCollection precision=0.0001 force

# Coast distance texture for the sea shader, from the same grown outline so its zero line sits on
# the mask's edge. pngjs lives in the web container.
mkdir -p apps/web/scripts/data
cp "$TMP/land-wide.json" apps/web/scripts/data/land-wide.json
rm -rf "$TMP"
docker compose exec -T web node scripts/build-coast-sdf.mjs

ls -l "$OUT"
