---
version: 1
slug: "apps-web-src-app-features-me-me-page-ts"
primary_target: "apps/web/src/app/features/me/me.page.ts"
related_targets: ["apps/web/src/app/features/me/me.service.ts","apps/web/src/app/features/me/reject-reason.ts","apps/web/src/app/features/report-detail/report-detail.component.html"]
---

# Surface: เรื่องของฉัน (`/me`) and comment photos in the detail panel

**Mode:** Operate. A signed-in neighbor checks what happened to what they reported, fixes their display name, leaves.

## Brief
- **Audience:** a reporter who just sent a report ("ดูเรื่องของฉัน" on the sent card) and wants to know it arrived; the same person days later wondering "อนุมัติหรือยัง / ทำไมไม่ขึ้น"; the instructor watching the demo step "admin approves, beam appears" from the reporter's side.
- **Job:** (1) see every own report with its status said in words and a shape, (2) learn why a report was rejected, (3) open the public ones on the map, (4) rename self, (5) sign out.
- **Content (real data, `GET /me/reports`):** 0–100 reports, newest first, no paging (the API caps at 100). Each: thumb (`thumb_url`, same origin) or none, title (wraps), category, danger level 0–3, one of 6 statuses, `reject_reason` (known key, free text or null), `place_name` or null, confirm/comment counts, `created_at`. Name: 2–30 characters.

## Direction (incumbent world, DESIGN.md unchanged)
- **Visual authority:** the existing app chrome, same page grammar as `/report`: Cream Ground page, a centred Card White card (18 px radius, Float shadow) from 820 px (max 600 px), full-width flat page on phones. Prompt for headings, Plex Sans Thai for reading, Lucide only, Trust Blue for action/focus, no new colours. Level colours appear only as the level pill and the no-photo tile (Ink On Pastel). Nothing glows.
- **Thesis:** a kind neighbor's notebook of your own reports: the name at the top is yours to fix, the list under it answers one question per row, "what became of this?", with the answer in words.
- **Order:** header (44 px `chevronLeft` back to the map, h1 "เรื่องของฉัน") > name row > display (plan 6) > list > sign-out.
- **Display (plan 6):** h2 "การแสดงผล", then a caption and a segmented radiogroup each for language ("ไทย" / "English", each named in itself, `lang` set) and theme (`sunMoon` ตามเครื่อง / `sun` สว่าง / `moon` มืด). Options are 44 px, the group sits on Cream Ground with a hairline; the chosen one is Card White with the Float shadow and weight 600 (`aria-checked`), never colour alone. Arrow keys move and choose (one tab stop). Language also saves to the account (`PATCH /me`, fire-and-forget); theme stays on the device.
- **Name row:** label "ชื่อที่แสดง", the name (Prompt 500 18 px, wraps anywhere), a secondary 44 px "แก้ชื่อ" button. Editing replaces the row with an input (aria-label "ชื่อที่แสดง", `maxlength` 30, counter `n/30`), "บันทึก" (primary, disabled until the trimmed name is 2–30 and not unchanged) and "ยกเลิก". API errors (`messageTh`: 422 profanity, 400 invalid) in `role="alert"` under the field; the old name stays. Success: the name updates in place, the account menu and comments pick it up (profile signal), the input closes, focus returns to "แก้ชื่อ". Hint: "ชื่อนี้คนอื่นเห็นในเรื่องที่คุณแจ้งและความคิดเห็น (ถ้าไม่ได้เลือกซ่อนชื่อ)".
- **Report row (card in a list, 12 px apart):** 72 px picture tile at the left (thumb, cover-fit 12 px radius; none: the category's Lucide icon at 30 px, Slate Ink on the level colour 45% into white, same as the duplicate card). To the right: title (Prompt 500 15 px, wraps), a status line, a meta line. **Status line = a Lucide icon + the word**, always both: pending_review `clock` "รอผู้ดูแลตรวจ", open `eye` "เปิดอยู่", fix_claimed `wrench` "รอตรวจว่าแก้แล้ว", resolved `circleCheck` "แก้แล้ว", rejected `circleX` "ไม่ผ่านการตรวจ", hidden `eyeOff` "ถูกซ่อน". Six words and six icons, none shared; no status uses a colour class on its own (the line is Slate Ink; the icon carries shape). Meta line (muted 13 px): level shape + level name, then `place_name` when present, then `formatAgo(created_at)`; public ones add "เจอเหมือนกัน N". Rejected rows add under the title a reason line "ไม่ผ่านเพราะ: {reason}" (known keys in Thai from `REJECT_REASON_TH`, free text as written, null "ผู้ดูแลไม่ได้ระบุเหตุผล"), text interpolation only.
- **Which rows are links:** `open` / `fix_claimed` / `resolved` are `<a href="/r/:id">` (whole card, 44 px+, a trailing `chevronRight`-free card; hover fills Cream Ground) and open the map on that report. `pending_review` / `rejected` / `hidden` are plain `<li>` with no link, no hover, no pointer cursor: nothing public exists to open.
- **Long list (100):** a single column list on the page, newest first, scrolling with the page; no pagination, no virtualisation (100 light rows). The h2 carries the count "เรื่องที่แจ้ง · N" so the length is known up front. Thumbs `loading="lazy"` with fixed 72 px boxes so nothing jumps.
- **Empty:** a Card-White block with a `fileText` icon disc, "ยังไม่มีเรื่องที่แจ้ง กดปุ่ม แจ้ง ได้เลยนะ" and a primary "แจ้ง" button (`plus`) to `/report`.
- **Loading:** "กำลังเปิดเรื่องของคุณ…" in muted caption and three Cream Ground placeholder rows (static, no shimmer). **Error:** a status line "โหลดเรื่องของคุณไม่สำเร็จ ลองอีกครั้งนะ" plus "ลองอีกครั้ง" (`refreshCw`) which calls `reports()` again.
- **Sign-out:** a secondary full-width-on-phone button "ออกจากระบบ" (`logOut`) at the bottom of the card, away from the list. It resets the report draft, signs out, then `navigateRoot('/')`.
- **Out of scope:** deleting or editing reports, push.

## Comment photos (detail panel)
A comment with `photo_path` shows `thumbPath(photo_path)` via `coverPhotoUrl` under its body: an `<img>` at most 160 px wide, 12 px radius, `alt="รูปที่แนบในความคิดเห็น"`, `loading="lazy"`, width/height auto with `aspect-ratio` fallback so no layout jump. No lightbox (out of scope). No `<img>` when no photo.

## Constraints
44 px targets, focus ring 3 px Trust Blue offset 2 px, only breakpoint 820 px, Thai copy "เพื่อนบ้านใจดี", user text only through interpolation, Lucide only, no emoji, never `prefers-reduced-motion`, no copy claiming photos are blurred.

## Assumptions (subagent run, no live answer channel)
`.superpowers/sdd/plan-4/task-12-brief.md` plus the controller rulings are the owner's confirmation. Wording not in the brief (name hint, loading/error lines, empty-state button label "แจ้ง", the six status icons, the "เรื่องที่แจ้ง · N" count) is the builder's call in the same voice.
