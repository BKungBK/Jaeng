# แจ้ง

เว็บแอปแจ้งปัญหาในชุมชน ทุกเรื่องที่แจ้งจะขึ้นบนแผนที่ประเทศไทยเป็นสัญญาณไฟแบบ Bat-Signal คนในละแวกกด "เจอเหมือนกัน" แสดงความคิดเห็น และติดตามได้ว่าเรื่องนั้นแก้แล้วหรือยัง

ชื่อ "แจ้ง" แปลได้ทั้ง *แจ้งเรื่อง* และ *สว่าง*

## เอกสาร

- [เอกสารออกแบบ (Design Spec)](docs/superpowers/specs/2026-10-16-jaeng-design.md) เป็นแหล่งอ้างอิงหลักของทุกเรื่อง
- [ต้นแบบหน้าตาแผนที่ไทย](docs/prototype/thai-map-v2.html) เปิดในเบราว์เซอร์ได้เลย
- แผนงาน (implementation plan): `docs/superpowers/plans/` (จะเพิ่มหลังเอกสารออกแบบได้รับอนุมัติ)

## สแต็ก

Angular + Ionic + Capacitor (APK สำหรับ Android) · Elysia (Bun) · Supabase (Postgres/PostGIS, Auth, Storage, Realtime) · MapLibre GL · Caddy · Docker ใน WSL2

## เริ่มใช้งาน

ยังไม่มีโค้ด ขั้นตอนติดตั้งดูได้ที่หัวข้อ 8 ของเอกสารออกแบบ

## โฟลเดอร์อื่น

- `docker-webui/` เป็นเครื่องมือจัดการ Docker ใน WSL ผ่านเว็บ (พอร์ต 8080) แยกจากแอปนี้
