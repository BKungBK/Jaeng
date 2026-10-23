"""Prompt section 9: offline mix of voice + music bed (sfx join in session 3).

- Music: data/music.json picks the file, start offset and gain. It is levelled with loudnorm in dynamic
  mode (LRA 7) because the source swings 18 LU, faded in/out, then ducked by sidechaincompress keyed
  by the voice.
- Voice is mono at -16 LUFS; it is placed in both channels at -3 dB so the stereo mix stays at -16.
- Check once: short-term loudness of voice minus music while speaking must be >= 12 dB (median).
  If not, lower the music by the missing amount and mix again once. Limiter at -1.5 dBTP only if needed.
Writes audio/master/music_bed.wav, audio/master/mix.wav, audio/audio-report.md.
Usage: python a7_mix.py [music file relative to video/] [name]  -> overrides data/music.json "file";
       with a name the outputs are music_bed-<name>.wav, mix-<name>.wav, audio-report-<name>.md.
"""
import json
import subprocess
import sys
import numpy as np
from sections import VIDEO, WORK, MASTER, DATA

SR = 48000
cfg = json.loads((DATA / "music.json").read_text(encoding="utf-8"))
if len(sys.argv) > 1:
    cfg["file"] = sys.argv[1]
SUFFIX = f"-{sys.argv[2]}" if len(sys.argv) > 2 else ""
music = VIDEO / cfg["file"]
voice = MASTER / "voice.wav"
voice_len = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                  str(voice)], capture_output=True, text=True).stdout)
total = voice_len + cfg.get("tail", 3.0)
VOICE_ST = "pan=stereo|c0=0.7071*c0|c1=0.7071*c0"
DUCK = cfg.get("duck", "threshold=0.02:ratio=8:attack=30:release=500:knee=4")


def ff(args, cwd=None):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", cwd=cwd)
    if r.returncode:
        raise SystemExit(r.stderr[-1500:])
    return r.stderr


def series(path, key, pre=""):
    """ebur128 momentary (M) or short-term (S) loudness every 100 ms."""
    out = WORK / f"r128_{key}.txt"  # relative name + cwd: a drive colon breaks the filter syntax
    ff(["-i", str(path), "-af", f"{pre}ebur128=metadata=1,ametadata=mode=print:key=lavfi.r128.{key}:"
        f"file={out.name}", "-f", "null", "-"], cwd=WORK)
    return np.array([float(l.split("=")[1]) for l in out.read_text().splitlines() if f"lavfi.r128.{key}=" in l])


def loudness(path):
    s = ff(["-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"])
    s = s[s.rindex("Summary:"):]
    return float(s.split("I:")[1].split("LUFS")[0]), float(s.split("Peak:")[1].split("dBFS")[0])


prep = WORK / "music_prep.wav"
bed = MASTER / f"music_bed{SUFFIX}.wav"
mix = MASTER / f"mix{SUFFIX}.wav"
fo = cfg.get("fade_out", 5)
if cfg.get("level") == "linear":
    # the synthesized bed already has its own dynamics (quiet scenes, the ring-out at the end): one fixed gain
    # to -24 LUFS keeps them, where dynamic loudnorm would pull the quiet parts back up
    m_i, _ = loudness(music)
    level = f"volume={-24 - m_i:.2f}dB"
else:
    level = "loudnorm=I=-24:LRA=7:TP=-3"
ff(["-y", "-ss", str(cfg.get("offset", 0)), "-t", f"{total:.3f}", "-i", str(music), "-af",
    f"aresample={SR},{level},afade=t=in:d={cfg.get('fade_in', 2)},"
    f"afade=t=out:st={total - fo:.3f}:d={fo}", "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s24le", str(prep)])


def make_bed(gain):
    ff(["-y", "-i", str(prep), "-i", str(voice), "-filter_complex",
        f"[0:a]volume={gain:.2f}dB[m];[1:a]{VOICE_ST},apad=whole_dur={total:.3f}[k];[m][k]sidechaincompress={DUCK}[out]",
        "-map", "[out]", "-t", f"{total:.3f}", "-ar", str(SR), "-c:a", "pcm_s24le", str(bed)])


vS = series(voice, "S", VOICE_ST + ",")
vM = series(voice, "M", VOICE_ST + ",")


def gap():
    b = series(bed, "S")
    n = min(len(vS), len(vM), len(b))
    speaking = (vM[:n] > -30) & np.isfinite(vS[:n]) & np.isfinite(b[:n]) & (b[:n] > -70)
    d = vS[:n][speaking] - b[:n][speaking]
    return float(np.median(d)), float(np.percentile(d, 10))


gain = cfg.get("gain", -2.0)
make_bed(gain)
med, p10 = gap()
retry = None
if med < 12:
    retry = round(12 - med + 0.5, 2)
    gain -= retry
    make_bed(gain)
    med, p10 = gap()

sfx = MASTER / "sfx.wav"  # scripts/b3_sfx_track.py (session 3); without it the mix is voice + music
use_sfx = sfx.exists() and not SUFFIX
ins = ["-i", str(voice), "-i", str(bed)] + (["-i", str(sfx)] if use_sfx else [])
graph = (f"[0:a]{VOICE_ST},apad=whole_dur={total:.3f}[v];"
         + (f"[v][1:a][2:a]amix=inputs=3" if use_sfx else "[v][1:a]amix=inputs=2") + ":normalize=0:duration=longest[out]")
ff(["-y", *ins, "-filter_complex", graph, "-map", "[out]", "-t", f"{total:.3f}", "-ar", str(SR), "-c:a", "pcm_s24le", str(mix)])
I, TP = loudness(mix)
limited = False
if TP > -1.5:
    raw = WORK / "mix_prelimit.wav"
    mix.replace(raw)
    # -2 dBFS sample peak leaves room for inter-sample peaks (true peak must stay under -1.5 dBTP)
    ff(["-y", "-i", str(raw), "-af", "alimiter=limit=0.794:attack=1:release=50:level=disabled",
        "-ar", str(SR), "-c:a", "pcm_s24le", str(mix)])
    I, TP = loudness(mix)
    limited = True

report = f"""# รายงานเสียง (เสียงพูด + ดนตรี{' + เอฟเฟกต์' if use_sfx else ' ยังไม่มีเอฟเฟกต์'})

| รายการ | ค่า |
|---|---|
| ไฟล์ | `audio/master/{mix.name}` ({total:.1f} วิ, 48 kHz สเตอริโอ) |
| ดนตรี | `{cfg['file']}` เริ่มที่วินาที {cfg.get('offset', 0)}, ปรับระดับ -24 LUFS LRA 7, ระดับเพลง {gain:+.1f} dB, เฟดเข้า {cfg.get('fade_in', 2)} วิ ออก {fo} วิ |
| ความดังรวม | {I} LUFS |
| True peak | {TP} dBTP{' (ใส่ limiter -1.5 dBTP)' if limited else ''} |
| เสียงพูดเหนือดนตรีขณะพูด (short-term) | ค่ากลาง {med:.1f} dB, เปอร์เซ็นไทล์ 10 = {p10:.1f} dB (เกณฑ์ ≥ 12 dB) |
| แก้ระดับดนตรี | {f'ลดดนตรีอีก {retry} dB แล้วมิกซ์ใหม่ 1 ครั้ง' if retry else 'ไม่ต้องแก้'} |

ducking: sidechaincompress คุมด้วยเสียงพูด ({DUCK})
"""
(VIDEO / "audio" / f"audio-report{SUFFIX}.md").write_text(report, encoding="utf-8")
print(f"mix.wav {total:.1f}s, I {I} LUFS, TP {TP} dBTP, gap median {med:.1f} dB p10 {p10:.1f} dB, "
      f"music gain {gain:+.1f} dB, retry {retry}, limiter {limited}")
