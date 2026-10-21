---
name: แจ้ง
description: Community problems as pastel signal beams on a toy Thailand, read through frosted, grain-textured glass at night-into-dawn.
colors:
  night-ground: "#0F1F44"
  night-surface: "#1B2A52"
  night-ink: "#F3EFF7"
  night-muted-ink: "#B9B5CC"
  night-line: "#2F3D66"
  night-accent: "#F4B49A"
  on-night-accent: "#2A1F3A"
  night-ink-wash: "rgba(243, 239, 247, 0.06)"
  glass-night: "rgba(16, 26, 54, 0.45)"
  glass-night-dense: "rgba(16, 26, 54, 0.8)"
  glass-edge-night: "rgba(255, 255, 255, 0.13)"
  dawn-cream: "#FFE3C4"
  dawn-peach: "#F4B49A"
  dawn-lilac: "#C9A0DC"
  dawn-ink: "#2A1F3A"
  backdrop-night: "#0E1D40"
  backdrop-navy: "#13264D"
  backdrop-glow: "#24356E"
  day-ground: "#FBF7F2"
  day-surface: "#FFFFFF"
  slate-ink: "#2B2A33"
  muted-ink: "#6B6878"
  sand-line: "#E8E0D5"
  glass-day: "rgba(255, 255, 255, 0.58)"
  glass-day-dense: "rgba(255, 255, 255, 0.84)"
  glass-edge-day: "rgba(255, 255, 255, 0.75)"
  backdrop-day: "#F6F1FA"
  backdrop-day-lilac: "#DCD6F2"
  backdrop-day-blush: "#F9D9CB"
  level-minor-mint: "#8FD3B6"
  level-caution-butter: "#F6D983"
  level-danger-peach: "#F4A582"
  level-critical-rose: "#E57373"
  toy-sea: "#9FCFDD"
  night-sea: "#1F5A6E"
  sea-shallow: "#C8F0E6"
  sea-deep: "#86A6D4"
  sea-line: "#F2FCF9"
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
typography:
  display:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: 1.3
  headline:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  chip:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1
  dock-word:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.2
  count:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  map-label:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "22px"
rounded:
  badge: "9px"
  tag: "10px"
  thumb: "12px"
  chip: "15px"
  button: "16px"
  toast: "16px"
  capsule-sm: "20px"
  panel: "22px"
  capsule: "23px"
  page-card: "24px"
  sheet: "26px"
  dock: "30px"
  disc: "50%"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  gutter: "16px"
  gutter-wide: "20px"
  xl: "24px"
components:
  glass-panel:
    backgroundColor: "{colors.glass-night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.panel}"
    padding: "8px"
  glass-panel-dense:
    backgroundColor: "{colors.glass-night-dense}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.panel}"
  button-primary:
    backgroundColor: "{colors.dawn-peach}"
    textColor: "{colors.dawn-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "44px"
  button-primary-big:
    backgroundColor: "{colors.dawn-peach}"
    textColor: "{colors.dawn-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.night-ink-wash}"
    textColor: "{colors.night-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "44px"
  button-back:
    backgroundColor: "{colors.glass-night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.disc}"
    size: "44px"
  report-pill:
    backgroundColor: "{colors.dawn-peach}"
    textColor: "{colors.dawn-ink}"
    rounded: "{rounded.capsule}"
    padding: "0 20px 0 16px"
    height: "46px"
  report-round:
    backgroundColor: "{colors.dawn-peach}"
    textColor: "{colors.dawn-ink}"
    rounded: "{rounded.disc}"
    size: "46px"
  brand-mark:
    backgroundColor: "{colors.dawn-peach}"
    textColor: "{colors.dawn-ink}"
    rounded: "{rounded.disc}"
    size: "34px"
  chip-level:
    backgroundColor: "{colors.glass-night}"
    textColor: "{colors.night-ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.chip}"
    padding: "0 11px"
    height: "44px"
  chip-level-off:
    textColor: "{colors.night-muted-ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.chip}"
    padding: "0 11px"
    height: "44px"
  phone-bar:
    backgroundColor: "{colors.glass-night}"
    rounded: "{rounded.capsule}"
    padding: "0 4px 0 6px"
    height: "46px"
  summary-pill:
    backgroundColor: "{colors.glass-night}"
    textColor: "{colors.night-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.capsule-sm}"
    height: "40px"
  dock:
    backgroundColor: "{colors.glass-night}"
    rounded: "{rounded.dock}"
    padding: "0 8px"
    height: "60px"
    width: "300px"
  dock-tab:
    textColor: "{colors.night-muted-ink}"
    typography: "{typography.dock-word}"
    rounded: "{rounded.chip}"
    height: "44px"
    width: "56px"
  side-panel:
    backgroundColor: "{colors.glass-night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.panel}"
    padding: "8px"
    width: "340px"
  menu-capsule:
    backgroundColor: "{colors.glass-night}"
    textColor: "{colors.night-muted-ink}"
    rounded: "{rounded.capsule-sm}"
    padding: "0 4px"
    height: "40px"
  control-column:
    backgroundColor: "{colors.glass-night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.capsule-sm}"
    width: "40px"
  search-field:
    backgroundColor: "{colors.night-ink-wash}"
    textColor: "{colors.night-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "0 4px 0 12px"
    height: "44px"
  detail-panel:
    backgroundColor: "{colors.glass-night-dense}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.panel}"
    padding: "12px"
    width: "380px"
  detail-sheet:
    backgroundColor: "{colors.glass-night-dense}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.sheet}"
  tooltip:
    backgroundColor: "{colors.glass-night-dense}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.toast}"
    padding: "10px 12px 12px"
    width: "240px"
  toast:
    backgroundColor: "{colors.glass-night-dense}"
    textColor: "{colors.night-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.toast}"
    padding: "8px 16px"
  page-card:
    backgroundColor: "{colors.glass-night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.page-card}"
    padding: "20px 24px 28px"
    width: "600px"
  admin-card:
    backgroundColor: "{colors.glass-night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.page-card}"
    padding: "20px 24px 28px"
    width: "760px"
  report-row:
    backgroundColor: "{colors.night-ink-wash}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.button}"
    padding: "10px"
  stats-ring:
    backgroundColor: "{colors.dawn-peach}"
    rounded: "{rounded.disc}"
    size: "26px"
  beacon-disc:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.disc}"
    size: "54px"
  cluster-disc:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-ink}"
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

**Creative North Star: "กระจกฝ้ายามฟ้าแจ้ง" (Frosted Glass at First Light)**

แจ้ง means both "to report" and "the sky turning bright". The map underneath is still the toy model of Thailand: thick, soft-edged cel land like a painted wooden puzzle, an animated sea, and above it the only lights in the scene, pastel signal beams rising from each reported problem. Since plan 6b everything the visitor touches floats over that world as one material: frosted, grain-textured glass, seen at night turning into dawn. The night is the default (a navy ground, a lavender glow top-left, a peach dawn glow bottom-right); the light theme keeps the same layout with white frosted glass.

The glass is quiet so the map can speak. Panels are small and few (the owner asked twice for less): a search pill, one row of level chips, a one-line summary, a locate button and a dock on phones; a content-height side panel, a menu capsule, a control column and one report pill on desktop. Exactly one thing is warm: the dawn gradient, on the brand mark, the report control and the page's primary action, and the stats ring. Danger is still said three ways at once (colour, a solid shape from one SVG set, pulse speed), and status by the beam's form, never by colour.

Confirmed anti-references (PRODUCT.md): a neon gaming look and a cold government form. The owner's reference poster is a style reference only; its artwork is never copied or stored.

**Key Characteristics:**
- One material: frosted glass (24px blur, 150% saturation, a 1px light edge, a 160-degree white sheen, fractal-noise grain at 15% overlay) for every floating surface, in a dense variant for running text.
- Night-into-dawn ground: dark theme by default; pages other than the map stand on a slow shader backdrop (navy mesh with a dawn corner, CSS gradient fallback).
- One warm accent, the dawn gradient (cream, peach, lilac), used on four things only.
- Cel-shaded toy Thailand that fades out between zoom 6 and 8 into a calm street map; only Thailand is ever shown, everything else is an animated sea.
- Pastel beams as the only light on the map; height grows with "เจอเหมือนกัน".
- Lucide (ISC) line icons for every pictogram; no emoji anywhere (owner, 2026-10-17). One solid SVG shape set (circle, triangle, diamond, warning triangle) for the four danger levels.
- Anuphan 300–600 for every word the app sets.
- Small visible parts inside full 44px targets.
- One easing for everything that moves; motion always plays.

## Colors

A navy night ground under translucent glass, one warm dawn gradient for the few things that matter most, and four pastel level colours that only ever mean danger.

### Primary
- **Dawn** (Dawn Cream → Dawn Peach → Dawn Lilac, a 135-degree gradient at 0 / 45 / 100%, with Dawn Ink text): the one warm colour, the same in both themes. Used only on the brand mark (a 34px dawn disc holding "แ"), the report control (desktop pill and the phone dock's round +), the primary button of a page, and the stats ring's filled arc. The intro blooms in the same three colours.
- **Accent** (`--pri`: Night Accent, peach, in the dark theme with On Night Accent text; the dark-dawn terracotta `#A6522F` with white text in the light theme, about 5.2:1 on Cream Ground): focus rings (3px), the field focus edge, the selected beacon's ring, the "เจอเหมือนกัน" button's outline and pressed fill, the more-filters count pill, the signed-in avatar tint (24%), the active search row's inner edge, toast and retry links, checkbox accent, text selection (28% tint). Never used for danger or status.

### Secondary
- **Level Minor Mint**: danger level 0 ทั่วไป, and the resolved state's disc border.
- **Level Caution Butter**: danger level 1 ควรระวัง.
- **Level Danger Peach**: danger level 2 อันตราย.
- **Level Critical Rose**: danger level 3 วิกฤต. The only red in the system.

### Tertiary (illustration only)
- **Cel Land**, one flat pastel for each of the six regions: north sage, Isan apricot, central cream, east blush, west lavender, south lime. Paler and greyer than the level colours so the land never reads as a level. **Toy Rim Cream** is the 6px sand beach under the 2–3px **Land Ink** outline; faint Land Ink lines mark the provinces.
- **Toy Soil** light / mid / deep: the three stacked side layers that make the land thick.
- **Sea**: daylight Sea Shallow → Toy Sea → Sea Deep with Sea Line ripples and white foam; at night teal and navy (Night Sea is the flat fallback).
- **Backdrop**: dark Backdrop Night, Backdrop Navy, Backdrop Glow and Dawn Peach as the four mesh colours; light Backdrop Day, Backdrop Day Lilac, Backdrop Day Blush and white.

### Neutral
- **Night set** (default): Night Ground (page ground, browser bar, Ionic background), Night Surface (glass-toned beacon and cluster discs, label pills, popovers), Night Ink (all text on glass), Night Muted Ink (secondary text, inactive tabs, meta lines, off chips), Night Line (dividers on solid surfaces).
- **Glass tints**: Glass Night under every panel, Glass Night Dense under running text, Glass Edge Night as the 1px edge and the hairlines between grouped controls. Light: Glass Day, Glass Day Dense, Glass Edge Day.
- **Ink washes**: anything set inside a glass panel (secondary buttons, fields, rows, segmented tracks, chips in the side panel) takes the theme ink at 5–14% over transparent instead of a second glass (Night Ink Wash is the 6% resting value; hover 10–12%, chosen 14%).
- **Day set**: Day Ground (Cream), Day Surface, Slate Ink, Muted Ink, Sand Line, the same roles in the light theme. Slate Ink is also the fixed ink on every pastel fill in both themes.

### Named Rules
**The One Warm Control Rule.** The dawn gradient appears on the brand mark, the report control, a page's primary action and the stats ring, and nowhere else. If a screen has two dawn buttons, one of them is wrong.

**The Levels Only Mean Danger Rule.** Mint, butter, peach and rose are reserved for the four danger levels. Never use them for decoration, categories or status.

**The Ink On Pastel Rule.** Text and icons on a pastel fill are Slate Ink, never white and never the theme ink, and the pastel is mixed into white, never into the theme surface or transparent. A level tile reads the same on night glass and day glass.

**The Toy Stays Toy Rule.** Illustration colours do not change with the theme. In dark mode the toy keeps its daylight colours and only the sea and the street map darken; the glass dims what is behind it instead.

**The Cel Rule.** The land has no gradients: every colour change is a hard step, every land edge has an ink line, and its depth is flat offsets, never blurs. The sea is the smooth counterpart, and the glass is the only blur in the scene.

## Typography

**Display Font:** Anuphan (with system-ui, sans-serif)
**Body Font:** Anuphan (with system-ui, sans-serif)

**Character:** One Thai-first sans in four weights (300–600), served locally through @fontsource and exposed as `--font`; Ionic and every heading take it. Weight and size carry the hierarchy, not a second family. MapLibre's street labels keep the base style's glyph fonts, the one exception.

### Hierarchy
- **Display** (600, 56px, 1.3): the word แจ้ง in the intro only.
- **Headline** (600, 22px, 1.3): page h1s (`/list`, `/me`, `/about`, report steps) and the report title in the detail panel (1.4, wraps anywhere). Admin titles 20px.
- **Title** (500, 15px, 1.4): buttons, row and tooltip titles, comment heading, menu rows, search result names (two-line clamp).
- **Body** (400, 16px, 1.6): descriptions, comments, the search input (16px so iOS never zooms), about text at most 62ch.
- **Label** (500, 14px, 1.5): the full numbers line (tabular), status lines, segmented options, toast.
- **Caption** (400, 13px, 1.5): summary pill words, meta and age lines, hints, search group headings. An age past 30 days switches to ink at 500 ("ค้างนาน").
- **Chip** (500, 12px, 1): level chips, menu capsule tabs at 13px.
- **Dock word** (400, 10px, 1.2): the word under each dock icon, ellipsised at 56px.
- **Count** (600, 18px, tabular): cluster counts. **Map Label** (400, 12px on a 22px pill): beacon short labels, max 150px, ellipsised.

### Named Rules
**The Thai First Rule.** Sizes and line heights are chosen for Thai with its tall vowels and tone marks; never set Thai running text tighter than 1.5. Single-line controls (chips, tabs) may set 1.

**The One Family Rule.** Every word the app sets is Anuphan; a new surface never brings its own face.

## Layout

A full-bleed map with a handful of glass pieces at its edges; no app bars. Phones and desktop are two arrangements of the same pieces, switched at 820px.

**Phones (under 820px)**
- **Top bar**: a 46px glass capsule, 12px below the safe area, 16px from both sides: the dawn mark and the search pill. Opening search lays a full-width glass card over the bar (sliding 8px down); the bar gives up its glass meanwhile so the card's own blur is not trapped.
- **Chip row**: directly under the bar (30px pills inside 44px targets); one sideways-scrolling row under 420px.
- **Summary pill**: bottom-left, 16px from the left and 72px from the right, 14px above the dock, 40px tall: the stats ring, "N ค้างอยู่ · แก้แล้ว M" and a chevron; the whole pill opens `/list`. A hint worth saying (every level off, nothing here) floats above it as a near-opaque bubble.
- **Locate**: a 40px glass circle in the same row, 16px from the right. MapLibre's attribution folds to its ⓘ above it.
- **Dock**: a 60px glass capsule, at most 300px wide, centred 16px above the bottom: แผนที่, รายการ, the round dawn +, ของฉัน (the account). Hidden while the report sheet is open; beams are capped at 96px meanwhile so their discs stay below the top bar.
- **Toast**: centred 124px from the top, under the bar and chips.

**Wide screens (820px and up)**
- **Side panel**: top-left, 20px gutters, 340px wide, content height (at most the viewport minus 40px; scrolls inside): the search row (32px mark, search field, account avatar), the chip row with a hairline under it, the summary (ring line plus any hint), up to three reports in view as 36px-visible rows (level shape, name, "เจอ N · ค้าง D วัน"), and "ดูทั้งหมด N".
- **Menu capsule**: top-right, 40px tall, 32px tabs: แผนที่ (current), รายการ, the language toggle, ⓘ about.
- **Control column**: bottom-right, 102px from the bottom, 40px wide: zoom in, zoom out, locate, home, 38px each with 18px hairlines between.
- **Report pill**: bottom-right, 42px from the bottom so the folded attribution sits below it.
- **Report detail**: a 380px dense glass panel on the right, 20px from the top, right and bottom; the menu, controls, report pill and MapLibre's corner controls step left of it (to 420px). Under 1180px the side panel folds to its search row while the panel is open; under 1000px the menu drops below the folded side panel.
- **Toast**: centred, 84px from the top.

**Pages on the backdrop** (`/list`, `/about`, `/me`, `/report`, `/login`, `/admin`): the shared shader backdrop behind one glass card. On phones the card is the whole page (no border, 16px sides, safe areas padded); from 820px a centred 600px card, 24px radius, 20px 24px 28px padding, 24px from the top (`/admin` 760px so facts and the small map sit side by side). The page scrolls, the card does not. The login form also opens as a sheet over the map (a 420px card from 820px).

**Rhythm**: 16px gutters on phones, 20px on desktop, plus safe-area insets; 4–8px between grouped controls, 12px inside the detail panel, 16px between page sections.

## Elevation & Depth

Two depth systems that never mix. The UI is glass: depth comes from the blur, the light edge and one long soft shadow, not from stacked cards. The toy map has physical depth from stacked soil layers offset downward (8 / 16 / 24px at zoom 6) that flatten to zero by zoom 8.

In the dark theme the glass also dims what is behind it to 55% brightness, and its shadow gains a 1px inner top highlight; in the light theme the glass leaves brightness alone. Over the map page sit a peach dawn glow from the bottom-right corner (screen blend) and a breath of grain (5%, half that in light).

### Shadow Vocabulary
- **Glass, night** (`box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 16px 36px -20px rgba(3,8,25,.9)`): every glass panel in the dark theme.
- **Glass, day** (`box-shadow: 0 16px 36px -20px rgba(40,40,80,.45)`): the same in the light theme.
- **Dawn lift** (`box-shadow: inset 0 0 0 1px rgba(255,255,255,.35), 0 12px 30px -10px rgba(244,180,154,.65)`): the report pill; the round + uses `inset 0 0 0 1px rgba(255,255,255,.4), 0 8px 22px -6px rgba(244,180,154,.75)`, a page's primary button the -14px variant.
- **Pill** (`box-shadow: 0 2px 8px rgba(0,0,0,.15)`): beacon short labels and the cluster's critical pill.
- **Glow** (`box-shadow: 0 0 0 6px color-mix(in srgb, <level> 30%, transparent), 0 0 28px <level>`): beacon and cluster discs only.
- **Selected** (`box-shadow: 0 0 0 3px <surface>, 0 0 0 6px <accent>, 0 0 28px <level>`): the beacon whose detail is open.

### Named Rules
**The One Material Rule.** Every floating surface takes its look from the glass tokens (`--glass-bg`, `-sheen`, `-edge`, `-blur`, `-shadow`, `-dim`, `--glass-bg-dense`, `--noise`) through the `.glass` class; the few that cannot carry the class (the sheet's scrolling layer, the attribution strip, chips) apply the same tokens, never new values.

**The No Glass In Glass Rule.** A second blur inside a glass panel sees only the panel. Anything set inside glass uses an ink wash and no backdrop filter; hint bubbles inside a glass pill go near-opaque instead.

**The Dense For Reading Rule.** A panel of running text (report detail, sheet, tooltip) uses dense glass so ink keeps 4.5:1 over the brightest toy land; in the dark theme the backdrop dimming does the rest.

**The Two Lights Rule.** Only beacons glow, and only the dawn casts a warm shadow. No other element gets a coloured shadow.

## Shapes

Round and soft, scaled to the thing: 9px level badges, 10px tags and label pills, 12px picture tiles and list hover grounds, 15px chip pills, 16px buttons, fields, rows, tooltip and toast, 22px side and detail panels, 24px page cards, 26px sheet tops. Controls that live in a capsule are capsules (half their height: 20px for 40px, 23px for 46px, 30px for the dock); single icon controls are circles (locate, back, close, avatar, more filters, the round +). The beam is a narrow cone (full width at the top to 8% at the base); pulse rings are flattened ellipses, as if light falls on the ground.

The four level shapes are one solid SVG set on a 12-unit grid: a filled circle (ทั่วไป), triangle (ควรระวัง), diamond (อันตราย), and a triangle with a cut-out exclamation (วิกฤต). On glass they carry a 1px dark rim (the level colour mixed 45% into Slate Ink, painted under the fill) so the shape keeps 3:1 even where butter alone would not. Every other icon is Lucide (`<app-icon>`), stroke 2, round caps, currentColor: 18px in map controls and the dock, 20px in menus, 24px in the report control and beacon discs.

### Named Rules
**The One Shape Set Rule.** A danger level's shape is always drawn from the SVG set, never typed as a character, and on glass it always has its dark rim.

**The Small Visible, Full Target Rule.** Glass controls may look small (30px chips, 32px tabs and avatar, 36px list rows, 40px circles and column buttons) but every one presses at 44 × 44px through an invisible extension.

## Components

### Buttons
- **Shape:** 16px radius (the detail panel's own buttons keep 14px), at least 44px tall; the one action of a step is 52px and 16px type.
- **Primary (dawn):** the dawn gradient with Dawn Ink, the Dawn lift shadow; hover brightens (1.06) and saturates; disabled keeps the gradient at 45% opacity without the shadow. Its focus ring is the theme ink, because an accent ring would vanish on the gradient.
- **Secondary:** a 6% ink wash with the 1px glass edge, ink label; hover 12%.
- **Glass controls** (map tabs, column buttons, dock tabs): transparent until hovered (8% ink wash), press scales to 0.96 in 120ms; focus is a 3px accent ring set inside the shape (-3px offset).
- **Back / close circle:** a 40px glass circle (sheen, glass ground, edge, glass shadow) inside its 44px target, used for step back and close on pages; the detail panel's close is the same circle on dense glass.
- **Focus:** a 3px accent outline everywhere (2px offset on free-standing controls, inset on glass controls, 4px on discs).

### Report control
The one warm control on the map, in two variants of the same button (`aria-label` "แจ้งเรื่องใหม่"): on desktop a 46px dawn pill with a 24px `plus` and "แจ้ง" (600, 15px); in the phone dock a 46px dawn circle with the `plus` alone. Signed out it opens the login sheet and goes on to `/report` only after a successful login.

### Chips
- **Style:** no tray. Each level chip is a 30px glass pill (15px radius, glass edge, glass ground with its own 16px blur) inside a 44px target, the level's solid shape at 14px in its colour, then the name in Chip type. Inside the side panel or a page card the pill takes a 6% ink wash and no blur.
- **On:** full pill, ink label, coloured shape. Hover deepens the ground by 10% ink; press scales 0.96.
- **Off:** the pill at 55% opacity, Muted Ink label with a line-through, the shape drained to Muted Ink at 55%; `aria-pressed="false"`. The shape and the strike say it without colour.
- **More filters:** a 30px glass circle at the end (`slidersHorizontal`); open gives it an accent edge; an accent count pill (20px, On Accent text) shows how many extras are on.

### Stats ring and numbers line
The summary's one line: a 26px ring (a conic fill in Dawn Peach for the share fixed this month over a 14% ink track, cut to a 2px band by a radial mask) that is decorative, then "N ค้างอยู่" (500) and "· แก้แล้ว M" in Muted Ink, ellipsised. "—" while loading, hidden on failure (the phone pill then says "รายการ"). The full form, where there is room, is two tabular Label lines led by `circleCheck` and `clock`.

### Search
On desktop a field well in the side panel's search row (6%-ish ink wash, no line, 16px radius, accent edge and 2px ring on focus); on phones a pill in the top bar that opens a full-width glass card. Results float under the field as their own 18px glass card (phones: inside the card), in two groups: "สถานที่" (`mapPin`, name, muted district) and "เรื่อง" (a 40px tile on the level colour 45% into white with a Slate Ink icon, the title clamped to two lines, level shape and word · status). Hover and the active row take an 8% ink wash; the active row adds a 3px accent inner edge. Captions for loading, nothing found, places offline and failure (an underlined accent "ลองอีกครั้ง").

### Account button
Two variants of one control. In the desktop search row a 32px avatar circle (10% ink wash, 18% on hover) inside 44px: `circleUser` signed out, the name's first grapheme (600, 15px) signed in, when the circle takes a 24% accent tint, so signed in reads by shape and colour. In the phone dock a tab like the others: a 22px face over "ของฉัน", the same initial and tint when signed in. The menu is a 240px popover on the theme surface (18px radius): the name (and a "ผู้ดูแล" tag), then 44px rows with 20px icons: เรื่องของฉัน, หน้าผู้ดูแล for admins, the other language (keeps the menu open), เกี่ยวกับแจ้ง, สลับผู้ใช้, ออกจากระบบ.

### Navigation
- **Dock (phones):** four 56 × 44px slots, an 18px icon over a 10px word; Muted Ink at rest, ink when current (`aria-current="page"`) or hovered; the round dawn + sits third.
- **Menu capsule (desktop):** 32px tabs in Chip type at 13px, Muted Ink; the current tab gets a 10% ink wash and ink text; ⓘ is a 36px icon tab. The language toggle wears the same tab look.

### Cards / Containers
- **Side panel:** see Layout. Its in-view rows read 36px with a 12px-radius hover ground inside a 44px target; focus is a 3px accent inner ring on that ground.
- **Tooltip:** dense glass, 16px radius, 240px, no pointer events: a 120px picture tile (cover photo, else the category's Lucide icon at 40px on the level colour at 45%), the title, a meta line (level shape, level name · status · เจอเหมือนกัน N), and for open reports an age line.
- **Detail panel / sheet:** dense glass. Desktop a 380px, 22px-radius `role="dialog"` that slides 16px in from the right over 320ms and scrolls inside its own layer so the grain covers the whole panel. Phones a bottom sheet (26px top corners, a 30% ink handle, 0.64 / full breakpoints, a 0.2 backdrop, dragging down closes it) whose scrolling layer is the glass. Content top to bottom, 12px apart: the picture (a scroll-snapping strip of 180px photos with ก่อนแก้ / หลังแก้ pills, 132px in the sheet, else the category tile) under the 44px close circle; the title (Headline, wraps anywhere); tags (level pill with its solid shape on the level colour 55% into white, category, status, age, user `#tags`); the description; the byline and place; for level 3 the emergency box (Critical Rose into white, Slate Ink, tappable 191 / 199 / 1669); the me-too row; the comments.
- **Me-too ("เจอเหมือนกัน"):** a 44px secondary button with an accent outline and label, a hand icon and the tabular count, on a whole line; pressed fills the accent with On Accent text; 60% while in flight. "แจ้งว่าแก้แล้ว" and the ⋯ menu share the second line. A resolved report shows "มีคนเจอเหมือนกัน N คน" in Muted Ink instead.
- **Inline forms (fix claim, content report), comments, composer:** unchanged in behaviour from plan 5–6; on glass their grounds are ink washes, their fields the field well below, their send button the accent.
- **Toast:** glass at 85% of the ground colour (denser than panels; it is read in passing over anything), 16px radius, ink text, `role="status"`. With an action it carries one 44px underlined accent text button ("ลองใหม่") and stays 8s; a plain toast stays 3.2s.
- **Page card:** see Layout. Rows inside it (`/me`, `/list`) are 16px-radius ink-wash rows (5%, 10% on hover) with the 1px glass edge, a 72px tile on the level colour 45% into white with a Slate Ink icon, the title (Title), a status line that is always a Lucide icon plus a word, and a muted meta line. The first twelve rows rise in 30ms apart.

### Inputs / Fields
- **Style:** a 6% ink wash with the 1px glass edge, 14–16px radius, ink text, Muted Ink placeholder.
- **Focus:** the edge turns accent with a 2px accent outline at 0 offset.
- **Status lines:** a live region that, when it has something to say, becomes a 12px-radius 6% ink-wash box with the glass edge.
- **Segmented choices** (sort, language, theme): a 16px-radius track (6% ink wash, glass edge inset), 44px options in Label type, Muted Ink; chosen is a 14% ink wash with a faint top highlight, ink and weight 600, never colour alone.

### Beacon (signature component)
The Bat-Signal beacon, unchanged in grammar: a 14px base dot in the level colour with a white rim; one or two flattened pulse rings (3s / 2.4s / 1.6s / 1s for levels 0–3, two rings half a period apart for 2–3); the cone beam, level colour fading to transparent at 80% opacity, height `beamHeight(confirm_count)`, growing over 400ms when the count rises; a 54px glass-toned disc (Night Surface at 82%, no blur because up to 150 markers repaint every frame) with a 3px level border, the Glow, and the category icon at 24px in ink; a level badge at its lower right (18px pill in the level colour, the shape in Slate Ink); a short label pill above. A new beacon pops up from its base (scale 0.4 to 1, 520ms).
- **fix_claimed:** beam at 28%, dashed disc border, no pulse. **resolved:** no beam, no pulse, mint border, a tick, disc at 85%. **Compact:** below zoom 12 an isolated report draws a short beam and an 82% disc with no label. **Selected:** the Selected ring.

### Cluster
A 52px glass-toned disc with the count in Count type, a 3px border and one pulse ring in the highest level inside, the Glow, that level's badge, and the same pop. With critical reports inside, a 22px pill at its upper left shows the critical shape and how many, Slate Ink on Critical Rose 55% into white.

### Toy map, sea and attribution
Province polygons on real coordinates, three soil layers that flatten with zoom, one flat Cel Land colour per region, faint province lines, a sand rim under the Land Ink outline, nothing standing on it; every toy layer fades from zoom 6 to 8 and street names start at 7.5. The sea is a custom WebGL layer (a coast glow, a few soft ripple lines, foam, rare wave marks) capped at 30 fps and stopped only in a hidden tab. The attribution is a strip of dense glass with a 12px blur and Muted Ink links; folded, a faint glass ⓘ (inverted to light in the dark theme) with an accent focus ring.

### Backdrop and intro
- **Backdrop:** every page that is not the map stands on a fixed, pointer-free shader mesh gradient in the four backdrop colours of the theme, drawn at half resolution and at most 30 fps, with 5% grain over it; it pauses in a hidden tab or off-screen and gives its GPU context back when the page goes. With no WebGL, or when the context is lost, the same picture in CSS: a lavender glow top-left, a peach dawn bottom-right, over a 170-degree navy (light: lilac and blush over pale lavender).
- **Intro:** once per visit (session), 1.8s, decorative and skippable by any tap or key: a point of light grows with a peach glow (0–400ms), a 3px beam rises from it (250–900ms), "แจ้ง" in Display is written bottom-up as its letters close in (700–1300ms), the dawn blooms from the bottom-right (1000–1600ms), then the whole view scales up 6%, blurs and fades into the app (1400–1800ms).

### Motion
- **One easing:** `cubic-bezier(0.2, 0.8, 0.2, 1)` for panels, pages, markers and the intro. Camera: `flyTo` 1600ms with curve 1.3, `fitBounds` 1200ms, both `essential`.
- **Rise:** panels rise into place once on mount (from 10px lower, transparent and 6px blurred, 700ms, fill backwards only so a panel with no animation is simply there), staggered 60ms by their order: bar or side panel, chips, summary, controls and menu, dock or report pill. Page cards rise the same way; list rows 600ms, 30ms apart.
- **Page change:** the new page rises 12px out of an 8px blur over 420ms while the old fades in 220ms; going back comes down from above.
- **Small:** hovers 160ms ease-out, presses scale 0.96–0.97 in 120ms, the selected ring 240ms, the phone search card slides 8px in 220ms, the detail panel 16px in 320ms.
- **Motion always plays** (owner decision): nothing reads a reduced-motion setting; motion only pauses with the tab.

## Do's and Don'ts

### Do:
- **Do** build every floating surface from the glass tokens and the `.glass` class, dense for running text.
- **Do** keep the dawn gradient to the brand mark, the report control, a page's primary action and the stats ring.
- **Do** set anything inside a glass panel on an ink wash with no blur of its own.
- **Do** encode every danger level with colour, the solid SVG shape (with its dark rim on glass) and pulse speed together.
- **Do** keep text on pastel fills in Slate Ink, with the pastel mixed into white, in both themes.
- **Do** show an off chip drained and struck through, so it reads without colour.
- **Do** keep every target at least 44 × 44px, even when the visible part is 30–40px, and give every beacon an `aria-label` of "{title} ระดับ{level} {status}".
- **Do** use the dark theme as the default and check both themes; every token pair passes AA in light and dark.
- **Do** use the one easing and the rise for anything that appears; let motion always play.
- **Do** take every word from `i18n/th.ts` / `en.ts` and check every screen in English at 375px.
- **Do** use Lucide SVG icons for pictograms; say a report's status in words with its own icon; say only what is true about photos.
- **Do** credit OpenStreetMap, OpenFreeMap, OCHA COD-AB, Lucide (ISC) and Anuphan (OFL).

### Don't:
- **Don't** look like a neon gaming screen or a cold government form.
- **Don't** pile white cards over the map; a new control joins an existing glass piece before it becomes a new one.
- **Don't** put a blurred panel inside another, or set running text on thin glass.
- **Don't** use the dawn gradient, or a warm shadow, on anything outside its four uses.
- **Don't** show status with colour; status is beam shape.
- **Don't** let anything except beacons glow.
- **Don't** type level shapes as characters (● ▲ ◆ ⚠); draw them from the SVG set.
- **Don't** copy or store the reference poster; draw everything from real geometry.
- **Don't** claim photos are blurred until blurring exists.
