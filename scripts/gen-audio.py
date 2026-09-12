#!/usr/bin/env python3
"""
Generate narration audio + word timings for every story in library/, plus the
shared narrator prompts, into public/library/<slug>/ and public/prompts/.

  python3 scripts/gen-audio.py            # all stories
  python3 scripts/gen-audio.py fox-and-crow

Voice: edge-tts en-IN-NeerjaNeural ($0, word boundaries built in). Audio is a
deploy-time artefact: public/library/**/*.m4a is gitignored. Recorded phoneme
clips live in public/sounds/ and are committed; this script only creates
nothing under public/sounds/ — phoneme clips are real recordings fetched by
scripts/fetch-phonemes.py (Wikimedia Commons IPA set, CC BY-SA).

Requires: pip install edge-tts ; ffmpeg on PATH (or imageio-ffmpeg).
"""
import asyncio, json, os, re, shutil, subprocess, sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("pip install edge-tts")

ROOT = Path(__file__).resolve().parents[1]
LIB, PUB = ROOT / "library", ROOT / "public"
NANI, RATE = "en-US-AndrewMultilingualNeural", "-28%"   # US voice; slow enough for a 4-year-old to follow the words (~130 wpm, owner 2026-09-11)

def ffmpeg():
    f = shutil.which("ffmpeg")
    if f: return f
    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
FF = ffmpeg()

def norm(s): return re.sub(r"[^a-z]", "", s.lower())

async def tts(text, out_m4a, voice=NANI, rate=RATE):
    """Synthesize text → m4a (AAC, plays on iOS). Returns (duration_ms, [(word, start_ms)])."""
    tmp = out_m4a.with_suffix(".mp3"); words = []
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    with open(tmp, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary": words.append((ch["text"], ch["offset"] / 1e4))
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(tmp), "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1", str(out_m4a)], check=True)
    tmp.unlink()
    probe = subprocess.run([FF, "-i", str(out_m4a)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
    ms = int((int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])) * 1000)
    return ms, words

def align(tokens, words):
    """Map TTS word boundaries onto display tokens 1:1 by normalised text, in order.
    A token may span several TTS words (e.g. 'Caw!' vs 'Caw'); a TTS word may never span tokens.
    Returns list of start_ms per token, or raises with a clear message."""
    out, wi = [], 0
    for ti, tok in enumerate(tokens):
        target = norm(tok)
        if not target:  # pure punctuation token
            out.append(words[wi][1] if wi < len(words) else (out[-1] if out else 0)); continue
        acc, start = "", None
        while wi < len(words) and len(acc) < len(target):
            w, ms = words[wi]
            if start is None: start = ms
            acc += norm(w); wi += 1
        if acc != target:
            raise SystemExit(f"alignment failed at token {ti} {tok!r}: tts gave {acc!r}")
        out.append(int(start))
    if wi != len(words):
        raise SystemExit(f"alignment failed: {len(words) - wi} unused tts words")
    return out

async def build_story(slug):
    src = LIB / slug / "story.json"; story = json.loads(src.read_text())
    out = PUB / "library" / slug; out.mkdir(parents=True, exist_ok=True)
    for i, p in enumerate(story["pages"], 1):
        text = p.pop("text", None) or " ".join(t["t"] for t in p["tokens"])
        toks = text.split(" ")
        ms, words = await tts(text, out / f"p{i}.m4a")
        starts = align(toks, words)
        p["tokens"] = [{"t": t, "ms": s} for t, s in zip(toks, starts)]
        p["audio"], p["audioMs"] = f"p{i}.m4a", ms
        print(f"  {slug} p{i}: {ms} ms, {len(toks)} tokens")
    ms, _ = await tts(story["moral"]["spoken"], out / "moral.m4a")
    story["moral"]["audio"], story["moral"]["audioMs"] = "moral.m4a", ms
    # story-specific narrator prompts (magic word feedback)
    story["prompts"] = {}
    for p in story["pages"]:
        for w in p.get("magic", []):
            for key, text in ((f"yes:{w}", f"Yes! {w}."), (f"word:{w}", f"{w}.")):
                m, _ = await tts(text, out / f"{key.replace(':', '-')}.m4a"); story["prompts"][key] = {"audio": f"{key.replace(':', '-')}.m4a", "ms": m}
    (out / "story.json").write_text(json.dumps(story, ensure_ascii=False, indent=1))
    src.write_text(json.dumps(story, ensure_ascii=False, indent=1))  # tokens + timings are part of the contract

SHARED = {
    "yours": "This one is yours. Start at the first sound and slide through the word.",
    "fast": "Now say it as one word.",
    "notyet": "That's okay. Listen: I'll slide through the sounds, then you try.",
    "yourturn": "Your turn: start here and slide through the word.",
    "practise": "We'll practise it tomorrow.",
    "line": "Now you. Read your line.",
    "done": "Beautiful reading. This story goes on your shelf.",
    "pick": "Pick today's story. One tap.",
}
async def build_shared():
    out = PUB / "prompts"; out.mkdir(parents=True, exist_ok=True); man = {}
    for k, text in SHARED.items():
        ms, _ = await tts(text, out / f"{k}.m4a"); man[k] = {"audio": f"{k}.m4a", "ms": ms}
    (out / "manifest.json").write_text(json.dumps(man, indent=1))
    print("  shared prompts done (phoneme clips come from scripts/fetch-phonemes.py, not TTS)")

async def main():
    slugs = sys.argv[1:] or [p.name for p in LIB.iterdir() if (p / "story.json").exists()]
    await build_shared()
    for s in slugs: print(s); await build_story(s)

asyncio.run(main())
