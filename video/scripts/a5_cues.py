"""Step 4.7: build cues.json (the one timeline that visuals, sfx and subtitles read).

Inputs: audio/work/align/<id>.json (spoken sentences, token times), audio/work/timemap.json (silence cuts),
        data/scenes.json (triggers + on-screen text), data/measured-values.json (numbers).
Output: cues.json (times in seconds of audio/master/voice.wav) and audio/work/cues-report.md.
Every trigger time is the start of the first matching spoken character after the previous beat;
when a word is not found the beat falls back to the start of the next sentence (reported).
"""
import json
import unicodedata
from sections import SECTIONS, WORK, DATA, VIDEO
from textsim import norm

FPS = 60
DROP_FILE = DATA / "voice-cuts.json"
drop = set(json.loads(DROP_FILE.read_text(encoding="utf-8")).get("drop", [])) if DROP_FILE.exists() else set()
# sections listed in drop_sections are simply absent from timemap.json (a4 skips them)
timemap = {t["id"]: t for t in json.loads((WORK / "timemap.json").read_text(encoding="utf-8"))}
scenes = json.loads((DATA / "scenes.json").read_text(encoding="utf-8"))
values = json.loads((DATA / "measured-values.json").read_text(encoding="utf-8"))

SFX = {  # default sound per beat kind (offset slightly before the word)
    "logo": "shimmer_reveal", "lower": "paper_slide", "title": "whoosh_soft", "map": "whoosh_map_zoom",
    "pin": "ui_pop", "item": "ui_tick", "zoom": "whoosh_map_zoom", "emph": "ui_pop", "caption": "paper_slide",
    "done": "check_stamp", "todo": "ui_tick", "chip": "ui_pop", "group": "whoosh_soft", "tech": "ui_pop",
    "stat": "counter_tick", "principle": "glass_hit", "diagram": "whoosh_soft", "flow": "data_blip_chain",
    "phase": "ui_tick", "card": "paper_slide", "cardfix": "check_stamp", "step": "ui_tick",
    "shotfocus": "whoosh_soft", "roles": "glass_hit", "role": "ui_pop", "level": "beam_ping", "state": "ui_tick",
    "alert": "alert_soft", "screens3": "whoosh_big", "screen": "ui_pop", "theme": "shimmer_reveal",
    "suite": "check_stamp", "limit": "ui_tick", "shield": "check_stamp", "next": "ui_tick",
    "beam:levels4": "beam_ping", "beam:height": "beam_rise", "beam:states3": "beam_ping", "beam:rise": "beam_rise",
    "beam:grow": "beam_rise", "beam:fade": "whoosh_soft", "beam:check": "success_chime",
}


def remap(sid, t):
    """Old time in the section file -> time in voice.wav (snaps into the kept audio)."""
    segs = timemap[sid]["segments"]
    for s in segs:
        a, b = s["in"]
        if t < a:
            return s["out"]
        if t <= b:
            return s["out"] + (t - a)
    last = segs[-1]
    return last["out"] + (last["in"][1] - last["in"][0])


def visual_len(s):
    return sum(1 for c in s if not unicodedata.category(c).startswith("M"))


cues = {"fps": FPS, "voice": "audio/master/voice.wav", "values": "data/measured-values.json", "sections": []}
report = ["# รายงาน cues", ""]
missing, long_labels = [], []
dropped_beats = []
for sid, num, title in SECTIONS:
    if sid not in timemap:  # whole section cut in data/voice-cuts.json
        continue
    al = json.loads((WORK / "align" / f"{sid}.json").read_text(encoding="utf-8"))
    tm = timemap[sid]
    sents = [s for s in al["sentences"] if not s.get("filler_only") and s["id"] not in drop]
    cut_text = norm(" ".join(s["text"] for s in al["sentences"] if s.get("id") in drop)
                    + " " + " ".join(s.get("cut_text", "") for s in al["sentences"]))
    # char index of the spoken section: normalized chars with start times
    chars, ctimes, sent_at = [], [], []
    for si, s in enumerate(sents):
        sent_at.append(len(chars))
        for p in s["phrases"]:
            for text, a, b in p["tokens"]:
                n = norm(text)
                for k, c in enumerate(n):
                    chars.append(c)
                    ctimes.append(a + (b - a) * k / max(1, len(n)))
    spoken = "".join(chars)

    sentences = []
    for s in sents:
        phrases = [{"text": p["text"], "start": round(remap(sid, p["start"]), 3), "end": round(remap(sid, p["end"]), 3)}
                   for p in s["phrases"] if not p.get("filler")]
        sentences.append({"id": s["id"], "text": s["text"], "script": s.get("script"), "match": s.get("match"),
                          "score": s.get("score"), "start": phrases[0]["start"], "end": phrases[-1]["end"],
                          "phrases": phrases})

    beats = [{"id": f"{s['id']}", "start": s["start"], "anim": f"{sid}.sentence", "kind": "sentence"}
             for s in sentences]
    cursor = 0
    sc = scenes.get(sid, {"beats": []})
    for i, b in enumerate(sc["beats"]):
        f = b["f"]
        if f == "start":
            t, how = (sentences[0]["start"] if sentences else tm["start"]), "start"
        else:
            hit = None
            for alias in f:
                n = norm(alias)
                j = spoken.find(n, cursor)
                if j >= 0 and (hit is None or j < hit):
                    hit = j
            if hit is not None:
                t, how = remap(sid, ctimes[hit]), "word"
                cursor = hit + 1
            elif any(norm(alias) in cut_text for alias in f):
                dropped_beats.append(f"{sid} `{b.get('t', '')}`")  # its words were in a cut sentence
                continue
            else:
                nxt = next((k for k, at in enumerate(sent_at) if at >= cursor), len(sents) - 1)
                t, how = sentences[nxt]["start"], "sentence-fallback"
                missing.append(f"{sid} `{'/'.join(f)}` → ประโยค {sentences[nxt]['id']}")
        kind = b["k"]
        beat = {"id": f"{sid}-b{i + 1}", "start": round(t, 3), "kind": kind, "anim": f"{sid}.{kind}",
                "text": b.get("t", ""), "sync": how}
        for key in ("sub", "icon", "ids", "shot"):
            if key in b:
                beat[key] = b[key]
        if "v" in b:
            beat["value"] = {"key": b["v"], **{k: values[b["v"]][k] for k in ("value", "unit")}}
        sfx = b.get("s", SFX.get(kind))
        if sfx:
            beat["sfx"] = [{"name": sfx, "offset": -0.12}]
        for txt in (beat["text"], beat.get("sub", "")):
            if visual_len(txt) > 30:
                long_labels.append(f"{sid}: {txt} ({visual_len(txt)})")
        beats.append(beat)
    beats.sort(key=lambda x: x["start"])
    cues["sections"].append({"id": sid, "num": num, "title": title, "system": sc.get("system", title),
                             "shots": sc.get("shots", []), "start": tm["start"], "end": tm["end"],
                             "sentences": sentences, "beats": beats})
    report.append(f"- {num} {title}: {tm['start']:.2f}–{tm['end']:.2f} s ({tm['end'] - tm['start']:.1f} s), "
                  f"{len(sentences)} ประโยค, {len([b for b in beats if b['kind'] != 'sentence'])} จุดซิงก์")

cues["duration"] = cues["sections"][-1]["end"]
(VIDEO / "cues.json").write_text(json.dumps(cues, ensure_ascii=False, indent=1), encoding="utf-8")
report += ["", f"ความยาวรวม {cues['duration']:.1f} s ({cues['duration'] / 60:.2f} นาที)", "",
           "## คำที่หาไม่เจอ (ใช้เวลาเริ่มประโยคแทน)", ""] + [f"- {m}" for m in missing or ["ไม่มี"]]
report += ["", "## ป้ายที่ตัดออกพร้อมประโยคที่ตัด", ""] + [f"- {m}" for m in dropped_beats or ["ไม่มี"]]
report += ["", "## ป้ายที่ยาวเกิน 30 ตัวอักษร", ""] + [f"- {m}" for m in long_labels or ["ไม่มี"]]
(WORK / "cues-report.md").write_text("\n".join(report), encoding="utf-8")
total_beats = sum(len(s["beats"]) for s in cues["sections"])
print(f"cues.json: {len(cues['sections'])} sections, {total_beats} beats, {cues['duration']:.1f}s; "
      f"missing {len(missing)}, long labels {len(long_labels)}, beats removed with cuts {len(dropped_beats)}")
for m in missing + long_labels:
    print(" ", m)
