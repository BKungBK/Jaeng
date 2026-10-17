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
  land-sand: "#F3EBDD"
  block-cream: "#FAF5EC"
  river-mist: "#CFE3F0"
  toy-sea: "#4FB3EA"
  level-minor-mint: "#8FD3B6"
  level-caution-butter: "#F6D983"
  level-danger-peach: "#F4A582"
  level-critical-rose: "#E57373"
  toy-land-green: "#79B83C"
  toy-isan-orange: "#F5A04A"
  toy-rim-cream: "#F3E3B0"
  toy-soil-light: "#AB7B42"
  toy-soil-mid: "#946636"
  toy-soil-deep: "#7B5430"
  night-ground: "#23212B"
  night-card: "#2E2B38"
  night-ink: "#F3EFF7"
  night-muted-ink: "#B7B2C4"
  night-blue: "#9CC0EE"
  night-line: "#433F52"
  night-sea: "#2F6F9F"
typography:
  headline:
    fontFamily: "Prompt, IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Prompt, IBM Plex Sans Thai, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.3
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
rounded:
  tag: "10px"
  chip: "14px"
  tooltip: "16px"
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
  chip-level:
    textColor: "{colors.slate-ink}"
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
    rounded: "{rounded.tooltip}"
    padding: "8px 12px"
    width: "240px"
  beacon-disc:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.disc}"
    size: "54px"
  cluster-disc:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.disc}"
    size: "52px"
---

# Design System: แจ้ง

## Overview

**Creative North Star: "เมืองของเล่นยามฟ้าแจ้ง" (Toy Town at First Light)**

แจ้ง means both "to report" and "the sky turning bright". The system is a toy model of Thailand seen at dawn: thick, soft-edged land like a painted wooden puzzle, a bright toy sea, small 3D landmarks, and above it the only lights in the scene, pastel signal beams that rise from each reported problem. The toy world is the welcome; the beams are the information. As the visitor zooms in, the toy dissolves into a calm street map and the beams stay, so the map stops being a picture and becomes a place.

Everything around the map is a working app: floating white cards with soft shadows, 44 px targets, Thai-first type, short warm copy. The interface never imitates the toy; it sits on top of it like a friendly guide holding the map open. Danger is said three ways at once (colour, shape, pulse speed), and status is said by the beam's form, never by colour.

Confirmed anti-references: a dark gaming look, glowing neon on black, and the cold grey forms of a government portal. The owner's reference poster is a style reference only; its artwork is never copied or stored.

**Key Characteristics:**
- Toy-model Thailand (stacked soil layers, green land, orange Isan, cream rim) that fades out between zoom 6 and 8.
- Pastel beams as the only light source; height grows with "เจอเหมือนกัน".
- Floating cards over a full-bleed map; no app chrome bars.
- Microsoft Fluent Emoji 3D (MIT) for every pictogram: landmarks, vehicles and the eight category icons, so the toy world and the beacons share one object language.
- Prompt for voice, IBM Plex Sans Thai for reading.

## Colors

A full pastel palette on a warm cream ground, with one trustworthy blue for action and four level colours that only ever mean danger.

### Primary
- **Trust Blue** (#3F6FA8): primary buttons, links, focus rings, the "me" location dot. Never used for danger or status.

### Secondary
- **Level Minor Mint** (#8FD3B6): danger level 0 ทั่วไป, and the resolved state's tick disc.
- **Level Caution Butter** (#F6D983): danger level 1 ควรระวัง.
- **Level Danger Peach** (#F4A582): danger level 2 อันตราย.
- **Level Critical Rose** (#E57373): danger level 3 วิกฤต. The only red in the system.

### Tertiary (illustration only)
- **Toy Land Green** (#79B83C), **Toy Isan Orange** (#F5A04A), **Toy Rim Cream** (#F3E3B0): the toy land top, the Isan region, and the rim stroke.
- **Toy Soil** light / mid / deep (#AB7B42 / #946636 / #7B5430): the three stacked side layers that make the land look thick.
- **Toy Sea** (#4FB3EA): the sea and the world mask that hides every other country.

### Neutral
- **Cream Ground** (#FBF7F2): page background behind sheets and lists.
- **Card White** (#FFFFFF): cards, chips' base mix, discs, tooltips, sheets.
- **Slate Ink** (#2B2A33): all text, including text on pastel chips.
- **Muted Ink** (#6B6878): secondary text, hints.
- **Sand Line** (#E8E0D5): dividers and secondary button borders.
- **Land Sand** (#F3EBDD), **Block Cream** (#FAF5EC), **River Mist** (#CFE3F0): street-map land, blocks and water tints, and neutral tags.
- **Night** set (#23212B ground, #2E2B38 card, #F3EFF7 ink, #B7B2C4 muted, #9CC0EE blue, #433F52 line, #2F6F9F sea): the dark theme, same roles.

### Named Rules
**The Levels Only Mean Danger Rule.** Mint, butter, peach and rose are reserved for the four danger levels. Never use them for decoration, categories or status.

**The Ink On Pastel Rule.** Text on any pastel fill is Slate Ink (#2B2A33), never white, so every chip passes WCAG AA.

**The Toy Stays Toy Rule.** Illustration colours do not change with the theme. In dark mode the toy keeps its daylight colours and only the sea darkens to Night Sea; the toy is an object, not a surface.

## Typography

**Display Font:** Prompt (with IBM Plex Sans Thai, system-ui)
**Body Font:** IBM Plex Sans Thai (with system-ui)

**Character:** Prompt is round, friendly and loud enough to name a place; Plex Sans Thai is calm and legible at 12–16 px in Thai and English. Both are served locally through @fontsource.

### Hierarchy
- **Headline** (600, 19px, 1.3): the brand word, sheet titles.
- **Title** (500, 15px, 1.3): buttons and card headings.
- **Body** (400, 16px, 1.6): descriptions and comments.
- **Label** (500, 14px): chips, tooltip titles.
- **Caption** (400, 13px): hints, metadata, status lines.
- **Map Label** (Prompt 600, 13px on the street map; 15–22px on the toy map, scaled with zoom): province names, white with a 3px Slate Ink halo; beacon short labels use Plex 12px on a white pill.

### Named Rules
**The Thai First Rule.** Sizes and line heights are chosen for Thai with its tall vowels and tone marks; never set Thai body text tighter than 1.5 line height.

## Layout

A full-bleed map with floating controls. No top app bar and no tab bar on the map.

- Top-left: brand card. Next to it (wrapping below on phones): the level chip group.
- Right edge: zoom-in, zoom-out and my-location buttons, vertically centred on desktop and bottom-right above the safe area on phones.
- Bottom-left: the zoom-level hint card (top under the chips on phones).
- Detail opens as a 380 px right panel at ≥ 820 px, and as a bottom sheet at about 64% height below 820 px.
- Gutters are 12 px from every edge plus the safe-area inset. Gaps between floating elements are 8 px.
- Breakpoint: 820 px is the only layout breakpoint.

## Elevation & Depth

Two depth systems that never mix. The UI floats with one soft, warm shadow. The toy map has physical depth, made of stacked soil layers offset downward, not shadows.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 28px rgba(60,50,40,.18)`): every floating card, tooltip and sheet.
- **Pill** (`box-shadow: 0 2px 8px rgba(0,0,0,.15)`): beacon short labels.
- **Glow** (`box-shadow: 0 0 0 6px color-mix(in srgb, <level> 30%, transparent), 0 0 28px <level>`): beacon and cluster discs only; it is the light the beam gives off.

### Named Rules
**The One Light Rule.** Only beacons glow. No other element gets a coloured shadow or glow.

## Shapes

Soft and rounded, like toys: 14 px chips and buttons, 18 px cards, 24 px sheets, perfect circles for discs and pulse rings. The beam is a narrow cone (a polygon from the full width at the top to 8% at the base). Pulse rings are flattened ellipses, as if light falls on the ground.

## Components

### Buttons
- **Shape:** gently rounded (14px), at least 44 × 44 px.
- **Primary:** Trust Blue fill, white Prompt 500 15px label.
- **Secondary:** Card White with a 1px Sand Line border.
- **Focus:** 3px Trust Blue outline with 2px offset, on every interactive element.

### Chips
- **Level filter chips:** fill is the level colour mixed 55% into Card White, Slate Ink label, prefixed by the level's shape symbol (● ▲ ◆ ⚠).
- **Off state:** 40% opacity with a line-through, and `aria-pressed="false"`. Shape symbol stays, so off is readable without colour.

### Cards / Containers
- **Floating card:** Card White, 18px radius, Float shadow, 8–14px padding.
- **Tooltip:** Card White, 16px radius, Float shadow, max 240px; title in Label, meta line in Caption with shape symbol, level name, status and "เจอเหมือนกัน N"; a 16:9 cover photo when one exists, else the category's 3D icon on a level-tinted tile.

### Beacon (signature component)
The Bat-Signal beacon. Bottom to top: a 14px base dot in the level colour with a white rim at the true point; one or two flattened pulse rings (3s / 2.4s / 1.6s / 1s for levels 0–3, two rings for levels 2–3); the cone beam, level colour fading to transparent, height `beamHeight(confirm_count)` from `packages/shared`; a 54px white disc with a 3px level-colour border, the Glow, and the category's Fluent Emoji 3D icon; a shape-symbol badge at its lower right; a short label pill above.
- **fix_claimed:** beam at 28% opacity, dashed disc border, no pulse.
- **resolved:** no beam, no pulse, mint disc with a tick.
- **Compact:** at zoom < 12 an isolated report draws a short beam (60 px) and no label; it becomes full height at zoom ≥ 12.
- **Labels:** at most 12 labels on screen, kept for the reports with the most "เจอเหมือนกัน".

### Cluster
A 52px white disc with the count in Prompt 600 18px, a 3px border in the highest level inside, the Glow, and one pulse ring at that level's speed. Clicking flies in.

### Toy map
Province polygons on real coordinates, three soil layers offset 8/16/24 px downward, green top with an orange Isan, thin province lines, fifteen white province labels, and Fluent Emoji 3D landmarks and vehicles placed on real coordinates. Clouds, two planes and a train drift slowly over it; all motion stops under `prefers-reduced-motion`. A compass sits at the lower right. Every toy layer fades from 100% at zoom 6 to 0% at zoom 8.

## Do's and Don'ts

### Do:
- **Do** encode every danger level with colour, shape symbol and pulse speed together.
- **Do** keep text on pastel fills in Slate Ink (#2B2A33).
- **Do** keep every target at least 44 × 44 px and give every beacon an `aria-label` of "{title} ระดับ{level} {status}".
- **Do** use Fluent Emoji 3D images for pictograms so they look the same on every device.
- **Do** credit OpenStreetMap, OpenFreeMap, OCHA COD-AB and Microsoft Fluent Emoji (MIT) in the map attribution.

### Don't:
- **Don't** look like a dark game or a cold government form.
- **Don't** copy or store the reference poster by ครูหนิง & Gemini; draw everything from real geometry and MIT emoji.
- **Don't** show status with colour; status is beam shape.
- **Don't** let anything except beacons glow.
- **Don't** claim photos are blurred until blurring exists.
