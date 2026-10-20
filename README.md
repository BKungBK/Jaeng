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

บัญชีเดโม: `admin@jaeng.local` (แอดมิน), `reporter@jaeng.local` และ `neighbor1@jaeng.local` ถึง `neighbor40@jaeng.local` ทุกบัญชีใช้รหัสผ่าน `DEMO_PASSWORD` ใน `.env`

หน้าผู้ดูแลอยู่ที่ http://localhost:8000/admin (ล็อกอินเป็นแอดมินแล้วเข้าจากเมนูบัญชี "หน้าผู้ดูแล") ข้อมูลเดโมมีเรื่องรอตรวจ 2 เรื่อง และคำขอแจ้งว่าแก้แล้ว 4 รายการ · โควตาต่อ 24 ชั่วโมงตั้งได้ใน `.env` (`RATE_LIMIT_REPORTS_PER_DAY`, `RATE_LIMIT_COMMENTS_PER_DAY`, `RATE_LIMIT_PHOTOS_PER_DAY`, `RATE_LIMIT_FIX_CLAIMS_PER_DAY`, `RATE_LIMIT_FLAGS_PER_DAY`)

### แอปแบบติดตั้งได้ (PWA)

dev server ที่ 8000 ไม่มี service worker ถ้าจะลองแอปแบบติดตั้งได้หรือเปิดตอนออฟไลน์ ให้ build ก่อน:

```bash
bash scripts/build-web.sh
```

แล้วเปิด http://localhost:8100 (Caddy เสิร์ฟ `apps/web/www` และส่ง `/api`, `/sb` ต่อเหมือน 8000) build ใหม่เมื่อไหร่ แอปที่เปิดค้างจะขึ้น "มีเวอร์ชันใหม่" ให้กดโหลดใหม่ · ค้นหาสถานที่ใช้ชื่ออำเภอ/จังหวัดในเครื่องก่อน แล้วถาม OpenStreetMap Nominatim ต่อ (`NOMINATIM_URL`, `NOMINATIM_CONTACT` ใน `.env`)

รายละเอียดเพิ่มเติมดูที่หัวข้อ 8 ของเอกสารออกแบบ

## โฟลเดอร์อื่น

- `docker-webui/` เป็นเครื่องมือจัดการ Docker ใน WSL ผ่านเว็บ (พอร์ต 8080) แยกจากแอปนี้
