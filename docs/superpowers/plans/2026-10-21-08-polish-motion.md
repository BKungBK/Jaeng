# แจ้ง — Plan 8: ขัดเกลา แอนิเมชัน E2E และเดโม

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (เจ้าของสั่งให้ลงมือเองใน session นี้ ไม่ส่งให้ subagent) Steps use checkbox (`- [ ]`) syntax for tracking.

**เป้าหมาย:** ทำให้แอปมีชีวิต: ทุกการแตะที่สำคัญ (ติ๊กถูก, เจอเหมือนกัน, ส่งเรื่อง, อนุมัติ, สลับธีม) ตอบกลับด้วยแอนิเมชันที่เป็นภาษาเดียวกับ "ลำแสงยามฟ้าแจ้ง" ของแอป แล้วปิดงานด้วยการขัดเกลา (audit/harden/clarify/polish), Playwright E2E ของฉากเดโมทั้ง 6 ขั้น และ `docs/demo-checklist.md`

**ไม่อยู่ในแผนนี้:** เบลอรูป (แผน 9) · tunnel/เช็กลิสต์ความปลอดภัย (แผน 10) · ซ้อมเดโมบนมือถือจริง (เจ้าของทำเอง ตามเช็กลิสต์ที่แผนนี้เขียนให้ Task 14) · งานเล็กที่ roadmap ยกมาซึ่งไม่ได้ระบุใน Task 11

**สถาปัตยกรรม:** (เจ้าของสั่งเพิ่ม 2026-10-21) ใช้ไลบรารี **Motion** (`motion@14.5.0` ติดตั้งแล้วใน `apps/web`) กับส่วนที่ต้องเรียงลำดับ/เล่นแบบสปริง/รอจบได้ (burst, ตัวเลขหมุน, exit ของ panel, collapse, FLIP) โดย `import { animate, spring, stagger } from 'motion'` (ตัวเดียวพอ: ได้ transform แยก, สปริงที่ขัดจังหวะได้, `await animation`; ตัวติดตั้งนี้ tree-shake ได้ ถ้าขนาด bundle เกินงบใน Task 10 ค่อยย้ายงานครั้งเดียวไป `motion/mini`) ส่วนสถานะ declarative (hover, เลือก, ติ๊กวาด, skeleton) ยังเป็น CSS keyframes/transition ทั้งหมดห่อไว้ในฟังก์ชันเล็กๆ ใน `core/motion.ts` ที่มีอยู่แล้ว คอมโพเนนต์ไม่ import `motion` ตรง ส่วนที่ซ้ำกันหลายหน้าทำเป็นคอมโพเนนต์/partial เดียว (`<app-tick>`, `<app-roll>`, `theme/_motion.scss`) Beacon บนแผนที่ขับด้วย attribute `data-fx` ที่ `updateBeaconElement` ตั้งเมื่อข้อมูลของ marker เดิมเปลี่ยน (ทดสอบได้โดยไม่ต้องมี WAAPI)

**Tech Stack:** Angular 22.1.7 + Ionic 9 + MapLibre 5.24 (เดิม) · `motion@14.5.0` (ติดตั้งแล้ว ตรึงตรงตัว) · Motion AI Kit (`npx motion-ai`: สกิล `/motion` + MCP server ให้ agent ใช้ตอนเขียนแอนิเมชัน ไม่ใช่ dependency ของแอป) · Playwright (เฉพาะ `e2e/` รันใน image `mcr.microsoft.com/playwright` ตรึงเวอร์ชันตรงตัวตอน Task 13) · การอนุมัติแผนนี้ถือเป็นการอนุญาตให้ติดตั้ง Playwright ใน `e2e/` และดึง image

**Spec:** [2026-10-16-jaeng-design.md](../specs/2026-10-16-jaeng-design.md) หัวข้อ 3.11 (UI), 7.5/เฟส 7.5 (ขัดเกลา), 10 (E2E); `DESIGN.md` หัวข้อ Motion; roadmap หัวข้อ "แผน 8"

## ความคิดด้านการเคลื่อนไหว (motion thesis ตาม Impeccable animate)

- **ช่วงเด่น 2 ช่วง:** (1) *ส่งเรื่องสำเร็จ* — วงแหวนวาด, ติ๊กวาด, ลำแสงขึ้นจากจุด แล้วข้อความลอยขึ้นตามลำดับ (ภาษาเดียวกับ intro) (2) *ลำแสงบนแผนที่เปลี่ยนสถานะ* — เจอเหมือนกันเพิ่ม = ดิสก์กระเด้งและวงคลื่นปล่อยออก, แจ้งแก้แล้ว = ลำแสงหรี่ลง, ยืนยันแล้ว = ไฟกะพริบสองครั้งแล้วดับ (ฉากเดโมขั้น 5–7)
- **ต่อเนื่อง (continuity):** ก้าวใน flow แจ้งเรื่องเลื่อนตามทิศ, panel รายละเอียดมีทางออก (ตอนนี้หายทันที), เนื้อหาสลับเรื่องเปลี่ยนแบบเฟด, เปลี่ยนธีมเป็นวงกลมกางจากปุ่มที่กด
- **ตอบรับ (feedback):** ติ๊ก/สวิตช์/ชิป/เรดิโอ ทุกตัวที่ "เลือก" ได้ มีจังหวะเลือกของตัวเอง; ปุ่มกำลังทำงานมีแถบกวาด; ข้อความ toast เข้า–ออก; คอมเมนต์ใหม่เลื่อนเข้าพร้อมแสงจาง; แอดมินกดอนุมัติ/ปฏิเสธแล้วการ์ดพับหายพร้อมติ๊ก
- **งบประสิทธิภาพ:** เล่นเฉพาะเมื่อมีเหตุ ไม่มี loop ใหม่ที่ไม่หยุดนอกจาก skeleton ที่หยุดเมื่อโหลดเสร็จ; animate เฉพาะ `transform`/`opacity` (+ `filter: blur` บนองค์ประกอบเดี่ยวที่ไม่ใช่ marker); marker บนแผนที่ห้ามมี filter/backdrop/shadow animation (150 ตัว repaint ทุกเฟรม); แท็บถูกซ่อนแล้วไม่มีอะไรเล่นต่อ (animation ของเบราว์เซอร์หยุดเองอยู่แล้ว)

## การตัดสินใจที่ผู้เขียนแผนเลือกเอง (เจ้าของค้านได้ก่อนลงมือ)

1. **เพิ่ม "สปริง" หนึ่งตัวสำหรับจังหวะเลือก** (ติ๊ก/สวิตช์/ดิสก์/ปุ่มที่กดซ้ำบ่อย) ส่วนการเคลื่อนที่ของ panel/หน้า/กล้องยังใช้ EASE เดียวเดิม สปริงมีสองรูป ค่าเดียวกัน: ใน JS = `POP_SPRING = { type: spring, visualDuration: 0.35, bounce: 0.3 }` (ขัดจังหวะได้และสืบความเร็วเดิม ตามสกิล `/motion`) ใน CSS = `--pop` เป็น `linear()` ที่สร้างด้วย `generate-css-easing({ kind: 'spring', duration: 0.35, bounce: 0.3 })` จาก Motion MCP (ถ้า MCP ยังไม่เปิด ใช้ `cubic-bezier(0.34, 1.56, 0.64, 1)` ชั่วคราวแล้วสลับทีหลัง) แล้วแก้ DESIGN.md หัวข้อ Motion ให้ตรง (ข้อความเดิม "One easing for everything that moves" เปลี่ยนเป็นหนึ่ง easing สำหรับการเดินทาง + หนึ่งสปริงสำหรับการเลือก)
   - **เลือกเครื่องมือตาม `css-or-motion.md` ของสกิล:** สถานะธรรมดา/ขึ้นเมื่อ mount/skeleton/วนซ้ำ = CSS; สิ่งที่ผู้ใช้กดซ้ำเร็วๆ หรือถูกขัดจังหวะ (เจอเหมือนกัน, สวิตช์, ดิสก์ beacon) = Motion สปริงด้วย `animate` จาก `motion` (transform แยก `scale`/`x`); ออกจาก DOM, พับความสูง, ประกาย, stagger แบบไดนามิก = Motion
   - **กฎของสกิลที่เจ้าของยกเว้น:** สกิล `/motion` และ Impeccable แนะนำ `prefers-reduced-motion` ซึ่งเจ้าของห้ามไว้ (ทำตามเจ้าของ ไม่เพิ่ม)
2. **เลือกหมวดในขั้น 2 หน่วง 220 ms ก่อนไปขั้น 3** เพื่อให้เห็นติ๊กวาด ("3 แตะ" ยังเป็น 3 แตะ) กดซ้ำระหว่างหน่วงไม่ไปสองครั้ง
3. **ธีม/ภาษา:** ธีมใช้ View Transitions API (วงกลมกางจากปุ่ม) เบราว์เซอร์ที่ไม่รองรับสลับทันทีเหมือนเดิม ภาษาเฟดข้าม (ไม่มีวงกลม)
4. **ไม่แตะแอนิเมชันของทะเล/พื้นหลัง shader/intro/ลำแสงที่ pulse อยู่แล้ว** และไม่ทำให้ FAB เรืองแสง (กฎ "อย่าให้อะไรเรืองนอกจาก beacon")
6. **LottieFiles ใช้เป็นแรงบันดาลใจ ไม่ดาวน์โหลดไฟล์ ไม่เพิ่ม lottie-web:** แนวที่เก็บมาจากหมวด success-check คือ "ดิสก์ขยายเข้า → วงแหวนกวาดรอบ → ติ๊กวาด → ประกาย" ซึ่ง Task 4 (sent-card) และ Task 2 (เจอเหมือนกัน) สร้างเองด้วย SVG + Motion เพื่อให้เบา สีตามธีม และไม่ติดไลเซนส์ของไฟล์ภายนอก (ถ้าเจ้าของอยากได้ไฟล์ Lottie จริง ให้เลือกไฟล์แล้วบอก จะเพิ่มเป็นงานแยก)
7. **ฉากเดโมขั้น 5–7 (ลำแสงเปลี่ยนสถานะ) ตรวจจากข้อมูลของ marker เดิมเท่านั้น:** marker ที่เพิ่งสร้างจากการแพนแผนที่ไม่เล่น bump/ดับ (เล่นแค่ `pop` เดิม)

## ข้อกำหนดรวม

- ทำบน branch `plan-8-polish` แตกจาก `master` merge กลับเมื่อ `bash scripts/test.sh` ผ่านทั้งหมดและเจ้าของอนุญาตเท่านั้น `git add` ทีละไฟล์ ห้าม `git add -A` / `.` ห้ามแตะ `docker-webui/`, `CLAUDE.md`, `.claude/`, `.impeccable/critique/`, `.impeccable/mocks/`
- คำสั่งรันใน WSL ที่ `/mnt/d/Project/Jaeng` หลัง `export PATH="$HOME/.local/node/bin:$PATH"` จาก PowerShell เขียน bash ลง scratchpad แล้ว `wsl bash /mnt/c/...` มี keep-alive `wsl -e bash -c "sleep 86400"` เช็ก `http://localhost:8000/api/health` ก่อนเริ่ม
- เทสต์เว็บรันใน container: `docker compose exec -T web npx ng test --watch=false` ปิดแต่ละ Task ด้วยคำสั่งนี้ผ่านทั้งหมด ปิดแผนด้วย `bash scripts/test.sh` WSL แรม 4 GB: ห้ามรัน Playwright พร้อม `test.sh`
- **ห้ามใช้ `prefers-reduced-motion`** ทั้ง CSS และ JS (เจ้าของสั่ง) · ห้ามแก้ไฟล์ไทยด้วย PowerShell `Get-Content`/`Set-Content` ใช้ Edit/Write · ข้อความใหม่เข้า `i18n/th.ts` + `en.ts` เท่านั้น · เป้ากด ≥ 44×44 px · ทุกแอนิเมชัน "เล่นได้ซ้ำและถูกขัดจังหวะได้" (ไม่ใช้ `animation-fill-mode: forwards/both` กับ rise/panel-in ตาม `theme.spec.ts`)
- ก่อนแก้ UI ให้อ่าน `reference/craft-floor.md` ของ Impeccable หนึ่งครั้ง และรัน `impeccable detect` ครั้งเดียวตอนจบแต่ละกลุ่ม UI (Task 8 และ Task 12)
- ตรวจด้วยตาในเบราว์เซอร์ (preview/Claude Browser) ที่ 375×812 และเดสก์ท็อป ทั้งธีมมืด/สว่าง ก่อนปิดแต่ละ Task ที่มี UI

## Review Focus

1. **กดเจอเหมือนกันรัว/สลับเร็ว หรือ API ล้ม:** แอนิเมชันไม่ซ้อนค้าง ตัวเลขหมุนไปที่ค่าสุดท้ายถูก และ rollback (API ล้ม) หมุนกลับ — เทสต์ใน Task 2
2. **ตัวเลขหมุน:** 0, 9→10, 99→100, 100→99, ค่าติดลบ/`NaN`/ทศนิยม ไม่พัง และโปรแกรมอ่านจอได้ค่าเดียว (ไม่อ่านทีละหลัก) — เทสต์ใน Task 1
3. **marker ที่สร้างใหม่จากการแพนแผนที่ต้องไม่ bump/ดับ** เฉพาะ marker เดิมที่ข้อมูลเปลี่ยน — เทสต์ใน Task 3
4. **ปิด panel รายละเอียดระหว่างเล่นทางออกแล้วเปิดอีกเรื่อง:** ต้องไม่ค้างสองแผง ไม่ค้าง `closing` (ตรงกับรายการค้างของแผน 3) — เทสต์ใน Task 6
5. **View Transition ไม่รองรับ/ถูกข้าม (แท็บซ่อน, เบราว์เซอร์เก่า, ข้อผิดพลาดใน callback):** ธีมต้องยังเปลี่ยนและ Promise ไม่ค้าง — เทสต์ใน Task 8
6. **เลือกหมวดแล้วกดซ้ำ/กด back ระหว่างหน่วง 220 ms:** ไม่ไปขั้น 3 สองครั้ง ไม่ไปขั้น 3 หลังย้อนกลับแล้ว — เทสต์ใน Task 4

---

### Task 1: ชุดเครื่องมือการเคลื่อนไหว (motion kit)

**Files:**
- Create: `apps/web/src/theme/_motion.scss`, `apps/web/src/app/shared/tick.component.ts`, `apps/web/src/app/shared/roll.component.ts`, `apps/web/src/app/shared/tick.component.spec.ts`, `apps/web/src/app/shared/roll.component.spec.ts`
- Modify: `apps/web/src/app/core/motion.ts`, `apps/web/src/app/core/motion.spec.ts`, `apps/web/src/theme/glass.scss` (`@use 'motion'` ผ่านจุดที่ `theme` โหลดอยู่แล้ว ดู `angular.json` styles), `DESIGN.md` (หัวข้อ Motion + Do's)
- Test: `motion.spec.ts`, `roll.component.spec.ts`, `tick.component.spec.ts`, `theme/theme.spec.ts` (ขยายตัวสแกน)

**Interfaces:**
- Produces:
  - `_motion.scss`: custom properties `--ease` (= EASE) และ `--pop`; keyframes `tick-draw` (stroke-dashoffset 1→0, 280ms), `ping` (วงแหวน scale 0.6→1.8, opacity 0.6→0, 560ms), `settle` (scale 1.14→1, 360ms pop), `sheen` (แถบกวาด 900ms ใช้กับปุ่ม busy), `shimmer` (skeleton, 1.4s วน), `leave` (opacity→0, translateY 6px, 180ms); mixin `@mixin press` (`:active` scale 0.97, 120ms)
  - `core/motion.ts`: `export const POP_SPRING = { type: spring, visualDuration: 0.35, bounce: 0.3 } as const` (ค่าเดียวกับ `--pop` ในการตัดสินใจข้อ 1; `import { spring } from 'motion'`); `export function burstSpecs(count: number, radius: number): { dx: number; dy: number; delay: number }[]` (มุมกระจายเท่ากัน เริ่มชี้ขึ้น, `delay` = `i * 12` ms, `count < 1` → `[]`); `export function burst(host: HTMLElement, opts?: { count?: number; radius?: number; color?: string }): void` (สร้าง `<i class="spark">` ชั่วคราวใน `host` เล่นด้วย `animate` + `stagger` จาก `motion` พร้อมสปริงเบาๆ ลบทิ้งเมื่อจบ ไม่ทำอะไรถ้า `host.animate` ไม่มี); `export function leave(el: HTMLElement, ms = 180): Promise<void>` (`animate` ออก opacity+translateY แล้ว resolve; ไม่มี `el.animate` → resolve ทันที); `export function collapse(el: HTMLElement, ms = 260): Promise<void>` (ย่อ height→0 + opacity บนองค์ประกอบเดียว); `export function springIn(el: HTMLElement, from = 0.8): Promise<void>` (สปริง scale `from`→1 สำหรับ "จังหวะเลือก" ที่ CSS `--pop` ทำไม่ได้); `export function viewTransition(update: () => void | Promise<void>, origin?: { x: number; y: number }): Promise<void>` (ใช้ `document.startViewTransition` ถ้ามีและแท็บไม่ซ่อน กางวงกลมจาก `origin` ด้วย `clip-path` ของ `::view-transition-new(root)`; ไม่งั้นเรียก `update()` ตรงๆ; เมื่อ transition ถูกข้ามหรือ callback โยน ต้อง resolve และ `update()` ถูกเรียกครั้งเดียวพอดี)
  - `shared/tick.component.ts`: `<app-tick [size]="20" [play]="true" />` SVG path `pathLength="1"` เส้นหนา 2.5 `currentColor` วาดด้วย `tick-draw` เมื่อ `play()` เป็น true (false = เห็นติ๊กเต็มทันที ไม่มี animation)
  - `shared/roll.component.ts`: `<app-roll [value]="n" />`; `export function rollDigits(value: number): number[]` (ค่า `NaN`/ติดลบ/ทศนิยม → ปัดลง เป็น 0 ขั้นต่ำ, คืนหลักซ้ายไปขวา) แต่ละหลักเป็นคอลัมน์ 0–9 เลื่อนด้วย `transform: translateY(-d em)` 420ms EASE หน่วง 30ms ต่อหลักจากขวา; ข้อความอ่านจอเป็น `.sr-only` ค่าเดียว คอลัมน์ `aria-hidden`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม**
  - `motion.spec.ts`: `burstSpecs(8, 24)` ได้ 8 รายการ, ตัวแรกชี้ขึ้น (`dx≈0, dy<0`), ระยะทุกตัว ≈ 24, `delay` เพิ่มทีละ 12; `burstSpecs(0, 24)` = `[]`; `leave()`/`collapse()` resolve ทันทีเมื่อ `el.animate` ไม่มี (jsdom); `viewTransition(fn)` เมื่อไม่มี `startViewTransition` เรียก `fn` ครั้งเดียว; เมื่อ `startViewTransition` ถูก stub ให้ `finished` reject ก็ยัง resolve และ `fn` ถูกเรียกครั้งเดียว; เมื่อ `document.hidden` เป็น true ไม่เรียก `startViewTransition`
  - `roll.component.spec.ts`: `rollDigits(0)=[0]`, `(9)=[9]`, `(10)=[1,0]`, `(99)=[9,9]`, `(100)=[1,0,0]`, `(-3)=[0]`, `(NaN)=[0]`, `(4.9)=[4]`; ภายใน component ค่าเปลี่ยน 9→10 แล้ว `.sr-only` เป็น `10` และมีคอลัมน์ 2 อัน; DOM มี `aria-hidden` ที่คอลัมน์
  - `tick.component.spec.ts`: `play=true` ใส่คลาสที่เล่น animation, `play=false` ไม่ใส่
  - `theme.spec.ts`: เพิ่มข้อ "ทุกไฟล์ `.scss`/`.ts` ของเว็บที่ไม่ใช่ spec ไม่มี `prefers-reduced-motion`" ครอบ `_motion.scss` ด้วย (มีอยู่แล้วให้ตรวจว่าอ่านไฟล์ใหม่) และ keyframes ใหม่ทุกอันไม่ใช้ `fill-mode` `forwards`/`both` กับ `settle`/`ping`/`leave`
- [ ] **Step 2: รันให้ล้ม** `docker compose exec -T web npx ng test --watch=false` คาดล้มเฉพาะไฟล์ที่ระบุ
- [ ] **Step 3: เขียน `_motion.scss`, `motion.ts` (ส่วนเพิ่ม), `tick.component.ts`, `roll.component.ts`** ตามซิกเนเจอร์ข้างบน; `burst` วาง spark เป็น `position:absolute` กึ่งกลาง `host` (host ต้อง `position:relative` ผู้เรียกรับผิดชอบ) `pointer-events:none`
- [ ] **Step 4: แก้ DESIGN.md** หัวข้อ Motion: บรรทัด "One easing" เป็น "One easing for travel, one pop for choosing" บอกค่า `--pop` และว่าใช้ที่ไหน; Do's บรรทัด "use the one easing" ให้ตรง; เพิ่มบรรทัด Motion: tick, ping, settle, sheen, shimmer
- [ ] **Step 5: รันทั้งชุดให้ผ่าน**
- [ ] **Step 6: Commit** `git add` ไฟล์ที่ระบุ · `feat(web): motion kit (tick, roll, burst, view transition)`

---

### Task 2: เจอเหมือนกัน — ปุ่ม ตัวเลข และตัวเลขทั่วแอป

**Files:**
- Modify: `apps/web/src/app/features/report-detail/report-detail.component.html:85-96`, `report-detail.component.scss` (`.metoo`, ~บรรทัด 282-305), `report-detail.component.ts` (`toggle()`), `apps/web/src/app/features/map/map.page.html` (`confirm_count` ในสรุป/tooltip `#summary`), `apps/web/src/app/features/map/stats-line*.ts` (ตัวเลขสถิติ)
- Test: `report-detail.component.spec.ts`, `stats-line` spec ที่มีอยู่ (หรือสร้างตามชื่อไฟล์จริงของ stats-line)

**Interfaces:**
- Consumes: `<app-tick>`, `<app-roll>`, `burst()`, `--pop`/`ping` จาก Task 1
- Produces: ปุ่ม `.metoo` ถือ `data-fx` = `'on' | 'off' | null` ที่ตั้งตอน toggle สำเร็จ/ย้อนกลับ (ใช้ทดสอบและขับ CSS)

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** ใน `report-detail.component.spec.ts` (ใช้ pattern mock API ที่มีอยู่ในไฟล์): กด toggle → ก่อน API ตอบ ตัวเลขใน `<app-roll>` เป็น `n+1` (optimistic) และ `data-fx="on"`; API ล้ม → ตัวเลขกลับ `n` และ `data-fx` ไม่ใช่ `on`, `aria-pressed="false"`; กดสองครั้งเร็วๆ ขณะ `confirming()` ครั้งที่สองไม่ส่ง API; ข้อความอ่านจอของปุ่มมีตัวเลขเดียว
- [ ] **Step 2: รันให้ล้ม**
- [ ] **Step 3: ทำ** — ไอคอนมือ→`<app-tick>` สลับด้วย `settle` (--pop), `ping` วงแหวน 1 ครั้งรอบปุ่ม, `burst(btn, { count: 8, color: 'var(--onpri)' })` ตอนยืนยัน (ไม่ยิงตอนยกเลิก ตอนยกเลิกมือกลับพร้อม `leave` เบาๆ), ปุ่มเต็มสีกวาดจากซ้ายไปขวา (`clip-path: inset` transition 320ms EASE ไม่ใช่ background transition), ตัวเลข `n` ใช้ `<app-roll>` เปลี่ยน `toggle()` ให้ตั้งตัวเลข optimistic ก่อนเรียก API (ถ้ายังไม่ได้ทำ ดูโค้ดเดิม) และ rollback เมื่อล้ม; `.metoo` ใช้ `@include press`; ตัวเลข `confirm_count` ในสรุปแผนที่/ตัวเลขใน stats-line ใช้ `<app-roll>` (เล่นเมื่อค่าเปลี่ยนจากข้อมูลสด ไม่เล่นตอนแสดงครั้งแรก)
- [ ] **Step 4: รันทั้งชุดให้ผ่าน** แล้วตรวจด้วยตา: เปิดเรื่องเดโม กดเจอเหมือนกัน/ยกเลิก 3 ครั้งเร็วๆ ที่ 375 px และเดสก์ท็อป ธีมมืด+สว่าง
- [ ] **Step 5: Commit** · `feat(web): me-too tick, ping, burst and rolling counts`

---

### Task 3: วงจรชีวิตของลำแสงบนแผนที่ (ฉากเดโมขั้น 4–7)

**Files:**
- Modify: `apps/web/src/app/features/map/beacon.ts` (`updateBeaconElement` ~บรรทัด 79-97, `build`), `apps/web/src/theme/map.scss` (`.beacon`, `.st-claimed`, `.st-done`, keyframes), `apps/web/src/app/features/map/beacon-layer.ts` (`showBeacon`)
- Test: `apps/web/src/app/features/map/beacon.spec.ts` (ไฟล์เดิมหรือสร้างตามชื่อที่มี)

**Interfaces:**
- Produces: `updateBeaconElement` ตั้ง `root.dataset['fx']` เป็น `'bump'` เมื่อ `confirm_count` เพิ่มบน root เดิม, `'claimed'` เมื่อสถานะเปลี่ยน open→fix_claimed, `'out'` เมื่อเปลี่ยนเป็น resolved, ล้างเมื่อ `animationend` (ผ่าน `{ once }` listener) และไม่ตั้งเลยเมื่อ root เพิ่งสร้าง (ใช้ `root.dataset['count']`/`['state']` เก็บค่าก่อนหน้า)

- [ ] **Step 1: เขียนเทสต์ที่ล้ม:** สร้าง root ใหม่ → `dataset.fx` ไม่มี; อัปเดตด้วย `confirm_count` +1 → `fx='bump'`; อัปเดตด้วยค่าเท่าเดิมหรือลดลง → ไม่มี `bump`; open→fix_claimed → `fx='claimed'`; fix_claimed→resolved → `fx='out'`; สร้างใหม่ด้วย structureKey เปลี่ยน (เช่น compact เปลี่ยนเพราะ zoom) แต่ข้อมูลเท่าเดิม → ไม่มี fx; สร้าง root ใหม่ที่เป็น resolved อยู่แล้ว → ไม่มี `out`
- [ ] **Step 2: รันให้ล้ม**
- [ ] **Step 3: ทำ**
  - CSS ตาม `data-fx` (ไม่มี filter/shadow animation): `bump` = ดิสก์ `settle` (scale 1.18→1, --pop) + วงแหวน `ping` หนึ่งครั้ง (สีระดับ `--c`) + แท่ง `.stand` ยืดด้วย transition `height` เดิม; `claimed` = beam opacity 0.8→0.28 ด้วย transition 600ms (ทำให้ `.beam`/`.ring` ใน `.st-claimed` ใช้ opacity/visibility transition แทน `display:none`) และขอบดิสก์ทำ `settle`; `out` = beam กะพริบ 2 ครั้ง (opacity 0.8→0.2→0.7→0.1→0, 900ms) แล้วดับ, แท่ง `.stand` ย่อเป็น 0 ด้วย `transform: scaleY` (ไม่ใช่ height), ดิสก์จางเป็น 0.85 และสีไป `--s0` ผ่าน transition
  - หมายเหตุ: `root.className = ...` ถูกตั้งทุกครั้ง ต้องคง `data-fx` (เป็น attribute ไม่ใช่ class จึงไม่ถูกทับ)
  - cluster: ตอนจำนวนเปลี่ยนแล้วสร้างใหม่ ใส่ `settle` ที่ตัวเลข (ใช้ `pop` เดิมอยู่แล้ว ไม่ต้องทำเพิ่มถ้าเห็นว่าพอ)
- [ ] **Step 4: รันทั้งชุดให้ผ่าน** แล้วตรวจด้วยตา: ใช้เดโมในแผนที่จริง (ล็อกอินแอดมิน/ผู้ใช้เดโมด้วย quick login) กดเจอเหมือนกัน → ดิสก์บนแผนที่กระเด้งและแท่งยืด; ให้แอดมินยืนยันแก้แล้ว → ลำแสงกะพริบดับ; แพนแผนที่แล้ว marker ใหม่ไม่ bump
- [ ] **Step 5: Commit** · `feat(web): beacons react when a report changes (bump, dim, go out)`

---

### Task 4: flow แจ้งเรื่อง — ก้าว ติ๊กหมวด รูป และช่วงเด่น "ส่งสำเร็จ"

**Files:**
- Modify: `apps/web/src/app/features/report-new/report-new.page.ts` (`go`, `pickCategory`), `report-new.page.html`, `report-new.page.scss` (`.seg`, สลับขั้น), `category-step.component.{ts,scss}`, `photo-step.component.*` (ดูชื่อไฟล์จริง: thumbnail เข้า/ออก/สถานะ), `sent-card.component.{ts,scss}`, `details-section.component.{html,scss}` (สวิตช์ซ่อนชื่อ + เรดิโอระดับ), `_flow.scss`
- Test: `report-new.page.spec.ts`, `sent-card.component.spec.ts` (สร้างถ้ายังไม่มี)

**Interfaces:**
- Produces: `ReportNewPage.pickCategory(c)` ตั้ง `picking = c.slug` (signal) แล้วเรียก `go(3)` หลัง 220 ms เฉพาะเมื่อ `picking` ยังเป็นค่าเดิม, `view() === 'flow'` และ `step() === 2`; `go()` ตั้งทิศ `dir = 'fwd'|'back'` (signal) ให้ CSS เลือก slide

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** (fake timers): `pickCategory(c)` ตั้งหมวดทันทีแต่ `step()` ยัง 2 จน 220 ms; กด `pickCategory` ซ้ำใน 220 ms → `go(3)` ครั้งเดียว; `backOrClose()` ระหว่างหน่วง → ไม่ไปขั้น 3 หลังครบเวลา; `go(3)` ตั้ง `dir='fwd'`, `go(1)` จากขั้น 2 ตั้ง `dir='back'`; sent-card: มี `<app-tick>` ที่ `play=true`, `h2` ยังเป็นเป้าโฟกัสของ `ionViewDidEnter`
- [ ] **Step 2: รันให้ล้ม**
- [ ] **Step 3: ทำ**
  - ก้าว: เนื้อหาขั้นใหม่เลื่อนเข้า 24px จากทิศ `dir` พร้อม fade (อย่างอื่นของการ์ด `.card` ไม่ขยับ), `.seg.done` เติมสีจากซ้ายไปขวา (transform scaleX 320ms), `.seg.now` กำลังเติมครึ่งหนึ่ง
  - ขั้น 2: การ์ดหมวดที่เลือกได้ `settle` + `<app-tick>` มุมการ์ดวาด 220 ms (เป็นสิ่งที่หน่วงรอ)
  - ขั้น 1: รูปที่เลือกเข้ามา `pop`, กำลังอัปโหลด = วงแหวนความคืบหน้าหมุน, เสร็จ = ติ๊ก `settle`, ลบ = `leave` + `collapse`; รูปผิดพลาดสั่นแนวนอน 2 ครั้ง (translateX ±4px 280ms)
  - ขั้น 3: ปุ่มส่งขณะ `aria-busy=true` มีแถบ `sheen` กวาด; สวิตช์ซ่อนชื่อ (checkbox role=switch): knob ยืดขณะเลื่อน (scaleX 1.25 กลางทาง) แล้วหดกลับ, พื้นรางกวาดสีจากด้านที่เลื่อนไป, ไอคอนเล็กในลูกบิดสลับ ✓/– (วาดจาก `<app-tick>` หรือเส้นขีด SVG ไม่ใช้อักษร); เรดิโอระดับ: ตัวเลือกที่เลือก `settle` และวงขอบเปลี่ยนสีด้วย transition
  - **ช่วงเด่น sent-card (≈1.1 วินาที):** วงแหวนรอบดิสก์วาดเส้นรอบ (stroke-dashoffset 0–500ms) → `<app-tick>` วาด (250–530ms) → ลำแสง 3px ขึ้นจากดิสก์ 56px แล้วจาง (400–900ms ภาษาเดียวกับ intro) + `burst(disc, { count: 10, radius: 44 })` ตอน 400ms → h2, lede, ปุ่ม ลอยขึ้นตามลำดับ (`rise`, หน่วง 350/410/470ms)
- [ ] **Step 4: รันทั้งชุดให้ผ่าน** แล้วตรวจด้วยตา: ทำ flow ครบ 3 ขั้นด้วยรูปทดสอบ (เดสก์ท็อปและ 375 px) และกด back กลางขั้น
- [ ] **Step 5: Commit** · `feat(web): report flow motion and the sent moment`

---

### Task 5: การเลือกทุกชนิดมีจังหวะเลือก (ชิป สวิตช์ เรดิโอ เช็กบ็อกซ์)

**Files:**
- Modify: `apps/web/src/app/shared/choice.scss` (ใช้ร่วมกับ theme/language choice), `features/map/filter-bar.component.ts` (ชิประดับ), `features/map/filters-panel.component.{ts,scss}` (หมวดและสวิตช์), `features/list/list.page.{html,scss}` (sort radio `[aria-checked]` และ checkbox `.old`), `features/report-detail/flag-form.component.ts` (เรดิโอเหตุผล), `features/admin/review-queue.component.{html,scss}` (`.pick`, ระดับ, ตำแหน่ง, เหตุผล), `features/admin/_admin.scss` (`[aria-checked]`)
- Test: `apps/web/src/theme/theme.spec.ts` (ครอบสไตล์ไม่มี reduced-motion และ keyframe ที่ใช้มีจริง), spec ของ filter-bar ที่มี

**Interfaces:**
- Consumes: `settle`, `--pop`, `<app-tick>`, `@include press` จาก Task 1
- Produces: partial `shared/_selectable.scss` ที่ export mixin `@mixin selectable($fill)`: ตัวเลือกที่ `[aria-pressed=true]`/`[aria-checked=true]` ได้พื้นกวาดจากซ้าย (pseudo `::before` `transform: scaleX` 240ms EASE), `settle` ครั้งเดียวตอนเปลี่ยนเป็นเลือก, `:active` = `press`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** (`theme.spec.ts`): สแกน `.scss` ที่ import `selectable` ทุกไฟล์ไม่มี `transition: all`; ชิประดับที่ปิดอยู่ (`aria-pressed=false`) ยังขีดฆ่า/จางตามเดิม (spec ของ filter-bar มีอยู่แล้ว รันให้ผ่านโดยไม่แก้เพื่อกันถดถอย)
- [ ] **Step 2: รันให้ล้ม**
- [ ] **Step 3: ทำ** mixin และใช้กับทุกจุดใน Files; ช่อง `.old` ของ `/list` เปลี่ยนเป็นช่องติ๊กที่วาดเอง (native checkbox ซ่อนด้วย `.sr-only`-style แบบเข้าถึงได้, กล่องวาด ✓ ด้วย `<app-tick>` เมื่อ checked) แป้นพิมพ์: โฟกัสวง `:focus-visible` ยังเห็นชัด; ชิประดับ: ตอนปิดชิปให้ "หมดแรง" (หด 0.96 + ขีดฆ่าไหลจากซ้าย 200ms) ตอนเปิดคืนกลับ `settle`
- [ ] **Step 4: รันทั้งชุดให้ผ่าน** แล้วตรวจด้วยตา: ไล่กดทุกตัวเลือกบน `/`, `/list`, `/report` ขั้น 3, `/admin` คิวตรวจ, ฟอร์มแจ้งปัญหา ทั้ง pointer และแป้นพิมพ์
- [ ] **Step 5: Commit** · `feat(web): choosing feels alive (chips, switches, radios, checkboxes)`

---

### Task 6: panel รายละเอียด รูป ความคิดเห็น

**Files:**
- Modify: `apps/web/src/app/features/map/map.page.{ts,html,scss}` (`close()`, `@if (id())` ด้านกว้าง, `panel-in` ~บรรทัด 661), `features/report-detail/report-detail.component.{html,scss,ts}` (gallery, skeleton, ความคิดเห็น, composer, ฟอร์ม fix/flag), `features/report-detail/fix-claim-form.component.ts`, `flag-form.component.ts`, `shared/fade-in.directive.ts` (สร้างใหม่)
- Test: `map.page.spec.ts` (ถ้ามีอยู่; หรือสร้าง `map-panel.spec.ts`), `report-detail.component.spec.ts`, `shared/fade-in.directive.spec.ts`

**Interfaces:**
- Produces: `FadeInDirective` selector `img[appFadeIn]` — ตั้ง `data-loaded` เมื่อ `load` (หรือ `complete` ตอนเริ่ม) ให้ CSS ทำ blur 8px→0 + opacity 420ms; `MapPage.panelLeaving = signal<string | null>(null)` — ด้านกว้าง `close()` ตั้งค่านี้ รอ `leave()` ของ panel 200 ms ค่อย navigate/ล้าง `id`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม:** `close()` ด้านกว้างตั้ง `panelLeaving` ทันทีและล้างหลัง `leave()` resolve; `openReport(B)` ระหว่างที่ A กำลังออก → panel B แสดงทันที `panelLeaving` เป็น null ไม่มีสอง panel (`querySelectorAll('.panel').length === 1`); `this.closing` ถูกล้างเมื่อ navigate ไม่สำเร็จ (รายการค้างของแผน 3); `FadeInDirective`: รูป `complete` ตอนเริ่ม → `data-loaded` ทันที, รูปที่ยังไม่เสร็จ → ตั้งหลัง event `load`, `error` → ตั้งด้วย (ไม่ค้างโปร่งใส)
- [ ] **Step 2: รันให้ล้ม**
- [ ] **Step 3: ทำ**
  - ทางออกของ panel ด้านกว้าง (เลื่อนออก 16px + fade 200ms) ส่วน bottom sheet ใช้ของ Ionic อยู่แล้ว
  - เปลี่ยนเรื่อง A→B ขณะเปิดอยู่: เนื้อหาใน `app-report-detail` เฟดเข้า 240ms (`rise` เบา)
  - รูปในแกลเลอรีใช้ `appFadeIn` + ที่ว่างเป็น skeleton `shimmer` (ใช้ `[attr.width/height]` ที่มีอยู่กัน layout กระโดด); สถานะ loading ของ detail ใช้ skeleton ของ tag/ข้อความแทนข้อความ "กำลังโหลด" อย่างเดียว (คงข้อความไว้ให้ screen reader)
  - ความคิดเห็นใหม่ (ของเรา/ realtime) เลื่อนเข้าจากล่าง 12px และมีแสงพื้นจาง 1.2s (`--pri` 14%→0); ปุ่มส่ง: ไอคอนบินขึ้นขวา+จางแล้วกลับเป็นไอคอนเดิม, textarea ล้างพร้อม `settle` ของตัวนับ
  - ฟอร์ม fix/flag เมื่อ `done`: ฟอร์มพับ (`collapse`) แล้วข้อความขอบคุณมี `<app-tick>` วาด
  - แก้ `aria-labelledby` ระหว่างโหลด (รายการค้างแผน 3) โดยให้ `h2` placeholder ตัวซ่อนมี id `report-detail-title` ตลอด
- [ ] **Step 4: รันทั้งชุดให้ผ่าน** แล้วตรวจด้วยตา: เปิด/ปิด/สลับเรื่องรัวๆ บนเดสก์ท็อป และบน 375 px ส่งคอมเมนต์ แจ้งปัญหา
- [ ] **Step 5: Commit** · `feat(web): detail panel exit, photo fade, comment arrival`

---

### Task 7: Toast สถานะ ปุ่มทำงาน และสถานะว่าง

**Files:**
- Modify: `apps/web/src/app/features/map/map.page.{ts,html,scss}` (toast ~บรรทัด 156-163, `showToast` ~461), `apps/web/src/theme/glass.scss` (`.btn[aria-busy='true']`), `features/list/list.page.{html,scss}` (skeleton แถว, ว่าง/ผิดพลาด), `features/map/stats-line*.ts` (skeleton ตัวเลข), `features/me/me.page.*` (ว่าง/โหลด), `shared/` ที่เป็นสถานะว่าง/ผิดพลาด
- Test: `map.page.spec.ts` (toast), `list.page.spec.ts`

**Interfaces:**
- Produces: `MapPage.toastLeaving = signal(false)` — ปิด toast: เล่น `leave` 180ms ก่อนล้าง; toast ที่มีปุ่มแสดงแถบเวลาถอยหลัง `--ms` (ACTION_TOAST_MS) ด้านล่างด้วย `transform: scaleX` linear (ไม่ใช่ EASE เพราะเป็นเวลา)

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** (fake timers): `showToast` สองครั้งต่อเนื่อง → toast ใหม่แทนทันทีไม่ซ้อน `toastLeaving` เป็น false; ครบเวลา → `toastLeaving` true แล้ว 180ms ค่อย `toast()` เป็น null; กดปุ่ม action ระหว่างออก ยังทำงานครั้งเดียว
- [ ] **Step 2: รันให้ล้ม**
- [ ] **Step 3: ทำ** toast เข้าจากล่าง 12px+blur (เหมือน `rise`) ออกด้วย `leave`; ปุ่ม `.btn[aria-busy=true]` เป็นแถบ `sheen` กวาดซ้ำ (หยุดเมื่อ `aria-busy` หาย) ใช้กับปุ่มส่งเรื่อง/ล็อกอิน/ส่งคอมเมนต์/แอดมิน; สถานะว่างและผิดพลาดของ `/list`, `/me`: ไอคอนลอยขึ้นลง 6px ช้าๆ ไม่เกิน 3 รอบแล้วหยุด (ไม่วนไม่สิ้นสุด); skeleton ของแถว `/list` ขณะโหลดครั้งแรกและตอน "ดูเพิ่มอีก"
- [ ] **Step 4: รันทั้งชุดให้ผ่าน** แล้วตรวจด้วยตา (บังคับ toast ด้วยการปิดอินเทอร์เน็ตของ API ชั่วคราวหรือกดตำแหน่งที่ถูกปฏิเสธ)
- [ ] **Step 5: Commit** · `feat(web): toast, busy buttons, skeletons`

---

### Task 8: ล็อกอิน บัญชี ธีม ภาษา

**Files:**
- Modify: `apps/web/src/app/features/auth/login-form.component.{ts,scss}`, `features/auth/account-button.component.ts` (เมนูบัญชี), `features/auth/login-prompt.service.ts` (แผ่นล็อกอิน), `shared/theme-choice.component.ts`, `shared/language-choice.component.ts`, `shared/language-toggle*.ts`, `core/theme.service.ts` (ชื่อไฟล์จริงตรวจก่อนแก้), `features/me/me.page.*` (แถวเรื่อง, ชิปสถานะ)
- Test: `theme.service.spec.ts` (ถ้ามี), `theme-choice.component.spec.ts`, `login-form.component.spec.ts`

**Interfaces:**
- Consumes: `viewTransition()`, `<app-tick>`
- Produces: `ThemeService.set(choice, origin?: { x: number; y: number })` — ค่าใหม่ถูกตั้งภายใน `viewTransition(...)`; ไม่ส่ง `origin` = กึ่งกลางหน้าจอ

- [ ] **Step 1: เขียนเทสต์ที่ล้ม:** `ThemeService.set('light')` ในสภาพ `viewTransition` ถูก stub ให้ปฏิเสธ → ธีมยังเปลี่ยน (Review Focus ข้อ 5); เรียกสองครั้งเร็วๆ ได้ค่าสุดท้ายถูก (ครั้งแรกถูกข้ามได้); `theme-choice` ส่งพิกัดกึ่งกลางปุ่มที่กด; `login-form`: เมื่อยืนยันรหัสสำเร็จมี `<app-tick>` ก่อนปิดแผ่น (ปิดหลัง ≥ 400ms ไม่ใช่ทันที)
- [ ] **Step 2: รันให้ล้ม**
- [ ] **Step 3: ทำ** ธีม: วงกลมกางจากปุ่ม 520ms EASE (`::view-transition-old(root)` ไม่ animate, `new(root)` ใช้ `clip-path: circle(0 at x y) → circle(150vmax ...)` ผ่านตัวแปร CSS ที่ตั้งก่อนเรียก); ภาษา: crossfade 200ms ผ่าน `viewTransition` ไม่มี origin; ช่อง OTP 6 หลัก: หลักที่พิมพ์ `settle`, ผิด = สั่นแนวนอนทั้งแถว 2 ครั้ง, ถูก = หลักทั้งหมดเปลี่ยนเขียว/สี pri พร้อมติ๊กแล้วแผ่นปิด; เมนูบัญชีโผล่ด้วยการขยายจากปุ่ม (`transform-origin` ที่ปุ่ม, scale 0.92→1 + fade); ชิปสถานะใน `/me` เมื่อเปลี่ยนจากข้อมูลสดให้ `settle`; แถวเรื่อง `/me` เข้าด้วย `rise` เหลื่อม 30ms (ตามแถวใน `/list`)
- [ ] **Step 4: รันทั้งชุดให้ผ่าน** + `impeccable detect --json` บนไฟล์ UI ที่แก้ใน Task 1–8 (ครั้งเดียว) แก้ที่รายงานตามกฎ (ยกเว้นข้อเสนอเรื่อง reduced-motion ที่เจ้าของห้ามไว้)
- [ ] **Step 5: ตรวจด้วยตา:** สลับธีมจากแท็บ `/about` และจาก `/me`, ภาษา, ล็อกอินด้วย Mailpit (OTP จริง) ที่ 375 px
- [ ] **Step 6: Commit** · `feat(web): login tick, account menu, theme reveal`

---

### Task 9: แอดมิน

**Files:**
- Modify: `apps/web/src/app/features/admin/admin.page.{ts,scss}` (แท็บ), `review-queue.component.{ts,html,scss}`, `claims-queue.component.ts`, `flags-queue.component.ts`, `users-tab.component.ts`, `log-tab.component.ts`, `_admin.scss`
- Test: `review-queue.component.spec.ts`, `claims-queue.component.spec.ts`

**Interfaces:**
- Consumes: `collapse()`, `<app-tick>`, `burst()`, `leave()`
- Produces: การ์ดคิวหลังตอบ API สำเร็จเรียก `await this.playDone(el, kind: 'approve' | 'reject')` (ใน component ของคิวนั้น) ก่อนลบรายการออกจาก signal

- [ ] **Step 1: เขียนเทสต์ที่ล้ม:** อนุมัติสำเร็จ → รายการยังอยู่ใน DOM จนกว่า `playDone` resolve แล้วจึงหายจากรายการ (ใน jsdom `collapse` resolve ทันที จึงเทสต์ลำดับผ่านการ spy); API ล้ม → ไม่เล่น `playDone` รายการอยู่ครบ และมีข้อความผิดพลาด; อนุมัติสองครั้งเร็วๆ ส่ง API ครั้งเดียว; รายการสุดท้ายถูกอนุมัติ → สถานะว่าง "ไม่มีงานค้าง" โผล่ด้วย `rise`
- [ ] **Step 2: รันให้ล้ม**
- [ ] **Step 3: ทำ** อนุมัติ: การ์ดแสดง `<app-tick>` เต็มบนแผ่นสี pri จางทับ 360ms + `burst` ที่ปุ่ม → `collapse`; ปฏิเสธ/dismiss: การ์ดเลื่อนออกด้านข้าง 24px + `collapse` (ไม่มี burst); ตัวเลขนับงานค้างในแท็บใช้ `<app-roll>`; ตัวระบุแท็บที่เลือกเป็นขีดล่างที่เลื่อนไปหาแท็บใหม่ (FLIP ด้วย transform บนองค์ประกอบเดียว); เปลี่ยนแท็บ: เนื้อหาเฟด 200ms
- [ ] **Step 4: รันทั้งชุดให้ผ่าน** แล้วตรวจด้วยตา: คิวตรวจจริงด้วยข้อมูลเดโม (สร้างเรื่องใหม่แล้วอนุมัติ/ปฏิเสธ)
- [ ] **Step 5: Commit** · `feat(web): admin approve/reject motion`

---

### Task 10: งบประสิทธิภาพและตรวจเข้ากับกฎ

**Files:**
- Create: `scripts/measure-frames.mjs` (สคริปต์ฉีดผ่าน `javascript_tool`/Playwright ใน Task 13 ก็ใช้ได้: วัดเวลาต่อเฟรมด้วย `requestAnimationFrame` ช่วง N วินาที คืน p50/p95/max และจำนวนเฟรม > 24 ms)
- Modify: ไฟล์ SCSS/TS ที่พบปัญหา; `docs/superpowers/plans/2026-10-21-08-polish-motion.md` (ผลวัดท้ายแผน)

- [ ] **Step 1:** เปิดแผนที่ (เดสก์ท็อป 1280×800 และ 375×812 emulated) วัด 5 วินาทีว่างและ 5 วินาทีระหว่างกดเจอเหมือนกัน 5 ครั้ง + เปลี่ยนธีม + ส่งเรื่อง เทียบกับค่าฐานที่วัดไว้ก่อนเริ่ม Task 2 (วัดชุดเดียวกันบน branch ที่ยังไม่มีแอนิเมชันใหม่ แล้วบันทึกตัวเลขท้ายแผน): เกณฑ์ p95 ไม่แย่ลงเกิน 4 ms และไม่มีเฟรม > 50 ms ที่เกิดจากแอนิเมชันใหม่
- [ ] **Step 2:** สแกนว่าไม่มี animation ใหม่ที่ `infinite` นอกจาก `shimmer`/`sheen` และทั้งสองหยุดเมื่อสถานะ busy/loading หมด: `grep -rn "infinite" apps/web/src` ต้องมีเฉพาะที่ระบุ
- [ ] **Step 2b: MotionScore audit** ด้วยสกิล `/motion` (หมวด performance-audit) ให้ agent `motion-reviewer` (อ่านอย่างเดียว ไม่ใช่งานลงมือเขียน จึงไม่ขัดกฎ "ลงมือเอง") ตรวจ `apps/web/src/app` และ `apps/web/src/theme` แล้วรายงานระดับ MotionScore ต่อไฟล์ แก้ทุกจุดที่ได้ระดับต่ำ (jank/layout thrash) ถ้าการตรวจเป็นของ Motion+ แล้วถูกปฏิเสธ ให้ข้าม ใช้ผลวัดเฟรมของ Step 1 แทนและบันทึกว่าข้ามเพราะอะไร ตรวจขนาด bundle ด้วย `ng build` ว่า `motion` เพิ่มไม่เกิน ~25 KB gzip ในชุดแรกที่โหลด (เกินให้ย้ายไป `motion/mini` หรือ lazy-load ส่วน burst/leave)
- [ ] **Step 3:** แก้ตามผลวัด (เช่น ลด `blur` ของ rise บน panel ใหญ่, ใส่ `contain: paint` ให้องค์ประกอบที่ animate) บันทึกผลวัดไว้ท้ายแผน
- [ ] **Step 4: Commit** · `perf(web): motion budget measured`

---

### Task 11: ขัดเกลา — harden และงานเล็กที่ยกมา (เฉพาะรายการนี้)

**Files:** ตามรายการ (แต่ละข้อมี spec/เทสต์ของมันเอง; อ่านเฉพาะไฟล์ที่เกี่ยว)
- `docker-compose.yml`/`apps/web`/`apps/api` `package.json`: ตรึง `nodemon` เป็น devDependency และไม่รัน `npm ci` ทุกครั้งที่ container สตาร์ต (รันเมื่อ `package-lock.json` เปลี่ยนเท่านั้น)
- `apps/api/src/routes/*` : `void broadcast()` เติม `.catch(log)`; อ่านความคิดเห็นกลับหลัง insert ไม่ได้ → ตอบ 201 ด้วยข้อมูลจากการ insert (ไม่ใช่ 500)
- `core/auth.service.ts`: ไม่โหลด profile ซ้ำสองรอบตอนเริ่มและตอน `TOKEN_REFRESHED`; `verifyOtp` แยกข้อความรหัสผิด (400) ออกจากข้อผิดพลาดอื่น
- Caddy `:8100`: `index.html` ผ่าน deep link ได้ `Cache-Control: no-cache`; แถบ "มีเวอร์ชันใหม่" มีปุ่มปิด
- แผงตัวกรองเพิ่มเติม: `aria-modal` + กัก Tab; ปุ่มหลักที่ disabled คอนทราสต์ตัวอักษรผ่าน AA; `.status:empty` ไม่มี padding/border
- `/list`: "ดูเพิ่มอีก" กรองซ้ำตาม id; โหลดหน้าถัดไปล้มแล้วรายการที่แสดงไม่หาย; ตัวเลขหัวเป็น "50+" เมื่อยังมีหน้าถัดไป
- เบราว์เซอร์ Back จาก `/report` ไป `/r/:id` ไม่สร้างหน้าแผนที่ที่สอง; tooltip แผนที่ใช้ `_thumb.webp`

- [ ] **Step 1: เขียนเทสต์ที่ล้มสำหรับแต่ละข้อ** (ข้อละหนึ่งเทสต์ในไฟล์ spec ที่ใกล้ที่สุด; เช่น API: broadcast ล้มแล้วคำขอยังสำเร็จและมี log, `/list`: สองหน้าที่ทับกันไม่ได้แถวซ้ำ) รันให้ล้ม
- [ ] **Step 2: แก้ทีละข้อให้ผ่าน** รันชุดที่เกี่ยวหลังแต่ละข้อ ข้อไหนเกินขนาด (เช่น Back สร้างแผนที่ที่สองต้องแก้ route strategy ใหญ่) ให้ข้ามและย้ายกลับ roadmap พร้อมเหตุผล ไม่ขยายแผน
- [ ] **Step 3:** อัปเดต roadmap หัวข้อ "แผน 8" ขีดฆ่าข้อที่แก้
- [ ] **Step 4: รัน `bash scripts/test.sh` ทั้งชุด** (ข้อนี้แตะ API/Caddy) ผ่านทั้งหมด
- [ ] **Step 5: Commit แยกตามกลุ่ม** (web / api / infra) · `fix: carried-over small items from plans 3–7`

---

### Task 12: Impeccable audit → harden → clarify → polish

**Files:** ตามที่ audit พบ; ข้อความไทย/อังกฤษใน `i18n/th.ts`, `en.ts`

- [ ] **Step 1: `/impeccable audit`** หน้า `/`, `/list`, `/r/:id`, `/report`, `/me`, `/admin`, `/about`, `/login` ที่ 375 px และเดสก์ท็อป ธีมมืด/สว่าง บันทึกข้อค้นพบลง `docs/design/audit-plan-8.md` จัดลำดับ P0–P3 (ตัดข้อที่ขอ `prefers-reduced-motion` ตามกฎเจ้าของ)
- [ ] **Step 2: แก้ P0–P1** ด้วย `/impeccable harden` (ข้อผิดพลาด, สองภาษา, กรณีขอบ: ชื่อยาว/ข้อความอังกฤษยาวที่ 375 px, ไม่มีรูป, ออฟไลน์) และ `/impeccable clarify` (น้ำเสียงเพื่อนบ้านใจดี: ข้อความผิดพลาด, ว่าง, ปุ่ม) ทีละหน้า เพิ่มเทสต์เมื่อแก้พฤติกรรม ไม่ใช่แค่ข้อความ
- [ ] **Step 3: `/impeccable polish`** ปิดท้าย แล้ว `impeccable detect --json` บนไฟล์ UI ทั้งหมดที่แก้ในแผนนี้ สะอาดจึงผ่าน (ครั้งเดียวต่อกลุ่ม)
- [ ] **Step 4:** รัน `docker compose exec -T web npx ng test --watch=false` ผ่าน แล้ว Commit แยกเป็น harden / clarify / polish · `polish: …`

---

### Task 13: Playwright E2E (ฉากเดโม 1–6 บนเดสก์ท็อปและ 375×812)

**Files:**
- Create: `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/tests/demo.spec.ts`, `e2e/tests/helpers.ts`, `e2e/fixtures/report.jpg` (รูปทดสอบ CC0 ที่มีอยู่ใน seed — คัดลอกจากไฟล์ seed ที่มี ไม่ดึงจากอินเทอร์เน็ต), `scripts/e2e.sh`
- Modify: `.gitignore` (`e2e/node_modules`, `e2e/test-results`, `e2e/playwright-report`), `scripts/test.sh` (ไม่ต่อท้ายอัตโนมัติ: ใช้ `E2E=1 bash scripts/test.sh` ค่อยรัน)

**Interfaces:**
- Produces: `bash scripts/e2e.sh [--project desktop|mobile]` — `reset-db.sh` แล้วรัน Playwright ใน `mcr.microsoft.com/playwright:v<ตรึงตรงกับ @playwright/test>-noble` ด้วย `--network host --ipc host --dns 1.1.1.1 --dns 8.8.8.8` ชี้ `BASE_URL=http://localhost:8000` ถ้า `--network host` เข้า localhost ของ WSL ไม่ได้ ให้ลอง `host.docker.internal` แล้วบันทึกที่ใช้ได้ไว้ใน `scripts/e2e.sh`
- helpers: `loginAs(page, 'member' | 'admin')` ใช้ปุ่มสลับผู้ใช้เดโม (quick login ทำงานเฉพาะ host `localhost`)

- [ ] **Step 1: สร้างโปรเจกต์ `e2e/`** ตรึงเวอร์ชัน `@playwright/test` ตรงตัว; config 2 projects: `desktop` (1280×800) และ `mobile` (375×812, `hasTouch`, `isMobile`), `workers: 1`, `retries: 0`, `video: 'retain-on-failure'`, `trace: 'retain-on-failure'`
- [ ] **Step 2: เขียน `demo.spec.ts` (ล้มก่อนถ้าแอปทำไม่ได้)** ตามฉากในสเปก 1.1/PRODUCT.md ทีละ `test.step`: (1) เปิด `/` ข้าม intro เห็นแผนที่ มีลำแสงอย่างน้อย 1 อัน (`.beacon .disc` ที่มี aria-label); (2) ซูมถึงถนน (ปุ่ม + หรือค้นสถานที่) แผนที่ปกติโผล่ (ตรวจ `map.getZoom()` ผ่านตัวช่วยที่แอปเปิดไว้ถ้ามี ไม่มีให้ตรวจ DOM ของ marker แบบเต็ม); (3) ล็อกอินสมาชิก → `/report` อัปโหลด `report.jpg` → เลือกหมวด → ปักหมุด (ซูมเข้า) → ส่ง → เห็น sent-card; (4) ล็อกอินแอดมิน → `/admin` อนุมัติเรื่องนั้น → กลับแผนที่เห็นลำแสงของเรื่องใหม่; (5) สมาชิกกดเจอเหมือนกัน → ตัวเลขเพิ่ม และ `data-fx='bump'` เคยโผล่ (ตรวจด้วย `page.waitForFunction` หรือ MutationObserver ที่ฉีดไว้); แจ้งแก้ → แอดมินอนุมัติ → marker เป็น `st-claimed`; แอดมินยืนยัน → `st-done`; (6) สลับภาษาเป็น English ข้อความหลักเปลี่ยน สลับกลับ
- [ ] **Step 3: รันให้ล้ม/ผ่านตามจริง** `bash scripts/e2e.sh` แก้เฉพาะเมื่อพบบั๊กจริงในแอป (บันทึกและแก้ + เทสต์หน่วยคู่กัน) ไม่ใช่ทำให้เทสต์หลวม; ทั้งสอง project ต้องผ่านเกิน 3 รอบติดกันโดยไม่ flaky (ใช้ locator ตามบทบาท/aria-label ไม่ใช้ timeout คงที่)
- [ ] **Step 4:** เก็บภาพหน้าจอสำคัญ 8 ภาพ (แผนที่, รายละเอียด, flow 3 ขั้น, sent, admin, 2 ธีม) ไว้ที่ `e2e/test-results` เพื่อดูด้วยตา (ไม่ commit)
- [ ] **Step 5: Commit** · `test(e2e): demo scenario on desktop and 375x812`

---

### Task 14: เช็กลิสต์เดโม ปิดแผน

**Files:**
- Create: `docs/demo-checklist.md`
- Modify: `docs/superpowers/plans/2026-10-16-00-roadmap.md` (แถวแผน 8 + หัวข้อ "แผน 8" ที่ยังไม่ได้ทำ), แผนนี้ (ผลตรวจท้ายแผน), `DESIGN.md` (ถ้า Motion เปลี่ยนจากที่เขียนใน Task 1)

- [ ] **Step 1: เขียน `docs/demo-checklist.md`** (ภาษาไทย): ก่อนเดโม (WSL keep-alive, `dev-up.sh`, `reset-db.sh`, เปิด Mailpit :54324, tunnel/LAN, ติดตั้ง APK ล่าสุด, ชาร์จ/ปิดโหมดประหยัดไฟ, ตั้ง server ในแอป), สคริปต์พูด 7 ขั้น (ขั้นละ 1–2 บรรทัด: ทำอะไร เห็นอะไร มี animation ตรงไหน), ถ้าพังทำอย่างไร (อินเทอร์เน็ตหลุด, GPS ไม่ขึ้น, OTP ไม่มา, ไฟล์ใหญ่), รายการที่ต้องตรวจบนมือถือจริงโดยเจ้าของ (4 รูปจากกล้อง, iOS/HEIC ถ้ามี, ลำแสงลื่นไหมตอนกดเจอเหมือนกัน, ธีมกางวงกลมบน WebView, ปุ่ม back)
- [ ] **Step 2: รัน `bash scripts/test.sh` ทั้งชุด** (ห้ามรันพร้อม Playwright) ผ่านทั้งหมด และ `bash scripts/e2e.sh` ผ่านแยกอีกครั้ง
- [ ] **Step 3: อัปเดต roadmap + ผลตรวจท้ายแผน** (สิ่งที่ทำ/ไม่ได้ทำ/ย้ายออก, ผลวัดเฟรม) ตั้งสถานะ "เสร็จ รอเจ้าของซ้อมบนมือถือจริงและอนุญาต merge"
- [ ] **Step 4: รีวิวทั้ง branch** ด้วย `superpowers:requesting-code-review` แก้ข้อที่สำคัญ
- [ ] **Step 5: Commit** · `docs: demo checklist, plan 8 results` แล้วถามเจ้าของก่อน merge (ไม่ merge เอง)

---

## ตรวจแผนกับสเปก (self-review)

- สเปก 7.5: audit/harden/clarify/polish → Task 12; E2E → Task 13; `docs/demo-checklist.md` → Task 14; ซ้อมบนมือถือ → เป็นของเจ้าของ (ระบุใน checklist, ไม่ใช่งานของแผน)
- คำขอของเจ้าของเรื่องแอนิเมชัน: ติ๊กถูก → Task 1, 2, 4, 5, 6, 8, 9; ลำแสง → Task 3; ช่วงเด่น → Task 4 (ส่งสำเร็จ) และ Task 3; ทั่วแอป → Task 5–9
- ชื่อที่ใช้ข้าม Task สม่ำเสมอ: `burst`, `leave`, `collapse`, `viewTransition`, `POP_SPRING`, `springIn`, `<app-tick>`, `<app-roll>`, `rollDigits`, `data-fx`, `settle`/`ping`/`sheen`/`shimmer`
