#!/usr/bin/env python3
"""
Generate narration audio + word timings for every story in library/, plus the
shared narrator prompts, into public/library/<slug>/ and public/prompts/.

  python3 scripts/gen-audio.py            # all stories
  python3 scripts/gen-audio.py fox-and-crow

Voice: Kokoro `af_sarah` at speed 0.65 (~108 wpm on a full page), hosted on DeepInfra
(plan-voice.md A2, resolved 2026-09-20 — chosen by ear from a nine-speed sweep; Apache-2.0
weights, word timestamps confirmed live). Requires DEEPINFRA_API_KEY, read from the environment
or from .env.local (gitignored, never committed) — see require_api_key(). Fail loud, not silent:
no key means this script refuses to generate rather than falling back to another voice
(principle 4). Audio is a deploy-time artefact: public/library/**/*.m4a and public/prompts/ are
gitignored. Recorded phoneme clips live in public/sounds/ and are committed; this script creates
nothing under public/sounds/ — phoneme clips are real recordings fetched by
scripts/fetch-phonemes.py (Wikimedia Commons IPA set, CC BY-SA). The "slide through the word"
blend clips are a separate, still-Andrew-voiced pipeline (scripts/gen-blends.py, plan-voice.md
A7) — not touched here.

Requires: pip install aiohttp ; ffmpeg on PATH (or imageio-ffmpeg).
"""
import asyncio, base64, json, os, re, shutil, subprocess, sys
from pathlib import Path

try:
    import aiohttp
except ImportError:
    sys.exit("pip install aiohttp")

ROOT = Path(__file__).resolve().parents[1]
LIB, PUB = ROOT / "library", ROOT / "public"
DEEPINFRA_URL = "https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M"
VOICE, SPEED = "af_sarah", 0.65   # plan-voice.md A2 — locked by ear; nothing downstream may override this
SENTENCE_PAUSE_MS = 420   # a bedtime reader stops at a full stop; the vendor runs sentences together

_API_KEY = None   # set once by require_api_key() at the top of main(); never guessed

def _read_env_local() -> dict[str, str]:
    """.env.local is a plain `KEY=value` file, gitignored (plan-voice.md A1). No python-dotenv
    dependency for one file with no quoting/escaping needs."""
    path = ROOT / ".env.local"
    out: dict[str, str] = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line: continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out

def require_api_key() -> str:
    """
    Fail loud (plan-voice.md principle 4): no key means this script refuses to touch
    public/library or public/prompts at all — never a silent fallback to another voice. Checked
    once, before build_shared()/build_story() run any I/O.
    """
    key = os.environ.get("DEEPINFRA_API_KEY") or _read_env_local().get("DEEPINFRA_API_KEY")
    if not key:
        sys.exit("DEEPINFRA_API_KEY not set (checked the environment and .env.local): refusing "
                  "to generate. No silent fallback to another voice (plan-voice.md principle 4).")
    return key

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

def sentence_offsets(durations_ms, pause_ms):
    """
    Where each sentence starts in the final concatenated file, given its own duration and the
    join silence between sentences (SENTENCE_PAUSE_MS). offsets[0] is always 0.
    Pure — pulled out of tts() so the join-offset arithmetic (plan-voice.md A3, "Join-offset
    rule") is independently testable: any vendor timestamp for sentence n>1 is only correct if it
    was shifted by the cumulative duration of every earlier sentence *and* every join between them.
    """
    offsets, acc = [], 0.0
    for i, dur in enumerate(durations_ms):
        offsets.append(acc)
        acc += dur + pause_ms
    return offsets

async def _one(text, voice, speed):
    """
    One synthesis pass against DeepInfra Kokoro: returns (mp3 bytes, [(word, start_ms)]).
    Response shape verified live (plan-voice.md): {"audio": "data:audio/mp3;base64,...", "words":
    [{"id","start","end","text"}], ...} with start/end in SECONDS. Only the start is kept here —
    align() (below) only ever consumed a word's start, and realign_from_heard() derives every
    endMs from ASR, never from the vendor. A fresh session per call: this script makes at most a
    few hundred calls per run, and a short-lived session avoids any cleanup edge case on the
    fail-loud abort paths (AbortPage, sys.exit) that skip an orderly close.
    """
    if not _API_KEY:
        raise RuntimeError("require_api_key() must run before any synthesis")
    async with aiohttp.ClientSession() as session:
        async with session.post(
            DEEPINFRA_URL,
            headers={"Authorization": f"bearer {_API_KEY}"},
            json={"text": text, "preset_voice": voice, "speed": speed, "output_format": "mp3", "return_timestamps": True},
            timeout=aiohttp.ClientTimeout(total=120),
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
    audio_field = data["audio"]
    b64 = audio_field.split(",", 1)[1] if audio_field.startswith("data:") else audio_field
    buf = base64.b64decode(b64)
    words = [(w["text"], float(w["start"]) * 1000.0) for w in (data.get("words") or [])]
    return buf, words

async def tts(text, out_m4a, voice=VOICE, speed=SPEED):
    """
    Synthesize text → m4a (AAC, plays on iOS). Returns (duration_ms, [(word, start_ms)]).
    Sentences are synthesised separately and joined with a real pause: read straight through,
    the voice runs one sentence into the next, which is what made it feel rushed even when the
    words-per-minute figure looked fine. Each sentence's own vendor word offsets are shifted by
    sentence_offsets() before being merged, so `words` is already in the final file's timeline.
    """
    tmp = out_m4a.with_suffix(".mp3")
    parts_text = sentences(text) or [text]
    raw = [await _one(sent, voice, speed) for sent in parts_text]
    parts = []
    for i, (buf, _) in enumerate(raw):
        piece = out_m4a.parent / f".part{i}.mp3"; piece.write_bytes(buf); parts.append(piece)
    durations = [_duration_ms(p) for p in parts]
    offsets = sentence_offsets(durations, SENTENCE_PAUSE_MS)
    words = [(w, ms + offset) for (_, ws), offset in zip(raw, offsets) for w, ms in ws]
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
    """
    Word timings measured from the file we actually ship, not from the synthesiser's own offsets.
    Returns [(word, start_ms, end_ms), ...] — the end time is kept (not just the start) so
    tokens[].endMs can come from where Whisper actually heard the word end, never a guess.
    """
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
        out = [(w.word.strip(), float(w.start) * 1000, float(w.end) * 1000) for s in segs for w in (s.words or [])]
    except Exception:
        out = None
    finally:
        wav.unlink(missing_ok=True)
    return out

class AbortPage(Exception):
    """
    Raised when a page's timings cannot be trusted enough to ship (plan-voice.md principle 4:
    fail loud). The caller must not write output for this page — never fall back to a guess.
    """

def _match_tokens(tokens, heard):
    """
    Align display `tokens` to ASR `heard` = [(word, start_ms, end_ms), ...] by minimum edit
    distance over normalised words, then walk the table back to the pairs that actually matched.
    Returns {token_index: heard_index}. A vendor's own word count is irrelevant here — this only
    ever looks at what Whisper actually heard in the file we shipped.
    """
    a, b = [norm(t) for t in tokens], [norm(w) for w, _, _ in heard]
    n, m = len(a), len(b)
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
    return pairs

def realign_from_heard(tokens, heard, vendor_starts, audio_ms, magic_indices=()):
    """
    The pure gating/timing logic behind realign(), separated from the ffmpeg/Whisper I/O so it can
    be unit-tested directly against a synthetic `heard` list.

    Contract (plan-voice.md A3): ASR measures the file we actually ship and owns tokens[].ms and
    tokens[].endMs. A vendor timestamp (`vendor_starts`, from align() — None if the vendor's word
    stream did not map cleanly onto the tokens) may only fill a hole ASR could not reach, and only
    when it falls inside the two ASR anchors bracketing that hole — never a raw positional zip,
    which Kokoro's 21 timestamps against 24 tokens cannot support at all. If Whisper cannot measure
    this file, or measures too little of it, or misses the magic word or the word right before it
    (the two tokens the karaoke stop and the C1 tap-to-hear slice cannot afford to guess), the page
    aborts — it must never silently ship the vendor's own (often 1.9 s off) offsets.

    Returns (ms, endMs): two int lists, one entry per token. Every token gets an endMs — matched
    tokens take Whisper's word end, unmatched (interpolated) tokens take the next token's start —
    and every token satisfies ms[k] < endMs[k] <= (ms[k+1] if any else audio_ms) before it is
    returned; a violation aborts rather than shipping a bad slice boundary.
    """
    n = len(tokens)
    if not heard:
        raise AbortPage("no ASR transcript: cannot measure this page's timings")
    pairs = _match_tokens(tokens, heard)
    if len(pairs) < max(2, int(n * 0.6)):
        raise AbortPage(f"ASR matched only {len(pairs)}/{n} words: too little to anchor on")
    for idx in magic_indices:
        if idx is not None and idx not in pairs:
            raise AbortPage(f"token {idx} ({tokens[idx]!r}) must be ASR-matched: it is the magic word or the word right before it")

    ms = [None] * n
    end = [None] * n
    for ti, hi in pairs.items():
        ms[ti] = int(heard[hi][1]); end[ti] = int(heard[hi][2])
    known = sorted(pairs.keys())
    for k in range(n):
        if ms[k] is not None: continue
        before = [x for x in known if x < k]; after = [x for x in known if x > k]
        v = vendor_starts[k] if vendor_starts is not None and k < len(vendor_starts) else None
        if before and after:
            lo, hi = before[-1], after[0]
            interp = ms[lo] + (ms[hi] - ms[lo]) * (k - lo) / (hi - lo)
            ms[k] = int(v) if (v is not None and ms[lo] <= v <= ms[hi]) else int(interp)   # a vendor timestamp fills the hole only when it agrees with both ASR anchors
        elif after:
            ms[k] = max(0, ms[after[0]] - 200 * (after[0] - k))
        else:
            ms[k] = ms[before[-1]] + 200 * (k - before[-1])
    for k in range(1, n): ms[k] = max(ms[k], ms[k-1] + 20)   # strictly increasing
    for k in range(n):
        if end[k] is None:
            end[k] = ms[k+1] if k + 1 < n else audio_ms      # unmatched -> next.ms

    for k in range(n):
        nxt = ms[k+1] if k + 1 < n else audio_ms
        if not (ms[k] < end[k] <= nxt):
            raise AbortPage(f"token {k} ({tokens[k]!r}) timing gate failed: ms={ms[k]} endMs={end[k]} next={nxt}")
    return ms, end

def realign(tokens, tts_ms, path, magic_indices=()):
    """
    I/O wrapper: measure `path` with Whisper and hand off to realign_from_heard(). Never returns
    the vendor's own offsets — a page that cannot be ASR-measured raises AbortPage instead
    (plan-voice.md A3's "if Whisper cannot measure, abort and do not overwrite story.json").
    """
    heard = asr_words(path)
    audio_ms = _duration_ms(path)
    return realign_from_heard(tokens, heard, tts_ms, audio_ms, magic_indices)

def align(tokens, words):
    """
    Best-effort 1:1 map of vendor TTS word boundaries onto display tokens, by normalised text, in
    order. No longer a hard gate (plan-voice.md A3): Kokoro returns 21 timestamps for a 24-token
    page and Inworld 37-38, so a vendor's word count routinely does not match the tokens at all.
    Returns a list of vendor start_ms per token when the vendor's words DO map onto the tokens
    cleanly, or None otherwise — realign_from_heard() then treats it only as an optional fill for
    ASR holes, never as a substitute for measuring the file.
    """
    out, wi = [], 0
    for tok in tokens:
        target = norm(tok)
        if not target:  # pure punctuation token
            out.append(words[wi][1] if wi < len(words) else (out[-1] if out else 0)); continue
        acc, start = "", None
        while wi < len(words) and len(acc) < len(target):
            w, ms = words[wi]
            if start is None: start = ms
            acc += norm(w); wi += 1
        if acc != target:
            return None   # vendor word stream does not map cleanly onto this token: don't guess
        out.append(int(start))
    if wi != len(words):
        return None       # leftover vendor words: not a clean 1:1 map either
    return out

def resolve_magic(tokens, word):
    """
    Same rule as src/lib/phonics/target.ts resolveMagic(): the token whose normalised text matches
    the magic word, preferring the one that is not capitalised (a capitalised token is a proper
    name — never the modelled word). Returns -1 if nothing matches.
    """
    w = norm(word)
    hits = [i for i, t in enumerate(tokens) if norm(t) == w]
    lower = next((i for i in hits if not tokens[i][:1].isupper()), None)
    return lower if lower is not None else (hits[0] if hits else -1)

async def build_story(slug):
    """
    Synthesise this story's audio + timings into a staging directory and only then swap it in for
    the published one (plan-voice.md A3 "Atomic publish"): the old code wrote each p{i}.m4a
    straight into public/library/<slug>/ inside the page loop and story.json only at the end, so a
    Whisper failure on page 5 left page 5's *new* audio sitting beside pages 1-4's *old* timings —
    a pairing bug manufactured by the generator itself, before any phone cache is involved. Any
    failure (AbortPage or otherwise) deletes the staging directory and leaves the published story
    and its old audio completely untouched.
    """
    src = LIB / slug / "story.json"; story = json.loads(src.read_text())
    final_out = PUB / "library" / slug
    staging = PUB / "library" / f".{slug}.staging"
    if staging.exists(): shutil.rmtree(staging)
    staging.mkdir(parents=True)
    try:
        for i, p in enumerate(story["pages"], 1):
            text = p.pop("text", None) or " ".join(t["t"] for t in p["tokens"])
            toks = text.split(" ")
            ms, words = await tts(text, staging / f"p{i}.m4a")
            vendor_starts = align(toks, words)
            magic_idx = [resolve_magic(toks, w) for w in p.get("magic", [])]
            critical = sorted({j for mi in magic_idx if mi >= 0 for j in ((mi,) if mi == 0 else (mi - 1, mi))})
            starts, ends = realign(toks, vendor_starts, staging / f"p{i}.m4a", critical)
            p["tokens"] = [{"t": t, "ms": s, "endMs": e} for t, s, e in zip(toks, starts, ends)]
            p["audio"], p["audioMs"] = f"p{i}.m4a", ms
            print(f"  {slug} p{i}: {ms} ms, {len(toks)} tokens, ASR-measured")
        ms, _ = await tts(story["moral"]["spoken"], staging / "moral.m4a")
        story["moral"]["audio"], story["moral"]["audioMs"] = "moral.m4a", ms
        # story-specific narrator prompts (magic word feedback)
        story["prompts"] = {}
        for p in story["pages"]:
            for w in p.get("magic", []):
                for key, text in ((f"yes:{w}", f"Yes! {w}."), (f"word:{w}", f"{w}.")):
                    m, _ = await tts(text, staging / f"{key.replace(':', '-')}.m4a"); story["prompts"][key] = {"audio": f"{key.replace(':', '-')}.m4a", "ms": m}
        (staging / "story.json").write_text(json.dumps(story, ensure_ascii=False, indent=1))
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    # everything synthesised and measured cleanly: swap audio + tokens[].ms/.endMs in together
    if final_out.exists(): shutil.rmtree(final_out)
    staging.rename(final_out)
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
    global _API_KEY
    _API_KEY = require_api_key()   # fail loud before anything under public/ is touched (principle 4)
    slugs = sys.argv[1:] or [p.name for p in LIB.iterdir() if (p / "story.json").exists()]
    await build_shared()
    aborted = []
    for s in slugs:
        print(s)
        try:
            await build_story(s)
        except AbortPage as e:
            print(f"  ABORTED {s}: {e}  (old audio and timings untouched)")
            aborted.append(s)
    if aborted:
        sys.exit(f"{len(aborted)} of {len(slugs)} stories aborted: {', '.join(aborted)}")

if __name__ == "__main__":
    # Guarded: importing this module (e.g. to unit-test the pure gating functions above, see
    # scripts/test_gen_audio_gating.py) must never itself talk to DeepInfra or touch public/library
    # or public/prompts. Before this guard, `import`ing the module ran the whole generator.
    asyncio.run(main())
