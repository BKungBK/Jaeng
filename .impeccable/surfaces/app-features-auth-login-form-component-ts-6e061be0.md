---
version: 1
slug: "app-features-auth-login-form-component-ts-6e061be0"
primary_target: "apps/web/src/app/features/auth/login-form.component.ts"
related_targets: ["apps/web/src/app/features/auth/login.page.ts","apps/web/src/app/features/auth/login-prompt.service.ts","apps/web/src/app/features/auth/account-button.component.ts"]
---

# Surface: เข้าสู่ระบบ (login form, login sheet `/login`, account button)

**Mode:** Operate. The visitor wants to get past the gate and back to what they were doing (press "เจอเหมือนกัน", comment) in as few steps as possible.

## Brief
- **Audience:** a neighbor on a phone, often outdoors, one hand, who just tapped an action that needs login; on desktop the same neighbor at home; in the live demo the instructor watching the owner switch between the three demo users.
- **Job:** prove an email in two short steps (email, then the 6-digit code from the mail) without leaving the map; in the demo, switch user in one tap.
- **Content:** one email field, one 6-digit code field, the email the code went to, a resend button that unlocks after 60 s (Supabase's minimum gap), Thai errors already mapped by `AuthService`. Demo section only when `config.quickLogin` is non-empty: one secondary button per `label_th` (3 today: reporter, neighbor1, admin). Account popover: display name, a "ผู้ดูแล" tag for admin, "สลับผู้ใช้", "ออกจากระบบ".
- **States:** email invalid (send disabled), sending (button busy, disabled), code step (shows the email, "เปลี่ยนอีเมล" back link), code < 6 digits (confirm disabled), verifying, wrong/expired code (Thai message in `role="alert"`, code field keeps focus), rate-limited, resend countdown, quick login busy/failed, profile not loaded yet (account button falls back to "บัญชี").
- **Out of scope:** `/me`, display-name editing, i18n switch (plans 4 and 6). No password field ever.

## Direction
- **Visual authority:** the incumbent world in DESIGN.md, unchanged. White card (18 px) / sheet (24 px top corners) with the Float shadow, Trust Blue primary button 44 px, secondary buttons Card White with a Sand Line border, Prompt for the headline, Plex Sans Thai for reading, Lucide icons only (`mail`, `send`, `circleUser`, `logOut`). Focus: 3 px Trust Blue, 2 px offset.
- **Thesis:** a kind neighbor holding the door, not a gate. One headline ("เข้าสู่ระบบ" / "ใส่รหัสจากอีเมล"), one line of warm explanation, one field, one primary action per step. Nothing else competes; the demo switch sits below a quiet divider so it never reads as the main path.
- **Code field:** one large input with tabular, letter-spaced digits (not six boxes: one input pastes and autofills reliably with `autocomplete="one-time-code"`).
- **Sheet:** on phones an Ionic sheet modal that grows to its content (auto height) and rides above the keyboard; on ≥ 820 px a centred card-sized modal (420 px). Closing resolves `false`.
- **`/login` page:** the same form centred on Cream Ground with the brand word above it; after login `navigateRoot(safeNext(next))`.
- **Account button:** a `.ctl` icon button in the map's control column after locate, `circleUser` when signed out (opens the sheet) and the user's initial on a Trust Blue tint when signed in (opens a popover). Labels per brief.

## Constraints
- 44 px targets, Thai copy in the voice "เพื่อนบ้านใจดี", text interpolation only, no emoji, never `prefers-reduced-motion`.
- Assumption (no live answer channel in this run): the brief in `.superpowers/sdd/plan-3/task-7-brief.md` is treated as the owner's confirmation; no further interview.
