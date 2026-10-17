---
version: 1
slug: "apps-web-src-app-features-map-map-page-ts"
primary_target: "apps/web/src/app/features/map/map.page.ts"
related_targets: []
---

# Surface: แผนที่หน้าแรก (`/`)

**Mode:** Operate. The visitor reads what is wrong where, filters by danger, and picks a report.

## Brief
- **Audience:** neighbors on phone and desktop with equal weight; the instructor in a live demo.
- **Job:** at a glance, see where problems are and how dangerous, with no hover required; zoom from the whole country to a street.
- **Content:** real public reports from `reports_in_bbox` (38 demo reports nationwide, mixed levels and statuses). Real geometry from OCHA COD-AB.
- **States:** loading (map shows, beacons fade in), empty filter result (hint says nothing matches and how to reset), network error (toast, retry on next move), all four chips off.
- **Constraints:** MapLibre GL v5 globe; OpenFreeMap positron; HTML-marker beacons capped at 150; 44 px targets; keyboard reachable beacons; `prefers-reduced-motion` stops pulses and drifting objects.
- **Out of scope now:** detail panel content (plan 3), report flow (plan 4), globe intro flight, i18n switch and dark toggle UI (plan 6).

## Direction contract
THESIS: The map is a toy model of Thailand at first light where the only lights are problems; refuse the category default of red pins on a grey basemap with a sidebar list.
OWN-WORLD: Toy Sea #4FB3EA ground, stacked soil-brown land with green top and orange Isan, Fluent Emoji 3D landmarks; pastel level beams (mint, butter, peach, rose) with white discs; white floating cards, Prompt + Plex Sans Thai, 14–24 px radii, one warm Float shadow.
STORY: The visitor sees all of Thailand lit by counted clusters, understands colour + shape = danger from the chips, zooms, watches the toy dissolve into streets, and finds individual beams whose height says how many neighbors agree.
FIRST VIEWPORT: Full-bleed globe-masked Thailand filling the height; brand card top-left with the level chip group beside it; zoom and locate buttons on the right; zoom-level hint card bottom-left; compass lower right; clusters and compact beams over the land. No bars.
FORM: Owner-pinned world (prototype v2 + toy-poster style, spec 3.11.1 "decisions marked ตัดสินแล้ว win"); concept-seed was never run because a pinned direction beats the roll. seed: none (owner-pinned, no roll)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Signature interaction
Zooming from 6 to 8 cross-fades the toy layers into the street map while beacons stay put; clusters burst into beams at density, beams rise to their `beamHeight` at zoom 12.

## Open decisions
- None for this plan. Exact landmark positions and vehicle paths are the builder's call (spec 14).
