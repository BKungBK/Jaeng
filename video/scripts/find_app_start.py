"""Seconds into a recording where the app (navy background) first fills the screen. Usage: find_app_start.py file"""
import subprocess
import sys
import numpy as np

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", sys.argv[1], "-t", "40", "-vf", "fps=10,scale=32:18",
                      "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, 18, 32, 3).astype(int)
for i, x in enumerate(frames):
    r, b = x[..., 0].mean(), x[..., 2].mean()
    if b > r + 12:  # navy app sky; the desktop app behind is grey
        print(f"{i / 10:.1f}")
        break
else:
    print("none")
