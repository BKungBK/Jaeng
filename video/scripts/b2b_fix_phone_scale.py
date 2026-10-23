"""Phone clips: some frames were captured at device scale 1 instead of 1.25, so the app fills only the top-left
375x812 of the 470x1016 grab and the rest is the window's solid navy. Those frames are cropped and scaled back
to full size. Runs on public/demo in place after b2_shots.py; frames that are already full are left alone, so
running it twice changes nothing.
"""
import json
import subprocess
import sys
import numpy as np
from sections import VIDEO

PUB = VIDEO / "public" / "demo"
W, H = 470, 1016
SMALL_W, SMALL_H = 375, 812
FILL = np.array([14, 30, 68])


def small(a: np.ndarray) -> bool:
    """The strip right of x=375 and the strip under y=812 are the solid window navy."""
    right = a[:, SMALL_W + 3:].reshape(-1, 3)
    below = a[SMALL_H + 6:, :SMALL_W].reshape(-1, 3)
    for strip in (right, below):
        if np.abs(strip.mean(axis=0) - FILL).max() > 4 or strip.std(axis=0).max() > 3:
            return False
    return True


def fix(name: str) -> None:
    src = PUB / f"{name}.mp4"
    tmp = PUB / f"{name}.fix.mp4"
    n = W * H * 3
    full = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(src), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    big = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(src), "-vf", f"crop={SMALL_W}:{SMALL_H}:0:0,scale={W}:{H}:flags=lanczos",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "60", "-i", "-",
                            "-c:v", "h264_nvenc", "-preset", "p5", "-cq", "18", "-pix_fmt", "yuv420p", str(tmp)], stdin=subprocess.PIPE)
    total = fixed = 0
    while True:
        a, b = full.stdout.read(n), big.stdout.read(n)
        if len(a) < n or len(b) < n:
            break
        arr = np.frombuffer(a, np.uint8).reshape(H, W, 3)
        total += 1
        if small(arr.astype(np.int16)):
            fixed += 1
            enc.stdin.write(b)
        else:
            enc.stdin.write(a)
    enc.stdin.close()
    for p in (full, big, enc):
        p.wait()
    if fixed:
        tmp.replace(src)
    else:
        tmp.unlink()
    print(f"{name}: {fixed}/{total} frames scaled back to full size")


shots = json.loads((VIDEO / "src" / "data" / "shots.json").read_text(encoding="utf-8"))
names = sys.argv[1:] or [k for k, v in shots.items() if v["device"] == "phone"]
for k in names:
    fix(k)
