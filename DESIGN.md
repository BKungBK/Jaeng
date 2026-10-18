---
name: แจ้ง
description: Community problems as pastel signal beams on a toy-like illustrated map of Thailand.
colors:
  cream-ground: "#FBF7F2"
  card-white: "#FFFFFF"
  slate-ink: "#2B2A33"
  muted-ink: "#6B6878"
  trust-blue: "#3F6FA8"
  on-trust-blue: "#FFFFFF"
  sand-line: "#E8E0D5"
  street-ground: "#EFF3E1"
  toy-sea: "#9FCFDD"
  sea-shallow: "#C8F0E6"
  sea-mid: "#9FCFDD"
  sea-deep: "#86A6D4"
  sea-line: "#F2FCF9"
  level-minor-mint: "#8FD3B6"
  level-caution-butter: "#F6D983"
  level-danger-peach: "#F4A582"
  level-critical-rose: "#E57373"
  cel-north: "#B4DCAB"
  cel-isan: "#F9CDA2"
  cel-central: "#F5E7B2"
  cel-east: "#F3C3D0"
  cel-west: "#D0C4EF"
  cel-south: "#DAEBA8"
  toy-rim-cream: "#FBF0D2"
  land-ink: "#4A4458"
  toy-soil-light: "#DDBB98"
  toy-soil-mid: "#CBA582"
  toy-soil-deep: "#B8916F"
  night-ground: "#23212B"
  night-card: "#2E2B38"
  night-ink: "#F3EFF7"
  night-muted-ink: "#B7B2C4"
  night-blue: "#9CC0EE"
  night-on-blue: "#1D1B24"
  night-line: "#433F52"
  night-sea: "#1F5A6E"
typography:
  headline:
    fontFamily: "Prompt, IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Prompt, IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  map-label:
    fontFamily: "Prompt, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
  count:
    fontFamily: "Prompt, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  badge: "9px"
  tag: "10px"
  thumb: "12px"
  chip: "14px"
  card: "18px"
  sheet: "24px"
  disc: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.trust-blue}"
    textColor: "{colors.on-trust-blue}"
    typography: "{typography.title}"
    rounded: "{rounded.chip}"
    padding: "0 14px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.chip}"
    padding: "0 14px"
    height: "44px"
  button-icon:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.chip}"
    size: "44px"
  chip-level:
    textColor: "{colors.slate-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "44px"
  chip-level-off:
    backgroundColor: "transparent"
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "44px"
  card-floating:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.card}"
    padding: "8px 14px"
  tooltip:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.card}"
    padding: "10px 12px 12px"
    width: "240px"
  detail-panel:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.card}"
    padding: "12px"
    width: "380px"
  fab-report:
    backgroundColor: "{colors.trust-blue}"
    textColor: "{colors.on-trust-blue}"
    typography: "{typography.title}"
    rounded: "{rounded.chip}"
    padding: "0 20px"
    height: "56px"
    width: "116px"
  report-card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.card}"
    padding: "16px"
    width: "600px"
  report-row:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.card}"
    padding: "12px"
  toast:
    backgroundColor: "{colors.slate-ink}"
    textColor: "{colors.cream-ground}"
    rounded: "{rounded.chip}"
    padding: "8px 16px"
  beacon-disc:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.disc}"
    size: "54px"
  cluster-disc:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.count}"
    rounded: "{rounded.disc}"
    size: "52px"
  level-badge:
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.badge}"
    height: "18px"
    width: "18px"
---

# Design System: แจ้ง

## Overview

**Creative North Star: "เมืองของเล่นยามฟ้าแจ้ง" (Toy Town at First Light)**

แจ้ง means both "to report" and "the sky turning bright". The system is a toy model of Thailand seen at dawn: thick, soft-edged land like a painted wooden puzzle, a bright toy sea, small 3D landmarks, and above it the only lights in the scene, pastel signal beams that rise from each reported problem. The toy world is the welcome; the beams are the information. As the visitor zooms in, the toy dissolves into a calm street map and the beams stay, so the map stops being a picture and becomes a place.

Everything around the map is a working app: floating white cards with soft shadows, 44 px targets, Thai-first type, short warm copy. The interface never imitates the toy; it sits on top of it like a friendly guide holding the map open. Danger is said three ways at once (colour, a solid shape from one SVG set, pulse speed), and status is said by the beam's form, never by colour.

Confirmed anti-references: a dark gaming look, glowing neon on black, and the cold grey forms of a government portal. The owner's reference poster is a style reference only; its artwork is never copied or stored.

**Key Characteristics:**
- Cel-shaded toy Thailand (one flat pastel per region, soft plum outline, sand rim, stacked soil layers) that fades out between zoom 6 and 8. No names, landmarks or props on it (owner, 2026-10-17): place names arrive with the street map at zoom 7.5. Only Thailand is ever shown: everything else is an animated stylized sea.
- Pastel beams as the only light source; height grows with "เจอเหมือนกัน".
- Floating cards over a full-bleed map; no app chrome bars.
- Lucide (ISC) line icons for every pictogram: the controls and the eight category icons. No emoji anywhere (owner decision 2026-10-17).
- One solid SVG shape set (circle, triangle, diamond, warning triangle) for the four danger levels everywhere they appear.
- Prompt for voice, IBM Plex Sans Thai for reading.

## Colors

A full pastel palette on a warm cream ground, with one trustworthy blue for action and four level colours that only ever mean danger.

### Primary
- **Trust Blue** (#3F6FA8; Night Blue #9CC0EE in the dark theme, with Night On Blue #1D1B24 text): primary buttons, links, focus rings, the selected-beacon ring, text selection (28% tint), the "me" location dot. Never used for danger or status.

### Secondary
- **Level Minor Mint** (#8FD3B6): danger level 0 ทั่วไป, and the resolved state's disc border.
- **Level Caution Butter** (#F6D983): danger level 1 ควรระวัง.
- **Level Danger Peach** (#F4A582): danger level 2 อันตราย.
- **Level Critical Rose** (#E57373): danger level 3 วิกฤต. The only red in the system.

### Tertiary (illustration only)
- **Cel Land**, one flat pastel for each of the six geographic regions (owner, 2026-10-17): north sage #B4DCAB, Isan apricot #F9CDA2, central cream #F5E7B2, east blush #F3C3D0, west lavender #D0C4EF, south lime #DAEBA8 (not blue-green, so the long coast never melts into the sea). They are paler and greyer than the level colours, so the land never reads as a danger level. Faint ink lines still mark the provinces. Hover lifts a province 30% toward white. **Toy Rim Cream** (#FBF0D2) is the 6px sand beach under the 2–3px **Land Ink** outline (#4A4458, a soft plum gentler than Slate Ink on pastel).
- **Toy Soil** light / mid / deep (#DDBB98 / #CBA582 / #B8916F, pastel clay): the three stacked side layers that make the land look thick.
- **Sea**: daylight Shallow Glow #C8F0E6, Mid #9FCFDD, Deep #86A6D4, Line #F2FCF9, white foam; Night is the reference's navy and teal: #4DB0AA / #1F5A6E / #16234D, Line #86DCD2, foam #D8F7F0. **Toy Sea** (#9FCFDD, Night #1F5A6E) stays as the flat fallback under it.

### Neutral
- **Cream Ground** (#FBF7F2): page background, icon-button hover fill, toast text.
- **Card White** (#FFFFFF): cards, chip tray, discs, tooltips, sheets, and the white base every chip pastel is mixed into.
- **Slate Ink** (#2B2A33): all text, including text on pastel chips and level badges in both themes; the toast fill.
- **Muted Ink** (#6B6878): secondary text, hints, meta lines, off chips, map attribution.
- **Sand Line** (#E8E0D5): dividers, icon-button borders, the 1px outline of an off chip.
- **Street map (pastel):** ground #EFF3E1, parks #D2EAC0, woods #C2E0AD, homes #F6F0E3, buildings #FFFAF2 with a #B7AEC6 edge, roads white with soft lilac casings (#A49BB6), water in Shallow Mint; Night ground #2C3328 with the same roles darkened.
- **Night** set (#23212B ground, #2E2B38 card, #F3EFF7 ink, #B7B2C4 muted, #9CC0EE blue, #433F52 line, #1F5A6E sea): the dark theme, same roles. Cards, discs and the chip tray turn Night Card; chips keep their daylight pastel.

### Named Rules
**The Levels Only Mean Danger Rule.** Mint, butter, peach and rose are reserved for the four danger levels. Never use them for decoration, categories or status.

**The Ink On Pastel Rule.** Text on any pastel fill is Slate Ink (#2B2A33), never white and never the theme ink, and the pastel is always mixed into white, never into the theme surface. A chip reads the same in light and dark and every one passes WCAG AA.

**The Toy Stays Toy Rule.** Illustration colours do not change with the theme. In dark mode the toy keeps its daylight colours and only the sea and the street map darken; the toy is an object, not a surface.

**The Cel Rule.** The land has no gradients: every colour change is a hard step, every land edge has an ink line, and shadows are flat offsets, never blurs. The sea is the counterpart: a smooth glow with a few crisp one-pixel ripple lines, so the land reads as the solid object in it. Every line and step is anti-aliased over one screen pixel, so nothing stair-steps at any zoom.

## Typography

**Display Font:** Prompt (with IBM Plex Sans Thai, system-ui)
**Body Font:** IBM Plex Sans Thai (with system-ui)

**Character:** Prompt is round, friendly and loud enough to name a place; Plex Sans Thai is calm and legible at 12–16 px in Thai and English. Both are served locally through @fontsource.

### Hierarchy
- **Headline** (Prompt 600, 24px, 1.2): the brand word แจ้ง in the brand card; sheet titles.
- **Title** (Prompt 500, 15px, 1.4): buttons and card headings, the report title in the tooltip and detail panel (wraps anywhere, never truncates).
- **Body** (400, 16px, 1.6): descriptions and comments.
- **Label** (500, 14px, 1.4): level chips (13px under 420px), toast.
- **Caption** (400, 13px, 1.5): brand tagline, hint card, meta and age lines. An age past 30 days switches to ink at 500 ("ค้างนาน").
- **Count** (Prompt 600, 18px, tabular figures): cluster counts.
- **Map Label**: beacon short labels are Plex 12px on a 22px white pill, max 150px, ellipsised.

### Named Rules
**The Thai First Rule.** Sizes and line heights are chosen for Thai with its tall vowels and tone marks; never set Thai body text tighter than 1.5 line height.
## Layout

A full-bleed map with floating controls. No top app bar and no tab bar on the map.

- Top-left: brand card, with the level chip tray beside it (wrapping below on narrow screens). The group stops 72px from the right edge on desktop to clear the controls.
- Right edge: zoom-in, zoom-out, my-location and account icon buttons in an 8px stack, vertically centred on desktop and bottom-right on phones. While a report is open on desktop the stack, the chip group and MapLibre's bottom-right controls step left of the panel.
- Bottom-left: the zoom-level hint card (max 340px on desktop). On phones it stretches to the control column and both sit 52px above the bottom so the attribution fits beneath.
- Attribution: bottom-right MapLibre strip; folded to its ⓘ button under 820px.
- Report detail: at ≥ 820px a 380px panel on the right (12px from the top, right and bottom edges, scrolling inside); below 820px a bottom sheet (24px top corners) that opens at 64% height and can be dragged to full height or away. It sits on `/r/:id` on the same map page, so the map is never rebuilt. The login form opens as a sheet over the map (auto-height under 820px, a centred 420px card from 820px), and `/login` is a page of its own for direct links.
- Report button (FAB "แจ้ง", chosen in the plan 4 shape pass and owner-constrained): the extended pill sits bottom-right on every screen size. On phones it is 12px from the right edge in the row 52px above the bottom, where the controls column used to end (the most thumb-reachable spot, clear of the folded attribution button beneath); the controls column lifts to sit 8px above it and the hint card stops 8px short of it. From 820px it is 12px from the right and 48px from the bottom so the attribution strip stays readable under it, and while the detail panel is open it steps left of the panel with the controls. It is hidden while the report sheet is open on phones.
- Report flow (`/report`): on phones a full page on Cream Ground; from 820px a centred Card White card, 600px wide, 24px from the top. The page scrolls, the card does not. `/me` uses the same grammar.
- Toast: centred, 84px from the top.
- Gutters are 12px from every edge plus the safe-area inset. Gaps between floating elements are 8px.
- Breakpoint: 820px is the only layout breakpoint; under 420px the chip tray tightens (4px gaps, 8px chip padding, no wrap).

## Elevation & Depth

Two depth systems that never mix. The UI floats with one soft, warm shadow. The toy map has physical depth made of stacked soil layers offset downward (8 / 16 / 24px at zoom 6), which flatten to zero by zoom 8 so the coast never ghosts as the toy fades.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 28px rgba(60,50,40,.18)`): every floating card, the chip tray, icon buttons, tooltip, detail panel and sheets.
- **Pill** (`box-shadow: 0 2px 8px rgba(0,0,0,.15)`): beacon short labels.
- **Glow** (`box-shadow: 0 0 0 6px color-mix(in srgb, <level> 30%, transparent), 0 0 28px <level>`): beacon and cluster discs only; it is the light the beam gives off.
- **Selected** (`box-shadow: 0 0 0 3px <surface>, 0 0 0 6px <Trust Blue>, 0 0 28px <level>`): the beacon whose detail panel is open; a solid blue ring replaces the level halo, the glow stays.
### Named Rules
**The One Light Rule.** Only beacons glow. No other element gets a coloured shadow or glow.

## Shapes

Soft and rounded, like toys: 9px level badges, 10px label pills, 12px picture tiles, 14px chips, buttons and toast, 18px cards, tooltip and detail panel, 24px sheets, perfect circles for discs and pulse rings. The beam is a narrow cone (a polygon from the full width at the top to 8% at the base). Pulse rings are flattened ellipses, as if light falls on the ground.

The four level shapes are one solid SVG set on a 12-unit grid: a filled circle (ทั่วไป), triangle (ควรระวัง), diamond (อันตราย), and a triangle with a cut-out exclamation (วิกฤต). They fill with currentColor at 0.85em inline and 10px inside badges, so their weight matches wherever they appear. Every other icon is Lucide (`apps/web/src/app/features/map/icons.ts`, `<app-icon>`): 22px in icon buttons, 24px in beacon discs, stroke 2, round caps, currentColor.

### Named Rules
**The One Shape Set Rule.** A danger level's shape is always drawn from the SVG set, never typed as a character, so chips, badges and meta lines show the same weight on every device.

## Components

### Buttons
- **Shape:** gently rounded (14px), at least 44 × 44 px.
- **Primary:** Trust Blue fill, white Prompt 500 15px label.
- **Secondary:** Card White with a 1px Sand Line border.
- **Icon button:** 44px square, Card White, 1px Sand Line border, Float shadow, a 22px line icon; hover fills Cream Ground. The account button shows the first letter of the signed-in name (Prompt 600, 19px, Trust Blue on a 14% Trust Blue tint) instead of the person icon, so signed in reads by shape as well as colour. Over the detail panel's picture the close button keeps its own white fill and has no shadow.
- **Focus:** 3px Trust Blue outline with 2px offset on every interactive element (4px offset on discs).

### Chips
- **Tray:** the four level chips sit in one Card White tray (18px radius, 6px padding and gap, Float shadow).
- **On:** fill is the level colour mixed 55% into white (75% on hover), Slate Ink label, led by the level's solid shape. Same fill and ink in both themes.
- **Off:** transparent fill, a 1px Sand Line inner outline, Muted Ink label with a line-through, `aria-pressed="false"`. The shape stays, so off reads without colour.

### Cards / Containers
- **Floating card:** Card White, 18px radius, Float shadow, 8–14px padding (brand card 8px 16px 10px).
- **Tooltip:** Card White, 18px radius, Float shadow, 240px wide, no pointer events. Top to bottom, 4px apart: a 120px picture tile (cover photo, else the category's Lucide icon at 40px in ink on the level colour mixed 45% into the surface), the title, a meta line (level shape, level name · status · เจอเหมือนกัน N), and for open reports an age line.
- **Detail panel:** Card White, 18px radius, Float shadow, 380px wide (a `role="dialog"` labelled by the report title); on phones the same content fills a bottom sheet (24px top corners, 0.64 / full breakpoints, dragging to the bottom closes it). Top to bottom, 12px apart: a picture (a scroll-snapping strip of photos with ก่อนแก้ / หลังแก้ pills, else the category tile at 48px; 180px high on the panel, 132px in the sheet so the me-too button sits inside the first 64%) with the 44px close button over its corner; the title (Prompt 600 22px, wraps anywhere); tags (level pill with its solid shape, category, status, age, user `#tags`); the description (line breaks kept); a byline "แจ้งโดย {name or ผู้ใช้นิรนาม} · {age}" with the place; for level 3 the emergency box; the me-too row; and the comments. Loading and error states keep the same frame, with a retry button.
- **Emergency box:** level 3 only. Critical Rose mixed 24% into white, Slate Ink text, 14px radius: "ระบบนี้ไม่ใช่ช่องทางฉุกเฉิน หากมีอันตรายทันที โทร 191 / 199 / 1669", each number a white 44px `tel:` link. This is the one place rose fills an area, because it means danger there.
- **Me-too button ("เจอเหมือนกัน"):** a 44px secondary button in Trust Blue (outline and label) with a hand icon and the count in tabular figures; pressed (`aria-pressed`) fills Trust Blue with white text. It is disabled at 60% opacity while the request is in flight and always shows the count the server last answered. A resolved report shows "มีคนเจอเหมือนกัน N คน" in Muted Ink instead. "คัดลอกลิงก์" sits beside it.
- **Comments:** a hairline above, heading "ความคิดเห็น · N" (Prompt 500 15px), then each comment as name (500), a "ผู้แจ้ง" badge (9px radius, Sand Line outline) when the author is the reporter, the age, and the body (Body, line breaks kept, user text only through text interpolation). The composer is a 14px-radius textarea with a `n/500` counter and a 44px Trust Blue send icon button, disabled while blank. Signed out, a secondary button "เข้าสู่ระบบเพื่อแสดงความคิดเห็น" takes its place. Hidden author names show as "ผู้ใช้นิรนาม", never the real name.
- **Login form:** the same form in a bottom sheet over the map and on the `/login` page: heading, a short lede, one field per step (email, then the 6-digit code with `autocomplete="one-time-code"`), a 44px Trust Blue primary button, "เปลี่ยนอีเมล" and "ส่งรหัสใหม่" (locked for 60 seconds with a countdown) as text links, and errors in `role="alert"` directly under the field. When quick login is configured, a "สลับผู้ใช้สำหรับเดโม" section lists one secondary button per demo user.
- **Account button and menu:** the account icon button above (person icon when signed out, opens the login sheet; the name's initial when signed in, opens the menu). The menu is an 18px-radius Card White popover, 240px wide, with the name (and a "ผู้ดูแล" tag for admins), "สลับผู้ใช้" and "ออกจากระบบ" as 44px rows.
- **Report button (FAB):** a Trust Blue pill, 56px tall and 116px wide, 14px radius, Float shadow, a Lucide `plus` and the word "แจ้ง" (Prompt 600 17px, white), `aria-label="แจ้งเรื่องใหม่"`. Signed out it opens the login sheet and goes on to `/report` only after a successful login.
- **Report flow (three steps):** a short form, not a wizard. Each step has a 44px icon button on the left (`x` back to the map on step 1, `chevronLeft` after), the caption "ขั้น N จาก 3" above the step title (Prompt 600 22px), and a decorative three-segment track (done and current segments Trust Blue, the current one wider, future ones a Sand Line outline) so the words, not the colour, carry the state. Focus moves to the step title on every change. Step 1, "ถ่ายรูปปัญหา": a primary "ถ่ายรูป" and a secondary "เลือกจากคลัง", a four-column strip of square 12px-radius tiles (preview, an upload overlay, a retry button on error, a 44px remove button in the corner, a `check` badge when ready), and the caption "รูปจะขึ้นแผนที่หลังผู้ดูแลตรวจ". Step 2, "เป็นเรื่องอะไร": the eight categories as large buttons (2 columns on phones, 4 from 820px, at least 96px tall, a 32px icon over the Thai name); the chosen one gets a 2px Trust Blue edge, a 10% tint and a `check`, and a tap moves straight on. Step 3, "ปักหมุดตรงไหน": a street-map picker with a fixed centre pin (Lucide `mapPin`, 44px, Trust Blue), 44px zoom buttons, a caption saying where the pin came from, then the 52px "ส่งเรื่อง" button with "เล่าที่ปัญหา ไม่ระบุชื่อหรือกล่าวหาบุคคล" directly under it, and a collapsed "เพิ่มรายละเอียด" fold (title, description, a level radio group in the chip style, up to five tags, the "ไม่แสดงชื่อฉัน" switch). Send stays disabled below zoom 14 for every pin source.
- **Duplicate card:** replaces the step 3 body. Heading "เรื่องนี้ใช่ไหม?", up to three rows, each with a 72px tile (cover photo, else the category icon on the level colour mixed 45% into white), the title, a meta line (level shape and name, status, เจอเหมือนกัน N) and a Trust Blue outline "ใช่ กดเจอเหมือนกันแทน" button in the me-too style; under the list a secondary "ไม่ใช่ แจ้งเป็นเรื่องใหม่". A note says the first photo will be attached as a comment.
- **Sent card:** replaces the whole flow. A 64px disc in a 14% Trust Blue tint holding a `check`, "ส่งแล้ว รอผู้ดูแลตรวจ", a line promising the beam appears after review, then a primary "ดูเรื่องของฉัน" and a secondary "กลับไปแผนที่".
- **My reports (`/me`):** the same page grammar as the report flow (a 600px card from 820px). Top to bottom: the name row (the display name in Prompt 500 18px, a 44px "แก้ชื่อ" button that swaps the row for an input with an `n/30` counter, save and cancel, errors in `role="alert"`), the list "เรื่องที่แจ้ง · N" and a secondary "ออกจากระบบ".
- **Report row:** Card White, 18px radius, 12px apart. A 72px tile at the left (thumb, else the category icon on the level colour mixed 45% into white), then the title, a status line, and a muted meta line (level shape and name, place, age, เจอเหมือนกัน N for public ones). The status line is always a Lucide icon plus a word, six pairs with none shared: `clock` รอผู้ดูแลตรวจ, `eye` เปิดอยู่, `wrench` รอตรวจว่าแก้แล้ว, `circleCheck` แก้แล้ว, `circleX` ไม่ผ่านการตรวจ, `eyeOff` ถูกซ่อน, all in Slate Ink so status never rests on colour. A rejected row adds "ไม่ผ่านเพราะ: {reason}". Public reports (`open`, `fix_claimed`, `resolved`) are whole-card links to `/r/:id` that fill Cream Ground on hover; the rest are plain rows because nothing public exists to open.
- **Comment photo:** a comment with a photo shows its thumbnail under the text, at most 160px wide, 12px radius, `alt="รูปที่แนบในความคิดเห็น"`, lazy loaded; no lightbox.
- **Toast:** Slate Ink fill, Cream Ground text, 14px radius, `role="status"`.

### Beacon (signature component)
The Bat-Signal beacon. Bottom to top: a 14px base dot in the level colour with a white rim at the true point; one or two flattened pulse rings (3s / 2.4s / 1.6s / 1s for levels 0–3, two rings half a period apart for levels 2–3); the cone beam, level colour fading to transparent at 80% opacity, height `beamHeight(confirm_count)` from `packages/shared`, rising over 400ms; a 54px surface disc with a 3px level-colour border, the Glow, and the category's Lucide icon at 24px in ink; a level badge at its lower right; a short label pill above.
- **Level badge:** 18px pill in the level colour holding the level's solid shape in Slate Ink.
- **fix_claimed:** beam at 28% opacity, dashed disc border, no pulse.
- **resolved:** no beam, no pulse; mint border, a tick in place of the icon and the badge shape, disc at 85% opacity.
- **Compact:** below zoom 12 an isolated report draws a 60px beam, an 82% disc and no label; it becomes full height at zoom ≥ 12.
- **Selected:** the Selected ring (see Elevation) while its detail panel is open.
- **Labels:** at most 12 labels on screen, kept for the reports with the most "เจอเหมือนกัน".

### Cluster
A 52px surface disc with the count in Count type, a 3px border and one pulse ring in the highest level inside, the Glow, and that level's badge at the lower right. Its label names the count and the highest level. Clicking flies in.

### Toy map
Province polygons on real coordinates, three soil layers that flatten with zoom, one flat Cel Land colour per region, faint Land Ink province lines (30%, 0.6px), and a 6px sand rim under the Land Ink outline. Nothing stands on it: no names, landmarks, vehicles or compass. Every toy layer fades from 100% at zoom 6 to 0% at zoom 8; the street map's place names start at zoom 7.5.

### Sea
A MapLibre custom WebGL layer (`features/map/sea/`) over everything outside Thailand at every zoom, with the flat Toy Sea fill under it as the fallback. An animated ocean (owner, 2026-10-17): a smooth glow around the coast (from a softened coast distance, so it follows the shore in clean curves) fading from the Shallow Glow through Mid to Deep, its reach 38 km or 26 px, whichever is wider; thin (~1 px, soft) ripple lines in the Line colour rolling out from the shore, about three at a time, each fading as it travels; soft foam that washes up the coast and drains back; and out on the open sea only a few small wave marks (two little crests), each fading in, drifting and fading out over about 10 s. No contour lines, wave strokes or glints (owner, 2026-10-17). Patterns are fixed to the ground and drawn at the two whole zooms around the camera, crossfaded, so nothing pops while zooming. Ripples and foam fade out between zoom 8 and 10 (the coast texture is too coarse past that); a white line on the mask edge stands in from zoom 8 and is gone by 11.5. Animation is capped at 30 fps (each frame repaints the whole map) and stops only in a hidden tab. Motion never switches off for `prefers-reduced-motion` (owner, 2026-10-17): the app does not read it at all. The camera centre is held inside Thailand plus about 2 degrees, and the zoom floor is the whole country.

### Attribution
MapLibre's strip on the surface at 88%, Muted Ink text and links, Trust Blue focus ring on its ⓘ toggle.

## Do's and Don'ts

### Do:
- **Do** encode every danger level with colour, the solid SVG shape and pulse speed together.
- **Do** keep text on pastel fills in Slate Ink (#2B2A33), with the pastel mixed into white, in both themes.
- **Do** show an off filter chip as an outline (transparent, 1px Sand Line, Muted Ink, line-through), not as a faded chip.
- **Do** keep every target at least 44 × 44 px and give every beacon an `aria-label` of "{title} ระดับ{level} {status}".
- **Do** use Lucide SVG icons for pictograms so they look the same on every device; never emoji.
- **Do** say a report's status in words with its own Lucide icon, and say only what is true about photos ("รูปจะขึ้นแผนที่หลังผู้ดูแลตรวจ").
- **Do** credit OpenStreetMap, OpenFreeMap, OCHA COD-AB and Lucide (ISC) in the map attribution.

### Don't:
- **Don't** look like a dark game or a cold government form.
- **Don't** copy or store the reference poster by ครูหนิง & Gemini; draw everything from real geometry and MIT emoji.
- **Don't** show status with colour; status is beam shape.
- **Don't** let anything except beacons glow.
- **Don't** type level shapes as characters (● ▲ ◆ ⚠); draw them from the SVG set.
- **Don't** move a map name away from its town to make it fit; hide it.
- **Don't** claim photos are blurred until blurring exists.
