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

แอปอยู่ที่ http://localhost:8000 · Supabase Studio อยู่ที่ http://localhost:54323 · Mailpit (อีเมล OTP) อยู่ที่ http://localhost:54324

```bash
bash scripts/dev-down.sh
```

รายละเอียดเพิ่มเติมดูที่หัวข้อ 8 ของเอกสารออกแบบ

## โฟลเดอร์อื่น

- `docker-webui/` เป็นเครื่องมือจัดการ Docker ใน WSL ผ่านเว็บ (พอร์ต 8080) แยกจากแอปนี้
