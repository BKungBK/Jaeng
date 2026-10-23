"""Step 4.1 + 4.2: per-file report (length, peak, noise floor, clipping, long silences) and light denoise.

Writes audio/work/check.json and audio/work/den/<id>.wav (48 kHz mono 24-bit).
Prints only files that look abnormal.
"""
import json
import re
import subprocess
from sections import SECTIONS, WORK, raw_path

DEN = WORK / "den"
DEN.mkdir(parents=True, exist_ok=True)


def ff(args):
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args],
                          capture_output=True, text=True, encoding="utf-8", errors="replace").stderr


def num(pattern, text, default=None):
    m = re.findall(pattern, text)
    return float(m[-1]) if m else default


report = []
for sid, _, _ in SECTIONS:
    src = raw_path(sid)
    err = ff(["-i", str(src), "-af",
              "pan=mono|c0=0.5*c0+0.5*c1,astats=measure_perchannel=none,silencedetect=noise=-45dB:d=0.8",
              "-f", "null", "-"])
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                           capture_output=True, text=True)
    length = float(probe.stdout.strip())
    peak = num(r"Peak level dB: (-?[\d.inf]+)", err)
    floor = num(r"Noise floor dB: (-?[\d.inf]+)", err)
    rms = num(r"RMS level dB: (-?[\d.inf]+)", err)
    peak_count = num(r"Peak count: (\d+)", err, 0)
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", err)]
    durs = [float(x) for x in re.findall(r"silence_duration: ([\d.]+)", err)]
    long_sil = [round(d, 2) for d in durs if d > 2.0]
    issues = []
    if peak is not None and peak > -0.3:
        issues.append(f"peak {peak} dBFS (อาจคลิป, peak count {int(peak_count)})")
    if rms is not None and rms < -35:
        issues.append(f"RMS ต่ำ {rms} dB")
    if floor is not None and floor > -45:
        issues.append(f"นอยส์พื้นสูง {floor} dB")
    if long_sil:
        issues.append(f"เงียบเกิน 2 วินาที {long_sil}")
    report.append({"id": sid, "file": src.name, "length": round(length, 2), "peak_db": peak, "rms_db": rms,
                   "noise_floor_db": floor, "silences_over_0_8s": len(durs), "issues": issues})

    out = DEN / f"{sid}.wav"
    if not out.exists():
        ff(["-y", "-i", str(src), "-af",
            "pan=mono|c0=0.5*c0+0.5*c1,highpass=f=80,afftdn=nr=8:nf=-50:tn=1",
            "-ar", "48000", "-c:a", "pcm_s24le", str(out)])

(WORK / "check.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
bad = [r for r in report if r["issues"]]
print(f"checked {len(report)} files, total {sum(r['length'] for r in report):.1f}s, abnormal {len(bad)}")
for r in bad:
    print(r["id"], r["file"], "; ".join(r["issues"]))
peaks = [r["peak_db"] for r in report]
floors = [r["noise_floor_db"] for r in report]
rmss = [r["rms_db"] for r in report]
print(f"peak range {min(peaks)}..{max(peaks)} dB, RMS {min(rmss)}..{max(rmss)} dB, noise floor {min(floors)}..{max(floors)} dB")
