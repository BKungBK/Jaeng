---
version: 1
slug: "report-detail-report-detail-component-ts-453c72b1"
primary_target: "apps/web/src/app/features/report-detail/report-detail.component.ts"
related_targets: ["apps/web/src/app/features/map/map.page.ts","apps/web/src/app/features/report-detail/report-detail.service.ts"]
---

# Surface: แผงรายละเอียดเรื่อง (`/r/:id`, right panel and bottom sheet)

**Mode:** Operate. The visitor reads one report, agrees with it ("เจอเหมือนกัน"), and talks about it, then goes back to the map.

## Brief
- **Audience:** a neighbor who just tapped a beam (phone, one hand, outdoors) or clicked it at home; someone who opened a shared `/r/:id` link; the instructor watching the me-too raise the beam in the demo.
- **Job:** understand what is wrong, how dangerous, how long it has waited and how many neighbors agree, in one glance at the top of the panel; then add one tap of agreement or one comment without leaving the map.
- **Content (real data, `public_reports` + `public_comments`):** 0–4 photos (before/after, most demo reports have none), title (up to ~80 Thai chars, wraps), level, category, status, days open (0–400+), optional description (pre-wrap, can be several paragraphs), author name or 'ผู้ใช้นิรนาม', created time, optional place name, free tags (0–5), confirm count (0–50), comments (0–200, each ≤ 500 chars).
- **Order (spec 3.4, owner-fixed):** gallery → `<h2>` title → tags (level with `app-level-shape`, category, status, age) → description → reporter + `<time>` + place → (level 3: emergency box) → `เจอเหมือนกัน · N` + `คัดลอกลิงก์` → comments with composer.

## Direction (incumbent world, DESIGN.md unchanged)
- **Visual authority:** the existing app chrome: Card White surfaces, 18 px card / 24 px sheet radii, the single Float shadow, Prompt for the title, Plex Sans Thai for reading, Lucide icons only, Trust Blue for action and focus. No new colours.
- **Thesis:** the panel is the beam's caption, not a document. The top 64% of the sheet (what a phone sees first) must carry picture, title, tags and the me-too button for a report without a long description, so the main action never needs a scroll on a typical report.
- **Gallery:** a 12 px picture tile, 180 px tall (16:9-ish), horizontal scroll-snap when there are several photos, each with a small white "ก่อนแก้" / "หลังแก้" label pill (Ink). No photo: the tooltip's tile, the category icon at 48 px in Slate Ink on the level colour mixed 45% into white (Ink On Pastel).
- **Tags:** 10 px-radius pills, 32 px tall, caption-weight label. Level pill = level colour 55% into white + Slate Ink + the level shape (One Shape Set); category, status and age pills are neutral (Cream Ground fill, Sand Line edge). Age over 30 days reads "ค้างนาน · ค้างมา N วัน" in ink 500, same as the tooltip. Status is words, never colour. User tags follow as muted "#tag" text, not pills.
- **Me-too button:** full-width-ish 44 px button with the `hand` icon and tabular count. Off = secondary (Card White, 1 px Trust Blue edge, Trust Blue label); on (`aria-pressed="true"`) = Trust Blue fill, white label. Busy = disabled, same look at 60% so the count does not jump. Resolved: no button, a caption "มีคนเจอเหมือนกัน N คน". Copy link = secondary icon+label button beside it.
- **Emergency box (level 3 only):** above the buttons, a 14 px-radius box with the rose level colour mixed 22% into white, Slate Ink text, `phone` icon, the exact spec sentence; the three numbers are `tel:` links in ink, underlined, padded to 44 px targets. Rose is legitimate here: it means danger. No glow.
- **Comments:** `<h3>ความคิดเห็น · N</h3>`, list with name (label 14/500), a neutral "ผู้แจ้ง" badge (Cream fill, Sand Line, 9 px radius) when `by_reporter`, `formatAgo` time in muted caption, body 16/1.6 pre-wrap. Empty: "ยังไม่มีความคิดเห็น มาเริ่มคุยกันได้เลยนะ". Composer: textarea (aria-label "เขียนความคิดเห็น", maxlength 500, `n/500` counter in muted caption) and a 44 px Trust Blue send icon button (`send`, aria-label "ส่งความคิดเห็น") disabled while trimmed text is empty or a send is running. Signed out: one secondary button "เข้าสู่ระบบเพื่อแสดงความคิดเห็น" instead of the composer.
- **Feedback:** one visually quiet `role="status"` line in the panel for API errors (`messageTh`) and "คัดลอกลิงก์แล้ว". Loading: the gallery tile in Cream Ground with "กำลังเปิดเรื่องนี้…" in muted caption. Missing report: the map shows the toast and leaves (no panel).

## Layout
- **≥ 820 px:** `<aside class="panel" role="dialog" aria-labelledby>` 380 px wide, 12 px from the right, top and bottom (plus safe areas), Card White, 18 px radius, Float shadow, scrolls inside itself with `overscroll-behavior: contain`. The 44 px icon close button sits top-right over the gallery corner with its own white fill. The map controls column moves to 12 px left of the panel while it is open; the top chip group right edge moves with it.
- **< 820 px:** Ionic sheet modal, breakpoints [0, 0.64, 1], starting at 0.64, backdrop only above 0.64 so the map still pans behind it; 24 px top radius, Ionic's drag handle, content scrolls once fully up. Same component and the same close button; swipe down to 0 closes.
- **Focus:** on open, focus goes to the panel's close button (Tab continues into the panel); Escape closes; focus returns to the same beacon disc (canvas fallback).

## Constraints
- 44 px targets, focus ring 3 px Trust Blue offset 2 px, Ink On Pastel, One Light (no shadows on panel children besides none; only the panel itself floats), One Shape Set, Lucide only, text interpolation only, Thai copy in the voice "เพื่อนบ้านใจดี", never `prefers-reduced-motion`.
- Out of scope: "แจ้งว่าแก้แล้ว", the ⋯ menu with report-content (plan 5), photo lightbox, i18n.
- Assumption (subagent run, no live answer channel): `.superpowers/sdd/plan-3/task-9-brief.md` is the owner's confirmation; copy not given there ("กำลังเปิดเรื่องนี้…", empty comments, "คัดลอกลิงก์แล้ว", button labels) is the builder's call in the same voice.
