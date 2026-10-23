"""Privacy scan of the screen recordings: flags moments that do not look like the app (the owner's desktop:
neutral dark-grey app windows, or white browser pages). 2 frames per second, tiny thumbnails.
Usage: scan_leaks.py [shot ...]  (default: every demo/raw/*.mp4 except K1 and the I1 screencasts)"""
import subprocess
import sys
import numpy as np
from sections import VIDEO

RAW = VIDEO / "demo" / "raw"
files = [RAW / f"{s}.mp4" for s in sys.argv[1:]] or sorted(p for p in RAW.glob("*.mp4") if not p.stem.startswith(("K1", "I1")))
for f in files:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-vf", "fps=2,scale=32:32", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 32, 32, 3).astype(int)
    r, g, b = fr[..., 0], fr[..., 1], fr[..., 2]
    grey = (np.abs(r - g) < 7) & (np.abs(g - b) < 7)
    dark_grey = (grey & (r < 70)).mean(axis=(1, 2))
    white = (grey & (r > 225)).mean(axis=(1, 2))
    bad = [i / 2 for i in range(len(fr)) if dark_grey[i] > 0.45 or white[i] > 0.45]
    spans, start = [], None
    for k, t in enumerate(bad):
        if start is None:
            start = t
        if k + 1 == len(bad) or bad[k + 1] - t > 0.6:
            spans.append(f"{start:.1f}-{t:.1f}s")
            start = None
    print(f"{f.stem:6s} {len(fr) / 2:6.1f}s  {'OK' if not spans else 'CHECK ' + ', '.join(spans)}")
