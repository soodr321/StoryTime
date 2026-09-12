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
NANI, RATE = "en-US-AndrewMultilingualNeural", "-35%"   # US voice, slow enough to follow the words with a finger
SENTENCE_PAUSE_MS = 420   # a bedtime reader stops at a full stop; edge-tts runs sentences together

def ffmpeg():
    f = shutil.which("ffmpeg")
    if f: return f
    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
FF = ffmpeg()

def norm(s): return re.sub(r"[^a-z]", "", s.lower())

def sentences(text):
    """Split a page into sentences, keeping their punctuation. Quotes stay with the sentence they close."""
    parts = re.split(r'(?<=[.!?])(?=[\s“"]|$)', text)
    return [p.strip() for p in parts if p.strip()]

async def _one(text, voice, rate):
    """One synthesis pass: returns (mp3 bytes, [(word, start_ms)])."""
    buf, words = bytearray(), []
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    async for ch in com.stream():
        if ch["type"] == "audio": buf += ch["data"]
        elif ch["type"] == "WordBoundary": words.append((ch["text"], ch["offset"] / 1e4))
    return bytes(buf), words

async def tts(text, out_m4a, voice=NANI, rate=RATE):
    """
    Synthesize text → m4a (AAC, plays on iOS). Returns (duration_ms, [(word, start_ms)]).
    Sentences are synthesised separately and joined with a real pause: read straight through,
    the voice runs one sentence into the next, which is what made it feel rushed even when the
    words-per-minute figure looked fine.
    """
    tmp = out_m4a.with_suffix(".mp3")
    parts, words, offset = [], [], 0.0
    for i, sent in enumerate(sentences(text) or [text]):
        buf, ws = await _one(sent, voice, rate)
        piece = out_m4a.parent / f".part{i}.mp3"; piece.write_bytes(buf)
        dur = _duration_ms(piece)
        words += [(w, ms + offset) for w, ms in ws]
        parts.append(piece); offset += dur + (SENTENCE_PAUSE_MS if i or True else 0)
    # concat with silence between the pieces
    listing = out_m4a.parent / ".concat.txt"
    sil = out_m4a.parent / ".sil.mp3"
    subprocess.run([FF, "-loglevel", "error", "-y", "-f", "lavfi", "-t", f"{SENTENCE_PAUSE_MS/1000}", "-i", "anullsrc=r=24000:cl=mono", "-c:a", "libmp3lame", str(sil)], check=True)
    lines = []
    for piece in parts: lines += [f"file '{piece.name}'", f"file '{sil.name}'"]
    listing.write_text("\n".join(lines))
    subprocess.run([FF, "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1", str(out_m4a)], check=True, cwd=out_m4a.parent)
    for f in parts + [listing, sil]: f.unlink(missing_ok=True)
    tmp.unlink(missing_ok=True)
    return _duration_ms(out_m4a), words

def _duration_ms(path):
    probe = subprocess.run([FF, "-i", str(path)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
    return int((int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])) * 1000) if m else 0

_ASR = None
def asr_words(path):
    """Word timings measured from the file we actually ship, not from the synthesiser's own offsets."""
    global _ASR
    try:
        if _ASR is None:
            from faster_whisper import WhisperModel
            _ASR = WhisperModel("base.en", device="cpu", compute_type="int8")
    except Exception:
        return None
    wav = path.with_suffix(".asr.wav")
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(path), "-ar", "16000", "-ac", "1", str(wav)], check=True)
    try:
        segs, _ = _ASR.transcribe(str(wav), word_timestamps=True, beam_size=5)
        out = [(w.word.strip(), float(w.start) * 1000) for s in segs for w in (s.words or [])]
    except Exception:
        out = None
    finally:
        wav.unlink(missing_ok=True)
    return out

def realign(tokens, tts_ms, path):
    """
    Prefer timings measured from the audio we actually ship. Synthesising sentence by sentence (for
    the pauses) shifts the synthesiser's own word offsets, and mp3 padding adds more: measured, the
    highlight sat up to 1.9 s from the spoken word, which lands it on the wrong word and can cut the
    narration early before a magic word.

    The transcript will not always match the page exactly (a name, a "Caw!"), so tokens are aligned to
    the heard words by edit distance and any token that was not matched is interpolated between its
    neighbours. Only a page that cannot be anchored at all falls back to the synthesiser.
    """
    heard = asr_words(path)
    if not heard: return tts_ms, False
    a, b = [norm(t) for t in tokens], [norm(w) for w, _ in heard]
    n, m = len(a), len(b)
    # Levenshtein table over words, then walk it back to get the pairs that matched
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1): d[i][0] = i
    for j in range(m + 1): d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d[i][j] = min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (0 if a[i-1] == b[j-1] else 1))
    pairs, i, j = {}, n, m
    while i > 0 and j > 0:
        if a[i-1] == b[j-1] and d[i][j] == d[i-1][j-1]: pairs[i-1] = j-1; i, j = i-1, j-1
        elif d[i][j] == d[i-1][j-1] + 1: i, j = i-1, j-1
        elif d[i][j] == d[i-1][j] + 1: i -= 1
        else: j -= 1
    if len(pairs) < max(2, int(n * 0.6)): return tts_ms, False      # too little to anchor on
    ms = [None] * n
    for ti, hi in pairs.items(): ms[ti] = int(heard[hi][1])
    known = sorted(k for k in range(n) if ms[k] is not None)
    for k in range(n):                                              # interpolate the words ASR misheard
        if ms[k] is not None: continue
        before = [x for x in known if x < k]; after = [x for x in known if x > k]
        if before and after:
            lo, hi = before[-1], after[0]
            ms[k] = int(ms[lo] + (ms[hi] - ms[lo]) * (k - lo) / (hi - lo))
        elif after: ms[k] = max(0, ms[after[0]] - 200 * (after[0] - k))
        else: ms[k] = ms[before[-1]] + 200 * (k - before[-1])
    for k in range(1, n): ms[k] = max(ms[k], ms[k-1] + 20)          # strictly increasing
    return ms, True

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
        starts, measured = realign(toks, starts, out / f"p{i}.m4a")
        p["tokens"] = [{"t": t, "ms": s} for t, s in zip(toks, starts)]
        p["audio"], p["audioMs"] = f"p{i}.m4a", ms
        print(f"  {slug} p{i}: {ms} ms, {len(toks)} tokens{'' if measured else '  (timings from the synthesiser: the audio could not be re-measured)'}")
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
