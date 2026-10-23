"""Synthesized background music that follows the clip (cues.json), so the bed fits the visuals.

Usage: python a8_synth_music.py groove|pulse|warm   -> audio/music/synth-<preset>.wav (+ .json arrangement map)

- One chord per bar (D major I-vi-IV-V with add9 voicings; relative minor for 2 "problem" and 10 "limits").
- Energy per section decides the layers: pad, high bell-pluck arpeggio with ping-pong delay, sub bass,
  hats/shaker, four-on-the-floor kick + clap. Kick pumps pad and bass (sidechain).
- Risers end and impacts land exactly on section starts where the energy rises (not on the bar grid),
  so they meet the scene changes. Drums and arpeggio stop at the last sentence ("ขอบคุณ"), where a final
  impact hits and the tonic chord rings out.
- Music sits under speech: arpeggio two octaves up, pad high-passed, -3 dB dip at 2.5 kHz on the master.
Deterministic (fixed seed).
"""
import json
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from sections import VIDEO

SR = 48000
PRESETS = {
    "groove": {"bpm": 104, "swing": 0.56, "arp_oct": 24, "arp_decay": 1.0, "bass": "pulse8", "pad_cut": (700, 3800), "key": 0},
    "pulse": {"bpm": 114, "swing": 0.52, "arp_oct": 24, "arp_decay": 1.5, "bass": "offbeat", "pad_cut": (600, 3000), "key": 2},
    "warm": {"bpm": 96, "swing": 0.58, "arp_oct": 12, "arp_decay": 0.55, "bass": "sustain", "pad_cut": (800, 2600), "key": -2},
}
# mood per scene: energy 1 = pad and slow bells, ~2 = bass and hats come in, ~3 = kick and clap, 3.5 = full lift
ENERGY = {"s1": 1.5, "s2": 1.2, "s3": 2.0, "s4": 2.2, "s5": 2.8, "s6": 3.0, "s7": 3.2, "s8": 1.5,
          "s8-1": 2.2, "s8-2": 2.8, "s8-3": 2.4, "s8-4": 2.6, "s8-5": 2.4, "s8-6": 2.8, "s8-7": 2.6, "s8-8": 2.0,
          "s8-9": 3.2, "s8-10": 2.6, "s9": 3.5, "s10": 1.6, "s11": 3.3}
MINOR = {"s2", "s8-8", "s10"}
# (bass root, pad notes) in MIDI; pad notes share tones for smooth voice leading
PROG_MAJOR = [(38, [57, 61, 64, 66]), (35, [57, 61, 62, 66]), (31, [57, 59, 62, 66]), (33, [57, 59, 61, 64])]
PROG_MINOR = [(35, [57, 61, 62, 66]), (31, [57, 59, 62, 66]), (28, [55, 59, 62, 66]), (30, [57, 61, 64, 66])]

name = sys.argv[1] if len(sys.argv) > 1 else "groove"
P = PRESETS[name]
rng = np.random.default_rng(11)
cues = json.loads((VIDEO / "cues.json").read_text(encoding="utf-8"))
total = cues["duration"] + json.loads((VIDEO / "data" / "music.json").read_text(encoding="utf-8"))["tail"]
N = int(total * SR) + 1
BEAT = 60.0 / P["bpm"]
BAR, STEP = 4 * BEAT, BEAT / 4
SWING = (P["swing"] - 0.5) * 2 * STEP
n_bars = int(np.ceil(total / BAR))
KEY = P["key"]


def hz(m):
    return 440.0 * 2 ** ((m + KEY - 69) / 12)


# ---------- arrangement ----------
secs = [(s["id"], s["start"]) for s in cues["sections"]]
sec_bar = [(sid, int(round(t / BAR))) for sid, t in secs]
bar_sec = []
for i in range(n_bars):
    cur = secs[0][0]
    for sid, b in sec_bar:
        if b <= i:
            cur = sid
    bar_sec.append(cur)
t_last = cues["sections"][-1]["sentences"][-1]["start"]  # "ขอบคุณครับ"


def smooth(x, a, b):
    u = np.clip((x - a) / (b - a), 0.0, 1.0)
    return u * u * (3 - 2 * u)


# energy as a curve, not steps: each change glides over the bar before the scene starts, and over the last two
# bars before "ขอบคุณ" everything winds down to the soft pad, so layers fade in and out instead of switching
TT = np.arange(0, total + 0.01, 0.01)
EN = np.full_like(TT, ENERGY.get(secs[0][0], 3))
for (sid, t), (psid, _) in zip(secs[1:], secs[:-1]):
    a, b = ENERGY.get(psid, 3), ENERGY.get(sid, 3)
    EN = np.where(TT >= t + 0.25 * BAR, b, np.where(TT > t - 0.75 * BAR, a + (b - a) * smooth(TT, t - 0.75 * BAR, t + 0.25 * BAR), EN))
w_end = smooth(TT, t_last - 2 * BAR, t_last)
EN = EN * (1 - w_end) + 1.2 * w_end


def e_at(t):
    return float(np.interp(t, TT, EN))


bar_e = [e_at((i + 0.5) * BAR) for i in range(n_bars)]
chords, k, prev = [], 0, None
for i in range(n_bars):
    s = bar_sec[i]
    if s != prev:
        k, prev = 0, s
    chords.append((PROG_MINOR if s in MINOR else PROG_MAJOR)[k % 4])
    k += 1
rises = []  # (time, delta) at real section starts where energy goes up
for (sid, t), (psid, _) in zip(secs[1:], secs[:-1]):
    d = ENERGY.get(sid, 3) - ENERGY.get(psid, 3)
    if d >= 0.5 and t < t_last - 2 * BAR:
        rises.append((t, d))

# ---------- buffers ----------
dry = np.zeros((2, N), np.float32)
send = np.zeros((2, N), np.float32)
G = np.ones(N, np.float32)  # sidechain gain from the kick


def put(buf, t0, sig, gain=1.0, pan=0.0, duck=False):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig, i0 = sig[..., -i0:], 0
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    n = min(sig.shape[1], N - i0)
    seg = sig[:, :n] * gain
    if duck:
        seg = seg * G[i0:i0 + n]
    buf[:, i0:i0 + n] += seg.astype(np.float32)


def sos(kind, f, order=2):
    return signal.butter(order, f, btype=kind, fs=SR, output="sos")


def saw(f, n):
    dt = f / SR
    ph = (rng.random() + dt * np.arange(n)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt
    y[m] -= x * x + x + x + 1
    return y


# ---------- instruments ----------
def pad(notes, dur, cut, rel=1.4):
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    env = np.minimum(t / 0.7, 1.0)
    tail = t > dur
    env[tail] *= np.exp(-(t[tail] - dur) / (rel / 4))
    out = np.zeros((2, n))
    for m in notes:
        for det, pan in zip((-14, -7, 0, 7, 14), (-0.95, -0.5, 0, 0.5, 0.95)):
            y = saw(hz(m) * 2 ** (det / 1200), n)
            a = (pan + 1) * np.pi / 4
            out[0] += y * np.cos(a)
            out[1] += y * np.sin(a)
    out = signal.sosfilt(sos("lowpass", cut), out, axis=1)
    out = signal.sosfilt(sos("highpass", 160, 1), out, axis=1)
    return out * env / (len(notes) * 2.2)


_pl = {}


def pluck(m, decay, dur=0.45):
    key = (m, decay)
    if key not in _pl:
        n = int(dur * SR)
        t = np.arange(n) / SR
        f = hz(m)
        y = np.zeros(n)
        for h in range(1, 14):
            if h * f > 12000:
                break
            y += (1 / h ** 1.15) * np.exp(-t * (5 + decay * h * 3.2)) * np.sin(2 * np.pi * h * f * t + h * 0.7)
        y *= np.minimum(t / 0.003, 1.0)
        _pl[key] = y / np.max(np.abs(y))
    return _pl[key]


def bass_note(m, dur, decay):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    y = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    env = np.minimum(t / 0.006, 1.0) * np.exp(-t / decay)
    env[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    return np.tanh(1.6 * y * env) / np.tanh(1.6)


def noise(n):
    return rng.standard_normal(n)


def make_kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 105 * np.exp(-t / 0.045)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    click = signal.sosfilt(sos("highpass", 2500), noise(n)) * np.exp(-t / 0.004) * 0.35
    return np.tanh(1.8 * (body + click)) / np.tanh(1.8)


def make_clap():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    env = sum(np.where(t >= o, np.exp(-(t - o) / 0.006), 0) for o in (0, 0.011, 0.022))
    env = env + np.where(t >= 0.03, 0.6 * np.exp(-(t - 0.03) / 0.12), 0)
    st = np.vstack([signal.sosfilt(sos("bandpass", [900, 5000]), noise(n)) * env for _ in range(2)])
    return st / np.max(np.abs(st))


def make_hat(decay):
    n = int((decay * 6) * SR)
    t = np.arange(n) / SR
    y = signal.sosfilt(sos("highpass", 7000, 4), noise(n)) * np.exp(-t / decay)
    return y / np.max(np.abs(y))


def make_shaker():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    y = signal.sosfilt(sos("bandpass", [5000, 10000]), noise(n)) * np.minimum(t / 0.005, 1) * np.exp(-t / 0.035)
    return y / np.max(np.abs(y))


def make_impact():
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    f = 35 + 40 * np.exp(-t / 0.25)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    air = signal.sosfilt(sos("lowpass", 3000), noise(n)) * np.exp(-t / 0.5) * 0.25
    return np.tanh(1.5 * (boom + air))


def make_riser(dur, n_blocks=48):
    n = int(dur * SR)
    out = np.zeros(n)
    x = noise(n)
    edges = np.linspace(0, n, n_blocks + 1).astype(int)
    for b in range(n_blocks):
        c = 400 * (8000 / 400) ** (b / n_blocks)
        seg = signal.sosfilt(sos("bandpass", [c * 0.7, min(c * 1.4, 20000)]), x[edges[b]:edges[b + 1] + 256])
        out[edges[b]:edges[b + 1]] = seg[:edges[b + 1] - edges[b]]
    t = np.arange(n) / n
    return out * t ** 2.2 / np.max(np.abs(out))


KICK, CLAP, SHAKER, IMPACT = make_kick(), make_clap(), make_shaker(), make_impact()
HATS = [make_hat(0.035) for _ in range(4)]
OHAT = make_hat(0.22)

# ---------- events ----------
# patterns (which steps play) follow the bar's energy; loudness of each layer follows the energy curve at the
# exact moment, so a layer fades in or out over a bar instead of appearing at full level
kicks, claps = [], []
for i in range(n_bars):
    t0 = i * BAR
    pre_drop = i + 1 < n_bars and bar_e[i + 1] - bar_e[i] >= 0.5 and bar_e[i + 1] >= 2.9
    for b in range(4):
        t = t0 + b * BEAT
        g = smooth(e_at(t), 2.6, 3.1)
        if t >= t_last or g < 0.03 or (pre_drop and b >= 2):
            continue
        kicks.append((t, g))
        if b in (1, 3):
            claps.append((t, g))
beat_n = int(BEAT * SR)
tt = np.arange(beat_n) / SR
for t, g in kicks:
    i0 = int(t * SR)
    n = min(beat_n, N - i0)
    G[i0:i0 + n] = np.minimum(G[i0:i0 + n], (1 - 0.45 * g * np.exp(-tt[:n] / 0.13)).astype(np.float32))

lo, hi = P["pad_cut"]
GATE = {2: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1], 3: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]}
for i in range(n_bars):
    t0 = i * BAR
    if t0 >= t_last:
        break
    root, notes = chords[i]
    e = bar_e[i]
    # pad (stops at the last sentence; the final chord is rendered below); louder when it is alone
    dur = min(BAR, t_last - t0)
    p = pad(notes, dur, lo + (hi - lo) * min(e_at(t0), 4) / 4)
    put(dry, t0, p, 0.30 * (1 + 0.6 * (1 - smooth(e_at(t0), 1.5, 2.5))), duck=True)
    put(send, t0, p, 0.16)
    g_air = smooth(e_at(t0), 3.15, 3.5)
    if g_air > 0.03:  # lift for the big scenes: an airy octave-up layer
        sh = signal.sosfilt(sos("highpass", 1500), pad([n + 12 for n in notes], dur, 7000), axis=1)
        put(dry, t0, sh, 0.12 * g_air)
        put(send, t0, sh, 0.10 * g_air)
    # arpeggio
    tones = [n + P["arp_oct"] for n in notes]
    seq = [tones[0], tones[2], tones[1], tones[3], tones[0] + 12, tones[3], tones[2], tones[1]]
    for s in range(16):
        on = (s % 4 == 0) if e < 1.9 else GATE[2 if e < 2.9 else 3][s]
        if not on:
            continue
        t = t0 + s * STEP + (SWING if s % 2 else 0) + rng.uniform(-0.004, 0.004)
        if t >= t_last:
            continue
        vel = (1.0 if s % 4 == 0 else 0.75 if s % 2 == 0 else 0.6) * rng.uniform(0.92, 1.08) * (0.7 + 0.3 * smooth(e_at(t), 1.5, 2.2))
        note = pluck(seq[s % 8], P["arp_decay"])
        pan = 0.45 if s % 2 else -0.45
        put(dry, t, note, 0.16 * vel, pan)
        put(send, t, note, 0.08 * vel, pan)
        for k in range(1, 5):  # ping-pong dotted-eighth delay
            put(dry, t + k * 3 * STEP, note, 0.16 * vel * 0.33 ** k, 0.85 if k % 2 else -0.85)
    # bass
    g_b = smooth(e_at(t0), 1.6, 2.2)
    if g_b > 0.03:
        if e < 2.8:
            put(dry, t0, bass_note(root, dur * 0.98, 1.2), 0.24 * g_b, duck=True)
        else:
            steps = range(1, 8, 2) if P["bass"] == "offbeat" else range(8)
            for s in steps:
                t = t0 + s * 2 * STEP
                if t < t_last:
                    put(dry, t, bass_note(root, 2 * STEP * 0.95, 0.16 if P["bass"] == "pulse8" else 0.12),
                        0.26 * (1 if s % 2 == 0 else 0.8) * smooth(e_at(t), 1.6, 2.2), duck=True)
    # hats / shaker / open hat
    for s in range(16):
        if e < 2.9 and s % 2:
            continue
        t = t0 + s * STEP + (SWING if s % 2 else 0)
        et = e_at(t)
        g_h = smooth(et, 1.8, 2.4)
        if t >= t_last or g_h < 0.03:
            continue
        v = [0.8, 0.35, 0.6, 0.35][s % 4] * rng.uniform(0.85, 1.1)
        put(dry, t, HATS[s % 4], 0.075 * v * (0.7 + 0.3 * smooth(et, 2.6, 3.0)) * g_h, 0.3)
        put(dry, t, SHAKER, 0.03 * v * smooth(et, 2.7, 3.2), -0.35)
        if s in (2, 6, 10, 14) and et > 3.15:
            put(dry, t, OHAT, 0.045 * smooth(et, 3.15, 3.5), -0.2)
            put(send, t, OHAT, 0.02 * smooth(et, 3.15, 3.5))
for t, g in kicks:
    put(dry, t, KICK, 0.42 * g)
for t, g in claps:
    put(dry, t, CLAP, 0.16 * g)
    put(send, t, CLAP, 0.10 * g)

# transitions synced to the real section starts
for t, d in rises:
    r = make_riser(BAR)
    put(dry, t - BAR, r, 0.05 * min(d, 2))
    put(send, t - BAR, r, 0.04 * min(d, 2))
    if d >= 1:
        put(dry, t, IMPACT, 0.22 * min(d, 2) / 2)
        put(send, t, IMPACT, 0.15)
# ending: the drums have faded over the last two bars; on "ขอบคุณ" a soft hit, the tonic chord with its bass,
# and a slow rising bell arpeggio that rings out into silence at the very end
ring = total - t_last
put(dry, t_last, IMPACT, 0.12)
put(send, t_last, IMPACT, 0.14)
end_pad = pad(PROG_MAJOR[0][1] + [50], ring * 0.3, hi * 0.7, rel=ring * 0.7)
put(dry, t_last, end_pad, 0.36)
put(send, t_last, end_pad, 0.3)
put(dry, t_last, bass_note(PROG_MAJOR[0][0], ring, ring / 4), 0.2)
for k, m in enumerate([57, 61, 64, 66, 69, 73]):
    bell = pluck(m + P["arp_oct"], 0.35, dur=2.5)
    put(dry, t_last + k * BEAT / 2, bell, 0.13 * 0.85 ** k, -0.4 if k % 2 else 0.4)
    put(send, t_last + k * BEAT / 2, bell, 0.12 * 0.85 ** k)
# ---------- reverb (convolution with a synthetic hall) ----------
ir_n = int(2.6 * SR)
ti = np.arange(ir_n) / SR
wet = np.zeros_like(dry)
for c in range(2):
    ir = signal.sosfilt(sos("lowpass", 6000), noise(ir_n)) * np.exp(-6.9 * ti / 2.3)
    ir[: int(0.025 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    wet[c] = signal.oaconvolve(send[c], ir.astype(np.float32))[:N]
del send
mix = dry + 0.55 * wet
del dry, wet

# ---------- master ----------
mix = signal.sosfilt(sos("highpass", 30), mix, axis=1)
w0 = 2 * np.pi * 2500 / SR  # RBJ peaking EQ, -3 dB at 2.5 kHz, Q 0.9
A, alpha = 10 ** (-3 / 40), np.sin(w0) / (2 * 0.9)
b = [1 + alpha * A, -2 * np.cos(w0), 1 - alpha * A]
a = [1 + alpha / A, -2 * np.cos(w0), 1 - alpha / A]
mix = signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], mix, axis=1)
mix /= np.max(np.abs(mix)) / 0.9
mix = np.tanh(1.4 * mix) / np.tanh(1.4)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
fade = int(1.5 * SR)  # whatever still rings reaches silence on the last frame
mix[:, -fade:] *= np.linspace(1, 0, fade) ** 2
out = VIDEO / "audio" / "music" / f"synth-{name}.wav"
out.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(out, SR, mix.T.astype(np.float32))
arr = {"preset": name, **P, "bars": n_bars, "bar_s": BAR, "kicks": len(kicks),
       "sections": [{"id": s, "start_bar": b, "energy": ENERGY.get(s, 3), "minor": s in MINOR} for s, b in sec_bar],
       "rises": [{"t": round(t, 3), "delta": d} for t, d in rises], "final_hit": round(t_last, 3)}
out.with_suffix(".json").write_text(json.dumps(arr, indent=1), encoding="utf-8")
print(f"{out.name}: {total:.1f}s, {P['bpm']} BPM, {n_bars} bars, {len(kicks)} kicks, {len(rises)} rises")
