"""Steps 4.5 + 4.6: shorten silences, join sections, compress, two-pass loudnorm.

- Inside a section every pause longer than 0.8 s becomes 0.4 s (0.2 s kept after the last sound,
  0.2 s before the next), never inside a word; joins use a 10 ms crossfade.
- Sentences listed in data/voice-cuts.json ({"drop": ["s9-7", ...]}) are removed with their pause.
- Sections are joined with a fixed pause (0.6 s before a main section, 0.3 s before a sub-section).
- Writes audio/master/voice.wav and audio/work/timemap.json (old time -> new time per section).
"""
import json
import subprocess
import numpy as np
from sections import SECTIONS, WORK, MASTER, DATA

SR = 48000
XF = int(0.010 * SR)
LONG, KEEP = 0.8, 0.2
LEAD, TAIL = 0.25, 0.35
GAP_MAIN, GAP_SUB = 0.6, 0.3
MASTER.mkdir(parents=True, exist_ok=True)

cuts_file = DATA / "voice-cuts.json"
cuts = json.loads(cuts_file.read_text(encoding="utf-8")) if cuts_file.exists() else {}
drop = set(cuts.get("drop", []))
drop_sections = set(cuts.get("drop_sections", []))


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def keep_segments(sid):
    """Return [(in_start, in_end)] seconds to keep in the denoised section file."""
    al = json.loads((WORK / "align" / f"{sid}.json").read_text(encoding="utf-8"))
    spans = []  # (start, end, dropped)
    for s in al["sentences"]:
        for p in s["phrases"]:
            for _, a, b in p["tokens"]:
                spans.append((a, b, s.get("id") in drop))
    spans.sort()
    # merge tokens whose gap is <= LONG into one sound block
    blocks = []
    for a, b, d in spans:
        if blocks and a - blocks[-1][1] <= LONG and blocks[-1][2] == d:
            blocks[-1][1] = max(blocks[-1][1], b)
        else:
            blocks.append([a, b, d])
    blocks = [b for b in blocks if not b[2]]
    segs = []
    for i, (a, b, _) in enumerate(blocks):
        lo = a - (LEAD if i == 0 else KEEP)
        hi = b + (TAIL if i == len(blocks) - 1 else KEEP)
        segs.append([max(0.0, lo), hi])
    return segs, al["duration"]


out = np.zeros(0, dtype=np.float32)
timemap = []
for sid, num, _ in SECTIONS:
    if sid in drop_sections:
        continue
    audio = load(WORK / "den" / f"{sid}.wav")
    segs, _ = keep_segments(sid)
    gap = GAP_SUB if "." in num else GAP_MAIN
    if len(out):
        out = np.concatenate([out, np.zeros(int(gap * SR), dtype=np.float32)])
    sec_start = len(out) / SR
    mapped = []
    for k, (a, b) in enumerate(segs):
        piece = audio[int(a * SR):min(len(audio), int(b * SR))]
        if k > 0 and len(piece) > XF:
            ramp = np.linspace(0, 1, XF, dtype=np.float32)
            out[-XF:] = out[-XF:] * (1 - ramp) + piece[:XF] * ramp
            o = len(out) - XF
            out = np.concatenate([out, piece[XF:]])
        else:
            o = len(out)
            out = np.concatenate([out, piece])
        mapped.append({"in": [round(a, 4), round(b, 4)], "out": round(o / SR, 4)})
    timemap.append({"id": sid, "start": round(sec_start, 4), "end": round(len(out) / SR, 4), "segments": mapped})

edit = WORK / "voice_edit.f32"
out.tofile(edit)
(WORK / "timemap.json").write_text(json.dumps(timemap, indent=1), encoding="utf-8")
print(f"edited length {len(out) / SR:.1f}s ({len(out) / SR / 60:.2f} min), "
      f"dropped sentences {len(drop)}, sections {sorted(drop_sections) or 'none'}")

# light compressor, then two-pass loudnorm to -16 LUFS / -1.5 dBTP / LRA 11
inp = ["-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", str(edit)]
comp = "acompressor=threshold=-22dB:ratio=2.5:attack=8:release=160:makeup=2"
p1 = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *inp, "-af",
                     f"{comp},loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                    capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
m = json.loads(p1[p1.rindex("{"):p1.rindex("}") + 1])
# The voice has a peak-to-loudness ratio of ~23 dB (plosive transients), so loudnorm alone stops
# near -17.5 LUFS to respect -1.5 dBTP. Instead: gain from the first-pass measurement, a fast
# limiter at -2 dBFS on the transients, then re-measure and correct the gain (at most 3 renders).


def measure(path):
    meas = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true",
                           "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8",
                          errors="replace").stderr
    summary = meas[meas.rindex("Summary:"):]
    return (float(summary.split("I:")[1].split("LUFS")[0]), float(summary.split("LRA:")[1].split("LU")[0]),
            float(summary.split("Peak:")[1].split("dBFS")[0]))


gain = -16.0 - float(m["input_i"])
for attempt in range(3):
    chain = f"{comp},volume={gain:.2f}dB,alimiter=limit=0.794:attack=0.5:release=40:level=disabled"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inp, "-af", chain, "-ar", str(SR), "-c:a", "pcm_s24le",
                    str(MASTER / "voice.wav")], check=True)
    I, LRA, TP = measure(MASTER / "voice.wav")
    if abs(I + 16.0) <= 0.3:
        break
    gain += -16.0 - I
(WORK / "voice-loudness.json").write_text(json.dumps({"I": I, "LRA": LRA, "TP": TP}), encoding="utf-8")
print(f"voice.wav: integrated {I} LUFS, LRA {LRA} LU, true peak {TP} dBTP")
