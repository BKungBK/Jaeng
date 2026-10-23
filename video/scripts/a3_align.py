"""Step 4.4: spoken sentences from Scribe tokens, matched to script sentences (char similarity >= 0.60).

Writes audio/work/align/<id>.json and audio/work/align-report.md (spoken text + match per sentence).
Times here are in the denoised per-section file (before silence cuts).
"""
import json
import re
from difflib import SequenceMatcher
from sections import SECTIONS, WORK, DATA, script_sentences
from textsim import similarity, norm

ALIGN = WORK / "align"
ALIGN.mkdir(parents=True, exist_ok=True)
_cuts = DATA / "voice-cuts.json"
PREFIX_CUTS = json.loads(_cuts.read_text(encoding="utf-8")).get("drop_prefix", []) if _cuts.exists() else []
FILLERS = {"เอ่อ", "อ่า", "อืม", "เออ", "อ้า", "เอ้อ", "อึม", "อ่ะ"}
MATCH = 0.60


def phrases(words):
    """Group grapheme tokens into phrases separated by spacing tokens."""
    out, cur = [], []
    for w in words:
        if w["type"] == "spacing":
            if cur:
                out.append(cur)
                cur = []
            continue
        cur.append(w)
    if cur:
        out.append(cur)
    return [{"text": "".join(t["text"] for t in p), "start": p[0]["start"], "end": p[-1]["end"],
             "tokens": [[t["text"], t["start"], t["end"]] for t in p]} for p in out]


def sentences(phr):
    """Close a sentence after ครับ/ค่ะ, after a pause >= 0.6 s, or at a pause >= 0.3 s once it is long."""
    out, cur = [], []
    for i, p in enumerate(phr):
        if p["text"] in FILLERS:
            p["filler"] = True
        cur.append(p)
        gap = phr[i + 1]["start"] - p["end"] if i + 1 < len(phr) else 9
        length = sum(len(x["text"]) for x in cur)
        if (re.search(r"(ครับ|ค่ะ|คะ)$", p["text"]) and length >= 12) or gap >= 0.6 or (gap >= 0.3 and length >= 110):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def norm_map(s):
    """Normalized string plus, for each of its chars, the index in s."""
    chars, idx = [], []
    for i, c in enumerate(s):
        if norm(c):
            chars.append(norm(c))
            idx.append(i)
    return "".join(chars), idx


class Aligner:
    """Monotonic char alignment of a whole section's speech against its script text."""

    def __init__(self, sent_texts, refs):
        self.ref_text = " ".join(refs)
        self.R, self.ridx = norm_map(self.ref_text)
        # ref sentence index for each original char of ref_text
        self.ref_of = []
        for k, r in enumerate(refs):
            self.ref_of += [k] * (len(r) + 1)
        self.offsets, parts = [], []
        for t in sent_texts:
            self.offsets.append(sum(len(p) for p in parts))
            parts.append(norm(t))
        S = "".join(parts)
        self.map = {}
        for a, b, n in SequenceMatcher(None, S, self.R, autojunk=False).get_matching_blocks():
            for k in range(n):
                self.map[a + k] = b + k
        self.lens = [len(p) for p in parts]

    def match(self, k, text):
        a = self.offsets[k]
        hits = [self.map[i] for i in range(a, a + self.lens[k]) if i in self.map]
        if len(hits) < max(3, 0.3 * self.lens[k]):
            return 0.0, None, None
        ra, rb = min(hits), max(hits)
        lo, hi = self.ridx[ra], self.ridx[rb]
        # widen to whole words of the script (spaces), so subtitles never cut a word
        while lo > 0 and self.ref_text[lo - 1] != " ":
            lo -= 1
        while hi + 1 < len(self.ref_text) and self.ref_text[hi + 1] != " ":
            hi += 1
        span = self.ref_text[lo:hi + 1]
        return similarity(text, span), span, (self.ref_of[lo], self.ref_of[hi])


report = ["# ประโยคที่พูดจริง เทียบสคริปต์", "", "ความคล้าย >= 0.60 ถือว่าตรง; `—` = พูดนอกสคริปต์", ""]
for sid, num, title in SECTIONS:
    data = json.loads((WORK / "stt" / f"{sid}.json").read_text(encoding="utf-8"))
    refs = script_sentences(num)
    phr = phrases(data["words"])
    groups = sentences(phr)
    texts = [" ".join(p["text"] for p in g if not p.get("filler")) for g in groups]
    al = Aligner(texts, refs)
    sents = []
    for k, group in enumerate(groups):
        words = [p for p in group if not p.get("filler")]
        text = texts[k]
        if not words:
            sents.append({"text": "", "filler_only": True, "start": group[0]["start"], "end": group[-1]["end"],
                          "phrases": group})
            continue
        score, span, rr = al.match(k, text)
        ok = score >= MATCH
        sents.append({
            "id": f"{sid}-{k + 1}", "text": text, "start": words[0]["start"], "end": words[-1]["end"],
            "match": (f"{sid}-r{rr[0] + 1}" + (f"..r{rr[1] + 1}" if rr[1] != rr[0] else "")) if ok else None,
            "score": round(score, 3), "script": span if ok else None,
            "phrases": group,
        })
    # words cut from the start of a sentence (data/voice-cuts.json "drop_prefix"): their tokens leave the
    # phrases, so a4 cuts the audio and a5 drops beats whose words were only in the cut part
    for cut in PREFIX_CUTS:
        s = next((x for x in sents if x.get("id") == cut["sentence"]), None)
        if not s:
            continue
        want, taken = norm(cut["prefix"]), ""
        for p in s["phrases"]:
            while p["tokens"] and len(taken) < len(want) and want.startswith(taken + norm(p["tokens"][0][0])):
                taken += norm(p["tokens"].pop(0)[0])
            p["text"] = "".join(t[0] for t in p["tokens"])
            if p["tokens"]:
                p["start"], p["end"] = p["tokens"][0][1], p["tokens"][-1][2]
        s["phrases"] = [p for p in s["phrases"] if p["tokens"]]
        s["cut_text"] = taken
        s["text"] = " ".join(p["text"] for p in s["phrases"])
        s["start"] = s["phrases"][0]["start"]
    fillers = [p for p in phr if p.get("filler")]
    (ALIGN / f"{sid}.json").write_text(json.dumps({"id": sid, "num": num, "title": title,
                                                    "duration": data.get("audio_duration_secs"),
                                                    "sentences": sents, "refs": refs},
                                                   ensure_ascii=False, indent=1), encoding="utf-8")
    real = [s for s in sents if not s.get("filler_only")]
    off = [s for s in real if s["match"] is None]
    report.append(f"## {num} {title} ({sid}) {data.get('audio_duration_secs'):.1f}s, {len(real)} ประโยค, "
                  f"นอกสคริปต์ {len(off)}, คำติดปาก {len(fillers)}")
    report.append("")
    for s in real:
        mark = f"{s['score']:.2f}" if s["match"] else f"— {s['score']:.2f}"
        report.append(f"- [{s['start']:.1f}] ({mark}) {s['text']}")
    report.append("")
(WORK / "align-report.md").write_text("\n".join(report), encoding="utf-8")
print("written", WORK / "align-report.md")
