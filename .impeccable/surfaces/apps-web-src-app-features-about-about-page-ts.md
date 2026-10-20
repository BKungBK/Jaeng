---
version: 1
slug: "apps-web-src-app-features-about-about-page-ts"
primary_target: "apps/web/src/app/features/about/about.page.ts"
related_targets: ["apps/web/src/app/shared/emergency-box.component.ts","apps/web/src/app/shared/language-choice.component.ts","apps/web/src/app/shared/theme-choice.component.ts"]
---

# Surface: เกี่ยวกับแจ้ง (`/about`)

**Mode:** Read. Anyone (signed in or not) learns what Jaeng is, its rules and what happens to their data, finds the emergency numbers, and changes language or theme.

## Brief
- **Audience:** a first-time visitor from the brand card's `info` button or the account menu; the instructor checking the rules and privacy promises; someone in a hurry looking for the emergency numbers.
- **Content (dictionaries only, both languages):** six sections in order, each with an h2: "แจ้งคืออะไร" (two short paragraphs), "กติกาการแจ้ง" (four bullets: the problem, not the person; no faces, plates or private details in photos; every report and every "fixed" passes the moderator first; not an emergency channel), "เบอร์ฉุกเฉิน" (the shared emergency box: the detail panel's words and three `tel:` links 191 / 199 / 1669), "ข้อมูลส่วนตัว" (five bullets: e-mail only for signing in; a hidden name is hidden from the public, not from the moderator; photos re-encoded without metadata or GPS (true: the API re-encodes to WebP without `withMetadata`); hazard pins moved up to 150 m; photos are **not blurred yet**, so leave faces and plates out), "การแสดงผล" (language and theme radiogroups, for everyone), "เครดิต" (what + who, linked: OpenStreetMap, OpenFreeMap/OpenMapTiles, OCHA COD-AB, MapLibre, Lucide ISC, Prompt and IBM Plex Sans Thai OFL; proper names stay as written).

## Direction (incumbent world, DESIGN.md unchanged)
- The `/me` page grammar: Cream Ground page, a centred 600 px Card White card from 820 px, flat on phones; header with a 44 px `chevronLeft` back to the map (pops back, the map keeps its view) and h1 "เกี่ยวกับแจ้ง" (Prompt 600 24 px).
- Reading rhythm: h2 Prompt 500 17 px, body Plex 16/1.6 at most 62ch, bullets with muted markers, 24 px between sections. No illustration, no cards inside the card except the emergency box (rose 24% into white, Slate Ink, the only rose on the page).
- Never say photos are blurred or checked automatically; the one blur sentence says they are not blurred yet.

## Constraints
44 px targets for buttons and the tel links, focus ring 3 px Trust Blue offset 2 px, one breakpoint 820 px, Lucide only, no emoji (the no-emoji guard counts "©", so credits say "contributors"), never `prefers-reduced-motion`.
