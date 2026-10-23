"""Prompt 7 + 9: one sound-effects track from the beats of cues.json (field "sfx"), using the owner's pick
(data/sfx-choice.json). Each hit sits ~12 dB under the speech (-16 LUFS -> about -28 LUFS per hit), effects
below 120 Hz are cut, and hits closer than 0.3 s to the previous one are skipped so they never pile up.
Writes audio/master/sfx.wav (same length as the music bed) and audio/sfx/placed.json (what went where).
"""
import json
import subprocess
import numpy as np
from scipy import signal
from scipy.io import wavfile
from sections import VIDEO, DATA, MASTER

SR = 48000
cues = json.loads((VIDEO / "cues.json").read_text(encoding="utf-8"))
choice = json.loads((DATA / "sfx-choice.json").read_text(encoding="utf-8"))
manifest = {(m["name"], m["option"]): m for m in json.loads((VIDEO / "audio/sfx/manifest.json").read_text(encoding="utf-8"))}
total = cues["duration"] + json.loads((DATA / "music.json").read_text(encoding="utf-8"))["tail"]
N = int(total * SR) + 1
out = np.zeros((2, N), np.float32)
cache = {}


def load(name):
    opt = 2 if name in choice["option2"] else choice.get("default", 1)
    m = manifest[(name, opt)]
    if name not in cache:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(VIDEO / m["file"]), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                             capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32).reshape(-1, 2)
        gain = 10 ** ((-28 - m["lufs"]) / 20)
        cache[name] = (x.T * gain, opt)
    return cache[name]


FPS = cues["fps"]


def bezier(x1, y1, x2, y2):
    """CSS cubic-bezier as a function of progress, like Easing.bezier in src/theme.ts."""
    ts = np.linspace(0, 1, 2001)
    bx = 3 * (1 - ts) ** 2 * ts * x1 + 3 * (1 - ts) * ts ** 2 * x2 + ts ** 3
    by = 3 * (1 - ts) ** 2 * ts * y1 + 3 * (1 - ts) * ts ** 2 * y2 + ts ** 3
    return lambda p: np.interp(p, bx, by)


EASE = bezier(0.2, 0.8, 0.2, 1)
# numbers that count up on screen: beat kind -> (frames, easing, final value or None for the beat's value)
# StatCard counts over 40 frames with EASE; the beam:height panel counts 0 -> 40 people over 2.5 s, linearly
COUNTERS = {"stat": (40, EASE, None), "beam:height": (150, lambda p: p, 40)}
# visuals that move for a fixed time: the sound is cut to end with them (beat kind -> seconds after the word)
SPAN = {"beam:rise": 0.5, "beam:grow": 0.45}


def tick(pitch, amp):
    """A short glassy click (sine with a fast decay and a touch of noise)."""
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    env = np.exp(-t / 0.006)
    rng = np.random.default_rng(int(pitch))
    x = (np.sin(2 * np.pi * pitch * t) * 0.8 + rng.normal(0, 0.2, n)) * env * amp
    return np.stack([x, x]).astype(np.float32)


def counter_ticks(b, frames, ease, final):
    """One click for every change of the shown number (at most one per 2 frames, rising in pitch as the count
    goes), then the landing sound on the frame the number reaches its final value."""
    value = final if final is not None else (b.get("value") or {}).get("value", 0)
    shown = [round(float(ease(k / frames)) * value) for k in range(frames + 1)]
    changes = [k for k in range(1, frames + 1) if shown[k] != shown[k - 1]]
    if not changes:
        return []
    last_change, hits, prev = changes[-1], [], -9
    for k in changes[:-1]:
        if k - prev >= 2:
            hits.append(k)
            prev = k
    out_hits = [(b["start"] + k / FPS, tick(1500 + 900 * k / last_change, 0.07)) for k in hits]
    land, _ = load("ui_tick")
    out_hits.append((b["start"] + last_change / FPS, land))
    return out_hits


def add(x, t):
    i0 = int(t * SR)
    n = min(x.shape[1], N - i0)
    if n > 0 and i0 >= 0:
        out[:, i0:i0 + n] += x[:, :n]


placed, last = [], -9.0
for sec in cues["sections"]:
    for b in sec["beats"]:
        if b["kind"] in COUNTERS and b.get("sfx"):
            hits = counter_ticks(b, *COUNTERS[b["kind"]])
            for t, x in hits:
                add(x, t)
            if hits:
                placed.append({"t": round(hits[0][0], 3), "name": f"counter ({len(hits)} ticks, ends {hits[-1][0]:.2f})", "option": 0, "beat": b["id"]})
                last = hits[-1][0]
            continue
        for s in b.get("sfx", []):
            t = b["start"] + s.get("offset", 0)
            if t - last < 0.3 or t < 0:
                continue
            x, opt = load(s["name"])
            if b["kind"] in SPAN:
                # fade out over 0.15 s so the sound stops as the visual settles
                end = int((b["start"] + SPAN[b["kind"]] - t) * SR)
                fade = int(0.15 * SR)
                if end + fade < x.shape[1]:
                    x = x[:, :end + fade].copy()
                    x[:, end:] *= np.linspace(1, 0, fade, dtype=np.float32)
            add(x, t)
            placed.append({"t": round(t, 3), "name": s["name"], "option": opt, "beat": b["id"]})
            last = t
out = signal.sosfilt(signal.butter(2, 120, "highpass", fs=SR, output="sos"), out, axis=1).astype(np.float32)
peak = float(np.abs(out).max())
if peak > 0.89:
    out *= 0.89 / peak
wavfile.write(MASTER / "sfx.wav", SR, out.T)
(VIDEO / "audio/sfx/placed.json").write_text(json.dumps(placed, indent=1), encoding="utf-8")
names = {}
for p in placed:
    names[p["name"]] = names.get(p["name"], 0) + 1
print(f"sfx.wav {total:.1f}s, {len(placed)} hits, peak {20 * np.log10(max(peak, 1e-9)):.1f} dBFS")
print("per sound:", dict(sorted(names.items(), key=lambda kv: -kv[1])))
