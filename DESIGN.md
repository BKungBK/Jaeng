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
  street-ground: "#E4EDCC"
  toy-sea: "#4FB3EA"
  sea-shallow: "#3FD6C8"
  sea-mid: "#1FA2E0"
  sea-deep: "#1556B8"
  sea-caustic: "#B9F3EC"
  sticker-paper: "#FFF8EC"
  level-minor-mint: "#8FD3B6"
  level-caution-butter: "#F6D983"
  level-danger-peach: "#F4A582"
  level-critical-rose: "#E57373"
  cel-north: "#7DBE4A"
  cel-isan: "#F5A04A"
  cel-central: "#9BD067"
  cel-south: "#4FB47A"
  toy-rim-cream: "#F3E3B0"
  toy-soil-light: "#AB7B42"
  toy-soil-mid: "#946636"
  toy-soil-deep: "#7B5430"
  night-ground: "#23212B"
  night-card: "#2E2B38"
  night-ink: "#F3EFF7"
  night-muted-ink: "#B7B2C4"
  night-blue: "#9CC0EE"
  night-on-blue: "#1D1B24"
  night-line: "#433F52"
  night-sea: "#2F6F9F"
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
  peek-card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.card}"
    padding: "12px"
    width: "300px"
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
- Cel-shaded toy Thailand (flat province tones, ink outline, sand rim, stacked soil layers) that fades out between zoom 6 and 8; its province names leave first, between zoom 6 and 7. Only Thailand is ever shown: everything else is an animated cel sea.
- Pastel beams as the only light source; height grows with "เจอเหมือนกัน".
- Floating cards over a full-bleed map; no app chrome bars.
- Lucide (ISC) line icons for every pictogram: landmarks, vehicles, the compass, the controls and the eight category icons. No emoji anywhere (owner decision 2026-10-17); on the map an icon sits on a "sticker" (cream disc, ink rim).
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
- **Cel Land** tones, three per region so neighbouring provinces never match: north #6FAF3E / #7DBE4A / #8CC957, Isan #EE9339 / #F5A04A / #F8B061, central #8CC458 / #9BD067 / #ABDA7B, south #43A86D / #4FB47A / #60C089. Hover lifts a province 30% toward white. **Toy Rim Cream** (#F3E3B0) is the 6px sand beach under the 2–3px Slate Ink outline.
- **Toy Soil** light / mid / deep (#AB7B42 / #946636 / #7B5430): the three stacked side layers that make the land look thick.
- **Cel Sea** (from the owner's reference): Shallow Turquoise #3FD6C8, Mid Blue #1FA2E0, Deep Blue #1556B8, Caustic #B9F3EC, white foam and sparkles; Night: #1F8A8C / #145C93 / #0E2F6B / #58C2C0, foam #CFE8F0. **Toy Sea** (#4FB3EA, Night #2F6F9F) stays as the flat fallback under it.

### Neutral
- **Cream Ground** (#FBF7F2): page background, icon-button hover fill, toast text.
- **Card White** (#FFFFFF): cards, chip tray, discs, tooltips, sheets, and the white base every chip pastel is mixed into.
- **Slate Ink** (#2B2A33): all text, including text on pastel chips and level badges in both themes; the halo behind toy province names; the toast fill.
- **Muted Ink** (#6B6878): secondary text, hints, meta lines, off chips, map attribution.
- **Sand Line** (#E8E0D5): dividers, icon-button borders, the 1px outline of an off chip.
- **Street map (cel):** ground #E4EDCC, parks #BFE09A, woods #A9D483, homes #EEEBD6, buildings #FFF8EC with an ink edge, roads white with Slate Ink casings, water in Shallow Turquoise; Night ground #29321F with the same roles darkened.
- **Night** set (#23212B ground, #2E2B38 card, #F3EFF7 ink, #B7B2C4 muted, #9CC0EE blue, #433F52 line, #2F6F9F sea): the dark theme, same roles. Cards, discs and the chip tray turn Night Card; chips keep their daylight pastel.

### Named Rules
**The Levels Only Mean Danger Rule.** Mint, butter, peach and rose are reserved for the four danger levels. Never use them for decoration, categories or status.

**The Ink On Pastel Rule.** Text on any pastel fill is Slate Ink (#2B2A33), never white and never the theme ink, and the pastel is always mixed into white, never into the theme surface. A chip reads the same in light and dark and every one passes WCAG AA.

**The Toy Stays Toy Rule.** Illustration colours do not change with the theme. In dark mode the toy keeps its daylight colours and only the sea and the street map darken; the toy is an object, not a surface.

**The Cel Rule.** The map has no gradients: every colour change is a hard step, every land edge has an ink line, and shadows are flat offsets, never blurs.

## Typography

**Display Font:** Prompt (with IBM Plex Sans Thai, system-ui)
**Body Font:** IBM Plex Sans Thai (with system-ui)

**Character:** Prompt is round, friendly and loud enough to name a place; Plex Sans Thai is calm and legible at 12–16 px in Thai and English. Both are served locally through @fontsource.

### Hierarchy
- **Headline** (Prompt 600, 24px, 1.2): the brand word แจ้ง in the brand card; sheet titles.
- **Title** (Prompt 500, 15px, 1.4): buttons and card headings, the report title in the tooltip and peek card (wraps anywhere, never truncates).
- **Body** (400, 16px, 1.6): descriptions and comments.
- **Label** (500, 14px, 1.4): level chips (13px under 420px), toast.
- **Caption** (400, 13px, 1.5): brand tagline, hint card, meta and age lines. An age past 30 days switches to ink at 500 ("ค้างนาน").
- **Count** (Prompt 600, 18px, tabular figures): cluster counts.
- **Map Label** (Prompt 600): toy province names grow from 13px at zoom 4 to 21px by zoom 6.5, white with a Slate Ink halo (3px blur plus a 1px outline); beacon short labels are Plex 12px on a 22px white pill, max 150px, ellipsised.

### Named Rules
**The Thai First Rule.** Sizes and line heights are chosen for Thai with its tall vowels and tone marks; never set Thai body text tighter than 1.5 line height.

**The Names Stay Home Rule.** A toy province name sits on its town, else one row below, else one row above (a name may prefer up), clear of clusters, beacons, landmarks and other names. If none of the three spots is free, it hides rather than drift. Names are short forms (กรุงเทพฯ).

## Layout

A full-bleed map with floating controls. No top app bar and no tab bar on the map.

- Top-left: brand card, with the level chip tray beside it (wrapping below on narrow screens). The group stops 72px from the right edge on desktop to clear the controls.
- Right edge: zoom-in, zoom-out and my-location icon buttons in an 8px stack, vertically centred on desktop and bottom-right on phones.
- Bottom-left: the zoom-level hint card (max 340px on desktop). On phones it stretches to the control column and both sit 52px above the bottom so the attribution fits beneath.
- Lower right on desktop: the Lucide compass on a 72px sticker, fading with the toy. Hidden under 820px; it is decoration and the phone needs the corner.
- Attribution: bottom-right MapLibre strip; folded to its ⓘ button under 820px.
- Report detail: a peek card at the right (300px, 72px from the edge, 96px from the top) on desktop, docked to the bottom edge with 12px gutters on phones. The full detail panel (380px right panel at ≥ 820px, bottom sheet at about 64% height below) replaces it in a later plan.
- Toast: centred, 84px from the top.
- Gutters are 12px from every edge plus the safe-area inset. Gaps between floating elements are 8px.
- Breakpoint: 820px is the only layout breakpoint; under 420px the chip tray tightens (4px gaps, 8px chip padding, no wrap).

## Elevation & Depth

Two depth systems that never mix. The UI floats with one soft, warm shadow. The toy map has physical depth made of stacked soil layers offset downward (8 / 16 / 24px at zoom 6), which flatten to zero by zoom 8 so the coast never ghosts as the toy fades. Toy props that move above the land (planes, clouds, train, ships) carry a soft drop to show they are off the ground.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 28px rgba(60,50,40,.18)`): every floating card, the chip tray, icon buttons, tooltip, peek card and sheet.
- **Pill** (`box-shadow: 0 2px 8px rgba(0,0,0,.15)`): beacon short labels.
- **Glow** (`box-shadow: 0 0 0 6px color-mix(in srgb, <level> 30%, transparent), 0 0 28px <level>`): beacon and cluster discs only; it is the light the beam gives off.
- **Selected** (`box-shadow: 0 0 0 3px <surface>, 0 0 0 6px <Trust Blue>, 0 0 28px <level>`): the beacon whose peek card is open; a solid blue ring replaces the level halo, the glow stays.
- **Prop Lift** (a flat, unblurred offset: `box-shadow: 0 4px 0 rgba(43,42,51,.35)` on stickers, `drop-shadow(0 6px 0 rgba(43,42,51,.18))` on clouds): moving toy props only.

### Named Rules
**The One Light Rule.** Only beacons glow. No other element gets a coloured shadow or glow.

## Shapes

Soft and rounded, like toys: 9px level badges, 10px label pills, 12px picture tiles, 14px chips, buttons and toast, 18px cards, tooltip and peek card, 24px sheets, perfect circles for discs and pulse rings. The beam is a narrow cone (a polygon from the full width at the top to 8% at the base). Pulse rings are flattened ellipses, as if light falls on the ground.

The four level shapes are one solid SVG set on a 12-unit grid: a filled circle (ทั่วไป), triangle (ควรระวัง), diamond (อันตราย), and a triangle with a cut-out exclamation (วิกฤต). They fill with currentColor at 0.85em inline and 10px inside badges, so their weight matches wherever they appear. Every other icon is Lucide (`apps/web/src/app/features/map/icons.ts`, `<app-icon>`): 22px in icon buttons, 24px in beacon discs, stroke 2, round caps, currentColor.

### Named Rules
**The One Shape Set Rule.** A danger level's shape is always drawn from the SVG set, never typed as a character, so chips, badges and meta lines show the same weight on every device.

## Components

### Buttons
- **Shape:** gently rounded (14px), at least 44 × 44 px.
- **Primary:** Trust Blue fill, white Prompt 500 15px label.
- **Secondary:** Card White with a 1px Sand Line border.
- **Icon button:** 44px square, Card White, 1px Sand Line border, Float shadow, a 22px line icon; hover fills Cream Ground. Inside a card (the peek card's close) it drops the shadow.
- **Focus:** 3px Trust Blue outline with 2px offset on every interactive element (4px offset on discs).

### Chips
- **Tray:** the four level chips sit in one Card White tray (18px radius, 6px padding and gap, Float shadow).
- **On:** fill is the level colour mixed 55% into white (75% on hover), Slate Ink label, led by the level's solid shape. Same fill and ink in both themes.
- **Off:** transparent fill, a 1px Sand Line inner outline, Muted Ink label with a line-through, `aria-pressed="false"`. The shape stays, so off reads without colour.

### Cards / Containers
- **Floating card:** Card White, 18px radius, Float shadow, 8–14px padding (brand card 8px 16px 10px).
- **Tooltip:** Card White, 18px radius, Float shadow, 240px wide, no pointer events. Top to bottom, 4px apart: a 120px picture tile (cover photo, else the category's Lucide icon at 40px in ink on the level colour mixed 45% into the surface), the title, a meta line (level shape, level name · status · เจอเหมือนกัน N), and for open reports an age line.
- **Peek card:** the same summary at 300px in a `role="dialog"` labelled by its title, with an icon-button close in its own column beside the picture. It is a stand-in for the detail panel and inherits its slot.
- **Toast:** Slate Ink fill, Cream Ground text, 14px radius, `role="status"`.

### Beacon (signature component)
The Bat-Signal beacon. Bottom to top: a 14px base dot in the level colour with a white rim at the true point; one or two flattened pulse rings (3s / 2.4s / 1.6s / 1s for levels 0–3, two rings half a period apart for levels 2–3); the cone beam, level colour fading to transparent at 80% opacity, height `beamHeight(confirm_count)` from `packages/shared`, rising over 400ms; a 54px surface disc with a 3px level-colour border, the Glow, and the category's Lucide icon at 24px in ink; a level badge at its lower right; a short label pill above.
- **Level badge:** 18px pill in the level colour holding the level's solid shape in Slate Ink.
- **fix_claimed:** beam at 28% opacity, dashed disc border, no pulse.
- **resolved:** no beam, no pulse; mint border, a tick in place of the icon and the badge shape, disc at 85% opacity.
- **Compact:** below zoom 12 an isolated report draws a 60px beam, an 82% disc and no label; it becomes full height at zoom ≥ 12.
- **Selected:** the Selected ring (see Elevation) while its peek card is open.
- **Labels:** at most 12 labels on screen, kept for the reports with the most "เจอเหมือนกัน".

### Cluster
A 52px surface disc with the count in Count type, a 3px border and one pulse ring in the highest level inside, the Glow, and that level's badge at the lower right. Its label names the count and the highest level. Clicking flies in.

### Toy map
Province polygons on real coordinates, three soil layers that flatten with zoom, flat Cel Land tones, faint ink province lines (30%, 0.6px), a 6px sand rim under the ink outline, fifteen white province names, and Lucide stickers for landmarks (28→44px between zoom 4 and 8) and vehicles placed on real coordinates. Clouds, planes, a train and ships drift slowly over it and pass under the names; all motion stops under `prefers-reduced-motion`. Every toy layer fades from 100% at zoom 6 to 0% at zoom 8; the province names fade from zoom 6 to 7 so they never double with the street map's own names.

### Cel sea
A MapLibre custom WebGL layer (`features/map/sea/`) over everything outside Thailand at every zoom, with the flat Toy Sea fill under it as the fallback. Hard depth bands from a coast-distance texture: shallows 4–30 km (about 6px at the country view), mid to four times that, deep beyond, their edges wobbling slowly; thin caustic cell lines in the shallows (faint in the mid band); foam that laps the coast with a broken line chasing it (faded out past zoom 9, where a static white line on the exact mask edge takes over); brief star sparkles on open water. Animation is capped at 30 fps, stops in a hidden tab and freezes under `prefers-reduced-motion`. The camera centre is held inside Thailand plus about 2 degrees, and the zoom floor is the whole country.

### Attribution
MapLibre's strip on the surface at 88%, Muted Ink text and links, Trust Blue focus ring on its ⓘ toggle.

## Do's and Don'ts

### Do:
- **Do** encode every danger level with colour, the solid SVG shape and pulse speed together.
- **Do** keep text on pastel fills in Slate Ink (#2B2A33), with the pastel mixed into white, in both themes.
- **Do** show an off filter chip as an outline (transparent, 1px Sand Line, Muted Ink, line-through), not as a faded chip.
- **Do** keep every target at least 44 × 44 px and give every beacon an `aria-label` of "{title} ระดับ{level} {status}".
- **Do** use Lucide SVG icons for pictograms so they look the same on every device; never emoji.
- **Do** credit OpenStreetMap, OpenFreeMap, OCHA COD-AB and Lucide (ISC) in the map attribution.

### Don't:
- **Don't** look like a dark game or a cold government form.
- **Don't** copy or store the reference poster by ครูหนิง & Gemini; draw everything from real geometry and MIT emoji.
- **Don't** show status with colour; status is beam shape.
- **Don't** let anything except beacons glow.
- **Don't** type level shapes as characters (● ▲ ◆ ⚠); draw them from the SVG set.
- **Don't** move a map name away from its town to make it fit; hide it.
- **Don't** claim photos are blurred until blurring exists.
