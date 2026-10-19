# Handoff Spec: หน้าผู้ดูแล (`/admin`)

Source of truth for intent: `.impeccable/surfaces/apps-web-src-app-features-admin-admin-page-ts.md` (shape brief). Tokens: `DESIGN.md` front matter and the CSS custom properties in `apps/web/src/theme/tokens.scss` (`--bg`, `--surf`, `--ink`, `--ink2`, `--line`, `--pri`, `--onpri`, `--sh`). Stack: Angular 22 standalone + signals, Ionic 9, MapLibre 5.24, Lucide via `ICONS` / `<app-icon>`. Plan: `docs/superpowers/plans/2026-10-19-05-admin.md` Tasks 11–13.

## Overview
One admin (the project owner) clears what waits for review: new reports, "แจ้งว่าแก้แล้ว" claims, reported content, users, and reads the log. Every action changes what the public sees, so the page is calm and deliberate: one item at a time, the two decisions far apart and different in shape and word. It is also a live demo step ("admin approves, the beam appears"), seen on a desktop browser and a phone.

Entry: account menu → "หน้าผู้ดูแล" (admins only). Route `/admin?tab=<tab>`, guarded by `adminGuard` (waits for the profile; non-admins go to `/`, signed-out to `/login?next=%2Fadmin`). The API re-checks the role on every call.

## Layout
| Area | Phone (< 820 px) | ≥ 820 px |
|---|---|---|
| Page | `ion-page`, Cream Ground (`--bg`), one scrolling `.scroller` | same |
| Card | full width, flat, padding `spacing-md` top (+ safe area) / `spacing-lg` sides / `spacing-xl` bottom (+ safe area) | centred, **760 px** wide, `rounded.card` 18 px, Float shadow `--sh`, padding 20 / 24 / 28, 24 px from the top |
| Header | 44 px `chevronLeft` (aria-label "กลับไปแผนที่") + h1 "หน้าผู้ดูแล" | same |
| Tabs | one row, horizontal scroll, `scroll-snap-type: x`, no wrap, selected tab scrolled into view | one row, all five visible |
| Review item | stacked: photos → title → tags → facts → map (200 px) → decision | photos → title → tags → two columns: facts (1fr) + map (300 px wide, 240 px tall) → decision |

Vertical rhythm inside the card: 20 px between header, tabs and tab body; 12 px between blocks inside an item; 16 px between items. One breakpoint only (820 px), as everywhere in the app.

Why 760 px and not `/me`'s 600 px: the review needs the facts and the map side by side so the admin compares the description with the place without scrolling.

## Design Tokens Used
| Token | Value | Usage |
|---|---|---|
| `colors.cream-ground` `--bg` | #FBF7F2 | page, section insets (approve/reject), hover fills, placeholders |
| `colors.card-white` `--surf` | #FFFFFF | card, items, inputs, chips off |
| `colors.slate-ink` `--ink` | #2B2A33 | all text; text on pastel |
| `colors.muted-ink` `--ink2` | #6B6878 | captions, e-mail, meta, counts |
| `colors.sand-line` `--line` | #E8E0D5 | borders, dividers, off chips |
| `colors.trust-blue` `--pri` | #3F6FA8 | primary buttons, selected tab underline, chosen radio edge + tint, focus ring |
| level colours (mint/butter/peach/rose) | DESIGN.md | level pill and chips only (55% into white), tiles 45% into white |
| `typography.headline` | Prompt 600 22 px | h1 |
| `typography.title` | Prompt 500 15 px | buttons, tab labels, section headings |
| review title | Prompt 600 20 px / 1.35 | report title in the review card (wraps anywhere) |
| `typography.body` | Plex 400 16 px / 1.6 | description, comment bodies |
| `typography.label` | Plex 500 14 px | field labels, legends, counter line |
| `typography.caption` | Plex 400 13 px / 1.5 | hints, meta, `n/max` counters (tabular) |
| `rounded.tag` 10 px | | tags, label pills on photos |
| `rounded.thumb` 12 px | | photos, map, tiles, radio rows |
| `rounded.chip` 14 px | | buttons, inputs, items, sections |
| `rounded.card` 18 px | | the page card |
| `spacing.xs/sm/md/lg/xl` | 4 / 8 / 12 / 16 / 24 | gaps as listed above |

No new colours. Nothing glows (One Light rule: only beacons, which this page has none of).

## Components
| Component | File | Inputs / outputs | Notes |
|---|---|---|---|
| `AdminPage` | `features/admin/admin.page.ts` | reads `?tab=` | tablist, counts from `AdminService.counts()` on enter and after every child `changed` |
| Tab button | in page | — | 44 px tall, padding 0 14 px, icon 18 px + word + " · N" (reports/claims/flags only; 0 shows "0") |
| `ReviewQueueComponent` | `review-queue.component.*` | `(changed)` | one report at a time; approve/reject sections |
| `PlaceMapComponent` | `place-map.component.ts` | `[truePoint] [publicPoint] [picking]` → `(picked)` | the only MapLibre map; HTML markers; created once |
| `ClaimsQueueComponent` (Task 12) | `claims-queue.component.*` | `(changed)` | before/after side by side |
| `FlagsQueueComponent` (Task 12) | `flags-queue.component.*` | `(changed)` | per-target cards + "ซ่อนอยู่" list |
| `UsersTabComponent` (Task 13) | `users-tab.component.*` | — | search 300 ms debounce, two-step ban |
| `LogTabComponent` (Task 13) | `log-tab.component.*` | — | 50 per page, "ดูเก่ากว่านี้" |
| Buttons | `report-new/_flow.scss` `.btn`, `.primary`, `.big`, `.ctl` | — | primary = Trust Blue fill; secondary = Card White + Sand Line; `.big` 52 px |
| Level chip | review `.chip` | — | DESIGN.md Chips: on = level colour 55% into white + shape; off = outline, Muted Ink |
| Category pick | review `.pick` | — | 72 px min, icon 24 over name; chosen = 2 px Trust Blue + 10% tint + `check` |
| Radio row | `_admin.scss` `.reason` | `role="radio"` `aria-checked` | 44 px; chosen = 2 px Trust Blue + `check` mark |

## States and Interactions
| Element | State | Behaviour |
|---|---|---|
| Tab | selected | `aria-selected="true"`, 2 px Trust Blue underline, label weight 600 (shape + weight, not colour alone); updates `?tab=` with `replaceUrl` |
| Tab | keyboard | ←/→ move focus and select, Home/End first/last (roving `tabindex`) |
| Counter ‹ › | 1 item | both disabled (Muted Ink) |
| "ปฏิเสธ…" / "อนุมัติ…" | default | opposite ends of the row (`justify-content: space-between`); reject = secondary + `circleX`, approve = primary + `circleCheck` |
| Approve / reject section | open | replaces the decision row; own "ยกเลิก" returns to the row |
| "อนุมัติ ขึ้นแผนที่" | disabled | while sending or title > 120 code points |
| "ยืนยันปฏิเสธ" | disabled | until a reason is chosen; note > 200 |
| Any action | sending | every button in the queue disabled; a second press is ignored (flag set before the first await) |
| Any action | success | item leaves the list, next one shows, `role="status"` line says what happened, counts reload |
| Any action | 409 `invalid_state` | the API's Thai message in the status line, the queue reloads |
| Any action | other error | `messageTh` (or the shared internal message) in the status line, item stays |
| Location "ปักหมุดเอง" | picking | markers hide, a fixed Trust Blue `mapPin` (40 px) sits at the map centre, caption "เลื่อนแผนที่ให้หมุดตรงจุดที่จะแสดง"; each `moveend` sets the point |
| Hazard (chosen category) | info | caption "เรื่องจุดเสี่ยงจะถูกเลื่อนให้อัตโนมัติ เว้นแต่เลือกตำแหน่งจริง" |
| Buttons / rows | hover | Cream Ground fill (primary: Trust Blue 88% mixed with ink), 160 ms ease-out |
| Everything focusable | focus | 3 px Trust Blue outline, 2 px offset |
| "ซ่อนและแบนเจ้าของ" / "แบน" (Tasks 12–13) | first press | turns into "แน่ใจ แบนเลย" + "ยกเลิก" in place; focus moves to "ยกเลิก" |

## Responsive Behavior
| Breakpoint | Changes |
|---|---|
| ≥ 820 px | 760 px card; facts + map in two columns; categories in 4 columns; tabs all visible |
| < 820 px | flat full-width page; one column; map 200 px under the facts; categories in 2 columns; photos 180 px tall; tabs scroll sideways |

## Edge Cases
- **Empty queues:** a 64 px disc (`circleCheck`, 14% Trust Blue tint) + one line: "ไม่มีเรื่องรอตรวจ เยี่ยมเลย" / "ไม่มีคำขอรอตรวจ" / "ไม่มีรายงานค้าง"; users search with no hits: "ไม่เจอผู้ใช้ที่ตรงกับคำค้น".
- **Loading:** "กำลังโหลด…" (caption) + one 160 px Cream Ground block; no shimmer (motion is never added for decoration).
- **Error:** status line + secondary "ลองอีกครั้ง" (`refreshCw`).
- **Photos:** 0 → category tile (icon on level colour 45% into white); 1 → full width; 2–4 → 86% wide scroll-snap strip; a URL that failed to sign (`''`) → the tile in that slot.
- **Long text:** titles, names, e-mails, places and comment bodies wrap anywhere (`overflow-wrap: anywhere`), never truncate; descriptions keep line breaks (`pre-wrap`).
- **Hidden author:** the real name and e-mail always show here, plus the "ขอปิดชื่อ" tag.
- **Coinciding points:** one marker labelled "จุดจริง (แสดงตรงนี้)".
- **Slow network:** buttons stay disabled until the answer; nothing is optimistic except removing the decided item after success.
- **Stale data:** another tab acted first → 409 → reload (see States).

## Animation / Motion
| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Buttons, rows | hover | background colour | 160 ms | ease-out |
| Small map | report change | `jumpTo` (no fly), markers reposition on `move` | instant | — |

No other motion. Never read `prefers-reduced-motion` (owner rule): the page simply has no decorative motion.

## Accessibility Notes
- **Focus order:** back button → h1 (focused on enter, `tabindex="-1"`) → tablist → status line (not focusable) → counter ‹ › → photos (not focusable) → decision buttons → section fields in visual order → section actions (cancel, then confirm).
- **Roles:** `role="tablist"`, tabs `role="tab"` with `aria-selected` and `aria-controls`, panel `role="tabpanel"` labelled by its tab; radio rows `role="radiogroup"` / `role="radio"` with `aria-checked`; category and level picks are toggle buttons with `aria-pressed`; location modes are native radios.
- **Labels:** icon-only buttons have `aria-label` ("กลับไปแผนที่", "เรื่องก่อนหน้า", "เรื่องถัดไป"); the map canvas "แผนที่ตำแหน่งของเรื่อง"; textareas have `aria-label` and `aria-describedby` to their counter.
- **Announcements:** one `role="status"` line per tab body for success and errors; it stays in the tree when empty.
- **Never colour alone:** status = word + Lucide icon (`STATUS_TH` / `STATUS_ICON`), level = word + `app-level-shape`, chosen = edge + check, markers = shape + word.
- **Targets:** every control ≥ 44 × 44 px.
- **Copy:** user text only through interpolation; never say photos are blurred or checked (plan 9).
