# สถานะงานคลิปนำเสนอ "แจ้ง"

คำตอบก่อนเริ่มงาน: [ANSWERS.md](ANSWERS.md) · รายงานเสียง: [audio/voice-report.md](audio/voice-report.md)

## ตอนนี้

เซสชัน 2 (ส่วนเสียงพูด) เสร็จ ยกเว้นมิกซ์ดนตรี (ข้อ 9) ที่รอดนตรีจากเซสชัน 1
**จุดตรวจ 2:** ผู้ใช้ตัดข้อ 1 ถึง 6 แล้วขอคืน แล้วตัดเฉพาะ `s9-7` (2026-10-22) → `voice.wav` 758.8 วิ (12:39), `cues.json` 21 ส่วน 352 จุดซิงก์, สุ่มตรวจ 0 ms
ยังรอ:
1. จุดที่ถอดเสียงต่างจากสคริปต์ (ตารางใน voice-report.md) พูดผิดจริงไหม จะอัดใหม่หรือให้จอแสดงค่าที่ถูก
2. (เสร็จ) เพลงพื้น: สังเคราะห์เอง แบบ pulse

ดนตรี (แทนข้อ 7 ส่วนดนตรี): ผู้ใช้เปลี่ยนใจจาก `soundtrack.mp3` ให้ **สังเคราะห์เพลงเองด้วยโค้ด คุณภาพสูง อารมณ์เปิดตัวเทค** (2026-10-23) → `scripts/a8_synth_music.py` 3 แบบ: groove 104 BPM / pulse 114 BPM / warm 96 BPM โครงเพลงเดินตาม cues (ความเข้มต่อหัวข้อ, riser+impact ตรงเวลาเริ่มหัวข้อที่ความเข้มเพิ่ม, เบรกที่หัวข้อ 8, จบที่ "ขอบคุณ") มิกซ์แล้ว `audio/master/mix-<แบบ>.wav` ทั้งสามแบบ -16.4 LUFS, เสียงพูดเหนือเพลงค่ากลาง 17.3–17.5 dB p10 12.5–12.6 dB ให้ฟังที่ `audio/audition.html` (mp3 ใน `audio/preview/`) **ผู้ใช้เลือก pulse (2026-10-23)** ตั้งใน `data/music.json` แล้ว → `audio/master/mix.wav` + `music_bed.wav` + `audio/audio-report.md` เป็นของ pulse: 761.8 วิ, -16.4 LUFS, TP -4.1 dBTP, ช่องว่างเสียงพูด/เพลง ค่ากลาง 17.5 dB p10 12.5 dB ลบ wav ของ groove/warm แล้ว (สร้างใหม่ได้ด้วย a8) (เอฟเฟกต์ยังสร้างตามข้อ 7 แล้วมิกซ์รอบสุดท้ายในเซสชัน 3)
มิกซ์ (ข้อ 9, `scripts/a7_mix.py`): `mix.wav` 761.8 วิ, -16.4 LUFS, TP -3.1 dBTP, เสียงพูดเหนือเพลงขณะพูด ค่ากลาง 18.7 dB / p10 12.9 dB รอบแรก (ratio 8) ได้ 25.1 dB เพลงแทบไม่ได้ยิน จึงปรับครั้งเดียวเป็น gain 0 dB ratio 4 รายงาน `audio/audio-report.md` ต้องมิกซ์ใหม่อีกครั้งในเซสชัน 3 เมื่อมีเอฟเฟกต์

ลำดับต่อไป: เซสชัน 1 (Remotion, เอฟเฟกต์, เดโม) → มิกซ์ (ข้อ 9) → เซสชัน 3

## เซสชัน 1 (เริ่ม 2026-10-23)

- Remotion 4.0.538 ใน `video/` (`src/`): ชิ้นส่วน 6 ชิ้นใน `src/components/` (Backdrop, Beam, StepList, Diagram, StatCards, DeviceFrame) + Bits (Logo, ThaiMap, Heading, Caption), ฉาก `src/scenes/` อ่าน `cues.json` (ของจริงจากเสียง) composition `Jaeng` 1920x1080 60 fps เสียง `public/audio/mix.wav`
- Studio: `.claude/launch.json` ชื่อ `remotion-studio` (พอร์ต 3300) ภาพนิ่ง: `node scripts/stills.mjs [sectionId...]` → `out/stills/` (ตรวจแล้ว 2 รอบ)
- แผนที่ไทยจาก `apps/web/src/assets/geo/provinces.json` (`scripts/b0_geo.py` → `src/data/thailand.json`), แผนผัง `src/data/diagramSvg.ts`
- เอฟเฟกต์ ElevenLabs: 23 เสียง x 2 ตัวเลือก (`scripts/b1_sfx.py`, ใช้ 343 เครดิต เหลือ 8,121) ปรับความดังแล้ว `audio/sfx/*.wav` + `manifest.json` ให้ฟังเลือกใน `audio/audition.html` ส่วน "เอฟเฟกต์เสียง" **รอผู้ใช้เลือก** (ตอนนี้ใช้ตัวเลือก 1)
- อัดเดโม: `demo/lib.ts` + `demo/main.tour.ts` (Playwright 1.64.1, Chrome เต็มจอ, ffmpeg ddagrab + h264_nvenc 60 fps ใช้ได้, เคอร์เซอร์/จุดแตะวาดในหน้า) รัน `npx playwright test -c demo/playwright.config.ts [-g B1]` ผลต่อช็อตใน `demo/data/tour-results.jsonl` แล้ว `python scripts/b2_shots.py` → `public/demo/*.mp4` (CFR 60) + `src/data/shots.json` + `demo/tour-report.md`
- มุมมองมือถือ: viewport 375x812 DPR 1.25 อยู่มุมซ้ายบนของจอเต็ม (อัดเฉพาะ 470x1016) ภาพทดลองครั้งแรกที่หน้าต่างไม่เต็มจอติดหน้าจอส่วนตัวผู้ใช้ เขียนทับแล้ว ไม่ได้ใช้
- ตำแหน่งในมุมมองมือถือ: สวนลุมพินี (ที่สาธารณะ) ตามคำตอบ C2 รูปโปรไฟล์: `demo/data/avatar.png` (สัญลักษณ์รุ่งอรุณ)
- ข้อมูลเดโม: reset-db แล้ว (ตอนสำรวจ ปุ่ม "ยังไม่แก้" ของผู้ดูแลปฏิเสธทันทีโดยไม่ถาม จึงรีเซ็ตใหม่)
- วัดตัวเลข: `node scripts/measure.mjs` (ข้อ 6.3, ควรรันหลัง reset-db) ยังไม่ได้รัน; `scripts/test.sh` ยังไม่ได้รัน
- อัดผ่านแล้ว (2026-10-23): B1 A2 C1 D1 D2 D3 E1 E2 F1 G1 G2 G3 H3 J1 J2 K1 (ผลใน `demo/data/tour-results.jsonl`, ไฟล์ `demo/raw/`)
- K1: `node demo/k1.mjs` ล้างข้อมูลแอป (pm clear) แล้วเปิดจากไอคอน, ใช้กล้องตอนมือถือคว่ำ (ห้ามเปิดคลังรูป: เห็นรูปส่วนตัวของผู้ใช้), GPS จริงผู้ใช้อนุญาต, หยุดที่หน้าปักหมุด ไม่กดส่ง ภาพเก่าที่ติดหัวแชต/คลังรูปลบแล้ว
- F1: แอปไม่มีปุ่มแนบรูปในคอมเมนต์ ผู้ใช้ให้ตัดคำ "comment แนบรูปได้ และ" ต้นประโยค s8-6-2 แล้ว (`data/voice-cuts.json` "drop_prefix", a3 ตัด token) → voice 757.2 วิ, cues 351 จุด, เพลง pulse และ mix สร้างใหม่แล้ว
- ฐานข้อมูลตอนนี้ไม่ตรงข้อมูลตั้งต้น (E1 รอบที่ผิดอนุมัติ 2 เรื่องที่ seed ไว้) ต้อง reset-db ก่อนวัดตัวเลข
- อัดเพิ่ม (2026-10-23): A1a/A1b (อีเมลจริงของเจ้าของ, รหัสจากภาพ Gmail ที่ผู้ใช้ส่ง, ภาพนั้นเก็บที่ `demo/data/gmail-owner.webp` ไว้ครอปเฉพาะฉบับ 11:08, A1b ตัดต้น 2 วิเพราะติดหน้าจอแอป Claude), H1 (3 คนรายงาน เรื่องหาย), H1b (แท็บถูกรายงาน + คืนเรื่อง), H2 (neighbor1 ครบโควตาผ่าน API แล้วแจ้งเรื่องที่ 6), H4 (ปุ่มสองจังหวะ "เอารูปโปรไฟล์ออก" → "แน่ใจ เอารูปออก") → `public/demo/` 22 ช็อต + `src/data/shots.json` + `demo/tour-report.md`
- ซ้อมอีเมล (B3): อีเมลซ้อม 11:06 เข้ากล่องจดหมาย (ไม่ตกสแปม) มาถึงภายในนาทีเดียวกับที่ส่ง (เวลาจริงเป็นวินาทีไม่ได้วัด)
- I1 สามจอ: อัดพร้อมกันได้ (`demo/raw/I1-1..3.mp4`) ลำแสงขึ้นบนจอเพื่อนบ้านเอง 873 ms หลังอนุมัติ (ครั้งเดียว) แต่ fps ผู้แจ้ง 22.8 (<24) ผู้ดูแล 30.3 เพื่อนบ้าน 49.4 → ตามกติกาต้องใช้ทางสำรองแยกเทค (หมายเหตุ: screencast ส่งเฟรมเฉพาะตอนจอเปลี่ยน จอผู้แจ้งนิ่ง fps จึงต่ำ) รอผู้ใช้ตัดสิน
- scenes.json อ้างช็อต "A1" ต้องผูกเป็น A1a/A1b ในเซสชัน 3
- วัดตัวเลข 2026-10-23 (หลัง reset-db): bbox ค่ากลาง 5.18 ms สูงสุด 8.89 ms (90 ครั้ง, 34 ลำแสง), API config ค่ากลาง ~1.1 ms ต่างจากที่พูด (7 / 61 / 2) → บนจอยังใช้ค่าเดิม ผลใหม่เก็บใน `measured_2026_10_23` รอผู้ใช้ตัดสิน (`scripts/keep_spoken_values.py`)
- test.sh 2026-10-23: exit 0 ผ่านครบ 7 ชุด ส่วนกลาง 20, API 386, เว็บ 1,024, ฐานข้อมูล 579 (ตรงกับที่พูด) log `data/raw/test-2026-10-23.log`
- จุดตรวจ 1 (จบเซสชัน 1): ผู้ใช้ตอบแล้ว ตัวเลขความเร็วใช้ค่าเดิม (ตรงกับ `data/measured-values.json` ตอนนี้), เอฟเฟกต์ตาม `data/sfx-choice.json` ฉากสามจอใช้คลิปที่อัดพร้อมกันจริง (`public/demo/I1-1..3.mp4`) ป้าย "อัดพร้อมกัน 3 จอ" ใน `src/scenes/Demo.tsx` **เซสชัน 1 เสร็จครบ** ต่อไปเซสชัน 3 (ผูกภาพกับ cues, วาง sfx จากฟิลด์ `sfx` ใน cues.json ด้วยไฟล์ที่เลือก, มิกซ์รอบสุดท้าย, ซับ, เรนเดอร์ร่าง)
- WSL ปิดทุกครั้งที่เริ่มเซสชันใหม่: เปิดตัวกันปิดแบบ background (`wsl -e bash -c "sleep 86400"`) แล้ว up.sh สองรอบ
- Claude in Chrome ยังไม่ได้เชื่อม (list_connected_browsers ว่าง) ต้องใช้สำหรับเปิดอีเมลใน Gmail ตามคำตอบ A1-รหัส

## ทำเสร็จแล้ว

- KICKOFF ขั้น 1 ถึง 4, ผู้ใช้ตอบ "เริ่ม" 2026-10-22
- คัดลอกเสียง 21 ไฟล์เข้า `audio/raw/` (ชื่อ `NN-NN-<หัวข้อ>.mp3`, ต้นฉบับยังอยู่ที่ `video/`)
- ตรวจไฟล์ (`audio/work/check.json`): ไม่คลิป peak สูงสุด -5.8 dBFS, s4 กับ s10 เบา (RMS -36/-35 dB) แก้ด้วย loudness แล้ว
- ลดนอยส์ (`audio/work/den/`), ถอดเสียง Scribe ครบ (`audio/work/stt/`, ใช้ 823 เครดิต เหลือ 8,540)
- จับคู่ประโยคแบบเรียงลำดับระดับตัวอักษร (`audio/work/align/`, `audio/work/align-report.md`): ทุกประโยคตรงสคริปต์ ≥ 0.60
- ตัดช่วงเงียบ + มาสเตอร์ → `audio/master/voice.wav` 776.6 วิ, -16.4 LUFS, TP -1.7 dBTP, LRA 3.4
- `cues.json` (fps 60): 21 ส่วน, 353 จุดซิงก์ (ประโยค + คำสำคัญจาก `data/scenes.json`), หาคำครบทุกจุด, สุ่มตรวจ 10 จุดคลาดเคลื่อน 0 ms
- `data/measured-values.json` ใส่ค่าจากตารางข้อเท็จจริง 2026-10-22 ไว้ก่อน เซสชัน 1 ต้องวัดซ้ำ (ข้อ 6.3) แล้วเขียนทับ

## เซสชัน 3 (เริ่ม 2026-10-23)

- ผูกคลิปเดโม: `src/scenes/Demo.tsx` แต่ละช็อตเล่นจากบีตที่พูดถึงถึงช็อตถัดไป ความเร็ว 0.8–2.5x ค้างเฟรมสุดท้ายถ้าสั้นกว่า (`DeviceFrame` prop `playFrames`), A1 แยก A1a/A1b, ภาพอีเมลจริงครอปฉบับ 11:08 (`public/demo/email-a1.png`) ป้าย "อีเมลจริงผ่าน Resend" ที่บีต "อีเมลจริงให้ดู"
- เอฟเฟกต์: `scripts/b3_sfx_track.py` → `audio/master/sfx.wav` 236 จุด (-28.6 LUFS ≈ ต่ำกว่าเสียงพูด 12 dB, ตัดต่ำกว่า 120 Hz) ตาม `data/sfx-choice.json`; มิกซ์สุดท้าย `a7_mix.py` (เสียงพูด+เพลง pulse+เอฟเฟกต์) -16.4 LUFS, TP -1.9 dBTP, ช่องว่างเสียงพูด/เพลง 17.4 dB → `public/audio/mix.wav`
- ซับ: `scripts/b4_captions.py` → `out/jaeng-presentation.srt` + `src/data/captions.json` (209 บรรทัด, ≤60 ตัวอักษร, ประโยคที่ตรงสคริปต์ใช้ข้อความสคริปต์ ยกเว้น Google ตามที่พูด) ฝังด้วย `src/components/Subtitles.tsx`
- ความเป็นส่วนตัว: `scripts/scan_leaks.py` สแกนทุกคลิป พบ J2 (ครึ่งหลังติดหน้าจอ Claude + หน้า Google ที่มี IP) และ J1 (วินาทีที่ 3 ติดแอป Claude) → ลบทิ้งและอัดใหม่แล้ว สะอาด; A1b ตัดต้น 2 วิ คลิปอื่นตรวจด้วยตาแล้วเป็นแอปจริง
- เรนเดอร์ร่าง: `npx remotion render src/index.ts Jaeng out/draft-960x540.mp4 --scale=0.5 --crf=28 --concurrency=4 --gl=angle` เสร็จ 17.2 นาที (ต้องปิดสแตกก่อน: RAM) 760.3 วิ, -16.4 LUFS, peak -1.9 **จุดตรวจ 3: รอผู้ใช้ดูร่าง** (แก้ได้ไม่เกิน 2 รอบ) หลังร่าง: ตัดต้น B1 2 วิ (ช่วงพื้นกรมท่าเปล่า) แล้ว ยังไม่ได้เรนเดอร์ใหม่
- ผู้ใช้ OK ร่าง (2026-10-23) → เรนเดอร์สุดท้าย 1080p 60 fps CRF 18 `--concurrency=6` เสร็จ 27.4 นาที: `out/jaeng-presentation.mp4` 760.3 วิ, -16.4 LUFS, peak -1.9 dBFS + `cover.jpg`, `.srt`, `audio-report.md`, `sfx-manifest.json`, `README.md` **งานเสร็จ (จุดตรวจ 4 ส่งไฟล์สุดท้าย)**
- รอบแก้ 2026-10-23 (ผู้ใช้ดูไฟล์สุดท้าย): (1) จอมือถือเล็กกว่ากรอบ: บางเฟรมอัดที่สเกล 1 แทน 1.25 (แอปอยู่มุมซ้ายบน 375x812 ที่เหลือเป็นสีกรมท่า) → `scripts/b2b_fix_phone_scale.py` ขยายเฉพาะเฟรมนั้นกลับเต็ม (รันหลัง b2_shots, รันซ้ำไม่เปลี่ยนอะไร); (2) 8.9 ไม่มีป้าย "เดโม I1" แล้ว: สามจอเป็นวิดีโอตั้งแต่ต้นฉาก เล็กข้างข้อความ แล้วขยายเต็มแถวตอน "สามหน้าจอ" ช่วงก่อนกดอนุมัติเล่นช้า ให้จังหวะกด (วินาที 4.2 ของคลิป) ตรงคำ "กดอนุมัติ" ชื่อบทบาทย้ายไปเหนือจอ (`DeviceFrame` prop `parts`); (3) เสียงนับตัวเลข: `b3_sfx_track.py` สร้างเสียงคลิกทุกครั้งที่ตัวเลขบนจอเปลี่ยน และเสียงจบตอนตัวเลขถึงค่าสุดท้าย, beam:rise/grow ตัดเสียงให้จบพร้อมภาพ; (4) ดนตรี: energy ต่อฉากรวม 8.1-8.10 เปลี่ยนแบบค่อย ๆ เฟด, สองห้องสุดท้ายก่อน "ขอบคุณ" ค่อย ๆ ลง แล้วคอร์ดจบกับระฆังดังค้างจนเงียบ, `music.json` tail 6 วิ (คลิปยาวขึ้น 3 วิ), level linear → เรนเดอร์ใหม่ `out/jaeng-presentation.mp4` (ไฟล์เดิมย้ายเป็น `jaeng-presentation-v1.mp4`)
- เก็บงาน: ลบ `demo/data/a1-state.json` (session บัญชี A1) แล้ว, `adb reverse --remove-all` + `adb kill-server` แล้ว ยังเหลือ (ไม่ได้ลบ): ไฟล์กลาง `audio/work/`, `demo/raw/` (คลิปดิบ), `demo/data/gmail-owner.webp` (ภาพกล่องจดหมายของผู้ใช้), บัญชี A1 ในฐานข้อมูลเดโม (หายเมื่อ reset-db)

## ค่าที่เลือก

- เสียงพูด: ตัดเงียบ > 0.8 วิ เหลือ 0.4 วิ, ช่องระหว่างหัวข้อหลัก 0.6 วิ ย่อย 0.3 วิ (+หัว 0.25 ท้าย 0.35), crossfade 10 ms
- มาสเตอร์: `acompressor` เบา → gain ตามค่าวัด → `alimiter` -2 dBFS (loudnorm อย่างเดียวได้แค่ -17.1 LUFS เพราะยอดเสียงสูงกว่าความดังราว 23 dB)
- ป้ายบนจอและคำสำคัญอยู่ใน `data/scenes.json` (ย่อจากคำพูดจริง แก้ข้อเท็จจริงตามตาราง: MapLibre, ค่ากลาง, แจ้งเรื่อง)

## คำสั่งที่ใช้ซ้ำ (PowerShell ที่ `video/`)

```
$env:PYTHONIOENCODING='utf-8'
.\.venv\Scripts\python scripts\a0_copy_raw.py        # คัดลอกเสียงเข้า audio/raw
.\.venv\Scripts\python scripts\a1_check_denoise.py   # ตรวจไฟล์ + ลดนอยส์ (ข้ามไฟล์ที่ทำแล้ว)
.\.venv\Scripts\python scripts\a2_transcribe.py all  # Scribe (cache ใน audio/work/stt ไม่เรียกซ้ำ)
.\.venv\Scripts\python scripts\a3_align.py           # จับคู่ประโยค
.\.venv\Scripts\python scripts\a4_edit_voice.py      # ตัดเงียบ + data/voice-cuts.json + มาสเตอร์
.\.venv\Scripts\python scripts\a5_cues.py            # cues.json
.\.venv\Scripts\python scripts\a6_sync_check.py      # สุ่มตรวจเวลา
.\.venv\Scripts\python scripts\a8_synth_music.py groove   # สังเคราะห์เพลง (groove|pulse|warm) ราว 80 วิ/แบบ
.\.venv\Scripts\python scripts\a9_music_check.py audio/music/synth-groove.wav  # ตัวเลขเพลง
.\.venv\Scripts\python scripts\a7_mix.py audio/music/synth-groove.wav groove   # มิกซ์ (ไม่ใส่อาร์กิวเมนต์ = data/music.json)
```

ตัดประโยค: ใส่ id ใน `data/voice-cuts.json` เช่น `{"drop": ["s9-7"]}` แล้วรัน a4, a5, a6 (ไม่เรียก API) อัดใหม่บางหัวข้อ: วางไฟล์ทับใน `audio/raw/` ลบ `audio/work/den/<id>.wav` และ `audio/work/stt/<id>.json` แล้วรัน a1 ถึง a6

## ปัญหาที่รู้

- `s9-7` (อัดแบบเว้นตัวเลขว่าง) ตัดแล้ว ถ้าวัดเรียลไทม์ได้และอยากใส่ ต้องอัดใหม่
- ความยาว 12:39 เกินเป้าราว 10 นาที (A2) ผู้ใช้เลือกคงส่วนอื่นไว้
- `s8-9` พูดว่า "จำลองพร้อมกันสามหน้าจอ" ขึ้นกับผลลองสามจอในเซสชัน 1
- Music API ของ ElevenLabs ใช้ได้เฉพาะแผนเสียเงิน (แผนปัจจุบัน free) และแผน free ต้องให้เครดิต "elevenlabs.io" เมื่อเผยแพร่ (ถ้าใช้เอฟเฟกต์จาก ElevenLabs)
- `soundtrack.mp3` (จาก YouTube ไม่ทราบสิทธิ์) ไม่ได้ใช้แล้ว ยังอยู่ใน `audio/music/`
- เพลงสังเคราะห์ตัดสินจากตัวเลขเท่านั้น (ฟังไม่ได้): เสียงแหลม 4–12 kHz ต่ำราว -25 ถึง -31 dB ของทั้งหมด อาจฟังทึบ ถ้าผู้ใช้ว่าทึบให้เพิ่ม hats/ความสว่าง pluck
- เปลี่ยน cues/เสียงพูดเมื่อไร (เช่นตัดหรืออัดใหม่) ต้องรัน a8 pulse ใหม่ด้วย เพราะโครงเพลงอิงเวลาหัวข้อใน cues.json แล้วค่อยรัน a7
- Scribe ไม่ส่งคำติดปากมา จึงไม่ได้ตัดคำติดปาก (ตัดแค่ช่วงเงียบ)
- `audio/work/voice_edit.f32` (ราว 150 MB) เป็นไฟล์กลาง ลบได้เมื่อจบเซสชัน
- adb server ถูกเปิดไว้ตั้งแต่ตอนตรวจ (ปิดตอนจบงานมือถือ)
