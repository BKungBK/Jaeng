"""Prompt section 7: sound effects from ElevenLabs (POST /v1/sound-generation), 2 options per sound.

Usage: python b1_sfx.py one     -> generate the first missing file only, print credits before/after (cost probe)
       python b1_sfx.py all     -> generate every missing file (stops if credits would run out)
       python b1_sfx.py level   -> loudness-match all files into audio/sfx/<name>_<k>.wav + manifest + audition page
Files are kept (audio/sfx/raw/*.mp3) and never generated twice. The key comes from video/.env and is never printed.
"""
import json
import subprocess
import sys
import requests
from sections import VIDEO

API = "https://api.elevenlabs.io/v1"
SFX = VIDEO / "audio" / "sfx"
RAW = SFX / "raw"
RAW.mkdir(parents=True, exist_ok=True)
OPTIONS = 2
STYLE = "clean modern tech product video sound design, no music, no voice"
SOUNDS = [
    ("whoosh_soft", "Soft airy whoosh transition, smooth and subtle motion graphics swish", 1.0, False),
    ("whoosh_big", "Big cinematic whoosh swoosh transition with deep low end and air", 1.6, False),
    ("whoosh_map_zoom", "Smooth zoom-in whoosh with rising airy pitch, like a camera flying down onto a map", 1.6, False),
    ("ui_tick", "Tiny crisp UI tick, soft click of a modern app interface, very short", 0.5, False),
    ("ui_click", "Soft mouse click, clean modern interface click, very short", 0.5, False),
    ("ui_pop", "Soft bubbly pop, friendly UI element appearing, very short", 0.5, False),
    ("type_soft", "Soft gentle laptop keyboard typing, a few quiet keystrokes, close and clean", 2.0, False),
    ("camera_shutter", "Smartphone camera shutter click, clean and short", 0.6, False),
    ("beam_rise", "Soft glowing light beam rising upward, airy shimmering synth swell, subtle", 1.5, False),
    ("beam_ping", "Gentle sonar ping pulse, soft rounded electronic tone with a short airy tail", 1.0, False),
    ("pulse_loop", "Soft rhythmic pulsing glow, gentle electronic heartbeat pulse, ambient and calm", 4.0, True),
    ("data_blip", "Tiny digital data blip, soft electronic chirp, very short", 0.5, False),
    ("data_blip_chain", "Quick chain of soft digital data blips travelling along a line, electronic sequence", 1.5, False),
    ("check_stamp", "Satisfying soft confirmation stamp, short positive success thud with a light ding", 0.7, False),
    ("success_chime", "Bright gentle success chime, two-note positive notification, clean bell tones", 1.5, False),
    ("counter_tick", "Fast soft ticking of a digital counter rolling up numbers, clean UI ticks", 2.0, True),
    ("paper_slide", "Soft card sliding into place, smooth paper swipe, short", 0.6, False),
    ("glass_hit", "Soft glass panel tap, light glassy click with a short shimmer", 0.7, False),
    ("alert_soft", "Soft gentle alert tone, calm two-note warning chime, not alarming", 1.2, False),
    ("ambient_hum", "Very quiet warm ambient room tone, airy soft pad drone", 8.0, True),
    ("shimmer_reveal", "Sparkling shimmer reveal, soft magical glitter swell, bright and airy", 1.8, False),
    ("riser_short", "Short tension riser, rising filtered noise and synth sweep building up, ends abruptly", 2.0, False),
    ("outro_swell", "Warm uplifting swell, soft synth pad and strings rising then fading out gently", 4.0, False),
]


def key():
    for line in (VIDEO / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    sys.exit("no key")


def credits_left():
    r = requests.get(f"{API}/user/subscription", headers={"xi-api-key": key()}, timeout=30)
    r.raise_for_status()
    s = r.json()
    return (s.get("character_limit") or 0) - (s.get("character_count") or 0)


def jobs():
    for name, prompt, dur, loop in SOUNDS:
        for k in range(1, OPTIONS + 1):
            yield name, k, f"{prompt}. {STYLE}", dur, loop


def generate(name, k, prompt, dur, loop):
    out = RAW / f"{name}_{k}.mp3"
    if out.exists():
        return False
    assert len(prompt) <= 450, name
    r = requests.post(f"{API}/sound-generation", params={"output_format": "mp3_44100_192"},
                      headers={"xi-api-key": key()},
                      json={"text": prompt, "duration_seconds": dur, "prompt_influence": 0.45, "loop": loop,
                            "model_id": "eleven_text_to_sound_v2"}, timeout=120)
    if r.status_code != 200:
        sys.exit(f"{name}_{k}: HTTP {r.status_code} {r.text[:300]}")
    out.write_bytes(r.content)
    return True


def measure(path):
    s = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    s = s[s.rindex("Summary:"):]
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                               capture_output=True, text=True).stdout)
    return float(s.split("I:")[1].split("LUFS")[0]), float(s.split("Peak:")[1].split("dBFS")[0]), dur


mode = sys.argv[1] if len(sys.argv) > 1 else "one"
if mode == "one":
    before = credits_left()
    for j in jobs():
        if generate(*j):
            after = credits_left()
            n_total = len(SOUNDS) * OPTIONS
            print(f"{j[0]}_{j[1]} ({j[3]}s): credits {before} -> {after}, cost {before - after}; "
                  f"{n_total} files at this rate ~{(before - after) * n_total}")
            break
elif mode == "all":
    left = credits_left()
    made = 0
    for j in jobs():
        if generate(*j):
            made += 1
    print(f"generated {made}, credits {left} -> {credits_left()}")
elif mode == "level":
    # short hits: peak -3 dBFS; anything >= 1.5 s: -20 LUFS (then peak-capped at -1 dBFS)
    manifest = []
    for name, prompt, dur, loop in SOUNDS:
        for k in range(1, OPTIONS + 1):
            src = RAW / f"{name}_{k}.mp3"
            if not src.exists():
                continue
            I, P, d = measure(src)
            gain = (-20 - I) if d >= 1.5 and I > -70 else (-3 - P)
            gain = min(gain, -1 - P)
            dst = SFX / f"{name}_{k}.wav"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", f"volume={gain:.2f}dB",
                            "-ar", "48000", "-c:a", "pcm_s24le", str(dst)], check=True)
            I2, P2, _ = measure(dst)
            manifest.append({"name": name, "option": k, "file": f"audio/sfx/{dst.name}", "prompt": prompt + ". " + STYLE,
                             "duration": round(d, 2), "loop": loop, "lufs": I2, "peak_dbfs": P2, "used_in": []})
    (SFX / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    rows = "".join(
        f"<section><h2>{n}</h2>" + "".join(
            f"<div class='row'><span>ตัวเลือก {m['option']} · {m['duration']} วิ · {m['lufs']} LUFS · peak {m['peak_dbfs']} dBFS"
            f"{' · วน' if m['loop'] else ''}</span><audio controls preload='none' src='sfx/{m['name']}_{m['option']}.wav'></audio></div>"
            for m in manifest if m["name"] == n) + "</section>"
        for n, *_ in SOUNDS)
    html = (VIDEO / "audio" / "audition.html").read_text(encoding="utf-8")
    start = html.find("<!--SFX-->")
    block = f"<!--SFX--><h1 style='margin-top:32px'>เอฟเฟกต์เสียง (ElevenLabs)</h1><p>เลือกตัวเลือกต่อเสียง แล้วบอกชื่อ เช่น ui_tick 2</p>{rows}<!--/SFX-->"
    if start >= 0:
        html = html[:start] + block + html[html.find("<!--/SFX-->") + len("<!--/SFX-->"):]
    else:
        html = html.replace("</main>", block + "\n</main>")
    (VIDEO / "audio" / "audition.html").write_text(html, encoding="utf-8")
    print(f"levelled {len(manifest)} files, manifest + audition page updated")
