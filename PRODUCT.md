# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Angular + Ionic (standalone, signals) packaged as an Android APK with Capacitor; Elysia on Bun for the write API; Supabase (Postgres/PostGIS, Auth, Storage, Realtime); MapLibre GL JS v5; Caddy; Docker in WSL2. Full detail: `docs/superpowers/specs/2026-10-16-jaeng-design.md`.

## Users

- **Neighbors who spot a problem** (broken road, dark street light, blocked drain, fallen branch) and report it on the spot, usually one-handed on a phone, sometimes later from home.
- **Neighbors who browse**, checking what is wrong around them, pressing "เจอเหมือนกัน" (me too), commenting, or marking something as fixed.
- **One admin** (the project owner), who reviews every new report, fix claim and abuse flag before anything becomes public.
- **Evaluator:** the course instructor, who must understand what the app does and how it is used in a single live demo on a real Android phone and a desktop browser.

## Product Purpose

แจ้ง lets anyone report a community problem with a photo and a pin. Each report becomes a light beam on a map of Thailand. Neighbors see it, confirm it, discuss it, and see whether it has been fixed. Success means reporting takes three taps, the map tells you what is wrong where without hovering, and an unresolved problem stays visibly unresolved.

## Positioning

Every problem is a signal light (Bat-Signal style): a beam rising from the pin to a disc showing the category icon. Beam height grows with "เจอเหมือนกัน" count. Danger is encoded in color, shape and pulse speed together. The map opens as an illustrated, toy-like Thailand and dissolves into a real street map as you zoom in. Open problems show how many days they have been waiting.

## Operating Context

- Reporting happens outdoors at the scene: bright sun, one hand, flaky attention, camera already in hand.
- Browsing happens on phone and desktop with equal weight.
- Runs locally on the owner's machine. The phone connects over LAN Wi-Fi to the APK's configured server. There is no public deployment yet; opening to others is the last phase, after photo blurring exists.
- Demo flow: map overview → zoom to street → report in 3 taps → admin approves → beam appears → me-too raises the beam → fix claimed (beam fades) → admin confirms (beam goes out) → switch language.

## Capabilities and Constraints

- Four danger levels: ทั่วไป / ควรระวัง / อันตราย / วิกฤต. Status is shown by beam shape, never color: open, fix_claimed, resolved.
- Viewing needs no login. Reporting, commenting, me-too, fix claims and flags need login (email OTP).
- Reporters may hide their name publicly; the admin still sees who they are.
- Eight core categories plus free user tags.
- Duplicate check within 50 m. Rate limits. Thai and English profanity filter.
- Critical-level reports show the emergency numbers 191 / 199 / 1669 and say the app is not an emergency channel.
- Thai is the default language, English is available. User-written content is not translated.
- Face and plate blurring is deferred. Until it exists, never claim photos are blurred and never expose the app publicly.

## Brand Commitments

- Name: **แจ้ง** (a pun on "to report" and "bright/dawn"). One word, no suffix.
- Feel: กระจกฝ้ามี noise บนกลางคืนสู่รุ่งเช้า อบอุ่น น่าเชื่อถือ ไม่ใช่ลุคเกมนีออนหรือฟอร์มราชการ (frosted, grain-textured glass over night-into-dawn; warm and trustworthy; neither a neon gaming look nor a cold government form).
- Voice: **เพื่อนบ้านใจดี** (kind neighbor). Casual, short, warm Thai; thanks people for reporting; never bureaucratic. Example: "ขอบคุณที่แจ้งนะ เดี๋ยวผู้ดูแลตรวจให้".
- Map illustration must evoke the owner's reference poster ("Thailand ดินแดนแห่งความสุข" by ครูหนิง & Gemini): thick toy-like 3D land, green regions with an orange Isan, small 3D landmarks, boats, planes, a train, clouds, a compass. Use it as style reference only. Never copy it or store it in the repo.
- Existing prototype: `docs/prototype/thai-map-v2.html` (palette, fonts Prompt + IBM Plex Sans Thai, beacon anatomy, level chips, bottom sheet).

## Evidence on Hand

- Prototype HTML with fake sample data (13 reports).
- No real users, reports, photos, testimonials or statistics exist. Never fabricate any. Seed data is clearly demo data.

## Product Principles

1. Reporting must be effortless: three taps, everything else optional.
2. The map must explain itself at a glance, with no hover required.
3. Never rely on color alone.
4. Talk about the problem, never the person.
5. Nothing goes public before the admin approves it, and unresolved problems are never quietly hidden.

## Accessibility & Inclusion

WCAG 2.1 AA contrast. 44 px minimum touch targets. Full keyboard access to beacons. A list view as an alternative to the map. Redundant encoding for color-blind users. Thai-first typography.
