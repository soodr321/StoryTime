#!/usr/bin/env python3
"""
Judge the letter sounds the way a phonetician would, not the way a file listing does.

Pitch and loudness only prove the clips came from one mouth at one volume. Whether a 4-year-old can
BLEND from what they hear depends on things you have to measure in the signal (thresholds from the
Gemini 3.1 Pro review of docs/audit-plan.md):

  stops   — a voiceless stop with voicing running on after the burst is "tuh", not /t/.
            Voice onset time separates /p t k/ (long, aspirated) from /b d g/ (short).
  vowels  — a short vowel must hold still: formants that slide are a diphthong, and a child
            cannot blend a moving target.
  fricatives — /s/ lives above 4 kHz. If a phone speaker or a bad cut drags its centre of
            gravity down, /s/ and /f/ turn into the same mud.

    python3 scripts/audit/phonetics.py
"""
import json, math, struct, subprocess, sys
from pathlib import Path
import numpy as np
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[2]
SOUNDS = ROOT / "public" / "sounds"
FF = imageio_ffmpeg.get_ffmpeg_exe()
VOICELESS_STOPS, VOICED_STOPS = {"t", "p", "k"}, {"b", "d", "g"}
VOWELS = {"a", "e", "i", "o", "u"}
FRICATIVES = {"s", "f", "h"}

def load(path, sr=16000):
    raw = subprocess.run([FF, "-loglevel", "error", "-i", str(path), "-ar", str(sr), "-ac", "1", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw[: len(raw) // 2 * 2], dtype="<i2").astype(float) / 32768
    return sr, x

def frames(x, sr, win=0.02, hop=0.005):
    w, h = int(win * sr), int(hop * sr)
    return [(k * h / sr, x[k * h: k * h + w]) for k in range(max(0, (len(x) - w) // h))]

def voiced(seg, sr):
    """periodicity: voicing means vocal folds, which is what makes a stop sound like 'tuh'"""
    if len(seg) < sr // 100: return 0.0
    s = seg - seg.mean()
    e0 = float(s @ s)
    if e0 < 1e-6: return 0.0
    lo, hi = sr // 350, sr // 70
    ac = np.correlate(s, s, "full")[len(s) - 1:]
    if hi >= len(ac): return 0.0
    return float(ac[lo:hi].max() / e0)

def formants(seg, sr, order=12):
    """F1/F2 by LPC (Levinson-Durbin); the two lowest resonances are what makes a vowel that vowel"""
    if len(seg) < order * 3: return None
    s = (seg - seg.mean()) * np.hamming(len(seg))
    s = np.append(s[0], s[1:] - 0.97 * s[:-1])                       # pre-emphasis
    r = np.correlate(s, s, "full")[len(s) - 1: len(s) + order]
    if r[0] <= 0: return None
    a, e = np.zeros(order + 1), r[0]; a[0] = 1
    for i in range(1, order + 1):
        acc = r[i] + sum(a[j] * r[i - j] for j in range(1, i))
        k = -acc / e if e else 0
        new = a.copy()
        for j in range(1, i): new[j] = a[j] + k * a[i - j]
        new[i] = k; a = new; e *= (1 - k * k)
        if e <= 0: return None
    roots = [z for z in np.roots(a) if np.imag(z) > 0.01]
    f = sorted(abs(np.arctan2(np.imag(z), np.real(z))) * sr / (2 * math.pi) for z in roots)
    f = [x for x in f if 200 < x < sr / 2 - 200]
    return (f[0], f[1]) if len(f) >= 2 else None

def centroid(seg, sr):
    sp = np.abs(np.fft.rfft(seg * np.hamming(len(seg))))
    fr = np.fft.rfftfreq(len(seg), 1 / sr)
    return float((sp * fr).sum() / max(sp.sum(), 1e-9))

def report():
    man = json.loads((SOUNDS / "manifest.json").read_text())
    fails = []
    print(f"{'clip':5s} {'kind':10s}  measurement")
    for g in sorted(man):
        sr, x = load(SOUNDS / f"{g}.wav")
        kind = man[g]["kind"]
        env = np.array([float(np.sqrt((s @ s) / max(1, len(s)))) for _, s in frames(x, sr)])
        times = np.array([t for t, _ in frames(x, sr)])
        if len(env) == 0: continue
        if g in VOICELESS_STOPS or g in VOICED_STOPS:
            burst = float(times[int(env.argmax())])
            after = [(t, voiced(s, sr)) for t, s in frames(x, sr) if t > burst]
            vstart = next((t for t, v in after if v > 0.45), None)
            vot = (vstart - burst) * 1000 if vstart is not None else None
            tail = sum(1 for t, v in after if v > 0.45) * 5
            note = f"burst at {burst*1000:.0f} ms · VOT {'—' if vot is None else f'{vot:.0f} ms'} · voiced tail {tail} ms"
            if g in VOICELESS_STOPS and tail > 15:
                fails.append(f"{g}: {tail} ms of voicing after the burst — this is 'tuh', not /{g}/"); note += "  ✗ schwa tail"
            if g in VOICED_STOPS and tail == 0:
                fails.append(f"{g}: no voicing at all — /{g}/ without voice is /{ {'b':'p','d':'t','g':'k'}[g] }/"); note += "  ✗ unvoiced"
        elif g in VOWELS:
            # A short vowel must hold still. Formant tracking by LPC picked F3 for back vowels and
            # reported nonsense, so stability is measured directly: how alike the spectrum is across
            # the vowel. A steady vowel matches itself; a diphthong slides away from itself.
            lo, hi = int(len(x) * 0.12), int(len(x) * 0.88)
            core = x[lo:hi]
            third = len(core) // 3
            # compare spectral ENVELOPES (log-spaced bands), not raw spectra: raw harmonics shift with
            # any tiny pitch change and would fail a perfectly steady vowel
            edges = np.geomspace(180, 5000, 25)
            def spec(a):
                mag = np.abs(np.fft.rfft(a * np.hamming(len(a)), 1024))
                fr = np.fft.rfftfreq(1024, 1 / sr)
                return np.array([mag[(fr >= edges[k]) & (fr < edges[k + 1])].sum() for k in range(len(edges) - 1)]) ** 0.5
            a_, b_, c_ = spec(core[:third]), spec(core[third:2 * third]), spec(core[2 * third:3 * third])
            cos = lambda u, v: float(u @ v / max(1e-9, np.linalg.norm(u) * np.linalg.norm(v)))
            same = min(cos(a_, b_), cos(b_, c_), cos(a_, c_))
            f = formants(core[third:third + int(0.025 * sr)], sr)
            note = f"steadiness {same:.2f}" + (f" · F1 {f[0]:.0f} Hz" if f else "")
            if same < 0.93:
                fails.append(f"{g}: the vowel slides (steadiness {same:.2f}) — a child cannot blend a moving target"); note += "  ✗ slides"
        elif g in FRICATIVES:
            mid = x[int(len(x) * 0.2): int(len(x) * 0.8)]
            c = centroid(mid, sr)
            note = f"spectral centre {c:.0f} Hz"
            if g == "s" and c < 4000: fails.append(f"s: centre of gravity {c:.0f} Hz, below 4 kHz — /s/ blurs into /f/"); note += "  ✗ too low"
        else:
            vs = [voiced(s, sr) for _, s in frames(x, sr)]
            note = f"voiced in {sum(1 for v in vs if v > 0.45) * 100 // max(1, len(vs))}% of frames"
        print(f"{g:5s} {kind:10s}  {note}")
    print()
    if fails:
        print(f"{len(fails)} clips would not help a child blend:")
        for f in fails: print(f"  ✗ {f}")
    else:
        print("every clip passes the blendability checks")
    return fails

if __name__ == "__main__":
    sys.exit(1 if report() and "--strict" in sys.argv else 0)
