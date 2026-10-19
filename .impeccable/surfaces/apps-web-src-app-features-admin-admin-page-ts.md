---
version: 1
slug: "apps-web-src-app-features-admin-admin-page-ts"
primary_target: "apps/web/src/app/features/admin/admin.page.ts"
related_targets: ["apps/web/src/app/features/admin/review-queue.component.ts","apps/web/src/app/features/admin/place-map.component.ts","apps/web/src/app/features/admin/claims-queue.component.ts","apps/web/src/app/features/admin/flags-queue.component.ts","apps/web/src/app/features/admin/users-tab.component.ts","apps/web/src/app/features/admin/log-tab.component.ts"]
---

# Surface: หน้าผู้ดูแล (`/admin`)

**Mode:** Operate. One admin (the owner) clears what waits for them, decides each item with care, and leaves. Also a demo step: "admin approves, the beam appears".

## Brief
- **Audience:** the project owner, on desktop most of the time and on the phone during the demo; the instructor watching. Calm, deliberate, never rushed: every action changes what the public sees.
- **Job:** (1) review new reports one by one and approve (with edits) or reject with a reason, (2) confirm or deny "แจ้งว่าแก้แล้ว" by comparing before/after photos, (3) act on reported content (dismiss / hide / hide and ban) and restore hidden things, (4) find a user and ban or unban, (5) read the log.
- **Content (real data, `/api/admin/*`):** queues of 0–50 (demo: 2 new reports, 4 claims), each report with 0–4 photos (signed URLs, 1600 px), title ≤120, description ≤1000, 0–5 tags, true and published points, reporter name + e-mail (always shown here, with a "ขอปิดชื่อ" tag when hidden publicly). Users 0–50 per search. Log 50 per page.

## Direction (incumbent world, DESIGN.md unchanged)
- **Visual authority:** the `/me` page grammar: Cream Ground page, one Card White card (18 px radius, Float shadow) centred from 820 px, flat full-width page on phones. Prompt for headings, Plex Sans Thai for reading, Lucide only, Trust Blue only for action/focus, level colours only for levels (Ink On Pastel). No new colours, nothing glows.
- **Thesis:** a quiet desk with one item on it. The review queue is **one report at a time** (plan decision 12: one MapLibre map on the page), big photos first, the facts beside the small map, the decision last. Approving and rejecting are far apart and look different, so a slip cannot publish or delete by accident.
- **Width:** the card is 760 px from 820 px (the queues need photos and a map side by side); `/me` stays 600 px.

## Layout
- **Header:** 44 px `chevronLeft` back to the map, h1 "หน้าผู้ดูแล" (focus target on enter).
- **Tabs:** `role="tablist"` of five 44 px tab buttons, each icon + word + count: `inbox` รอตรวจ · N, `wrench` แจ้งว่าแก้แล้ว · N, `flag` ถูกรายงาน · N, `users` ผู้ใช้, `history` บันทึก. A count of 0 shows "0". Selected = Trust Blue 2 px underline + ink 600 word + `aria-selected="true"` (shape, not colour alone). Under 820 px the tablist is one horizontally scrolling row (no wrap, scroll-snap, the selected tab scrolled into view); from 820 px all five fit one row. `?tab=` holds the tab (replaceUrl); unknown values open รอตรวจ. Arrow keys move between tabs.
- **Review card (tab รอตรวจ):** a counter line "เรื่องที่ 1 จาก N" with 44 px previous/next icon buttons (`chevronLeft` / `chevronRight`, labelled "เรื่องก่อนหน้า" / "เรื่องถัดไป"), then:
  1. photo strip: full photos 220 px tall (180 px on phones), scroll-snap, `alt="รูปที่ N"`; none: the category tile (icon on level colour 45% into white).
  2. title (Prompt 600 20 px, wraps), tags row: level pill with `app-level-shape`, category, "ขอปิดชื่อ" (neutral) when `hide_author`, "มีคำที่อาจไม่เหมาะสม" (`triangleAlert`, neutral pill with Slate Ink, words carry it) when `profanity_flag`, "ถูกแบน" (`ban`) when the reporter is banned.
  3. two columns from 820 px (stacked on phones): left = description (pre-wrap), user tags as `#tag`, place, time (`formatAgo` + full date title), reporter "{name} · {email}"; right = the small map (`app-place-map`, 240 px tall, 12 px radius) with two markers told apart by shape and word: the true point = `mapPin` + label "จุดจริง", the shown point = a 14 px disc with a white rim + label "จุดที่แสดง". When they coincide only "จุดจริง (แสดงตรงนี้)" shows.
  4. decision row: left a secondary "ปฏิเสธ…" (`circleX`), right a primary "อนุมัติ…" (`circleCheck`), `justify-content: space-between` so they sit at opposite ends. Each opens its own section in place of the row (never both); each section has its own cancel.
- **Approve section:** heading "อนุมัติเรื่องนี้", then fields that start at the report's values: หมวด (8 category buttons, 2 cols phones / 4 from 820 px, icon over name, selected = 2 px Trust Blue edge + `check`), ระดับ (4 chips with level shape, same chip style), หัวข้อ (input ≤120 with `n/120`), ตำแหน่งที่แสดง (radio list: ใช้ตำแหน่งเดิม · ตำแหน่งจริง (ไม่เลื่อน) · สุ่มเลื่อนใหม่ไม่เกิน 150 ม. · ปักหมุดเอง; "ปักหมุดเอง" turns the small map into a picker with a fixed centre pin and the caption "เลื่อนแผนที่ให้หมุดตรงจุดที่จะแสดง"). For hazard (current or chosen) a caption: "เรื่องจุดเสี่ยงจะถูกเลื่อนให้อัตโนมัติ เว้นแต่เลือกตำแหน่งจริง". Primary "อนุมัติ ขึ้นแผนที่" (52 px) + secondary "ยกเลิก". Only changed fields are sent.
- **Reject section:** heading "ปฏิเสธเรื่องนี้", radio group of the five `REJECT_REASON_TH` reasons (44 px rows, selected = 2 px Trust Blue edge + `check`), "อื่นๆ" opens a note textarea ≤200 with `n/200`, hint "ผู้แจ้งจะเห็นเหตุผลนี้ในหน้าเรื่องของฉัน". A secondary "ยืนยันปฏิเสธ" (`circleX`, Slate Ink, never filled) + "ยกเลิก"; disabled until a reason is chosen.
- **Feedback:** one `role="status"` line above the card body: "อนุมัติแล้ว ลำแสงขึ้นแผนที่แล้ว" / "ปฏิเสธแล้ว ผู้แจ้งจะเห็นเหตุผลในหน้าของฉัน" / API `messageTh` (409 reloads the queue). Every button disabled while a request runs.
- **Empty:** a `circleCheck` disc (14% Trust Blue tint) + "ไม่มีเรื่องรอตรวจ เยี่ยมเลย". **Loading:** "กำลังโหลด…" + a Cream Ground placeholder block. **Error:** the status line + "ลองอีกครั้ง" (`refreshCw`).
- **Claims tab (Task 12):** one card per claim, before/after side by side (two 1:1 tiles, labels "ก่อนแก้" / "หลังแก้" as white pills like the panel; no after photo = a dashed Sand Line tile "ไม่ได้แนบรูปหลังแก้"), title, level, place, "ค้างมา N วัน", claimant name + e-mail, note, time; actions apart: secondary "ยังไม่แก้" (`circleX`) left, primary "ยืนยันว่าแก้แล้ว" (`circleCheck`) right.
- **Flags tab (Task 12):** one card per target: kind word (เรื่อง / ความคิดเห็น), content (title or comment body + photo), report status word + icon (`STATUS_ICON`), "ซ่อนอยู่" (`eyeOff`) when hidden, "N รายงาน" and the reasons list (reason word, note, reporter, time), owner (name, "ถูกแบน"). Actions: "ยกเลิกรายงาน" / "ยกเลิกรายงานและคืน" (`undo2`), "ซ่อน" (`eyeOff`, absent when hidden), "ซ่อนและแบนเจ้าของ" (`ban`, absent for admin owners) which turns into "แน่ใจ แบนเลย" + "ยกเลิก" in place. A section "ซ่อนอยู่" at the end lists hidden things with "คืน" (`undo2`).
- **Users tab (Task 13):** search field (`search` icon, `type="search"`, debounce 300 ms, "ค้นชื่อหรืออีเมล"), rows: name, e-mail, "ผู้ดูแล" tag, status word + icon ("ใช้งานได้" `circleCheck` / "ถูกแบน" `ban`), counts, joined date; "แบน" (two-step confirm like flags) / "ยกเลิกแบน"; no ban button for admins. Empty: "ไม่เจอผู้ใช้ที่ตรงกับคำค้น".
- **Log tab (Task 13):** newest first, rows: time (`formatAgo`, full date as title), actor (admin name, null = "ระบบ"), action word (`LOG_ACTION_TH`, unknown shown as stored), target kind, link to `/r/:id` when the target is a report, and known detail keys (reason, note, location mode) as text. "ดูเก่ากว่านี้" loads the next 50 and disappears when a page comes back short.

## Constraints
- 44 px targets, focus ring 3 px Trust Blue offset 2 px, one breakpoint 820 px, Lucide only, no emoji, words + icon/shape for every state, user text only through interpolation, Thai "เพื่อนบ้านใจดี" (direct is fine here), never `prefers-reduced-motion`, never say photos are blurred or checked (plan 9).
- One MapLibre map on the whole page (the review tab only); it is created once and its markers move between reports.
- Out of scope: tag merge/delete (plan 8), i18n (plan 6), blur badges (plan 9).
- Assumption (plan 5, the owner asked for no questions mid-plan): the plan's Tasks 11–13 are the owner's confirmation; layout choices above (one at a time, 760 px card, scrolling tabs on phones, opposite-end decision buttons) are the builder's call.
