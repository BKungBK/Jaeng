"""Numbers for a synthesized music bed (I cannot listen): loudness, peak, LRA, band balance,
mean loudness per section, NaN/DC/clipping checks. Usage: python a9_music_check.py audio/music/synth-groove.wav"""
import json
import subprocess
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from sections import VIDEO

path = VIDEO / sys.argv[1]
sr, x = wavfile.read(path)
x = x.astype(np.float64)
s = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                   capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
s = s[s.rindex("Summary:"):]
I = s.split("I:")[1].split("LUFS")[0].strip()
LRA = s.split("LRA:")[1].split("LU")[0].strip()
TP = s.split("Peak:")[1].split("dBFS")[0].strip()
mono = x.mean(axis=1)
bands = {"sub <60": (20, 60), "bass 60-250": (60, 250), "low-mid 250-1k": (250, 1000),
         "speech 1-4k": (1000, 4000), "high 4-12k": (4000, 12000)}
f, p = signal.welch(mono[: sr * 120], sr, nperseg=8192)
tot = p[(f >= 20) & (f <= 12000)].sum()
bal = {k: round(10 * np.log10(p[(f >= a) & (f < b)].sum() / tot), 1) for k, (a, b) in bands.items()}
cues = json.loads((VIDEO / "cues.json").read_text(encoding="utf-8"))
per = []
for sec in cues["sections"]:
    seg = mono[int(sec["start"] * sr):int(sec["end"] * sr)]
    per.append(f"{sec['id']} {20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12):.1f}")
corr = np.corrcoef(x[: sr * 120, 0], x[: sr * 120, 1])[0, 1]
print(f"I {I} LUFS, LRA {LRA} LU, peak {TP} dBFS, NaN {int(np.isnan(x).sum())}, DC {mono.mean():.5f}, "
      f"samples >= 0.999: {int((np.abs(x) >= 0.999).sum())}, L/R correlation {corr:.2f}")
print("band balance (dB of total, first 2 min):", bal)
print("RMS dBFS per section:", ", ".join(per))
