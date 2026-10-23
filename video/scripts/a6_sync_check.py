"""Step 4.7 (d): random sync check of the silence-cut time map.

For 10 random trigger beats, cross-correlate 0.6 s of the denoised source at the original word time with
voice_edit at the mapped time. The lag is the mapping error (must be <= 100 ms). Fixed seed, so repeatable.
"""
import json
import random
import subprocess
import numpy as np
from sections import WORK, VIDEO

SR = 48000
edit = np.fromfile(WORK / "voice_edit.f32", dtype=np.float32)
cues = json.loads((VIDEO / "cues.json").read_text(encoding="utf-8"))
timemap = {t["id"]: t for t in json.loads((WORK / "timemap.json").read_text(encoding="utf-8"))}


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def inverse(sid, t):
    for s in timemap[sid]["segments"]:
        a, b = s["in"]
        if s["out"] <= t <= s["out"] + (b - a):
            return a + (t - s["out"])
    return None


pool = [(sec["id"], b) for sec in cues["sections"] for b in sec["beats"] if b.get("sync") == "word"]
random.seed(7)
rows, worst = [], 0.0
for sid, b in random.sample(pool, 10):
    src = load(WORK / "den" / f"{sid}.wav")
    t_out = b["start"]
    t_in = inverse(sid, t_out)
    w = int(0.6 * SR)
    ref = src[int(t_in * SR):int(t_in * SR) + w]
    pad = int(0.15 * SR)
    seg = edit[int(t_out * SR) - pad:int(t_out * SR) + w + pad]
    corr = np.correlate(seg, ref, mode="valid")
    lag = (int(np.argmax(corr)) - pad) / SR
    worst = max(worst, abs(lag))
    rows.append(f"| {b['id']} | {b['text'][:24]} | {t_out:.3f} | {lag * 1000:+.1f} ms |")
out = ["| beat | ป้าย | เวลาใน voice.wav (s) | คลาดเคลื่อน |", "|---|---|---|---|", *rows]
(WORK / "sync-check.md").write_text("\n".join(out) + f"\n\nสูงสุด {worst * 1000:.1f} ms\n", encoding="utf-8")
print(f"10 random beats, worst mapping error {worst * 1000:.1f} ms")
