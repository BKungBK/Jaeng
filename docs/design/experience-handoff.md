# Handoff Spec: ประสบการณ์ครบ (แผน 6)

Source of truth for intent: `PRODUCT.md`, `DESIGN.md`, spec `docs/superpowers/specs/2026-10-16-jaeng-design.md` §3.2, 3.9, 3.11–3.13. Plan: `docs/superpowers/plans/2026-10-20-06-experience.md` Tasks 7–11. Every UI task still runs `/impeccable shape` first; this sheet is the input to that pass, and where shape finds a better answer inside these constraints the brief wins and this sheet is updated at close-out.

Tokens: the CSS custom properties in `apps/web/src/theme/tokens.scss` (`--bg`, `--surf`, `--ink`, `--ink2`, `--line`, `--pri`, `--onpri`, `--sh`, `--s0…--s3`) and DESIGN.md named sizes. Stack: Angular 22 standalone + signals (zoneless), Ionic 9, MapLibre 5.24, Lucide 1.59.0 through `ICONS` / `<app-icon>`. No new colours.

## Overview

Plan 6 makes the demo's last web step true ("switch Thai/English, works as well on a phone as on a desktop") and fills the pages the spec promised: a list view for people who cannot use the map, an about page with the rules and emergency numbers, place search, the monthly "encouragement" numbers, a way home to the whole country, and a theme switch. The reader is a neighbour on a phone outdoors, a neighbour at a desk, and the instructor watching a live demo; every new control has to be findable in one look and work by keyboard.

New and changed surfaces:

| Surface | Route / place | New? |
|---|---|---|
| Top group: brand card + search + chip tray + more-filters | map, top-left | changed |
| Filters panel | map, from the more-filters button | new |
| Hint card with the numbers | map, bottom-left | changed |
| Controls column: + home, + list | map, right edge | changed |
| Cluster critical count | map markers | changed |
| Toast with action | map | changed |
| List page | `/list` | new |
| About page | `/about` | new |
| Language and theme | brand card, account menu, `/me`, `/about` | new |

## Layout

One breakpoint (820 px), 12 px gutters plus safe area, 8 px between floating elements, as everywhere (DESIGN.md Layout).

| Area | Phone (< 820 px) | ≥ 820 px |
|---|---|---|
| Brand card | "แจ้ง" + tagline, then a row of two 44 px buttons: language (text "EN" / "ไทย") and about (`info`) | same; the two buttons sit at the card's right end on the brand's line |
| Search | a 44 px `search` icon button in the brand card's button row; pressing it lays a full-width search card over the top group (brand and chips hidden while it is open) | a 300 px search field card between the brand card and the chip tray (the group still stops 72 px from the right) |
| Chip tray | under the brand card, the four level chips then a 44 px `slidersHorizontal` button ("ตัวกรองเพิ่มเติม") inside the same tray | beside the search card, same contents |
| Filters panel | `ion-modal` sheet, auto height, 24 px top corners | a 320 px Card White popover under the more-filters button (18 px radius, Float shadow) |
| Hint card | bottom-left, stretches to the controls column, numbers line above the hint line | bottom-left, max 340 px |
| Controls column | zoom in, zoom out, locate, home, list, account; 8 px stack above the FAB | same stack, vertically centred |
| `/list`, `/about` | full page on Cream Ground | centred 600 px Card White card, 24 px from the top (the `/me` grammar) |

Why the language button lives in the brand card and not only in the account menu: the demo switches language while signed out, and the account menu exists only for signed-in people. One tap, always in the same corner.

Why search collapses to an icon on phones: the top of a 375 px screen already holds the brand and four chips; a permanent field would push the chips into a second row and hide the map.

## Design Tokens Used

| Token | Value | Usage |
|---|---|---|
| `--bg` Cream Ground | #FBF7F2 / Night #23212B | pages, insets, hover fills, selected-row fill in results |
| `--surf` Card White | #FFFFFF / Night #2E2B38 | cards, search card, results, filters panel, rows |
| `--ink` Slate Ink | #2B2A33 / #F3EFF7 | all text |
| `--ink2` Muted Ink | #6B6878 / #B7B2C4 | captions, hint line, meta, empty states |
| `--line` Sand Line | #E8E0D5 / #433F52 | borders, dividers, off toggles |
| `--pri` Trust Blue | #3F6FA8 / #9CC0EE | primary buttons, chosen segment edge + 10% tint, focus ring, active-filter count |
| `--s3` Critical Rose | #E57373 | cluster critical pill only (mixed 55% into white, Slate Ink text) |
| Float `--sh` | 0 8px 28px rgba(60,50,40,.18) | every floating card and panel |
| headline | Prompt 600 22–24 px | page h1 |
| title | Prompt 500 15 px | buttons, section headings, result titles |
| body | Plex 400 16 px / 1.6 | about text, inputs (16 px so iOS never zooms) |
| label | Plex 500 14 px | chips, numbers line, segment labels |
| caption | Plex 400 13 px / 1.5 | hint line, meta, group headings in results |
| radii | 10 / 12 / 14 / 18 / 24 px | pills / tiles / buttons, inputs / cards / sheets |

## Components

| Component | File | Inputs / outputs | Notes |
|---|---|---|---|
| `LanguageToggleComponent` | `shared/language-toggle.component.ts` | — | 44 × 44 min, text of the other language, `lang` attribute on that text |
| `ThemeChoiceComponent` | `shared/theme-choice.component.ts` | — | radiogroup of three 44 px segments: ตามเครื่อง `sunMoon`, สว่าง `sun`, มืด `moon` |
| `LanguageChoiceComponent` | `shared/language-choice.component.ts` | — | radiogroup: "ไทย" / "English" |
| `SearchBoxComponent` | `features/map/search-box.component.ts` | `(place)`, `(report)` | combobox + listbox; phone mode via `[collapsed]` |
| `FiltersPanelComponent` | `features/map/filters-panel.component.ts` | uses `FilterState` | categories, show-resolved, clear, done |
| `StatsLineComponent` | `features/map/stats-line.component.ts` | `[stats]` | inside the hint card |
| `ListPage` | `features/list/list.page.ts` | reads `FilterState`, `MapViewService` | |
| `AboutPage` | `features/about/about.page.ts` | — | static text from the dictionaries |
| Toast | `map.page.html` `.toast` | `{ text, action? }` | action is one text button |
| Cluster | `features/map/beacon.ts` `createClusterElement` | `count, maxLevel, critical` | pill when `critical > 0` |
| Buttons | `report-new/_flow.scss` `.btn`, `.primary`, `.ctl` | — | reuse; no new button styles |

New Lucide names (check the export names in the container before adding to `ICONS`): `languages` (`Languages`, account menu row), `info` (`Info`), `house` (`House`), `list` (`List`), `map` (`Map`), `slidersHorizontal` (`SlidersHorizontal`), `sun` (`Sun`), `moon` (`Moon`), `sunMoon` (`SunMoon`), `navigation` (`Navigation`, near-me sort), `arrowUpDown` (`ArrowUpDown`, sort legend).

## States and Interactions

### Brand card buttons
| Element | State | Behavior |
|---|---|---|
| Language | default | "EN" while Thai shows (`lang="en"`, aria-label "Switch to English"); "ไทย" while English shows (`lang="th"`, aria-label "เปลี่ยนเป็นภาษาไทย") |
| Language | press | every string swaps in place; no reload, no overlay closes, focus stays on the button; the URL does not change |
| About | press | navigates to `/about` |
| Both | hover / focus | hover fills Cream Ground; 3 px Trust Blue ring, 2 px offset |

### Search
| Element | State | Behavior |
|---|---|---|
| Field | empty | placeholder "ค้นหาเรื่องหรือสถานที่" / "Search reports or places"; no results card |
| Field | 1 character | no request; results card shows nothing |
| Field | ≥ 2 characters | 300 ms debounce, then places (API) and reports (RPC) in parallel |
| Results | loading | one caption row "กำลังค้นหา…" (`aria-live="polite"` region says it once) |
| Results | ready | up to two groups with caption headings "สถานที่" and "เรื่อง", 5 rows each; place row: `mapPin` + name + muted detail (district, province); report row: 40 px category tile on the level colour 45% into white + title (2 lines max, ellipsis) + level shape and word · status word |
| Results | none | "ไม่เจอเรื่องหรือสถานที่ที่ตรงกับ “{q}”" |
| Results | online places down | reports and local districts still show; a caption under the place group "ค้นสถานที่ออนไลน์ไม่ได้ตอนนี้ แสดงเฉพาะชื่ออำเภอและจังหวัด" |
| Results | both failed | "ค้นหาไม่สำเร็จ" + a "ลองอีกครั้ง" text button |
| Row | hover / keyboard active | Cream Ground fill; active row also gets `aria-selected="true"` |
| Place row | choose | map fits the place's bounds (padding 48 px, max zoom 14) or flies to its point at zoom 13; field keeps the text; results close |
| Report row | choose | navigates to `/r/:id` (the panel flies there as for any link); results close |
| Field | Escape | first press closes results; second clears the field; on phones the third closes the search card and focus returns to the search icon |
| Phone search card | open | brand and chips hidden; field focused; a 44 px `x` button "ปิดการค้นหา" at its right |

### More filters
| Element | State | Behavior |
|---|---|---|
| Button | no extra filter | `slidersHorizontal` only, aria-label "ตัวกรองเพิ่มเติม" |
| Button | N extra filters on | a Trust Blue count pill on the button (e.g. "2"), aria-label "ตัวกรองเพิ่มเติม (เปิดอยู่ 2)" |
| Panel | open | heading "ตัวกรองเพิ่มเติม"; group "หมวด": eight 44 px toggle buttons (icon + name, `aria-pressed`, chosen = 2 px Trust Blue edge + 10% tint + `check`); none chosen means all; a switch row "แสดงเรื่องที่แก้แล้ว" (on by default) |
| Panel | change | applies at once (map reloads through the existing 300 ms debounce); no apply button |
| Panel | "ล้างตัวกรอง" | all categories, resolved on; levels untouched (they have their own chips) |
| Panel | "เสร็จ" / Escape / outside press | closes; focus back to the button |

### Hint card numbers
| Element | State | Behavior |
|---|---|---|
| Numbers line | loading first time | "—" in place of both numbers |
| Numbers line | ready | `circleCheck` "เดือนนี้แก้แล้ว {n} เรื่อง" · `clock` "ค้างอยู่ {m} เรื่อง" (tabular figures); counts the visible map area |
| Numbers line | map moved | refreshes with the bbox load (same debounce); old numbers stay until new ones arrive |
| Numbers line | error | the line hides; the hint line stays (the numbers are encouragement, not data the reader needs) |
| Month | — | the calendar month in Asia/Bangkok, whatever the device's zone |

### Controls column
| Element | State | Behavior |
|---|---|---|
| Home (`house`, "กลับไปดูทั้งประเทศ") | press | flies to the whole-country view (the same view the app opens with); closes nothing |
| List (`list`, "ดูเป็นรายการ") | press | navigates to `/list`, carrying the current map bounds |

### Toast
| Element | State | Behavior |
|---|---|---|
| Toast | plain | as today (3.2 s) |
| Toast | with action | text + a "ลองใหม่" text button (Cream Ground underline, 44 px tall); stays 8 s or until pressed; pressing runs the retry and hides the toast. Used for: bbox load failed, stats are silent, beacon layer failed ("ลองใหม่" reloads the page) |

### Cluster
| Element | State | Behavior |
|---|---|---|
| Cluster | no critical inside | as today |
| Cluster | ≥ 1 critical | a pill at the disc's upper-left: the critical shape + the count in Slate Ink on rose 55% into white; aria-label gains "วิกฤต {n} เรื่อง" |

### `/list`
| Element | State | Behavior |
|---|---|---|
| Header | — | 44 px `map` button "กลับไปแผนที่" (returns to the same map view) + h1 "รายการเรื่อง" + caption "ในกรอบแผนที่ตอนนี้ · {n} เรื่อง" (or "ทั้งประเทศ" when there was no map view) |
| Level chips | — | the same `app-filter-bar`, sharing `FilterState` with the map |
| Sort | default | a radiogroup legend "เรียงตาม" with four segments: ใกล้ฉัน (`navigation`), ใหม่สุด, เจอเหมือนกันมากสุด, ค้างนานสุด; default ใหม่สุด; one row, scrolls sideways on phones |
| Sort | ใกล้ฉัน chosen | asks for the location; while waiting the segment shows "กำลังหาตำแหน่ง…"; denied or unavailable → back to ใหม่สุด and a status line "เปิดสิทธิ์ตำแหน่งก่อนนะ แล้วลองใหม่" |
| Old resolved | — | a 44 px checkbox row "รวมเรื่องที่แก้แล้วเกิน 30 วัน" (off by default); only shown while "แสดงเรื่องที่แก้แล้ว" is on |
| Rows | ready | the `/me` report row: 72 px tile, title, status icon + word, meta (level shape + name, place, "ค้างมา N วัน" for open, เจอเหมือนกัน N, distance "1.2 กม." / "350 ม." for ใกล้ฉัน); whole row links to `/r/:id` |
| Rows | loading | the `/me` ghost rows (3) + "กำลังโหลดรายการ…" |
| Rows | empty | "ไม่มีเรื่องในกรอบนี้" + a secondary "ดูทั้งประเทศ" (switches the box to Thailand) |
| Rows | error | "โหลดรายการไม่สำเร็จ" + "ลองอีกครั้ง" |
| More | ≥ 50 shown and more exist | a secondary "ดูเพิ่มอีก" at the end; loads 50 more; disappears on a short page |

### `/about`
Sections in order, each with an h2: "แจ้งคืออะไร" (two sentences), "กติกาการแจ้ง" (four bullets: talk about the problem, not the person; avoid faces, plates and private details in photos; every report and every "fixed" goes past the reviewer first; this is not an emergency channel), the emergency box (same component and copy as the detail panel, three `tel:` links 191 / 199 / 1669), "ข้อมูลส่วนตัว" (bullets: the e-mail is only for signing in; a hidden name is hidden from the public, the reviewer still knows; photos are re-encoded without metadata or GPS; safety-hazard pins are moved up to 150 m; photos are **not** blurred yet, so leave faces and plates out), "การแสดงผล" (language choice + theme choice, for everyone), "เครดิต" (OpenStreetMap, OpenFreeMap, OCHA COD-AB, MapLibre, Lucide ISC, Prompt and IBM Plex Sans Thai OFL). Never say photos are blurred or checked automatically.

### `/me` and the account menu
| Element | Behavior |
|---|---|
| `/me` | new section "การแสดงผล" between the name and the list: `LanguageChoiceComponent` then `ThemeChoiceComponent` |
| Account menu | new rows after "หน้าผู้ดูแล": "English" / "ภาษาไทย" (`languages`, switches and keeps the menu open) and "เกี่ยวกับแจ้ง" (`info`) |

## Responsive Behavior

| Breakpoint | Changes |
|---|---|
| ≥ 820 px | search is a field card; filters panel is a popover; list/about are a 600 px card |
| < 820 px | search is an icon that opens a full-width card; filters panel is a bottom sheet; list/about are full pages |
| < 420 px | chip tray tightens as today; the more-filters button keeps 44 px; the sort row scrolls sideways (no wrap) |

## Edge Cases

- **English is longer.** No fixed widths on text buttons or segments; chips may wrap inside the tray; the brand tagline may take two lines; result titles clamp at two lines. Test every surface in English at 375 px.
- **Many results.** Search shows at most 5 per group; the list pages by 50; the map stays capped as before.
- **No map view yet** (direct `/list`): the box is all of Thailand and the caption says "ทั้งประเทศ".
- **Slow connection.** Search keeps the last answer until the new one arrives and drops answers for older queries; the numbers keep their last value.
- **Offline / place service down.** Local districts and provinces still answer; the online part says it is unavailable (above).
- **Missing data.** No cover photo → category tile. No place name → the meta line skips it.
- **Theme.** "ตามเครื่อง" follows the system live; an explicit choice wins and survives reload with no flash (set before Angular boots).

## Animation / Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Home button | press | MapLibre `flyTo` to the country view | MapLibre default | MapLibre default |
| Place result | choose | `fitBounds` / `flyTo` | MapLibre default | MapLibre default |
| Phone search card | open / close | fade + 8 px slide down | 160 ms | ease-out |
| Filters sheet | open / close | Ionic sheet default | — | — |
| Language / theme switch | press | none (instant swap) | — | — |

No motion reads `prefers-reduced-motion` (owner rule); nothing here loops.

## Accessibility Notes

- **Focus order on the map:** a skip link "ข้ามไปที่รายการเรื่อง" (visible on focus, goes to `/list`), brand card buttons, search, level chips, more filters, controls column, FAB, then the markers.
- **Search** is the ARIA 1.2 combobox: `role="combobox"`, `aria-expanded`, `aria-controls` the listbox, `aria-activedescendant`; ArrowUp/Down move, Enter chooses, Escape as above; group headings are `role="presentation"` captions with the groups as `role="group"` + `aria-label`.
- **Segments** (sort, language, theme) are `role="radiogroup"` with roving tabindex and arrow keys; the chosen one shows by edge + tint + weight, not colour alone.
- **Language:** `<html lang>` follows the choice; the language button's own text carries `lang` of the language it names. After a switch nothing moves focus.
- **Numbers line** is not live (it would chatter while panning); the hint line stays `aria-live="polite"` as today.
- **Viewport:** drop `maximum-scale=1, user-scalable=no` from `index.html` so pages can be zoomed; the map canvas keeps its own pinch.
- Every new target ≥ 44 × 44 px; every icon-only button has an `aria-label` in both languages.
