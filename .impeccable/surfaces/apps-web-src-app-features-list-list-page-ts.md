---
version: 1
slug: "apps-web-src-app-features-list-list-page-ts"
primary_target: "apps/web/src/app/features/list/list.page.ts"
related_targets: ["apps/web/src/app/features/list/list.service.ts","apps/web/src/app/core/filter-state.service.ts","apps/web/src/app/core/map-view.service.ts"]
---

# Surface: รายการเรื่อง (`/list`)

**Mode:** Operate. A neighbour who cannot or would rather not use the map reads what is wrong around them as rows, sorts them, and opens one.

## Brief
- **Audience:** keyboard and screen-reader users (spec: "a list view as an alternative to the map"), phone readers who want to scan faster than panning, the instructor checking that unresolved problems stay visible.
- **Job:** (1) see the reports of the area the map was showing (or all of Thailand), (2) sort them four ways, (3) include reports fixed more than 30 days ago when asked, (4) open one on the map.
- **Content (real data, `list_reports`):** 0–n rows, 50 a page. Each: cover thumb or none, title, category, level, status (open / fix_claimed / resolved), place name or null, days open, me-too count, distance (only for "near me").

## Direction (incumbent world, DESIGN.md unchanged)
- **Page grammar:** the `/me` grammar: Cream Ground page, a centred 600 px Card White card from 820 px (24 px from the top, 18 px radius, Float shadow), a flat page on phones.
- **Order:** header (44 px `map` button "กลับไปแผนที่" that pops back to the same map view, h1 "รายการเรื่อง", caption "ในกรอบแผนที่ตอนนี้ · N เรื่อง" or "ทั้งประเทศ · N เรื่อง") > the map's level chips and more-filters (same `app-filter-bar`, `FilterState` shared) > sort > "รวมเรื่องที่แก้แล้วเกิน 30 วัน" checkbox (only while fixed reports are shown) > status line > rows > "ดูเพิ่มอีก".
- **Sort:** caption "เรียงตาม" over one segmented radiogroup (Cream Ground inset, the chosen segment Card White + Float shadow + weight 600): ใกล้ฉัน (`navigation`), ใหม่สุด (default), เจอเหมือนกันมากสุด, ค้างนานสุด. One row that scrolls sideways on narrow phones. Arrow keys move and choose. "ใกล้ฉัน" asks for the position ("กำลังหาตำแหน่ง…" in the segment); refused or unavailable: back to ใหม่สุด and the status line says "เปิดสิทธิ์ตำแหน่งก่อนนะ แล้วลองใหม่อีกครั้ง".
- **Rows:** the `/me` row (72 px tile, title, status icon + word, muted meta: level shape + word · place · "ค้างมา N วัน" for open (ink when over 30) · เจอเหมือนกัน N · distance for ใกล้ฉัน). The whole row is an `<a href="/r/:id">`; a plain click returns to the map page and opens the report there.
- **States:** loading (caption + three static ghost rows), error ("โหลดรายการไม่สำเร็จ" + "ลองอีกครั้ง"), empty ("ไม่มีเรื่องในกรอบนี้" + secondary "ดูทั้งประเทศ" when the box was a map view), more ("ดูเพิ่มอีก" while a page came back full). A change of filter or sort starts again at the top and drops late answers. Live signals reload the first page quietly (1 s), unless the reader already paged on.
- **Language:** every string from the dictionaries; switching rewords in place without reloading.

## Constraints
44 px targets, focus ring 3 px Trust Blue offset 2 px, one breakpoint 820 px, status never by colour alone, user text by interpolation only, Lucide only, never `prefers-reduced-motion`.
