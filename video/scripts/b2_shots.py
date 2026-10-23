"""After the tour: constant 60 fps copies for Remotion, src/data/shots.json, demo/tour-report.md (prompt 6.1).

Reads demo/data/tour-results.jsonl (last attempt per shot wins). Recordings are variable-rate (screen grabs
only send changed frames); fps=60 + tpad to the wall-clock length makes them constant 60 fps.
"""
import json
import subprocess
from sections import VIDEO

DEMO = VIDEO / "demo"
PUB = VIDEO / "public" / "demo"
PUB.mkdir(parents=True, exist_ok=True)
rows = {}
for line in (DEMO / "data" / "tour-results.jsonl").read_text(encoding="utf-8").splitlines():
    r = json.loads(line)
    rows[r["shot"]] = r

# seconds cut from the start of a recording: A1b began while the restored window was still behind the
# owner's desktop app (scripts/find_app_start.py found the app at 1.4 s)
# B1 opens with 2 s of plain navy before the app's opening screen (image variance jumps at 2 s and 5 s)
TRIM = {"A1b": 2.0, "B1": 2.0}
ORDER = ["A1a", "A1b","A1", "A2", "B1", "C1", "D1", "D2", "D3", "E1", "E2", "F1", "G1", "G2", "G3", "H1", "H2", "H3", "H4", "I1",
         "I1-1", "I1-2", "I1-3", "J1", "J2", "K1"]
shots = {}
for s in sorted(rows, key=lambda k: ORDER.index(k) if k in ORDER else 99):
    r = rows[s]
    if not r["ok"]:
        continue
    clip = r["clip"]
    src = DEMO / clip["file"]
    trim = TRIM.get(s, 0.0)
    wall = (clip["end"] - clip["start"]) / 1000 - trim
    dst = PUB / f"{s}.mp4"
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{trim:.2f}", "-i", str(src), "-vf", f"fps=60,tpad=stop_mode=clone:stop_duration=2",
                        "-t", f"{wall:.3f}", "-c:v", "h264_nvenc", "-preset", "p5", "-cq", "18", "-pix_fmt", "yuv420p", "-an",
                        str(dst)], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)],
                               capture_output=True, text=True).stdout)
    shots[s] = {"file": f"demo/{s}.mp4", "device": clip["device"], "duration": round(dur, 2), "wallStart": clip["start"]}
(VIDEO / "src" / "data" / "shots.json").write_text(json.dumps(shots, indent=1), encoding="utf-8")

lines = ["# ผลทัวร์เดโม (ทุกช็อตคือการใช้งานจริงในแอป และมีการตรวจผล)", "",
         "| ช็อต | ระบบ | อุปกรณ์ | ผล | หมายเหตุ / ข้อผิดพลาด |", "|---|---|---|---|---|"]
for s in sorted(rows, key=lambda k: ORDER.index(k) if k in ORDER else 99):
    r = rows[s]
    note = "; ".join(r.get("notes") or []) if r["ok"] else r.get("error", "")
    lines.append(f"| {s} | {r['system']} | {r['device']} | {'ผ่าน' if r['ok'] else 'ไม่ผ่าน'} | {note.replace('|', '/')} |")
missing = [s for s in ["A1a", "A1b", "A2", "B1", "C1", "D1", "D2", "D3", "E1", "E2", "F1", "G1", "G2", "G3", "H1", "H2", "H3", "H4", "I1-1", "J1", "J2", "K1"] if s not in rows]
if missing:
    lines += ["", f"ยังไม่ได้อัด: {', '.join(missing)}"]
(DEMO / "tour-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"{len(shots)} shots ready in public/demo, {len(rows) - len(shots)} failed, missing {missing}")
