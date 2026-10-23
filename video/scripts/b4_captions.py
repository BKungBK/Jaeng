"""Prompt 10: subtitles from the real speech. A sentence that matches the script (>= 0.60) shows the script's
words (fixes transcription slips), otherwise what was said. One phrase at a time, at most 2 lines
(<= 60 characters per caption, split at spaces), timed in proportion to the sentence's spoken length.
Writes out/jaeng-presentation.srt and src/data/captions.json (burned in by Remotion).
"""
import json
import unicodedata
from sections import VIDEO

MAX = 60
cues = json.loads((VIDEO / "cues.json").read_text(encoding="utf-8"))


def vis(s):
    return sum(1 for c in s if not unicodedata.category(c).startswith("M"))


def chunks(text):
    words, out, cur = text.split(), [], ""
    for w in words:
        if cur and vis(cur) + 1 + vis(w) > MAX:
            out.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
        while vis(cur) > MAX:  # a long run with no spaces: cut it
            cut = len(cur) * MAX // vis(cur)
            while cut < len(cur) and unicodedata.category(cur[cut]).startswith("M"):
                cut += 1
            out.append(cur[:cut])
            cur = cur[cut:]
    if cur:
        out.append(cur)
    return out


caps = []
for sec in cues["sections"]:
    for s in sec["sentences"]:
        text = (s.get("script") or s["text"]).replace('"', "").strip()
        # the speech said "Google" where the script says LINE (plans; the screen follows the speech too)
        if "Google" in s["text"] and "LINE" in text and "Google" not in text:
            text = text.replace("LINE", "Google")
        parts = chunks(text)
        total = sum(vis(p) for p in parts) or 1
        t, span = s["start"], s["end"] - s["start"]
        for p in parts:
            d = span * vis(p) / total
            caps.append({"start": round(t, 3), "end": round(t + d, 3), "text": p})
            t += d
# small gaps between captions close up so the line does not flicker
for a, b in zip(caps, caps[1:]):
    if 0 < b["start"] - a["end"] < 0.35:
        a["end"] = b["start"]


def ts(x):
    h, m = int(x // 3600), int(x % 3600 // 60)
    return f"{h:02d}:{m:02d}:{int(x % 60):02d},{int(round((x % 1) * 1000)) % 1000:03d}"


srt = "\n".join(f"{i + 1}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n" for i, c in enumerate(caps))
(VIDEO / "out").mkdir(exist_ok=True)
(VIDEO / "out" / "jaeng-presentation.srt").write_text(srt, encoding="utf-8")
(VIDEO / "src" / "data" / "captions.json").write_text(json.dumps(caps, ensure_ascii=False), encoding="utf-8")
print(f"{len(caps)} captions, longest {max(vis(c['text']) for c in caps)} chars")
