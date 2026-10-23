# คลิปนำเสนอ "แจ้ง" (สร้างด้วยโค้ด)

คลิปสุดท้ายอยู่ที่ [`docs/media/jaeng-presentation.mp4`](../docs/media/jaeng-presentation.mp4): ความยาว 12:43, 1080p 60 fps, ซับฝังในภาพ ไฟล์นี้บีบให้เล็กกว่า 100 MB เพื่อเก็บใน GitHub

โฟลเดอร์นี้มีโค้ดสำหรับสร้างคลิปทั้งหมด แต่ไม่มีไฟล์เสียงอัด คลิปเดโมดิบ ไฟล์กลาง และไฟล์เรนเดอร์ (อยู่ใน `.gitignore`) ถ้าจะสร้างใหม่ต้องอัดเสียงและเดโมเอง

| ส่วน | ไฟล์ |
|---|---|
| ฉากทั้งหมด (Remotion, React) | `src/` คอมโพสิชัน `Jaeng` 1920x1080 60 fps |
| ไทม์ไลน์เดียวที่ภาพ เอฟเฟกต์ และซับอ่านร่วมกัน | `cues.json` สร้างจากเวลาของคำพูดจริง |
| ป้ายบนจอ คำสำคัญ และตัวเลข | `data/scenes.json`, `data/measured-values.json` |
| ตัดประโยคหรือคำ | `data/voice-cuts.json` |
| ดนตรีและเอฟเฟกต์ | `data/music.json`, `data/sfx-choice.json` |
| สคริปต์งานทั้งหมด (Python และ Node) | `scripts/` เรียงตามลำดับ a0 ถึง b4 |
| บันทึกสถานะและการตัดสินใจ | `STATE.md` |

## สร้างใหม่

ใช้ PowerShell ที่โฟลเดอร์ `video/` และต้องมี Python venv ที่ `video/.venv` (`requests`, `numpy`, `scipy`), Node ของ Windows และ ffmpeg ส่วนคีย์ ElevenLabs ให้ใส่ใน `video/.env` เป็น `ELEVENLABS_API_KEY=...`

```powershell
npm install
$env:PYTHONIOENCODING='utf-8'; $py='.\.venv\Scripts\python'
```

1. **เสียงพูด:** วางไฟล์ใน `audio/raw/` ตั้งชื่อตาม `scripts/sections.py` แล้วรัน
   `& $py scripts/a1_check_denoise.py; & $py scripts/a2_transcribe.py all; & $py scripts/a3_align.py; & $py scripts/a4_edit_voice.py; & $py scripts/a5_cues.py; & $py scripts/a6_sync_check.py`
2. **ดนตรีและเอฟเฟกต์:** โครงเพลงอิงเวลาของแต่ละหัวข้อ จึงต้องสร้างใหม่ทุกครั้งที่เสียงพูดเปลี่ยน
   `& $py scripts/a8_synth_music.py pulse; & $py scripts/b3_sfx_track.py; & $py scripts/a7_mix.py; Copy-Item audio/master/mix.wav public/audio/mix.wav -Force`
   ถ้าจะสร้างเอฟเฟกต์ใหม่ ใช้ `scripts/b1_sfx.py`
3. **ซับ:** `& $py scripts/b4_captions.py`
4. **เดโม:** สแตกของแอปต้องเปิดอยู่ (`bash scripts/dev-up.sh` และ `bash scripts/reset-db.sh` ใน WSL)
   `npx playwright test -c demo/playwright.config.ts demo/main.tour.ts` (มี `safety.tour.ts`, `three.tour.ts` และ `a1.tour.ts` ด้วย) ส่วนมือถือจริงใช้ `node demo/k1.mjs`
   จากนั้นรัน `& $py scripts/scan_leaks.py`, `& $py scripts/b2_shots.py` และ `& $py scripts/b2b_fix_phone_scale.py D1 D2 D3 F1 G1 H1 H2 H3 J2`
5. **ตรวจภาพ:** `node scripts/stills.mjs [sectionId ... | @วินาที]` ภาพจะอยู่ใน `out/stills/`
6. **เรนเดอร์:** ปิดสแตกก่อนเพื่อคืน RAM
   `npx remotion render src/index.ts Jaeng out/jaeng-presentation.mp4 --crf=18 --concurrency=6 --gl=angle`

ดูตัวอย่างระหว่างแก้ได้ที่ `npx remotion studio src/index.ts`

เอฟเฟกต์เสียงมาจาก ElevenLabs แผนฟรี ถ้าเผยแพร่ต้องให้เครดิต "elevenlabs.io" และห้ามใช้เชิงพาณิชย์
