#!/usr/bin/env python3
"""
Listen to everything the app says, and judge it the way a parent would.

For every narration file: what was actually said (ASR), whether it matches the page text, how fast
it is (both raw and excluding pauses), whether it pauses at full stops, how expressive it is (pitch
range), and whether the word timings the karaoke highlight uses really land on those words.
For every phoneme clip and every blended word: what a listener hears.

    python3 scripts/audit/listen.py            # everything
    python3 scripts/audit/listen.py clips      # just the letter sounds and blends
"""
import json, math, os, re, struct, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TMP = Path("/tmp/audit-wav"); TMP.mkdir(exist_ok=True)
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()

def wav(src, name, rate=16000):
    out = TMP / f"{name}.wav"
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(src), "-ar", str(rate), "-ac", "1", str(out)], check=True)
    return out

def samples(p):
    d = p.read_bytes(); i = 12; sr = 16000; data = b""
    while i < len(d) - 8:
        cid = d[i:i+4]; sz = struct.unpack("<I", d[i+4:i+8])[0]
        if cid == b"fmt ": sr = struct.unpack("<I", d[i+12:i+16])[0]
        if cid == b"data": data = d[i+8:i+8+sz]
        i += 8 + sz + (sz & 1)
    a = struct.unpack(f"<{len(data)//2}h", data[: len(data)//2*2])
    return sr, [v / 32768 for v in a]

def pitch_track(x, sr, hop=0.02):
    """F0 per 40 ms window; the spread over a sentence is how expressive the reading is."""
    out = []
    win = int(0.04 * sr); step = int(hop * sr)
    for k in range(0, max(0, len(x) - win), step):
        w = x[k:k+win]
        m = sum(w) / len(w); w = [v - m for v in w]
        e0 = sum(v*v for v in w)
        if e0 < 1e-4: out.append(None); continue
        lo, hi = sr // 350, sr // 70
        best, bl = 0.0, 0
        for lag in range(lo, min(hi, len(w) - 1)):
            s = sum(w[j] * w[j+lag] for j in range(0, len(w) - lag, 2)) * 2 / e0
            if s > best: best, bl = s, lag
        out.append(sr / bl if best > 0.35 and bl else None)
    return out

_MODEL = None
def asr(path):
    global _MODEL
    if _MODEL is None:
        from faster_whisper import WhisperModel
        _MODEL = WhisperModel("base.en", device="cpu", compute_type="int8")
    segs, _ = _MODEL.transcribe(str(path), word_timestamps=True, beam_size=5)
    segs = list(segs)
    words = [(w.word.strip(), float(w.start), float(w.end)) for s in segs for w in (s.words or [])]
    return " ".join(s.text.strip() for s in segs).strip(), words

norm = lambda s: re.sub(r"[^a-z' ]", " ", s.lower()).split()

def narration():
    print("═" * 100)
    print("NARRATION — what the recorded voice actually says, and how")
    print("═" * 100)
    rows = []
    for story_dir in sorted((ROOT / "library").iterdir()):
        story = json.loads((story_dir / "story.json").read_text())
        for i, page in enumerate(story["pages"], 1):
            src = ROOT / "public" / "library" / story["slug"] / (page.get("audio") or "")
            if not page.get("audio") or not src.exists(): continue
            w = wav(src, f"{story['slug']}-p{i}")
            sr, x = samples(w)
            text = " ".join(t["t"] for t in page["tokens"])
            heard, words = asr(w)
            want, got = norm(text), norm(heard)
            wrong = [a for a, b in zip(want, got) if a != b] if len(want) == len(got) else None
            dur = len(x) / sr
            speech = sum(e - s for _, s, e in words) or dur
            gaps = [words[k+1][1] - words[k][2] for k in range(len(words)-1)]
            long_pauses = [g for g in gaps if g > 0.35]
            f0 = [f for f in pitch_track(x, sr) if f]
            f0.sort()
            lo, hi = (f0[len(f0)//10], f0[-len(f0)//10]) if len(f0) > 10 else (0, 0)
            # do the shipped karaoke timings land on the words ASR heard?
            off = []
            if len(words) == len(page["tokens"]):
                off = [abs(words[k][1] * 1000 - page["tokens"][k]["ms"]) for k in range(len(words))]
            rows.append(dict(slug=story["slug"], page=i, dur=dur, words=len(want),
                             wpm=len(want) / (dur / 60), artic=len(words) / (speech / 60) if speech else 0,
                             match=(got == want), wrong=wrong, heard=heard, pauses=len(long_pauses),
                             sentences=text.count(".") + text.count("!") + text.count("?"),
                             f0lo=lo, f0hi=hi, off_mean=(sum(off)/len(off) if off else None), off_max=(max(off) if off else None)))
    bad = [r for r in rows if not r["match"]]
    print(f"\n{len(rows)} pages · {sum(1 for r in rows if r['match'])} transcribe exactly · {len(bad)} differ")
    for r in bad[:20]:
        print(f"\n  {r['slug']} p{r['page']}: heard “{r['heard']}”")
    wpm = sum(r["wpm"] for r in rows) / len(rows); art = sum(r["artic"] for r in rows) / len(rows)
    print(f"\nspeed:   {wpm:.0f} words per minute overall, {art:.0f} while actually speaking")
    print(f"         slowest page {min(r['wpm'] for r in rows):.0f}, fastest {max(r['wpm'] for r in rows):.0f}")
    # a page with N sentences has N-1 gaps between them; the last full stop is the end of the page
    pausey = [r for r in rows if r["pauses"] < max(0, r["sentences"] - 1)]
    print(f"pauses:  {len(rows)-len(pausey)}/{len(rows)} pages stop at every full stop; {len(pausey)} run sentences together")
    f0lo = sum(r["f0lo"] for r in rows)/len(rows); f0hi = sum(r["f0hi"] for r in rows)/len(rows)
    print(f"tone:    pitch {f0lo:.0f}–{f0hi:.0f} Hz (a flat reader spans under ~40 Hz; a storyteller 80+)")
    aligned = [r for r in rows if r["off_mean"] is not None]
    if aligned:
        print(f"karaoke: highlight is {sum(r['off_mean'] for r in aligned)/len(aligned):.0f} ms from the spoken word on average, worst {max(r['off_max'] for r in aligned):.0f} ms")
        for r in sorted(aligned, key=lambda r: -r["off_max"])[:5]:
            print(f"         worst: {r['slug']} p{r['page']} {r['off_max']:.0f} ms")
    return rows

def clips():
    print("═" * 100)
    print("LETTER SOUNDS — what a listener hears when the app plays one sound, and a whole word")
    print("═" * 100)
    man = json.loads((ROOT / "public" / "sounds" / "manifest.json").read_text())
    for g in sorted(man):
        p = ROOT / "public" / "sounds" / f"{g}.wav"
        w = wav(p, f"clip-{g}")
        heard, _ = asr(w)
        sr, x = samples(w)
        f0 = [f for f in pitch_track(x, sr) if f]
        print(f"  {g:3s} {man[g]['ms']:4d} ms  heard: “{heard or '(no words)'}”")
    print("\nBLENDED WORDS — the app slides the sounds together; does a listener hear the word?")
    sys.path.insert(0, str(ROOT / "scripts" / "audit"))
    import importlib.util
    spec = importlib.util.spec_from_file_location("rb", ROOT / "scripts" / "audit" / "render-blend.py")
    rb = importlib.util.module_from_spec(spec); spec.loader.exec_module(rb)
    for word in ["sat", "pin", "dog", "pen", "cup", "run", "mat", "puff", "kid", "red"]:
        for rate, label in ((1.0, "normal"), (0.85, "slower")):
            sr, x = rb.render(word, rate)
            out = TMP / f"blend-{word}-{label}.wav"
            data = b"".join(struct.pack("<h", max(-32768, min(32767, int(v * 32767)))) for v in x)
            out.write_bytes(b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, sr, sr*2, 2, 16) + b"data" + struct.pack("<I", len(data)) + data)
            heard, _ = asr(out)
            print(f"  {word:5s} {label:7s} {len(x)*1000//sr:5d} ms  heard: “{heard or '(nothing)'}”")

if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("all", "clips"): clips()
    if what in ("all", "narration"): narration()
