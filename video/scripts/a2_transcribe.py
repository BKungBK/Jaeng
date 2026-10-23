"""Step 4.3: ElevenLabs Scribe (scribe_v2, Thai), one call per file, cached in audio/work/stt/<id>.json.

Usage: python a2_transcribe.py credits      -> one subscription call, prints remaining credits + tier
       python a2_transcribe.py first        -> transcribe s1 only and check similarity with the script (stop < 0.80)
       python a2_transcribe.py all          -> transcribe every file not cached yet
The API key is read from video/.env and never printed or written.
"""
import json
import sys
import requests
from sections import SECTIONS, VIDEO, WORK, script_text
from textsim import similarity

STT = WORK / "stt"
STT.mkdir(parents=True, exist_ok=True)
API = "https://api.elevenlabs.io/v1"


def key():
    for line in (VIDEO / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    sys.exit("ELEVENLABS_API_KEY not in video/.env")


def credits():
    r = requests.get(f"{API}/user/subscription", headers={"xi-api-key": key()}, timeout=30)
    r.raise_for_status()
    s = r.json()
    keep = {k: s.get(k) for k in ("tier", "character_count", "character_limit", "next_character_count_reset_unix",
                                  "status", "can_extend_character_limit")}
    (WORK / "subscription.json").write_text(json.dumps(keep, indent=1), encoding="utf-8")
    left = (s.get("character_limit") or 0) - (s.get("character_count") or 0)
    print(f"tier={keep['tier']} used={keep['character_count']} limit={keep['character_limit']} left={left}")


def transcribe(sid):
    out = STT / f"{sid}.json"
    if out.exists():
        return json.loads(out.read_text(encoding="utf-8"))
    path = WORK / "den" / f"{sid}.wav"
    with open(path, "rb") as f:
        r = requests.post(f"{API}/speech-to-text", headers={"xi-api-key": key()},
                          data={"model_id": "scribe_v2", "language_code": "th", "timestamps_granularity": "word",
                                "tag_audio_events": "false", "diarize": "false"},
                          files={"file": (path.name, f, "audio/wav")}, timeout=600)
    if r.status_code != 200:
        sys.exit(f"{sid}: HTTP {r.status_code} {r.text[:300]}")
    data = r.json()
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return data


def check(sid, num):
    data = transcribe(sid)
    spoken = data.get("text", "")
    ref = " ".join(script_text()[num])
    sim = similarity(spoken, ref)
    print(f"{sid}: {len(data.get('words', []))} tokens, similarity to script {sim:.3f}")
    return sim


mode = sys.argv[1] if len(sys.argv) > 1 else "first"
if mode == "credits":
    credits()
elif mode == "first":
    sim = check("s1", "1")
    if sim < 0.80:
        sys.exit("STOP: similarity below 0.80")
else:
    for sid, num, _ in SECTIONS:
        check(sid, num)
