# Administrative boundaries

- **Source:** OCHA Common Operational Dataset, Thailand administrative boundaries (COD-AB), HDX dataset `cod-ab-tha`
  - File: `tha_admin_boundaries.gdb.zip`
  - URL: https://data.humdata.org/dataset/cod-ab-tha
  - Data valid from 2022-01-22, version v01
- **Licence:** Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO). Credit "OCHA COD-AB" in the app (`/about` and map attribution).
- **Downloaded:** 2026-10-17
- **Processing:**
  1. `ogr2ogr` exported layers `tha_admin1` and `tha_admin2` with the fields renamed: `adm1_pcode → ADM1_PCODE`, `adm1_name1 → ADM1_TH`, `adm1_name → ADM1_EN`, `adm2_pcode → ADM2_PCODE`, `adm2_name1 → ADM2_TH`, `adm2_name → ADM2_EN`.
  2. `mapshaper -simplify 3% keep-shapes` (admin 1) and `-simplify 2% keep-shapes` (admin 2), with `precision=0.0001`.
- **Result:** 77 provinces (`tha_adm1.geojson`) and 928 districts (`tha_adm2.geojson`)
- **Region rule:** provinces `TH30`–`TH49` are `isan`; all others are `other`. This drives the orange Isan colour on the illustrated map.
