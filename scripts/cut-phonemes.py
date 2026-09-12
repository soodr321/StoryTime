#!/usr/bin/env python3
"""
Cut the pinned Commons IPA recordings (assets/phonemes-src/) into pure instructional sounds
using scripts/phoneme-cuts.json, and write public/sounds/<clip>.wav + manifest.json.

Why WAV: a 40 ms plosive burst cannot survive AAC priming/edit-list handling on every engine;
22.05 kHz mono 16-bit WAV is ~44 bytes/ms, decodes everywhere, and the whole set is < 400 KB.
Never TTS here: every clip is a real recording (CC BY-SA, attribution in manifest.json).
Check after cutting: python3 scripts/cut-phonemes.py --check prints a 10 ms voicing map per clip.
"""
import hashlib, json, shutil, struct, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "phonemes-src"
OUT = ROOT / "public" / "sounds"
CUTS = json.loads((ROOT / "scripts" / "phoneme-cuts.json").read_text())
SOURCES = json.loads((SRC / "sources.json").read_text())

def ffmpeg():
    f = shutil.which("ffmpeg")
    if f: return f
    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()

def wav_samples(path):
    d = path.read_bytes(); i = 12; sr = 22050; data = b""
    while i < len(d) - 8:
        cid = d[i:i + 4]; sz = struct.unpack("<I", d[i + 4:i + 8])[0]
        if cid == b"fmt ": sr = struct.unpack("<I", d[i + 12:i + 16])[0]
        if cid == b"data": data = d[i + 8:i + 8 + sz]
        i += 8 + sz + (sz & 1)
    import array; a = array.array("h"); a.frombytes(data[: len(data) // 2 * 2]); return sr, a

TARGET_RMS_DB = -17.0

def decode(path, start_ms=None, end_ms=None):
    """ffmpeg-decode a slice to mono float samples at 22.05 kHz."""
    FF = ffmpeg(); args = [FF, "-loglevel", "error"]
    if start_ms is not None: args += ["-ss", f"{start_ms / 1000}", "-t", f"{(end_ms - start_ms) / 1000}"]
    args += ["-i", str(path), "-ar", "22050", "-ac", "1", "-f", "s16le", "-"]
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    import array; a = array.array("h"); a.frombytes(raw[: len(raw) // 2 * 2])
    return 22050, [v / 32768 for v in a]

def _f0(x, sr):
    """lowest lag with near-maximal normalised autocorrelation (octave-safe); None when unvoiced."""
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

def measure(path, start_ms=None, end_ms=None):
    import math
    sr, x = decode(path, start_ms, end_ms)
    rms = math.sqrt(sum(v * v for v in x) / max(1, len(x)))
    peak = max((abs(v) for v in x), default=0.0)
    half = len(x) // 2
    a, b = _f0(x[:half], sr), _f0(x[half:], sr)
    return {"rms_db": 20 * math.log10(rms + 1e-9), "peak_db": 20 * math.log10(peak + 1e-9),
            "f0": round(_f0(x, sr) or 0), "drift": round(abs((b or 0) - (a or 0))) if a and b else 0}

def check():
    for clip in sorted(k for k in CUTS if not k.startswith("_")):
        p = OUT / f"{clip}.wav"
        if not p.exists(): print(f"{clip}: missing"); continue
        sr, a = wav_samples(p); hop = sr // 100; n = len(a) // hop
        def rms(k): s = a[k * hop:(k + 1) * hop]; return (sum(v * v for v in s) / max(1, len(s))) ** 0.5 / 32768
        def zcr(k): s = a[k * hop:(k + 1) * hop]; return sum(1 for j in range(1, len(s)) if (s[j - 1] < 0) != (s[j] < 0)) / max(1, len(s))
        line = "".join("." if rms(k) < 0.02 else ("H" if zcr(k) > 0.3 else "V") for k in range(n))
        print(f"{clip:3s} {len(a) * 1000 // sr:4d} ms  {CUTS[clip]['kind']:10s} {line}")

def main():
    if "--check" in sys.argv: return check()
    FF = ffmpeg(); OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.m4a"): old.unlink()
    man = {}
    for clip, c in CUTS.items():
        if clip.startswith("_"): continue
        src = SRC / f"{c['src']}.ogg"; meta = SOURCES[c["src"]]
        if hashlib.sha256(src.read_bytes()).hexdigest() != meta["sha256"]: sys.exit(f"{src} does not match the pinned hash; offsets would be wrong")
        dur = (c["end"] - c["start"]) / 1000
        fades = ([f"afade=t=in:st=0:d={c['fadeIn'] / 1000}"] if c["fadeIn"] else []) + [f"afade=t=out:st={dur - c['fadeOut'] / 1000}:d={c['fadeOut'] / 1000}"]   # a 0 ms fade-in is treated by ffmpeg as "fade everything"
        af = ",".join(fades)
        # loudness, not peak: a 25 ms burst peak-normalised sits far louder than a 200 ms nasal, so the
        # blend used to jump in volume from sound to sound. Continuants and vowels are matched on RMS.
        stats = measure(src, c["start"], c["end"])
        gain = (-6.0 - stats["peak_db"]) if c["kind"] == "stop" else (TARGET_RMS_DB - stats["rms_db"])
        gain = max(-12.0, min(24.0, gain))
        if stats["peak_db"] + gain > -1.0: gain = -1.0 - stats["peak_db"]   # never clip
        subprocess.run([FF, "-loglevel", "error", "-y", "-ss", f"{c['start'] / 1000}", "-t", f"{dur}", "-i", str(src),
                        "-af", f"volume={gain:.2f}dB,{af}", "-ar", "22050", "-ac", "1", "-c:a", "pcm_s16le", str(OUT / f"{clip}.wav")], check=True)
        after = measure(OUT / f"{clip}.wav")
        man[clip] = {"audio": f"{clip}.wav", "ms": c["end"] - c["start"], "kind": c["kind"], "recorded": True,
                     "f0": after["f0"], "f0_drift": after["drift"], "rms_db": round(after["rms_db"], 1),
                     "source": f"https://commons.wikimedia.org/wiki/File:{meta['title']}", "license": meta["license"], "artist": meta["artist"],
                     "edit": f"cut {c['start']}–{c['end']} ms of the original to the isolated sound, level-matched ({gain:+.1f} dB)"}
        print(f"  {clip:3s} {man[clip]['ms']:4d} ms  {c['kind']:10s} F0={man[clip]['f0'] or '-':>4} drift={man[clip]['f0_drift']:>4} {man[clip]['rms_db']:>6} dB  {meta['title']}")
    (OUT / "manifest.json").write_text(json.dumps(man, indent=1))
    print(f"{len(man)} clips → public/sounds/ (WAV; attribution + edit note in manifest.json)")

if __name__ == "__main__": main()
