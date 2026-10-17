#!/bin/bash
# Builds the toy-map geometry for the web app from the OCHA COD-AB provinces (supabase/data).
# Output: apps/web/src/assets/geo/{provinces,land,mask}.json
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

# Mask: the whole world with Thailand cut out, painted as sea over every other country.
$MS -i "$OUT/land.json" name=land \
  -rectangle bbox=-180,-85,180,85 name=world \
  -erase land target=world \
  -o "$OUT/mask.json" format=geojson geojson-type=FeatureCollection precision=0.001 force

ls -l "$OUT"
