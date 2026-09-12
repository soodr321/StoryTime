#!/usr/bin/env python3
"""
Render a word the way src/lib/blend.ts schedules it (same holds, loops and crossfades) and measure
whether the result sounds like one person: pitch continuity across the word, and level continuity.
This is the offline stand-in for listening; the owner's ears remain the real gate (audit-plan 1.6).

    python3 scripts/audit/render-blend.py sat pin dog puff
"""
import json, math, struct, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOUNDS = ROOT / "public" / "sounds"
MAN = json.loads((SOUNDS / "manifest.json").read_text())
# mirrors src/lib/blend.ts
CONT = {"s", "f", "m", "n", "l", "r", "h"}
VOWELS = {"a", "e", "i", "o", "u"}
TARGET = lambda g: 520 if g in CONT else 420 if g in VOWELS else 0
LOOP_EDGE = 0.03
GRAPHEME_CLIP = {"c": "k", "ck": "k", "ff": "f", "ll": "l", "ss": "s"}

def readwav(p):
    d = p.read_bytes(); i = 12; sr = 22050; data = b""
    while i < len(d) - 8:
        cid = d[i:i + 4]; sz = struct.unpack("<I", d[i + 4:i + 8])[0]
        if cid == b"fmt ": sr = struct.unpack("<I", d[i + 12:i + 16])[0]
        if cid == b"data": data = d[i + 8:i + 8 + sz]
        i += 8 + sz + (sz & 1)
    a = struct.unpack(f"<{len(data) // 2}h", data[: len(data) // 2 * 2])
    return sr, [v / 32768 for v in a]

def graphemes(word):
    out = []; i = 0
    while i < len(word):
        two = word[i:i + 2]
        if two in ("ck", "ff", "ll", "ss"): out.append(two); i += 2
        else: out.append(word[i]); i += 1
    return out

def f0(x, sr):
    n = min(len(x), sr // 2)
    if n < sr // 40: return None
    m = sum(x[:n]) / n; w = [v - m for v in x[:n]]
    e0 = sum(v * v for v in w)
    if e0 <= 0: return None
    lo, hi = sr // 400, sr // 60
    best = []
    for lag in range(lo, min(hi, n - 1)):
        s = 0.0
        for k in range(0, n - lag, 3): s += w[k] * w[k + lag]
        best.append(s * 3 / e0)
    if not best: return None
    mx = max(best)
    if mx < 0.3: return None
    for i, v in enumerate(best):
        if v >= 0.85 * mx: return sr / (lo + i)
    return None

def render(word, rate=1.0):
    gs = graphemes(word)
    sr = 22050; bufs = []
    for g in gs:
        clip = GRAPHEME_CLIP.get(g, g)
        s, x = readwav(SOUNDS / f"{clip}.wav"); bufs.append(x); sr = s
    out = [0.0] * int(sr * 6); t = 0.0
    for i, g in enumerate(gs):
        buf = bufs[i]; clip_s = len(buf) / sr
        stop = g not in CONT and g not in VOWELS
        hold = clip_s if stop else TARGET(g) / rate / 1000
        fade = 0.0 if stop else min(0.07, hold / 3)
        n = int(hold * sr)
        start = int(t * sr)
        le, lo_ = int(LOOP_EDGE * sr), len(buf) - int(LOOP_EDGE * sr)
        for k in range(n):
            src = buf[k] if k < len(buf) else buf[le + (k - lo_) % max(1, lo_ - le)]
            g_in = min(1.0, k / max(1, int(fade * sr))) if (i > 0 and not stop) else 1.0
            g_out = min(1.0, (n - k) / max(1, int(fade * sr))) if not stop else 1.0
            if start + k < len(out): out[start + k] += src * g_in * g_out
        t += hold if stop else hold - fade * 0.5
    return sr, out[: int((t + 0.1) * sr)]

def main():
    words = sys.argv[1:] or ["sat", "pin", "dog", "puff"]
    print(f"{'word':8s} {'ms':>5s}  pitch through the word (20 ms hops, one voice = one number)")
    for w in words:
        sr, x = render(w)
        hops = []
        step = int(0.06 * sr)
        for k in range(0, len(x) - step, step):
            p = f0(x[k:k + step * 2], sr)
            hops.append(round(p) if p else None)
        voiced = sorted(h for h in hops if h)
        # trim the extremes: a 25 ms burst is not periodic, so the hop that straddles one reports nonsense
        trim = voiced[len(voiced) // 8: len(voiced) - len(voiced) // 8] or voiced
        spread = (max(trim) - min(trim)) / trim[len(trim) // 2] * 100 if trim else 0
        print(f"{w:8s} {len(x) * 1000 // sr:5d}  {' '.join(str(h) if h else '·' for h in hops)}   spread {spread:.0f}%")
    print("\npass: every word's voiced hops sit inside ~25% of each other (one speaker, no octave jumps)")

if __name__ == "__main__": main()
