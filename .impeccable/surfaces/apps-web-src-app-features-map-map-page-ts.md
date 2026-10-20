---
version: 1
slug: "apps-web-src-app-features-map-map-page-ts"
primary_target: "apps/web/src/app/features/map/map.page.ts"
related_targets: ["apps/web/src/app/features/map/map.page.html","apps/web/src/app/features/map/map.page.scss"]
---

# Surface: แผนที่หน้าแรก (`/`)

**Mode:** Operate. The visitor reads what is wrong where, filters by danger, and picks a report.

## Brief
- **Audience:** neighbors on phone and desktop with equal weight; the instructor in a live demo.
- **Job:** at a glance, see where problems are and how dangerous, with no hover required; zoom from the whole country to a street.
- **Content:** real public reports from `reports_in_bbox` (38 demo reports nationwide, mixed levels and statuses). Real geometry from OCHA COD-AB.
- **States:** loading (map shows, beacons fade in), empty filter result (hint says nothing matches and how to reset), network error (toast with a "ลองใหม่" text button, 8 s), all four chips off.
- **Constraints:** MapLibre GL v5; OpenFreeMap positron; HTML-marker beacons capped at 150; 44 px targets; keyboard reachable beacons; motion never stops for `prefers-reduced-motion` (owner decision).
- **Kept from plan 6:** skip link first; search combobox behaviour; more-filters panel; month numbers (Bangkok month, "—" while loading, hidden on failure); critical pill on clusters; street names follow the language.
- **Plan 6b (glass UI, owner-approved 2026-10-20):** layout from `.impeccable/mocks/decision/fused-mobile.html` and `fused-desktop.html`. The owner asked twice for less: smaller controls, fewer tips, nothing that explains itself in prose when a shape can.

## Direction contract
THESIS: Frosted, grain-textured glass floats over the toy Thailand at night-into-dawn; refuse both the plan-6 pile of white cards and the stock map app's white sheets.
OWN-WORLD: Navy sea gradient (#0E1D40 → #13264D) with a lavender glow top-left and a peach dawn glow bottom-right; glass panels = 12%→3% white sheen over rgba(16,26,54,.45), 24 px blur, 1 px rgba(255,255,255,.13) edge, SVG fractal-noise overlay at 15%; ink #F3EFF7, muted 60%; one accent, the dawn gradient #FFE3C4 → #F4B49A → #C9A0DC, only on the brand mark, the report button and the progress ring; pastel level dots with their shapes; Anuphan throughout.
STORY: The visitor sees the toy map almost uncovered, reads "34 ค้างอยู่ · แก้แล้ว 4" in one line, taps a level to filter, zooms into beams, and reports with the one warm-coloured button.
FIRST VIEWPORT: Phone: 46 px search pill (mark, search, account) top; one row of 32 px level chips; map; a 40 px summary pill bottom-left with the locate button beside it; a 300 px dock (แผนที่, รายการ, round +, ของฉัน). Desktop: a 340 px content-height panel top-left (search row, chips, summary, top 3 reports in view, "ดูทั้งหมด"); a nav capsule top-right (แผนที่, รายการ, ของฉัน, EN, ⓘ); a 40 px control column bottom-right (+, −, ◎, ⌂) above a 46 px "+ แจ้ง" pill.
FORM: Assigned direction (lacquer-glass) fused by the owner with the canon map-app arrangement and the frosted-gradient material of the pick; position 4 of the grounded list. seed:db6fbc3e34224ad5
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Signature interaction
The intro: a point of light rises into a beam, writes "แจ้ง", the dawn gradient blooms and the view falls into the map. On the map, glass panels rise in once with a stagger, beacons scale up from their base, and every camera move uses one easing.

## Open decisions
- None. Light theme keeps the same layout with white frosted glass; dark is the default when nothing is stored.
