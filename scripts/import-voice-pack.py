#!/usr/bin/env python3
"""
Turn the family's raw recordings into the shipped sound set.

The raw takes in assets/voice-pack/ are the pinned originals — exactly like the Commons files in
assets/phonemes-src/. Everything after that is reproducible: trim, level-match, and then the same
gates that caught /b/ saying /p/ and the vowels wandering. Improve the processing later and re-run
this; nobody has to record again.

    python3 scripts/import-voice-pack.py            # process and report
    python3 scripts/import-voice-pack.py --check    # report only, change nothing
"""
import json, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "assets" / "voice-pack"
OUT = ROOT / "public" / "sounds"
TARGET_RMS_DB = -17.0

def ffmpeg():
    f = shutil.which("ffmpeg")
    if f: return f
    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
FF = ffmpeg()

sys.path.insert(0, str(ROOT / "scripts" / "audit"))
import importlib.util
_spec = importlib.util.spec_from_file_location("ph", ROOT / "scripts" / "audit" / "phonetics.py")
ph = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(ph)

def measure(path, start=None, end=None):
    import math, array, struct
    args = [FF, "-loglevel", "error"]
    if start is not None: args += ["-ss", f"{start/1000}", "-t", f"{(end-start)/1000}"]
    args += ["-i", str(path), "-ar", "22050", "-ac", "1", "-f", "s16le", "-"]
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    a = array.array("h"); a.frombytes(raw[: len(raw)//2*2])
    x = [v/32768 for v in a]
    if not x: return None
    rms = math.sqrt(sum(v*v for v in x)/len(x)); peak = max(abs(v) for v in x)
    return {"n": len(x), "sr": 22050, "rms_db": 20*math.log10(rms+1e-9), "peak_db": 20*math.log10(peak+1e-9), "x": x}

def trim(x, sr, keep_ms=40, floor=0.08):
    """find the sound: drop the room either side but keep a breath, so a stop's burst survives"""
    hop = sr // 100
    env = [ (sum(v*v for v in x[k*hop:(k+1)*hop])/hop) ** 0.5 for k in range(len(x)//hop) ]
    if not env: return 0, len(x)*1000//sr
    peak = max(env)
    if peak < 0.01: return None
    thr = max(0.006, peak*floor)
    a = next((k for k,v in enumerate(env) if v>=thr), 0)
    b = len(env)-1
    while b>a and env[b]<thr: b -= 1
    return max(0, a*10-keep_ms), min(len(x)*1000//sr, (b+1)*10+keep_ms)

def main():
    check = "--check" in sys.argv
    takes = sorted(RAW.glob("*.webm")) + sorted(RAW.glob("*.m4a")) + sorted(RAW.glob("*.wav"))
    if not takes: sys.exit(f"no recordings in {RAW} — record them in the app first (dev server)")
    man = json.loads((OUT / "manifest.json").read_text()) if (OUT / "manifest.json").exists() else {}
    kinds = {g: man.get(g, {}).get("kind", "continuant") for g in [t.stem for t in takes]}
    report, wrote = [], 0
    for t in takes:
        g = t.stem
        m = measure(t)
        if not m: report.append((g, "empty recording")); continue
        cut = trim(m["x"], m["sr"])
        if not cut: report.append((g, "silent — hold the phone closer")); continue
        start, end = cut
        if end - start > 1400: report.append((g, f"{end-start} ms is a word, not a sound")); continue
        if end - start < 60: report.append((g, f"{end-start} ms is too short")); continue
        seg = measure(t, start, end)
        gain = TARGET_RMS_DB - seg["rms_db"]
        if seg["peak_db"] + gain > -1.0: gain = -1.0 - seg["peak_db"]
        if not check:
            dur = (end - start) / 1000
            subprocess.run([FF, "-loglevel", "error", "-y", "-ss", f"{start/1000}", "-t", f"{dur}", "-i", str(t),
                            "-af", f"volume={gain:.2f}dB,afade=t=out:st={max(0, dur-0.015)}:d=0.015",
                            "-ar", "22050", "-ac", "1", "-c:a", "pcm_s16le", str(OUT / f"{g}.wav")], check=True)
            after = measure(OUT / f"{g}.wav")
            man[g] = {"audio": f"{g}.wav", "ms": end - start, "kind": kinds.get(g, "continuant"), "recorded": True,
                      "f0": 0, "f0_drift": 0, "rms_db": round(after["rms_db"], 1),
                      "source": "recorded by the family", "license": "family", "artist": "family",
                      "edit": f"raw take assets/voice-pack/{t.name}, trimmed {start}-{end} ms, level-matched ({gain:+.1f} dB)"}
            wrote += 1
        report.append((g, f"{end-start} ms, {gain:+.1f} dB"))
    if not check and wrote:
        (OUT / "manifest.json").write_text(json.dumps(man, indent=1))
    print(f"{len(takes)} takes · {wrote} written to public/sounds/")
    for g, note in report: print(f"  {g:4s} {note}")
    if not check and wrote:
        print("\nphonetic check:")
        ph.report()

if __name__ == "__main__": main()
