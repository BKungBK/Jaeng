# สมัครด้วยอีเมลจริง และตั้งชื่อเล่น + รูปโปรไฟล์ (แผน 9) Implementation Plan

> **For agentic workers:** ทำทีละ Task ในเซสชันนี้เอง (เจ้าของสั่งให้ทำเองทั้งหมด ไม่ส่งต่อให้ subagent) ใช้ `- [ ]` ติดตามทีละขั้น

**Goal:** ผู้ใช้ใหม่ได้รหัส OTP ทางอีเมลจริงผ่าน Resend แล้วต้องตั้งชื่อเล่น (= ชื่อที่แสดง) และเลือกรูปโปรไฟล์ได้ก่อนเข้าใช้

**Architecture:** ตั้ง SMTP ของ Resend ใน `supabase/config.toml` (คีย์ใน `supabase/.env`) เพิ่ม `profiles.onboarded_at` กับ `profiles.avatar_path` ขั้น "ตั้งโปรไฟล์" เป็นขั้นที่สามของ `LoginFormComponent` ถ้ายังไม่ผ่านแต่มีเซสชัน `ProfileSetupService` เปิดแผ่นซ้ำ รูปผ่าน API ใหม่ (`PUT/DELETE /me/avatar`) เก็บใน bucket สาธารณะ `avatars` และแสดงด้วยคอมโพเนนต์เดียว `AvatarComponent`

**Tech Stack:** Supabase (GoTrue SMTP, Postgres, Storage), Elysia + Bun + sharp, Angular 22 + Ionic 9, Vitest, bun test, pgTAP

**Spec:** `docs/superpowers/specs/2026-10-22-signup-profile-design.md`

## Global Constraints

- ตอบ/คำในแอปเป็นไทยใน `th.ts` พร้อมอังกฤษใน `en.ts` ทุกคำ ไม่เขียนคำในคอมโพเนนต์ (DESIGN.md: "Do take every word from i18n")
- ห้ามใช้ `prefers-reduced-motion`; อนิเมชันใช้ชุดเดิม (`--ease`, `rise`, `app-tick`, `sheen`, สั่น 4px สองครั้ง)
- เป้าแตะ ≥ 44×44 px, โฟกัส 3px accent, ตรวจ 375 px ทั้งธีมมืด/สว่างและไทย/อังกฤษ
- ชื่อ 2–30 ตัวอักษร (`DISPLAY_NAME_MIN/MAX`), กรองคำหยาบด้วย `checkName` เดิม
- รูป: รับ ≤ 5 MB (`PHOTO_MAX_BYTES`), เก็บ 256×256 WebP ≤ 1 MB, ลบ EXIF/GPS
- `packages/shared/database.types.ts` สร้างด้วย `bash scripts/gen-types.sh` เท่านั้น
- ไม่ commit คีย์; `supabase/.env` ถูก gitignore อยู่แล้ว
- รันคำสั่งใน WSL (`/mnt/d/Project/Jaeng`) ตาม CLAUDE.md; web test ผ่านคอนเทนเนอร์ `web`

## Review Focus

- ผู้ใช้เดิม/ผู้ใช้เดโม/แอดมินในข้อมูลตัวอย่างต้องไม่เจอขั้นตั้งโปรไฟล์ (Task 2 ทดสอบ seed)
- ผู้ใช้ที่ปิดแผ่นกลางทาง หรือรีเฟรชหน้าก่อนกดเริ่ม ต้องเจอแผ่นตั้งโปรไฟล์อีก (Task 5)
- ผู้แจ้งที่ปิดชื่อ ต้องไม่เปิดเผยรูปด้วย (Task 6 pgTAP)
- ไฟล์ที่ไม่ใช่รูป/เกินขนาด/รูปปลอมนามสกุลรูป และผู้ใช้ที่ถูกแบน ต้องอัปโหลดไม่ได้ (Task 3)
- เปลี่ยนรูปหลายครั้งต้องไม่ทิ้งไฟล์เก่าค้าง และ `DELETE /me/avatar` ซ้ำต้องไม่พัง (Task 3)
- ชื่อที่เป็นอักขระล่องหน/คำหยาบต้องไม่ผ่านขั้นนี้ ทั้งที่ฝั่งปุ่มและฝั่ง API (Task 3, 5)

---

### Task 1: อีเมลผ่าน Resend และสคริปต์สลับ Mailpit

**Files:**
- Modify: `supabase/config.toml` (บล็อก `[auth.email.smtp]` บรรทัด ~238-246), `scripts/dev-up.sh`, `README.md`, `.env.example`
- Create: `scripts/mail-mode.sh`

**Interfaces:**
- Produces: `bash scripts/mail-mode.sh resend|mailpit|status` แก้บรรทัด `enabled =` ใต้ `[auth.email.smtp]` แล้วพิมพ์โหมดปัจจุบัน

- [ ] **Step 1:** ใน `config.toml` เปิดบล็อก `[auth.email.smtp]` (`enabled = true`, `host = "smtp.resend.com"`, `port = 465`, `user = "resend"`, `pass = "env(RESEND_API_KEY)"`, `admin_email = "noreply@bkungbk.online"`, `sender_name = "แจ้ง"`) เติมคอมเมนต์สั้นๆ ว่าคีย์อยู่ใน `supabase/.env`
- [ ] **Step 2:** เขียน `scripts/mail-mode.sh` (bash, `set -euo pipefail`) สลับ `enabled = true|false` ด้วย `sed` เฉพาะบรรทัดใต้ `[auth.email.smtp]` และตรวจว่ามี `RESEND_API_KEY` ใน `supabase/.env` เมื่อเลือก `resend`
- [ ] **Step 3:** `dev-up.sh` เตือนก่อน `supabase start` ถ้าโหมดเป็น resend แต่ไม่มีคีย์ และพิมพ์โหมดอีเมลปัจจุบันท้ายสคริปต์ (บรรทัด Mailpit ระบุว่าใช้เมื่อโหมด mailpit)
- [ ] **Step 4:** `README.md` เพิ่มหัวข้อ "อีเมลรหัสเข้าใช้" (Resend, `supabase/.env`, สลับโหมด, ขีดจำกัดโควตา, DMARC); `.env.example` ไม่ใส่คีย์
- [ ] **Step 5: ตรวจ:** รีสตาร์ต Auth (`npx supabase stop && npx supabase start` ผ่านสคริปต์) แล้วเรียก `POST /auth/v1/otp` ด้วยอีเมลทดสอบของ Resend `delivered@resend.dev` ต้องได้ 200 (ไม่ส่งไปกล่องจริงของใคร) และสลับ `mailpit` แล้วอีเมลเข้า Mailpit
- [ ] **Step 6: Commit** `feat(auth): send login codes through Resend, with a switch back to Mailpit`

### Task 2: Migration โปรไฟล์ (`avatar_path`, `onboarded_at`) และ bucket `avatars`

**Files:**
- Create: `supabase/migrations/20261022000100_profile_setup.sql`, `supabase/tests/<ถัดไป>_profile_setup.test.sql`
- Modify: `scripts/seed.ts` (ผู้ใช้ตัวอย่างทุกคนตั้ง `onboarded_at`), `packages/shared/database.types.ts` (สร้างใหม่)

**Interfaces:**
- Produces: `profiles.avatar_path text null`, `profiles.onboarded_at timestamptz null`; bucket `avatars` (public, 1 MB, `image/webp`); มุมมอง `public_reports.author_avatar text`, `public_comments.author_avatar text` (null เมื่อ `author_name` เป็น null); ฟังก์ชันผู้ดูแลที่คืน `Person` มี `avatar_path`

- [ ] **Step 1 (test):** pgTAP: คอลัมน์ใหม่มีอยู่; แถวเดิมมี `onboarded_at` เท่ากับ `created_at`; ผู้ใช้ใหม่ (insert `auth.users`) ได้ `onboarded_at is null`; `authenticated` UPDATE `avatar_path`/`onboarded_at` ตรงไม่ได้ (ยังแก้ `locale` ได้); `public_reports.author_avatar` เป็น null เมื่อ `hide_author`; `public_comments.author_avatar` เป็น null เมื่อผู้แจ้งปิดชื่อและคอมเมนต์เป็นของผู้แจ้ง; bucket `avatars` ไม่มี policy เขียนสำหรับ `authenticated`
- [ ] **Step 2:** รันแล้วต้องล้ม
- [ ] **Step 3:** เขียน migration: `alter table profiles add column ...; update profiles set onboarded_at = created_at;` `create or replace view` ของ `public_reports` (เพิ่มท้ายสุด ใช้นิยามล่าสุดใน `20261020000100_experience.sql`) และ `public_comments` (นิยามล่าสุดใน `20261018000200_report_create.sql`) เพิ่ม `author_avatar`; แก้ฟังก์ชัน `admin_*` ที่ประกอบ `Person` (`20261019000300_admin_reads.sql:14`) ให้ใส่ `'avatar_path'`; `insert into storage.buckets` สำหรับ `avatars`; `grant` คอลัมน์ไม่เพิ่ม
- [ ] **Step 4:** `seed.ts`: หลังสร้างผู้ใช้ตัวอย่าง `update public.profiles set onboarded_at = now()` ทุกแถว
- [ ] **Step 5:** `bash scripts/reset-db.sh`, `bash scripts/gen-types.sh`, รัน pgTAP (ส่วน db ของ `scripts/test.sh`) ต้องผ่าน
- [ ] **Step 6: Commit** `feat(db): profile setup state, avatar path and avatars bucket`

### Task 3: API: รูปโปรไฟล์และจบการตั้งโปรไฟล์

**Files:**
- Modify: `packages/shared/api.ts` (error codes), `packages/shared/report.ts` (`AVATAR_SIDE = 256`), `apps/api/src/errors.ts`, `apps/api/src/env.ts` (`rateLimits.avatars`, `RATE_LIMIT_AVATARS_PER_DAY` ค่าเริ่มต้น 10), `apps/api/src/store.ts`, `apps/api/src/supabase-store.ts`, `apps/api/src/photos/storage.ts`, `apps/api/src/photos/pipeline.ts`, `apps/api/src/routes/me.ts`
- Test: `apps/api/test/me-avatar.test.ts`, `apps/api/test/me-profile.test.ts`

**Interfaces:**
- Produces: `makeAvatar(bytes: Uint8Array): Promise<Buffer>` (ถอดรหัส, หมุนตาม EXIF, ตัดกลาง 256×256, WebP q80); `Bucket` เพิ่ม `'avatars'`; store `setAvatar(userId: string, path: string | null, limit: number): Promise<{ previous: string | null }>` (ตรวจโควตาต่อวัน, คืนเส้นทางเก่าเพื่อลบไฟล์); `updateMe(id, patch)` รับ `complete_profile?: boolean` และคืน `{ display_name, locale, avatar_path, onboarded: boolean }`
- Routes: `PUT /me/avatar` (multipart `file`) → `200 { avatar_path }`; `DELETE /me/avatar` → `200 { avatar_path: null }`; `PATCH /me` รับ `{ display_name?, locale?, complete_profile? }` โดย `complete_profile: true` ต้องมี `display_name` ถูกกติกา แล้วตั้ง `onboarded_at = now()`
- Errors: `avatar_limit` (429 เกินโควตา) ใช้ `invalid_photo`/`photo_too_large` เดิมสำหรับไฟล์ผิด

- [ ] **Step 1 (test):** `me-avatar.test.ts`: อัปโหลด PNG ถูกต้อง → 200 และไฟล์ที่ `put` เป็น WebP 256×256 ไม่มี EXIF; ไฟล์ข้อความนามสกุล .jpg → 400 `invalid_photo`; > 5 MB → 413 `photo_too_large`; ไม่ล็อกอิน → 401; ผู้ใช้ที่ถูกแบน → 403; ครั้งที่ 11 ในวัน → 429 `avatar_limit`; เปลี่ยนรูปครั้งที่สองลบไฟล์เก่าออกจาก `avatars`; `DELETE` สองครั้งติดกันได้ 200 ทั้งคู่ และลบไฟล์; อัปโหลดไม่สำเร็จที่ที่เก็บแล้วไม่ทิ้งค่า `avatar_path` ใหม่
- [ ] **Step 2 (test):** `me-profile.test.ts`: `complete_profile` ไม่มีชื่อ → 400 `invalid_request`; ชื่อ 1 ตัว/อักขระล่องหน → 400 `invalid_display_name`; คำหยาบ → 400 `profanity`; ชื่อถูก → 200 `onboarded: true`; เรียกซ้ำยังได้ 200 และไม่เปลี่ยนเวลา `onboarded_at`
- [ ] **Step 3:** รัน (`bun test` ผ่านคอนเทนเนอร์ ตามคำสั่งใน CLAUDE.md) ต้องล้ม
- [ ] **Step 4:** ทำตาม Interfaces; ใช้ `sniffImage` ก่อน, `makeAvatar` ใช้ sharp `rotate().resize(AVATAR_SIDE, AVATAR_SIDE, { fit: 'cover' }).webp({ quality: 80 })` และไม่ใช้ `processForPrivacy`; ลำดับในเส้นทาง: ตรวจ → ประมวลผล → `setAvatar` (ได้ path เก่า) → `put` ไฟล์ใหม่ (ล้มเหลวให้ย้อนด้วย `setAvatar(previous)`) → ลบไฟล์เก่า (ล้มเหลวแค่ log)
- [ ] **Step 5:** รันชุด api ทั้งหมดต้องผ่าน (ต้อง `docker run ... bun test` ตามที่ระบุ)
- [ ] **Step 6: Commit** `feat(api): avatar upload and profile completion`

### Task 4: เว็บ: ข้อมูลโปรไฟล์, `AvatarComponent`, ที่อยู่ไฟล์รูป

**Files:**
- Create: `apps/web/src/app/shared/avatar.component.ts` (+ `.spec.ts`)
- Modify: `apps/web/src/app/core/auth.service.ts` (`Profile` เพิ่ม `avatar_path: string | null`, `onboarded_at: string | null`, select ใหม่, `setProfile(patch)`), `apps/web/src/app/features/me/me.service.ts` (`completeProfile(name: string): Promise<void>`, `uploadAvatar(file: Blob): Promise<string>`, `removeAvatar(): Promise<void>`), `apps/web/src/app/i18n/th.ts` + `en.ts`

**Interfaces:**
- Produces: `<app-avatar [name]="string" [path]="string | null | undefined" [size]="number">` สี่เหลี่ยมจัตุรัสวงกลม: มี `path` แสดง `<img>` จาก `/sb/storage/v1/object/public/avatars/{path}` (ผ่าน `ServerUrlPipe` เดิมสำหรับ APK), ไม่มีก็แสดง `initialOf(name)` บนพื้น accent 24% (เหมือน `.face` ใน `account-button.component.ts`) และไอคอน `circleUser` เมื่อไม่มีชื่อ; `aria-hidden` เสมอ (ชื่ออยู่ข้างๆ เป็นข้อความอยู่แล้ว)
- ย้าย `initialOf` ไป `shared/initial-of.ts` และ re-export จาก `account-button.component.ts` เพื่อไม่ให้ import เดิมพัง

- [ ] **Step 1 (test):** `avatar.component.spec.ts`: มี path → `<img>` src ถูก, ไม่มี path → ตัวอักษรแรกตามกฎสระนำภาษาไทย (`เก` → `ก`), ไม่มีชื่อและไม่มี path → ไอคอน, รูปโหลดไม่ได้ (`error`) → กลับไปแสดงตัวอักษร
- [ ] **Step 2:** รัน (คอนเทนเนอร์ `web`, `--include`) ต้องล้ม; **Step 3:** เขียนคอมโพเนนต์ + ย้ายฟังก์ชัน + เพิ่มคำใน i18n (`profile.title`, `profile.lede`, `profile.photo`, `profile.nickname`, `profile.start`, `profile.starting`, `profile.changePhoto`, `profile.removePhoto`, `profile.signOutHere`, `profile.uploading`) ไทย/อังกฤษ
- [ ] **Step 4:** รันชุด web ที่เกี่ยวข้องต้องผ่าน; **Step 5: Commit** `feat(web): avatar component and profile fields`

### Task 5: เว็บ: ขั้น "ตั้งโปรไฟล์" ในฟอร์มล็อกอินและแผ่นบังคับ

**Files:**
- Modify: `apps/web/src/app/features/auth/login-form.component.{ts,html,scss}`, `apps/web/src/app/app.component.ts` (เรียก `ProfileSetupService` เมื่อเซสชันมีแต่ยังไม่ผ่าน), `apps/web/src/app/features/auth/login-prompt.service.ts` (เปิดเผย `whenIdle(): Promise<void>`)
- Create: `apps/web/src/app/features/auth/profile-setup.service.ts` (+ spec), `apps/web/src/app/features/auth/profile-form.component.{ts,html,scss}` (+ spec)
- Test: ปรับ `login-form.component.spec.ts`

**Interfaces:**
- Consumes: `AvatarComponent`, `MeService.completeProfile/uploadAvatar/removeAvatar`, `AuthService.loadedProfile()`
- Produces: `ProfileFormComponent` (`done` output) มี HTML/สไตล์ตามหัวข้อ 5 ของ spec (วงรูป 80px, ปุ่มถ่ายรูป/เลือกจากคลัง, ช่องชื่อ, ปุ่ม primary "เริ่มใช้แจ้ง"); `LoginFormComponent` ขั้น `'profile'` หลัง `verifyCode` ถ้า `(await auth.loadedProfile())?.onboarded_at == null`; `ProfileSetupService.ensure(): Promise<void>` เปิดแผ่น Ionic (`cssClass: 'login-sheet'` เดิม, `backdropDismiss: false`, `keyboardClose` ปกติ ไม่มีปุ่มปิด มีลิงก์ออกจากระบบ) เมื่อ `auth.signedIn() && profile.onboarded_at == null` และไม่ซ้อนกับแผ่นล็อกอินที่เปิดอยู่

- [ ] **Step 1 (test):** `profile-form.component.spec.ts`: ปุ่มเริ่มกดไม่ได้เมื่อชื่อว่าง/1 ตัว/อักขระล่องหน; ชื่อถูกแล้วเรียก `completeProfile(name)` แล้ว emit `done`; ข้อผิดพลาดจาก API (`profanity`) แสดงใต้ช่องผ่าน `i18n.say`; เลือกรูป → `uploadAvatar` ถูกเรียกก่อนกดเริ่ม, แสดงตัวอย่าง, ปุ่ม `x` เรียก `removeAvatar`; ไม่เลือกรูปกดเริ่มได้; อัปโหลดล้มเหลวแสดงข้อความและกดลองใหม่ได้ ไม่เสียชื่อที่พิมพ์
- [ ] **Step 2 (test):** `login-form.component.spec.ts`: ผู้ใช้ `onboarded_at = null` หลังรหัสถูก → เห็นฟอร์มโปรไฟล์ ไม่ emit `done`; ผู้ใช้เดิม → emit `done` เหมือนเดิม; `profile-setup.service.spec.ts`: มีเซสชันแต่ยังไม่ผ่าน → เปิดแผ่นหนึ่งครั้ง (เรียกซ้ำไม่ซ้อน), ผ่านแล้วไม่เปิด, ออกจากระบบแล้วปิด
- [ ] **Step 3:** รันต้องล้ม; **Step 4:** เขียนตาม Interfaces ใช้ class เดิมของ `login-form` (`.head .lede .field .input .primary .error`) และ `.btn.big` + ไอคอน `camera`/`image` + `<input type=file>` ซ่อนแบบ `photo-step`; ลดขนาดรูปก่อนส่งด้วยเครื่องมือใน `photo-tools.ts` ถ้ามีฟังก์ชันย่อขนาดอยู่แล้ว (ตรวจก่อนเขียนใหม่)
- [ ] **Step 5:** รันชุด web ทั้งหมดผ่าน; ตรวจด้วยตาในเบราว์เซอร์ 375 px ทั้งสองธีมและสองภาษา; **Step 6: Commit** `feat(web): profile step after the login code`

### Task 6: เว็บ: แสดงรูปในที่ต่างๆ และแก้ไขในหน้า "ของฉัน"

**Files:**
- Modify: `apps/web/src/app/features/auth/account-button.component.ts` (วงใช้ `<app-avatar>`; เมนู: วง 32px หน้าชื่อ), `apps/web/src/app/features/me/me.page.{ts,html,scss}` (วง 72px, ปุ่มเปลี่ยนรูป/เอารูปออกในแถวชื่อ), `apps/web/src/app/features/report-detail/report-detail.{ts,component.html,service.ts}` (`author_avatar` ในผู้แจ้งและคอมเมนต์, select ใหม่), `packages/shared/api.ts` (`author_avatar`), `apps/api/src/supabase-store.ts` (select คอมเมนต์เพิ่ม `author_avatar`)
- Test: สเปคที่อยู่ติดกัน

**Interfaces:**
- Consumes: `AvatarComponent`, `AuthService.setProfile`, `MeService.uploadAvatar/removeAvatar`

- [ ] **Step 1 (test):** ปุ่มบัญชีแสดงรูปเมื่อมี `avatar_path` (และตัวอักษรเมื่อไม่มี); `report-detail` แสดงวงหน้าชื่อผู้แจ้งและผู้คอมเมนต์เมื่อ `author_avatar` มี, ไม่มีวงเลยเมื่อ `author_name` เป็น null; หน้า "ของฉัน": เปลี่ยนรูป → `uploadAvatar` แล้ว `profile.avatar_path` ใหม่, เอาออก → `removeAvatar` แล้ว null, ระหว่างส่งปุ่มกดซ้ำไม่ได้
- [ ] **Step 2:** รันต้องล้ม; **Step 3:** ทำตามนั้น ใช้ปุ่ม `.btn` ขนาด 44px และไอคอน `camera`/`trash2` ที่มีใน `IconComponent` (ตรวจชื่อไอคอนก่อนใช้)
- [ ] **Step 4:** รันชุด web และ api ทั้งหมดผ่าน; ตรวจด้วยตา; **Step 5: Commit** `feat(web): show profile pictures and let people change them`

### Task 7: ผู้ดูแลเอารูปโปรไฟล์ออกได้

**Files:**
- Modify: `apps/api/src/routes/admin.ts`, `apps/api/src/store.ts`, `apps/api/src/supabase-store.ts`, `packages/shared/admin.ts` (`LOG_ACTIONS` + `'remove_avatar'`, `Person`/`AdminUser` มี `avatar_path`), `apps/web/src/app/features/admin/users-tab.component.ts`, `apps/web/src/app/features/admin/admin.service.ts`, `apps/web/src/app/i18n/th.ts` + `en.ts` (คำของ log และปุ่ม), migration ถัดไป (ฟังก์ชัน `remove_avatar` + ขยาย check ของบันทึกถ้ามี)
- Test: `apps/api/test/admin-avatar.test.ts`, `users-tab.component.spec.ts`, pgTAP ของฟังก์ชัน

**Interfaces:**
- Produces: `POST /admin/users/:id/remove-avatar` → `{ ok: true }` ตั้ง `avatar_path = null` ลบไฟล์ในที่เก็บ และบันทึก `remove_avatar` ลงบันทึกผู้ดูแล; `AdminService.removeAvatar(userId: string): Promise<void>`

- [ ] **Step 1 (test):** ไม่ใช่แอดมิน → 403; แอดมินเอารูปผู้ใช้ที่ไม่มีรูป → 200 ไม่พัง; มีรูป → ไฟล์ถูกลบ `avatar_path` เป็น null มีแถวบันทึก; แท็บ "ผู้ใช้" แสดงวงรูปและปุ่ม "เอารูปออก" เฉพาะคนที่มีรูป (ยืนยันสองจังหวะเหมือนปุ่มแบน `admin.sureBan`)
- [ ] **Step 2:** ล้ม → ทำ → ผ่าน; **Step 3: Commit** `feat(admin): remove a member's profile picture`

### Task 8: ตรวจรวมและส่งมอบ

- [ ] **Step 1:** `bash scripts/reset-db.sh` แล้ว `bash scripts/test.sh` ผ่านทั้งหมด (ส่งผลจริงให้ดูเมื่อมีล้ม)
- [ ] **Step 2:** ในเบราว์เซอร์: ผู้ใช้ใหม่ครบเส้นทาง (โหมด mailpit อ่านรหัสจาก Mailpit) 375 px และเดสก์ท็อป ธีมมืด/สว่าง ไทย/อังกฤษ; ผู้ใช้เดโมไม่เจอขั้นตั้งโปรไฟล์; ปิดแผ่นกลางทางแล้วถูกเปิดซ้ำ; ผู้แจ้งปิดชื่อไม่เห็นรูป
- [ ] **Step 3:** อัปเดต `docs/superpowers/specs/2026-10-16-jaeng-design.md` (3.1, 5.1, API ตาราง) และ `CLAUDE.md` (สคริปต์ `mail-mode.sh`, คีย์ใน `supabase/.env`) ให้ตรงกับของที่ทำ
- [ ] **Step 4:** แจ้งเจ้าของให้ทดสอบส่งอีเมลจริงหนึ่งฉบับ (`bash scripts/mail-mode.sh resend`) และบอกว่าเรื่องคีย์ที่วางในแชตควรสร้างใหม่หลังทดสอบเสร็จ
