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
        # peak-normalise to -1 dBFS in two passes so a 40 ms burst is as audible as a 300 ms vowel
        probe = subprocess.run([FF, "-loglevel", "info", "-ss", f"{c['start'] / 1000}", "-t", f"{dur}", "-i", str(src), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
        peak = next((float(l.split("max_volume:")[1].split("dB")[0]) for l in probe.splitlines() if "max_volume" in l), 0.0)
        gain = -1.0 - peak
        subprocess.run([FF, "-loglevel", "error", "-y", "-ss", f"{c['start'] / 1000}", "-t", f"{dur}", "-i", str(src), "-af", f"volume={gain}dB,{af}", "-ar", "22050", "-ac", "1", "-c:a", "pcm_s16le", str(OUT / f"{clip}.wav")], check=True)
        man[clip] = {"audio": f"{clip}.wav", "ms": c["end"] - c["start"], "kind": c["kind"], "recorded": True,
                     "source": f"https://commons.wikimedia.org/wiki/File:{meta['title']}", "license": meta["license"], "artist": meta["artist"],
                     "edit": f"cut {c['start']}–{c['end']} ms of the original to the isolated sound, peak-normalised"}
        print(f"  {clip:3s} {man[clip]['ms']:4d} ms  {c['kind']:10s} {meta['license']:12s} {meta['title']}")
    (OUT / "manifest.json").write_text(json.dumps(man, indent=1))
    print(f"{len(man)} clips → public/sounds/ (WAV; attribution + edit note in manifest.json)")

if __name__ == "__main__": main()
