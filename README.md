# แจ้ง

เว็บแอปแจ้งปัญหาในชุมชน ทุกเรื่องที่แจ้งจะขึ้นบนแผนที่ประเทศไทยเป็นสัญญาณไฟแบบ Bat-Signal คนในละแวกกด "เจอเหมือนกัน" แสดงความคิดเห็น และติดตามได้ว่าเรื่องนั้นแก้แล้วหรือยัง

ชื่อ "แจ้ง" แปลได้ทั้ง *แจ้งเรื่อง* และ *สว่าง*

## เอกสาร

- [เอกสารออกแบบ (Design Spec)](docs/superpowers/specs/2026-10-16-jaeng-design.md) เป็นแหล่งอ้างอิงหลักของทุกเรื่อง
- [ต้นแบบหน้าตาแผนที่ไทย](docs/prototype/thai-map-v2.html) เปิดในเบราว์เซอร์ได้เลย
- [แผนภาพรวม (Roadmap)](docs/superpowers/plans/2026-10-16-00-roadmap.md) และ [แผน 1: Foundation](docs/superpowers/plans/2026-10-16-01-foundation.md)
- [PRODUCT.md](PRODUCT.md) ข้อมูลผลิตภัณฑ์สำหรับ Impeccable (skill ออกแบบ UI)

## สแต็ก

Angular + Ionic + Capacitor (APK สำหรับ Android) · Elysia (Bun) · Supabase (Postgres/PostGIS, Auth, Storage, Realtime) · MapLibre GL · Caddy · Docker ใน WSL2

## เริ่มใช้งาน

ทุกคำสั่งรันใน WSL (Ubuntu) ที่โฟลเดอร์ `/mnt/d/Project/Jaeng` และต้องใช้ Node ของ Linux ใน WSL ไม่ใช่ Node ของ Windows

ติดตั้งครั้งแรก:

1. Node 22 ของ Linux ไว้ที่ `~/.local/node` และเพิ่ม `export PATH="$HOME/.local/node/bin:$PATH"` ใน `~/.bashrc`
2. Docker Compose v2+ เป็น CLI plugin ที่ `~/.docker/cli-plugins/docker-compose` (หรือติดตั้งด้วย `sudo apt install docker-compose-v2`)
3. `npm install` เพื่อติดตั้ง Supabase CLI ในโปรเจ็กต์
4. `bash scripts/check-tools.sh` ต้องขึ้น ✓ ทุกบรรทัด

รันทุกวัน:

```bash
bash scripts/dev-up.sh
```

แอปอยู่ที่ http://localhost:8000 · Mailpit (อีเมล OTP) อยู่ที่ http://localhost:54324 · Supabase Studio ปิดไว้เพื่อประหยัดแรม (เปิดได้ที่ `[studio] enabled` ใน `supabase/config.toml` แล้วจะอยู่ที่ http://localhost:54323)

```bash
bash scripts/dev-down.sh
```

ล้างฐานข้อมูลแล้วใส่ข้อมูลเดโม 40 เรื่องใหม่:

```bash
bash scripts/reset-db.sh
```

รันเทสต์ทั้งหมด:

```bash
bash scripts/test.sh
```

บัญชีเดโม: `admin@jaeng.local` (แอดมิน), `reporter@jaeng.local` และ `neighbor1@jaeng.local` ถึง `neighbor40@jaeng.local` ทุกบัญชีใช้รหัสผ่าน `DEMO_PASSWORD` ใน `.env` ซึ่ง `scripts/gen-env.sh` สุ่มให้ต่อเครื่อง (เพราะมือถือต่อเซิร์ฟเวอร์นี้ผ่าน LAN) และเก็บค่าเดิมไว้ทุกครั้งที่รันซ้ำ ถ้า `gen-env.sh` บอกว่าสุ่มรหัสใหม่ ให้รัน `bash scripts/reset-db.sh` หนึ่งครั้งเพื่อสร้างผู้ใช้เดโมด้วยรหัสนั้น

### อีเมลรหัสเข้าใช้

รหัส OTP ส่งผ่าน Resend จากโดเมน `bkungbk.online` (ผู้ส่ง `noreply@bkungbk.online`) ตั้งไว้ใน `[auth.email.smtp]` ของ `supabase/config.toml` คีย์อยู่ใน `supabase/.env` บรรทัด `RESEND_API_KEY=...` (ไฟล์นี้อยู่ใน `.gitignore` และ `gen-env.sh` ไม่แตะ)

ตอนพัฒนาไม่อยากส่งอีเมลจริง ให้สลับไปใช้ Mailpit แล้วเริ่มสแตกใหม่:

```bash
bash scripts/mail-mode.sh mailpit
bash scripts/dev-up.sh
```

`bash scripts/mail-mode.sh resend` สลับกลับ และ `bash scripts/mail-mode.sh status` ดูโหมดปัจจุบัน · แผนฟรีของ Resend ส่งได้วันละ 100 ฉบับ (ตรวจที่ resend.com/pricing) และ `[auth.rate_limit] email_sent` ใน `config.toml` จำกัด 100 ฉบับต่อชั่วโมง · ควรเพิ่มเรกคอร์ด DMARC (`_dmarc`) ที่ผู้ให้บริการ DNS ของโดเมน ไม่งั้นอีเมลมีโอกาสตกสแปม

หน้าผู้ดูแลอยู่ที่ http://localhost:8000/admin (ล็อกอินเป็นแอดมินแล้วเข้าจากเมนูบัญชี "หน้าผู้ดูแล") ข้อมูลเดโมมีเรื่องรอตรวจ 2 เรื่อง และคำขอแจ้งว่าแก้แล้ว 4 รายการ · โควตาต่อ 24 ชั่วโมงตั้งได้ใน `.env` (`RATE_LIMIT_REPORTS_PER_DAY`, `RATE_LIMIT_COMMENTS_PER_DAY`, `RATE_LIMIT_PHOTOS_PER_DAY`, `RATE_LIMIT_FIX_CLAIMS_PER_DAY`, `RATE_LIMIT_FLAGS_PER_DAY`, `RATE_LIMIT_AVATARS_PER_DAY`)

### แอปแบบติดตั้งได้ (PWA)

dev server ที่ 8000 ไม่มี service worker ถ้าจะลองแอปแบบติดตั้งได้หรือเปิดตอนออฟไลน์ ให้ build ก่อน:

```bash
bash scripts/build-web.sh
```

แล้วเปิด http://localhost:8100 (Caddy เสิร์ฟ `apps/web/www` และส่ง `/api`, `/sb` ต่อเหมือน 8000) build ใหม่เมื่อไหร่ แอปที่เปิดค้างจะขึ้น "มีเวอร์ชันใหม่" ให้กดโหลดใหม่ · ค้นหาสถานที่ใช้ชื่ออำเภอ/จังหวัดในเครื่องก่อน แล้วถาม OpenStreetMap Nominatim ต่อ (`NOMINATIM_URL`, `NOMINATIM_CONTACT` ใน `.env`)

### แอป Android (APK)

แอปเดียวกับเว็บ ห่อด้วย Capacitor ใช้ GPS และกล้องของเครื่อง ต่อเซิร์ฟเวอร์บนคอมผ่าน **ที่อยู่สาธารณะแบบ https ของ Cloudflare quick tunnel** (ไม่ต้องใช้ Wi-Fi เดียวกัน ไม่ต้องแก้ firewall และไม่ต้องติดตั้งอะไรบน Windows เพราะ `cloudflared` รันจาก Docker image ทางการ)

**เปิดอุโมงค์** (ทุกครั้งที่จะให้มือถือเข้า):

```bash
bash scripts/build-web.sh   # ครั้งแรก หรือเมื่อแก้เว็บ: build production ที่ :8100
bash scripts/tunnel.sh
```

สคริปต์พิมพ์ที่อยู่ `https://<ชื่อสุ่ม>.trycloudflare.com` กรอบใหญ่ๆ ปิดอุโมงค์ด้วย Ctrl+C ลิงก์ดับทันที ข้อควรรู้:

- **ที่อยู่เปลี่ยนทุกครั้งที่เปิด** ถ้าจะให้คงที่ต้องใช้ named tunnel ของบัญชี Cloudflare กับโดเมนของตัวเอง (นอกแผนนี้)
- ระหว่างเปิด `:8100` ทั้งก้อนอยู่บนอินเทอร์เน็ต มีแต่ข้อมูลเดโม (สเปกหัวข้อ 9.2) สคริปต์ปิดปุ่มสลับผู้ใช้เดโม (`DEV_QUICK_LOGIN=false`) ให้เองแล้วคืนค่าเมื่อปิดอุโมงค์ รายการที่ต้องทำก่อนเปิดให้คนอื่นใช้จริงอยู่ที่แผน 10 ใน roadmap
- เว็บเปิดบนมือถือผ่านที่อยู่เดียวกันได้เลย (https จึงติดตั้งเป็น PWA ได้)

**Build และติดตั้ง APK**

```bash
bash scripts/build-apk.sh
```

ไม่ต้องใส่ที่อยู่ เพราะที่อยู่ของอุโมงค์เปลี่ยนทุกครั้ง แอปจะขึ้นหน้า "ตั้งค่าเซิร์ฟเวอร์" ให้ใส่ตอนเปิดครั้งแรก (ถ้าอยากให้มีค่าเริ่มต้นก็ `bash scripts/build-apk.sh https://<ที่อยู่>`) ได้ `dist/jaeng-debug.apk` (ครั้งแรกใช้เวลานานเพราะโหลด Android SDK และ Gradle ครั้งต่อไปไม่กี่นาที อย่ารันพร้อม `test.sh` เพราะ WSL มีแรม 4 GB) ตรวจไฟล์ด้วย `bash scripts/check-apk.sh` แล้วส่งไฟล์ไปมือถือ เปิด "ติดตั้งแอปที่ไม่รู้จัก" แล้วกดติดตั้ง หรือถ้าต่อ Wi-Fi debugging ไว้ก็ `adb install -r dist/jaeng-debug.apk`

- **ที่อยู่ของอุโมงค์เปลี่ยน** ไม่ต้อง build ใหม่: ในแอปไปที่ "เกี่ยวกับ" หรือ "ของฉัน" → ตั้งค่าเซิร์ฟเวอร์ → ใส่ที่อยู่ใหม่ → ทดสอบ → บันทึก ถ้าแอปติดต่อเซิร์ฟเวอร์ไม่ได้ตอนเปิด จะเด้งมาหน้านี้เอง
- **ล็อกอินบนมือถือ** ใช้ OTP 6 หลัก อ่านรหัสที่ Mailpit บนคอม (http://localhost:54324) ปุ่มสลับผู้ใช้เดโมไม่ขึ้นในแอป
- **ใช้ในบ้านโดยไม่ผ่านอินเทอร์เน็ต** ก็ได้ แต่ต้องเปิดพอร์ต 8000 ออก LAN เอง (WSL แบบ mirrored ทำให้ `127.0.0.1` ใน WSL ใช้ไม่ได้และ Supabase CLI พัง จึงไม่แนะนำ) แล้ว `build-apk.sh http://<IP ของคอม>:8000`

| อาการ | ตรวจ |
|---|---|
| `tunnel.sh` บอกไม่มี production build | `bash scripts/build-web.sh` ก่อน |
| แอปขึ้นหน้าตั้งค่าเซิร์ฟเวอร์และ "ทดสอบ" ไม่ผ่าน | ที่อยู่ของอุโมงค์เก่าแล้ว (ปิดไปหรือเปิดใหม่ได้ชื่อใหม่) เปิดอุโมงค์แล้วใส่ที่อยู่ใหม่ ลองเปิดที่อยู่ `/api/health` ในเบราว์เซอร์มือถือ |
| ปุ่มตำแหน่งไม่ทำงาน | ตั้งค่า Android → แอป → แจ้ง → สิทธิ์ → ตำแหน่ง และเปิด GPS ของเครื่อง |
| กล้องไม่เปิด | สิทธิ์กล้องของแอป (ถ้ากดปฏิเสธครั้งเดียว Android จะไม่ถามซ้ำ ต้องเปิดเองในตั้งค่า) |
| ล็อกอินไม่ได้ | รหัส OTP อยู่ที่ Mailpit บนคอม ไม่ใช่อีเมลจริง ใช้ได้ 1 ชั่วโมง |

รายละเอียดเพิ่มเติมดูที่หัวข้อ 8 ของเอกสารออกแบบ

## โฟลเดอร์อื่น

- `docker-webui/` เป็นเครื่องมือจัดการ Docker ใน WSL ผ่านเว็บ (พอร์ต 8080) แยกจากแอปนี้
