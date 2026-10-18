---
version: 1
slug: "pp-features-report-new-report-new-page-ts-89a19ffc"
primary_target: "apps/web/src/app/features/report-new/report-new.page.ts"
related_targets: ["apps/web/src/app/features/report-new/report-fab.component.ts","apps/web/src/app/features/report-new/report-draft.service.ts","apps/web/src/app/features/map/map.page.ts"]
---

# Surface: แจ้งเรื่อง (FAB on the map, `/report` in three steps, details, duplicate card, sent card)

**Mode:** Operate. A neighbor at the scene wants the problem on record in three taps and to get back to their day.

## Brief
- **Audience:** a neighbor outdoors on a phone, one hand, bright sun, camera already in hand; the same neighbor at home on a desktop with a photo from the gallery; the instructor watching "report in 3 taps" in the live demo.
- **Job:** photo → category → pin → send. Everything else (title, description, level, tags, hiding the name) is optional and folded away.
- **Proof of "3 taps":** tap "ถ่ายรูป" (1, the camera's own shutter is the OS) → the first ready photo moves the flow to step 2 by itself (first time only) → tap a category (2), which goes straight to step 3 with no "ถัดไป" → tap "ส่งเรื่อง" (3). With an EXIF or device position the pin is already placed.
- **Content (real data):** 1–4 photos (compressed in the browser, uploaded at once), the 8 categories from `CategoriesService` (Lucide icon + `name_th` + `default_level`), the pin from EXIF → device GPS → the national view, optional title ≤ 120, description ≤ 1000, level 0–3, ≤ 5 tags (suggested by `suggest_tags`), `hide_author`. Duplicates: up to 3 public candidates (title, cover photo or category icon, level, status, เจอเหมือนกัน N).

## Direction (incumbent world, DESIGN.md unchanged)
- **Visual authority:** the existing app chrome. Card White 18 px cards and the one Float shadow, Trust Blue primary buttons 44 px+ (the main step action 52 px), secondary buttons Card White with a Sand Line edge, 14 px button radius, 12 px picture tiles, Prompt for headings and buttons, Plex Sans Thai for reading, Lucide only (`plus`, `camera`, `image`, `x`, `check`, `chevronLeft`, `chevronDown`, `upload`, `refreshCw`, `send`, `hand`, `mapPin`, `minus`). No new colours; the level colours appear only in the level picker and the duplicate card's level line (Levels Only Mean Danger, Ink On Pastel, One Shape Set via `app-level-shape`). Nothing glows (One Light).
- **Thesis:** a kind neighbor holding the clipboard: one question per screen, a big obvious answer, and the optional parts tucked under a fold. The flow is a short form, not a wizard with chrome.

## FAB "แจ้ง" (decision 7, owner constraints)
- Extended pill: `plus` icon + the word "แจ้ง" (Prompt 600 17 px), 56 px tall, 116 px wide, Trust Blue fill, white label, 14 px radius, Float shadow, `aria-label="แจ้งเรื่องใหม่"`.
- **Phones (< 820 px):** bottom-right, 12 px from the right edge, in the row 52 px above the bottom where the controls column used to end: the most thumb-reachable spot, clear of the folded attribution button beneath. The controls column lifts to sit 8 px above the FAB (bottom 116 px), and the hint card's right edge stops 8 px left of the FAB (right 136 px). Nothing overlaps.
- **Desktop (≥ 820 px):** bottom-right, 12 px from the right, 48 px from the bottom so the attribution strip stays readable under it; the controls column stays vertically centred. While the detail panel is open it steps left of the panel with the controls.
- **Hidden** while the report sheet is open on phones (the sheet covers that corner anyway and the FAB would sit above the sheet's backdrop).
- Signed out: opens the login sheet; only a successful login continues to `/report`.

## Layout of `/report`
- **Phones:** a full page on Cream Ground. **≥ 820 px:** a centred Card White card, 600 px wide, 24 px from the top, Float shadow; the page scrolls, the card does not.
- **Header (every step):** a 44 px icon button on the left (step 1: `x` "ปิด" back to the map; steps 2–3: `chevronLeft` "ย้อนกลับ" to the previous step), then the step label "ขั้น 1 จาก 3" (caption, muted) above the step title (Prompt 600 22 px): "ถ่ายรูปปัญหา", "เป็นเรื่องอะไร", "ปักหมุดตรงไหน". Under it a three-segment track: done segments filled Trust Blue, the current one filled Trust Blue and wider, future ones Sand Line outline. The track is decorative (`aria-hidden`); the words carry the state, so it never relies on colour.
- **Step 1:** lede "รูปเดียวก็พอ ใส่ได้สูงสุด 4 รูป". Two big buttons side by side (stacked under 360 px): "ถ่ายรูป" (primary, `camera`, opens `<input type=file accept=image/* capture=environment>`) and "เลือกจากคลัง" (secondary, `image`, `multiple`). A 4-column strip of square 12 px tiles: preview image; while compressing/uploading a Cream overlay with "กำลังอัปโหลด…"; on error an overlay with the Thai message and a 44 px "ลองใหม่" (`refreshCw`); every tile has a 44 px white `x` "ลบรูปที่ n" in its corner. Ready tiles show a small white `check` badge with hidden text "พร้อมแล้ว". Caption: "รูปจะขึ้นแผนที่หลังผู้ดูแลตรวจ". Footer: "ไปต่อ" primary, disabled until at least one photo and every photo is ready, with a caption saying why ("รอรูปอัปโหลดให้เสร็จก่อนนะ" / "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบออกก่อนนะ").
- **Step 2:** a grid of 8 big buttons (2 columns on phones, 4 from 820 px), each ≥ 96 px tall: the category icon at 32 px over its Thai name. `aria-pressed` on the chosen one, which also gets a 2 px Trust Blue edge, a 10% blue tint and a `check` in its corner (shape + colour). A tap chooses and moves to step 3 at once.
- **Step 3:** a summary row ("หมวด" with the icon and name, a text button "เปลี่ยน" back to step 2). The map (MapLibre from `MAP_FACTORY`, pastel street tint, no toy, no sea, no beacons), 12 px radius, ~46% of the phone height (min 280 px), 380 px on desktop, with a fixed centre pin (`mapPin` 44 px Trust Blue with a white fill, its tip on the true centre) and 44 px zoom-in/zoom-out buttons in its top-right corner. A caption above the map says where the pin came from: EXIF "หมุดอยู่ตามตำแหน่งในรูป เลื่อนแผนที่ให้หมุดตรงจุดได้เลย", device "หมุดอยู่ตามตำแหน่งของเครื่อง เลื่อนแผนที่ให้หมุดตรงจุดได้เลย", fallback "ไม่เจอตำแหน่งจากรูปหรือเครื่อง เลื่อนและซูมแผนที่ไปยังจุดที่เจอปัญหานะ", while looking "กำลังหาตำแหน่ง…". Below the map: (fallback and zoom < 14) "ซูมเข้าไปอีกหน่อยเพื่อปักหมุดให้แม่น"; the "ส่งเรื่อง" primary (`send`, 52 px, full width); right under it the caption "เล่าที่ปัญหา ไม่ระบุชื่อหรือกล่าวหาบุคคล"; then the page's `role="status"` line for API errors; then the "เพิ่มรายละเอียด" fold.
- **Details fold ("เพิ่มรายละเอียด", collapsed):** a 44 px row button with "ไม่บังคับ" in muted text and a `chevronDown` that turns when open (`aria-expanded`). Inside, 16 px apart: หัวข้อ (input, `n/120`, hint "เว้นว่างได้ ระบบตั้งชื่อให้จากหมวดและที่ตั้ง"), คำอธิบาย (textarea, `n/1000`), ระดับอันตราย (a radio group of four 44 px chips with the level shape and name; checked = level colour 55% into white + Slate Ink, unchecked = outline, same as the filter chips; starts at the category's `default_level`), แท็ก (input + up to 8 suggestion buttons from `suggest_tags`, debounced 250 ms; Enter or comma adds; chosen tags as "#tag" pills each with a 44 px remove target; `n/5`; at 5 the input is disabled with "ใส่ได้สูงสุด 5 แท็ก"), and the switch "ไม่แสดงชื่อฉัน" (off; hint "คนอื่นจะเห็นเป็นผู้ใช้นิรนาม ผู้ดูแลยังเห็นว่าใครแจ้ง").
- **Duplicate card (replaces the step 3 body):** heading "เรื่องนี้ใช่ไหม?", lede "มีคนแจ้งเรื่องหมวดเดียวกันไว้ใกล้ๆ จุดนี้ ถ้าเป็นเรื่องเดียวกัน กดเจอเหมือนกันแทนได้เลย", note "ถ้ากดใช่ รูปแรกของคุณจะถูกแนบเป็นความคิดเห็นในเรื่องนั้น". Up to 3 rows: a 72 px tile (cover photo, else the category icon on the level colour 45% into white), the title (wraps), a meta line (level shape + level name · status · เจอเหมือนกัน N), and the "ใช่ กดเจอเหมือนกันแทน" button (`hand`, Trust Blue outline like the me-too button). Under the list: "ไม่ใช่ แจ้งเป็นเรื่องใหม่" (secondary, full width). After a merge: back to the map at `/r/:id` (the map flies there) with the toast "ขอบคุณนะ นับให้แล้ว".
- **Sent card (replaces the whole flow):** a 64 px disc in a 14% Trust Blue tint holding a `check`, the heading "ส่งแล้ว รอผู้ดูแลตรวจ", the line "ขอบคุณที่แจ้งนะ เดี๋ยวผู้ดูแลตรวจให้ พอผ่านแล้วเรื่องนี้จะขึ้นเป็นสัญญาณไฟบนแผนที่", then "ดูเรื่องของฉัน" (primary, `/me`) and "กลับไปแผนที่" (secondary). The draft is reset.

## States and ranges
- Photos 0–4 (a fifth is ignored, with a status line "ใส่ได้สูงสุด 4 รูปนะ"); each compressing → uploading → ready or error (413 → "รูปใหญ่เกินไป (ไม่เกิน 3 MB)", others their `messageTh`).
- Location: looking, exif, device, fallback (gate at zoom 14).
- Submit: idle, sending (button disabled, "กำลังส่ง…"), duplicates, created, error (`rate_limited`, `invalid_photos`, `invalid_report`, `invalid_location`, `network`, `internal` → their `messageTh` in the status line), 401 after refresh → login sheet, then the same submit runs again; the draft is never lost.
- Category list failed to load: a retry button "ลองโหลดใหม่".

## Interaction, focus, keyboard
- On every step change focus moves to the step title (`tabindex=-1`); the sent and duplicate headings likewise.
- Every control is a native button/input/label; the map canvas is focusable (arrows pan, +/- zoom) and the zoom buttons repeat that for pointer and keyboard.
- Back from step 1, "กลับไปแผนที่" and a merge return to the map page that is already in the stack, so the home map is never built twice.

## Constraints
- 44 px targets, focus ring 3 px Trust Blue offset 2 px, the 820 px breakpoint only, Thai copy in the voice "เพื่อนบ้านใจดี", user text through interpolation only, no emoji, never `prefers-reduced-motion`, and no copy anywhere that says photos are blurred or faces/plates hidden.
- Out of scope: `/me` (Task 12; the "ดูเรื่องของฉัน" link lands on the catch-all until then), native camera/GPS (plan 7), i18n (plan 6).
- **Assumptions (subagent run, no live answer channel):** `.superpowers/sdd/plan-4/task-11-brief.md` plus the owner rulings relayed in the task (FAB constraints, duplicate check on `public_location`, only the first photo attached on "ใช่") are the owner's confirmation. The FAB geometry, the auto-advance after the first ready photo, the step titles, captions and button wording not given in the task are the builder's call in the same voice.
