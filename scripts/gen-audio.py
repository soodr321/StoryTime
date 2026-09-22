#!/usr/bin/env python3
"""
Generate narration audio + word timings for every story in library/, plus the
shared narrator prompts, into public/library/<slug>/ and public/prompts/.

  python3 scripts/gen-audio.py            # the shared prompts and every story
  python3 scripts/gen-audio.py fox-and-crow   # just that story; public/prompts is left alone

Voice: Kokoro `af_sarah` at speed 0.65 (~108 wpm on a full page), hosted on DeepInfra
(plan-voice.md A2, resolved 2026-09-20 — chosen by ear from a nine-speed sweep; Apache-2.0
weights, word timestamps confirmed live).

Every sentence is synthesised behind a carrier lead-in and cut back out (plan-voice.md A7a,
generalised — see synth_sentence()). Kokoro's acoustic model has not settled when an utterance
begins, so the first word after ANY sentence-ending full stop comes out with a phantom syllable
in front of it or with no onset consonant at all. That is not a property of isolated words: it
happens at every sentence boundary in ordinary page narration too, which is 75 of the library's
99 pages. The cut itself is alignment-guided, not a dB search (plan-voice.md A7e): a dB-threshold
search shipped in cae82dd and destroyed the very word the carrier was added to protect, because a
stop consonant's silent closure looks the same to that search as the gap it was hunting for.

Requires DEEPINFRA_API_KEY, read from the environment
or from .env.local (gitignored, never committed) — see require_api_key(). Fail loud, not silent:
no key means this script refuses to generate rather than falling back to another voice
(principle 4). Audio is a deploy-time artefact: public/library/**/*.m4a and public/prompts/ are
gitignored. Recorded phoneme clips live in public/sounds/ and are committed; this script creates
nothing under public/sounds/ — phoneme clips are real recordings fetched by
scripts/fetch-phonemes.py (Wikimedia Commons IPA set, CC BY-SA). The "slide through the word"
blend clips are a separate, still-Andrew-voiced pipeline (scripts/gen-blends.py, plan-voice.md
A7) — not touched here.

Requires: pip install aiohttp numpy ; ffmpeg on PATH (or imageio-ffmpeg).
"""
import asyncio, base64, json, os, re, shutil, statistics, subprocess, sys
from pathlib import Path

try:
    import aiohttp
except ImportError:
    sys.exit("pip install aiohttp")
try:
    import numpy as np
except ImportError:
    sys.exit("pip install numpy")   # the onset gate measures spectra; faster-whisper already pulls numpy in

ROOT = Path(__file__).resolve().parents[1]
LIB, PUB = ROOT / "library", ROOT / "public"
DEEPINFRA_URL = "https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M"
VOICE, SPEED = "af_sarah", 0.65   # plan-voice.md A2 — locked by ear; nothing downstream may override this
SENTENCE_PAUSE_MS = 420   # a bedtime reader stops at a full stop; the vendor runs sentences together
SR_SYNTH = 24000          # Kokoro returns 24 kHz mono; keep the intermediates there and resample once, at the end
SR_ASR = 16000            # what Whisper wants, and what the spectral measurements below use

# The carrier ladder (plan-voice.md A7a, generalised to whole sentences). A comma lead-in keeps the
# model settled; a full stop does not — "Okay. Sat on the mat." comes out with the same phantom word
# as "Sat on the mat." does, which is why a single continuous per-page call cannot fix this either.
# Several carriers because one is not enough: "Listen," ends in /n/, and before a payload that also
# opens on a sonorant ("Woof!") the two run together with no boundary to cut at. Each entry is
# (text, word_count); the cut lands between the carrier's last spoken word and the payload's first.
CARRIERS = (("Listen, ", 1), ("Yes, ", 1), ("Wait, ", 1), ("Look, ", 1), ("Listen to this, ", 3))
ZERO_CROSS_WINDOW_MS = 10.0   # A7e: snap the alignment cut to the nearest zero crossing within this
CUT_FADE_S = 0.003            # A7e: ~3 ms linear fade-in at the cut, so it never starts on a nonzero sample
FIRST_WORD_MIN_MS = 180.0        # A7e's first-word gate: an absolute floor...
FIRST_WORD_MEDIAN_RATIO = 0.5    # ...and at least half the page's own median word duration
PAGE_TRIES = 3            # a page whose timings the gate refuses is re-synthesised, not waved through
LEAD_SILENCE_MS = 580     # Kokoro's own leading pad, measured across the shipped tree (530-630 ms).
                          # Restored after the cut so the pause architecture is unchanged by this fix:
                          # a page still opens ~580 ms in and sentences are still ~1,850 ms apart.

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
    One synthesis pass against DeepInfra Kokoro: returns (mp3 bytes, [(word, start_ms, end_ms)]).
    Response shape verified live (plan-voice.md): {"audio": "data:audio/mp3;base64,...", "words":
    [{"id","start","end","text"}], ...} with start/end in SECONDS. Punctuation comes back as its own
    timestamped entry ("," between the carrier and the payload), which callers must skip — anchoring
    a cut on words[n] rather than on the nth *spoken* word searches the carrier's own vowel tail and
    concludes, wrongly, that there is no gap to cut in.
    A fresh session per call: this script makes at most a few hundred calls per run, and a
    short-lived session avoids any cleanup edge case on the fail-loud abort paths (AbortPage,
    sys.exit) that skip an orderly close.
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
    words = [(w["text"], float(w["start"]) * 1000.0, float(w["end"]) * 1000.0) for w in (data.get("words") or [])]
    return buf, words

# ---------------------------------------------------------------------------------------------
# Measuring the audio: the instruments the onset gate is built from.
# ---------------------------------------------------------------------------------------------

def _pcm(path, sr=SR_ASR, start_ms=0.0):
    """Decode `path` (from `start_ms` on) to a float32 mono numpy array at `sr`."""
    out = subprocess.run(
        [FF, "-loglevel", "error", "-ss", f"{start_ms/1000:.4f}", "-i", str(path),
         "-f", "s16le", "-acodec", "pcm_s16le", "-ar", str(sr), "-ac", "1", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype="<i2").astype(np.float32) / 32768.0

def _rms_db(x, sr=SR_ASR, frame_ms=10):
    """Per-frame RMS in dBFS. One value per 10 ms — the resolution the cut is chosen at."""
    f = int(sr * frame_ms / 1000)
    n = len(x) // f
    if n == 0: return np.array([-120.0])
    r = np.sqrt(np.mean(x[:n*f].reshape(n, f) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(r + 1e-12)

def _speech_onset(x, sr=SR_ASR, floor_db=-42.0, frame_ms=10):
    """
    Sample index of the first real speech: the first frame within `floor_db` of the clip's peak.
    Kokoro pads every synthesis with near-silence, so measuring a spectrum from sample 0 measures
    the padding.
    """
    f = int(sr * frame_ms / 1000)
    db = _rms_db(x, sr, frame_ms)
    hits = np.nonzero(db > db.max() + floor_db)[0]
    return int(hits[0] * f) if len(hits) else 0

def _centroids(x, sr=SR_ASR, n_frames=3, frame_ms=20):
    """
    Spectral centroid (Hz) of each of the first three 20 ms frames of speech — the measurement
    A7a used to prove the defect: bare `sat` came out 616 688 969, which is a vowel, so there was
    no /s/ in it at all; carrier-sliced it is 6122 5969 6291.
    """
    i0 = _speech_onset(x, sr)
    w = int(sr * frame_ms / 1000)
    freqs = np.fft.rfftfreq(w, 1 / sr)
    out = []
    for k in range(n_frames):
        seg = x[i0 + k*w : i0 + (k+1)*w]
        if len(seg) < w: out.append(float("nan")); continue
        mag = np.abs(np.fft.rfft(seg * np.hanning(w)))
        out.append(float((freqs * mag).sum() / (mag.sum() + 1e-12)))
    return out

# Only two onset classes are asserted, and only because both separate cleanly on measured data:
# a sibilant onset reaches 4.0-6.1 kHz within the first two frames when it survives and stays at
# 0.6-2.3 kHz when it does not, and an /m n/ onset drops to 350-700 Hz somewhere in the first three
# frames when it survives while a phantom syllable in its place holds 1.1-5.9 kHz throughout.
#
# Everything else is left to the phantom check below and to the parent's ear (plan-voice.md A7's
# rule 1: automation catches regressions, it does not choose). A7c already says centroid cannot
# judge a vowel-initial word; measurement adds four more classes it cannot judge either:
#   /f/   labiodental, diffuse and quiet — the same `fan.` measured 4273 Hz on one call and
#         1515 Hz on the next, with the onset audibly present in both, so a threshold here
#         would abort books at random;
#   /h/   breathy, 1.9-4.5 kHz whether or not the defect is present;
#   /th/  voiced — "They were scared." reads 338 Hz when it is completely correct;
#   stops, liquids and glides, which have no steady-state onset to measure at all.
SIBILANT_ONSETS = ("sh", "ss", "s")
NASAL_ONSETS = ("m", "n")
SIBILANT_MIN_HZ = 2500.0
NASAL_MAX_HZ = 900.0

def _onset_rule(word):
    w = norm(word)
    if not w: return None
    for g in SIBILANT_ONSETS:
        if w.startswith(g): return "sibilant"
    for g in NASAL_ONSETS:
        if w.startswith(g): return "nasal"
    return None

def _alignment_cut_point(heard, n_carrier):
    """
    Where to cut the carrier off its payload (plan-voice.md A7e): the midpoint between the
    carrier's last spoken word and the payload's first, both measured by Whisper on the actual
    carrier+payload render. Returns the cut point in ms, or None if Whisper did not report enough
    spoken words to find both sides of the gap, or the two sides leave no gap at all — either way
    the caller should try the next carrier rather than guess.

    This replaces a dB-threshold search that was the actual bug behind A7e: cae82dd's cut searched
    forward for the quietest frame using the VENDOR's (Kokoro's) own word boundaries as the window.
    A stop consonant begins with a silent closure, and so does the gap after the carrier's comma, so
    that search routinely walked through the whole gap, through the payload's first word, and
    latched onto a LATER closure inside a later word — shipping a ~65 ms trailing burst instead of
    the word the carrier was added to protect. Cutting at the midpoint between two Whisper-measured
    word boundaries has no "quiet enough" threshold to walk past: it cannot land inside either word,
    whatever their phonemes are, which is why this is also phoneme-invariant like the gate below.
    """
    spoken = [i for i, (w, _, _) in enumerate(heard) if norm(w)]
    if len(spoken) <= n_carrier: return None
    carrier_end = heard[spoken[n_carrier - 1]][2]
    payload_start = heard[spoken[n_carrier]][1]
    if payload_start <= carrier_end: return None   # no gap Whisper can see: try the next carrier
    return (carrier_end + payload_start) / 2.0

def _nearest_zero_crossing(x, sr, center_ms, window_ms=ZERO_CROSS_WINDOW_MS):
    """
    Sample index in mono float PCM `x` (at `sr`) nearest to `center_ms` where the waveform crosses
    zero, searched within +/- `window_ms`. Landing the cut exactly on a zero crossing is what keeps
    the ~3 ms fade-in (CUT_FADE_S) from starting on a nonzero sample and clicking.

    Falls back to the centre sample when the window has no sign change — true digital silence reads
    as all-zero, which is already "on" a zero crossing everywhere inside it, so the centre is as
    good as any other sample in the window.
    """
    center = int(round(center_ms * sr / 1000))
    span = int(round(window_ms * sr / 1000))
    lo, hi = max(0, center - span), min(len(x) - 1, center + span)
    if hi <= lo: return center
    seg = x[lo:hi + 1]
    signs = np.sign(seg)
    crossings = [i for i in range(1, len(seg)) if signs[i] == 0 or signs[i] != signs[i - 1]]
    if not crossings: return center
    best = min(crossings, key=lambda i: abs((lo + i) - center))
    return lo + best

def _first_word_ok(duration_ms, context_ms):
    """
    plan-voice.md A7e's gate: the payload's first word must last at least FIRST_WORD_MIN_MS AND at
    least FIRST_WORD_MEDIAN_RATIO of the median word duration measured elsewhere on the same page
    (`context_ms`) — both straight from Whisper's own span, never a spectral or transcription check.
    Deliberately phoneme-invariant: A7a already found the onset centroid unusable on vowel-initial
    payloads, and a transcription check is exactly what the bug hid from — Whisper's language prior
    transcribes a clipped word correctly while still reporting its true, too-short span, which is
    what caught this bug in the first place (65 ms measured against a "the" that Whisper spelled
    perfectly). With no page context yet (a one-word prompt clip, or nothing else on the page has
    been measured yet), only the absolute floor applies.
    """
    if duration_ms < FIRST_WORD_MIN_MS: return False
    if not context_ms: return True
    return duration_ms >= FIRST_WORD_MEDIAN_RATIO * statistics.median(context_ms)

def _onset_verdict(path, tokens):   # -> (reason or None, heard)
    """
    Did the payload survive the cut with its first sound intact? Returns (reason, heard): reason is
    None when it did and a string naming what is wrong when it did not, and `heard` is what Whisper
    read back, which synth_sentence() uses to pick between takes of a one-word clip.
    Two independent instruments, because neither is sufficient alone:

    * **No phantom in front.** Whisper localises the defect as an inserted word — bare "Sat on the
      mat." transcribes as "They sat on the mat." and "Pat was hot." as "A pat was hot." So: align
      the tokens to what was heard and fail if the first token matched anything but the first thing
      heard. An unmatched first token is *not* failed on — Whisper mishears "Pat" as "Hat" and
      spells "Nani" as "Nanny" on perfectly good audio, and a book must not be blocked by that.
    * **Onset class.** A7a's warning is that Whisper's language prior transcribes an onsetless "at"
      as "sat", so the phantom check can be fooled exactly where it matters most. The centroid
      cannot be, for the two classes where it separates (_onset_rule).

    A third instrument — "is there sound before the first word Whisper heard" — is deliberately
    absent: asr_words() now moves a word start forward out of silence, so it would compare a
    number with itself. The first-word duration gate in synth_sentence() (plan-voice.md A7e, run on
    this function's `heard` after it returns) is what stands in for it: a cut that clipped into the
    payload does not just fail to sound right, it measures short.
    """
    heard = asr_words(path)
    if not heard: return "no ASR transcript for this sentence", []
    first = next((t for t in tokens if norm(t)), None)
    if first is None: return None, heard
    pairs = _match_tokens(tokens, heard)
    ti = next(i for i, t in enumerate(tokens) if norm(t))
    if ti in pairs and pairs[ti] != 0:
        return f"phantom before {first!r}: heard {' '.join(w for w, _, _ in heard[:pairs[ti]+1])!r}", heard
    rule = _onset_rule(first)
    if rule:
        c = _centroids(_pcm(path))
        if rule == "sibilant" and not (max(c[0], c[1]) >= SIBILANT_MIN_HZ):
            return f"{first!r} has no fricative onset: centroids {c[0]:.0f} {c[1]:.0f} {c[2]:.0f} Hz", heard
        if rule == "nasal" and not (min(c) <= NASAL_MAX_HZ):   # "man" holds 1540/1417 Hz for two frames and only then drops to 419
            return f"{first!r} has no nasal onset: centroids {c[0]:.0f} {c[1]:.0f} {c[2]:.0f} Hz", heard
    return None, heard

async def synth_sentence(text, work, stem, voice=VOICE, speed=SPEED, exact=None, page_word_durations=None):
    """
    Synthesise ONE sentence with its onset intact, and return
    (samples at SR_SYNTH, [(word, start_ms, end_ms)] relative to those samples, this sentence's own
    Whisper-measured word durations in ms).

    The sentence is never sent on its own. It goes behind a carrier lead-in ("Listen, ...") which
    absorbs the unsettled start of the utterance, and the carrier is then cut back out at the
    midpoint of the gap between the carrier's last word and the payload's first — both measured by
    Whisper on the carrier+payload render (plan-voice.md A7e). If the carrier and the payload ran
    together with no gap, the cut did not leave a clean onset behind, or the first word came out too
    short (the gate below), the next carrier in the ladder is tried; when the ladder is exhausted
    the page aborts rather than shipping a word with no first sound (plan-voice.md principle 4 — the
    same reason realign() refuses a page it cannot measure).

    `page_word_durations` is the running list of Whisper-measured word durations (ms) from the
    sentences already synthesised earlier on this same page — tts() accumulates it sentence by
    sentence. It is the "median word duration on that page" the A7e gate compares the first word
    against; None/empty for a page's first sentence (which still has its OWN later words as context,
    folded in below) and for one-word prompt clips, where only the absolute floor applies.

    `exact` is for the one-word clips — `word:{w}` and the word half of `yes:{w}` — where
    plan-voice.md A7's gate 2 applies: Whisper must read the clip back as the word itself. It is a
    preference, not a gate, and deliberately so: Whisper spells `sun` as "Son" and `mat` as "Matt"
    on clips that are perfectly good, so failing on a mismatch would refuse correct audio. Instead
    every carrier is tried and the first take Whisper reads back correctly wins; if none does, the
    first take that passed the onset gate ships and the run prints what was heard, because a `bat`
    that comes back as "that" is exactly the kind of thing the parent should listen to (A7 gate 1:
    automation catches regressions, it does not choose). The duration gate is not relaxed for this
    preference — a short first word is rejected before `exact` is even considered.
    """
    tokens = text.split(" ")
    reasons, fallback = [], None
    for carrier, n_carrier in CARRIERS:
        raw = work / f".{stem}.raw.mp3"
        buf, words = await _one(carrier + text, voice, speed)
        raw.write_bytes(buf)
        try:
            heard_raw = asr_words(raw)
            if not heard_raw:
                reasons.append(f"{carrier!r}: no ASR transcript for the carrier+payload render"); continue
            found = _alignment_cut_point(heard_raw, n_carrier)
            if found is None:
                reasons.append(f"{carrier!r}: Whisper found no clean gap after the carrier"); continue
            x16 = _pcm(raw, SR_ASR)
            cut = _nearest_zero_crossing(x16, SR_ASR, found) / SR_ASR * 1000.0
            piece = work / f".{stem}.piece.mp3"
            subprocess.run([FF, "-loglevel", "error", "-y", "-ss", f"{cut/1000:.4f}", "-i", str(raw),
                            "-af", f"afade=t=in:st=0:d={CUT_FADE_S}",
                            "-c:a", "libmp3lame", "-q:a", "2", "-ar", str(SR_SYNTH), "-ac", "1", str(piece)], check=True)
            try:
                bad, heard = _onset_verdict(piece, tokens)
                if bad:
                    reasons.append(f"{carrier!r}: {bad}"); continue
                first_dur = heard[0][2] - heard[0][1]
                context = list(page_word_durations or []) + [en - st for _, st, en in heard[1:]]
                if not _first_word_ok(first_dur, context):
                    ref = f"page median {statistics.median(context):.0f} ms" if context else "no page context yet"
                    reasons.append(f"{carrier!r}: first word only {first_dur:.0f} ms ({ref})"); continue
                x = _pcm(piece, SR_SYNTH)
                payload = [(t, st - cut, en - cut) for t, st, en in words if st >= cut]
                durations = [en - st for _, st, en in heard]
                if exact is None: return x, payload, durations
                said = " ".join(norm(w) for w, _, _ in heard if norm(w))
                if said == norm(exact): return x, payload, durations
                if fallback is None: fallback = (x, payload, durations, said)
                reasons.append(f"{carrier!r}: heard {said!r}, not {norm(exact)!r}")
            finally:
                piece.unlink(missing_ok=True)
        finally:
            raw.unlink(missing_ok=True)
    if fallback is not None:
        x, payload, durations, said = fallback
        print(f"    ! {exact!r} ships as the best of {len(CARRIERS)} takes; Whisper reads it back as {said!r} — listen to this one")
        return x, payload, durations
    raise AbortPage("no carrier produced a clean, full-length onset for " + repr(text[:60]) + " — " + "; ".join(reasons))

def _encode(samples, out_m4a):
    """Write float32 mono samples at SR_SYNTH to `out_m4a` as AAC, the format the app ships."""
    pcm16 = np.clip(samples, -1.0, 1.0) * 32767.0
    subprocess.run([FF, "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(SR_SYNTH), "-ac", "1",
                    "-i", "pipe:0", "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1", str(out_m4a)],
                   input=pcm16.astype("<i2").tobytes(), check=True, capture_output=True)

async def tts(text, out_m4a, voice=VOICE, speed=SPEED, exact_word=None):
    """
    Synthesize text -> m4a (AAC, plays on iOS). Returns (duration_ms, [(word, start_ms)]).

    Sentences are synthesised separately and joined with a real pause: read straight through, the
    voice runs one sentence into the next, which is what made it feel rushed even when the
    words-per-minute figure looked fine. Each sentence goes through synth_sentence(), so each one
    is carrier-protected and cut — and each is then padded back to LEAD_SILENCE_MS of leading
    silence, because the cut removes Kokoro's own ~580 ms pad along with the carrier and without
    that restoration every pause in the library would shorten by a third.
    Each sentence's own vendor word offsets are shifted into the final file's timeline before being
    merged, so `words` is already in the final file's timeline (plan-voice.md A3 join-offset rule).

    `page_word_durations` accumulates each sentence's own Whisper-measured word spans as they are
    produced, so sentence 2's first-word gate (plan-voice.md A7e) is judged against sentence 1's
    words too, not just its own — "the median word duration on that page" means the whole page, and
    sentences are the only thing this function can see becoming a page.
    """
    parts_text = sentences(text) or [text]
    pieces, word_sets = [], []
    page_word_durations: list[float] = []
    for i, sent in enumerate(parts_text):
        # `Yes! nap.` is two sentences; the preference applies to the one that IS the word
        want = exact_word if (exact_word and norm(sent) == norm(exact_word)) else None
        x, payload, word_durations = await synth_sentence(
            sent, out_m4a.parent, f"{out_m4a.stem}.s{i}", voice, speed, want, page_word_durations)
        page_word_durations.extend(word_durations)
        lead_ms = _speech_onset(x, SR_SYNTH) / SR_SYNTH * 1000
        pad = np.zeros(int(max(0.0, LEAD_SILENCE_MS - lead_ms) * SR_SYNTH / 1000), dtype=np.float32)
        pieces.append(np.concatenate([pad, x]))
        word_sets.append([(t, st + len(pad) / SR_SYNTH * 1000) for t, st, _ in payload])
    durations = [len(pc) / SR_SYNTH * 1000 for pc in pieces]
    offsets = sentence_offsets(durations, SENTENCE_PAUSE_MS)
    words = [(w, ms + off) for ws, off in zip(word_sets, offsets) for w, ms in ws]
    join = np.zeros(int(SENTENCE_PAUSE_MS * SR_SYNTH / 1000), dtype=np.float32)
    out = np.concatenate([p for pc in pieces for p in (pc, join)])   # a join after the last piece too, as before
    _encode(out, out_m4a)
    return _duration_ms(out_m4a), words

def _duration_ms(path):
    probe = subprocess.run([FF, "-i", str(path)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
    return int((int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])) * 1000) if m else 0

def _snap_starts_out_of_silence(path, heard, floor_db=-50.0):
    """
    Move each measured word start forward to the first frame that actually has sound in it.

    Whisper stretches the word that OPENS a segment back to the segment boundary, and a segment
    boundary sits in silence — so the first word of a page was measured as starting at 0 ms in a
    file whose first 580 ms are digital silence, and came out 1.6-2.8x longer than the page's
    other words. That reads like the onset defect and is not: it is 26 of the 49 shipped pages,
    and every one of them is a page whose tokens[0].ms is exactly 0. A word cannot begin during
    silence, so advancing the start to where sound begins is a measurement correction, not a
    guess (plan-voice.md principle 6). Nothing moves an end, and nothing moves a start past its
    own end.
    """
    if not heard: return heard
    db = _rms_db(_pcm(path))
    quiet = db < db.max() + floor_db
    out = []
    for w, st, en in heard:
        k = int(st // 10)
        while k < len(quiet) and (k + 1) * 10 <= en and quiet[k]: k += 1
        moved = max(st, float(k * 10))
        # A word whose whole span reads as silence tells us nothing, and snapping it to its own end
        # would manufacture the zero-width span the ms < endMs gate exists to catch. Leave it as
        # Whisper measured it and let the gate decide.
        out.append((w, moved if moved < en else st, en))
    return out

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
    return _snap_starts_out_of_silence(path, out) if out else out

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
    return _bridge_substitutions(pairs, n, m)

def _bridge_substitutions(pairs, n, m):
    """
    One unmatched token, bracketed by matched neighbours, with exactly one unclaimed heard word in
    the same gap: that heard word IS the token, however Whisper spelled it. Pair them.

    Whisper spells `hare` "hair", `howled` "held", `dal` "doll" and `Nani` "Nanny" — homophones and
    near-homophones of audio that is perfectly correct. Dropping those words costs twice. The token
    loses its real measurement and gets a synthetic one, and that synthetic time lands *inside* the
    measured span of the word before it (`dal` interpolated to 7,300 ms while `making` was measured
    to 7,540 ms), so the page then fails the `endMs <= next.ms` gate and the whole book aborts. Three
    of the sixteen books aborted for exactly this, identically on every retry.

    This is not the "raw positional zip" A3 forbids — that was zipping a vendor's 21 timestamps onto
    24 tokens across a whole page. This is a single hole with a confirmed ASR anchor on each side and
    exactly one candidate inside it, so the correspondence is forced. The times stay ASR's; only the
    spelling is overruled. A hole of two or more tokens is left alone: the ASR is struggling there
    and the correspondence is no longer forced, so the page fails loud as before.
    """
    for ti in range(n):
        if ti in pairs: continue
        lo = pairs.get(ti - 1, -1) if ti > 0 else -1
        hi = pairs.get(ti + 1, m) if ti + 1 < n else m
        if (ti > 0 and ti - 1 not in pairs) or (ti + 1 < n and ti + 1 not in pairs): continue
        if hi - lo == 2: pairs[ti] = lo + 1
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
            magic_idx = [resolve_magic(toks, w) for w in p.get("magic", [])]
            critical = sorted({j for mi in magic_idx if mi >= 0 for j in ((mi,) if mi == 0 else (mi - 1, mi))})
            for attempt in range(1, PAGE_TRIES + 1):
                ms, words = await tts(text, staging / f"p{i}.m4a")
                vendor_starts = align(toks, words)
                try:
                    starts, ends = realign(toks, vendor_starts, staging / f"p{i}.m4a", critical)
                    break
                except AbortPage as e:
                    # a retry is a different take, not the same audio measured twice: every Kokoro
                    # call is a fresh sample, and Whisper's occasional zero-width span or missed
                    # word does not survive one. The gate is untouched — the synthesis is asked
                    # again until it satisfies it, and after PAGE_TRIES the page still aborts.
                    print(f"  {slug} p{i}: retry {attempt}/{PAGE_TRIES} — {e}")
                    if attempt == PAGE_TRIES: raise
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
                    m, _ = await tts(text, staging / f"{key.replace(':', '-')}.m4a", exact_word=w)
                    story["prompts"][key] = {"audio": f"{key.replace(':', '-')}.m4a", "ms": m}
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

def _ts_string_array(path, pattern):
    """Every quoted string inside each array the regex finds. The .ts files are the source of
    truth for these word sets (One fact, one home) — copying them into this script would let the
    two drift, and scripts/prompt-coverage.test.ts reads the same two files to check they have not."""
    text = Path(path).read_text()
    out = []
    for body in re.findall(pattern, text, re.S):
        out += re.findall(r'"([^"]+)"', body)
    return out

def prompt_words():
    """
    Every word `word:{w}` must be able to say, in order, deduplicated (plan-voice.md A6/C3 + E3).

    The 66 TEACH.*.words chips — `apple`, `ink`, `under` — appear on no page, so they cannot be a
    narration slice, and they are not blend targets either: they exist so the child hears the sound
    *inside* a word at normal pace. Plus the eight TRICKY_PHASE2 words, which `Story.tsx:376` and
    `TeachSound.tsx:37` speak today through the OS voice (C5). This set was deliberately left
    ungenerated until now, because generating it before the onset fix would have baked the defect
    into all 74 clips: the form is `f"{w}."`, which is the exact broken pattern.
    """
    words = _ts_string_array(ROOT / "src/lib/phonics/teach.ts", r"\bwords:\s*\[(.*?)\]")
    words += _ts_string_array(ROOT / "src/lib/phonics/learner.ts", r"\bTRICKY_PHASE2\s*=\s*\[(.*?)\]")
    seen, out = set(), []
    for w in words:
        if w.lower() in seen: continue      # `sock` is both s and ck; `off` is both o and ff
        seen.add(w.lower()); out.append(w)
    return out

async def build_shared():
    """
    Staged and swapped whole, exactly like build_story() (plan-voice.md A3 "Atomic publish"). The
    old version wrote each clip straight into public/prompts/ and the manifest at the end, so one
    word the onset gate would not pass left the published set half new, half old, with a manifest
    describing neither. There is no partial success here: either every prompt is regenerated in
    this voice or the published set is left exactly as it was.
    """
    final_out = PUB / "prompts"
    staging = PUB / ".prompts.staging"
    if staging.exists(): shutil.rmtree(staging)
    staging.mkdir(parents=True)
    try:
        man, failed = {}, []
        words = prompt_words()
        for key, text, fname in ([(k, t, f"{k}.m4a") for k, t in SHARED.items()]
                                 + [(f"word:{w}", f"{w}.", f"word-{w}.m4a") for w in words]):
            try:
                ms, _ = await tts(text, staging / fname, exact_word=key[5:] if key.startswith("word:") else None)
                man[key] = {"audio": fname, "ms": ms}
            except AbortPage as e:
                failed.append(f"{key}: {e}")   # keep going: one run should name every prompt it cannot make, not just the first
        if failed:
            raise AbortPage(f"{len(failed)} of {len(SHARED) + len(words)} prompts have no clean onset:\n    "
                            + "\n    ".join(failed))
        (staging / "manifest.json").write_text(json.dumps(man, indent=1))
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    if final_out.exists(): shutil.rmtree(final_out)
    staging.rename(final_out)
    print(f"  shared prompts done: {len(SHARED)} scripted + {len(words)} word:*  "
          "(phoneme clips come from scripts/fetch-phonemes.py, not TTS)")

async def main():
    global _API_KEY
    _API_KEY = require_api_key()   # fail loud before anything under public/ is touched (principle 4)
    named = sys.argv[1:]
    slugs = named or [p.name for p in LIB.iterdir() if (p / "story.json").exists()]
    if named:
        # public/prompts/ is shared, not per-story: regenerating one book should not spend half an
        # hour rebuilding 82 clips that have nothing to do with it, nor republish them on a run
        # whose point was one story.
        print("(named stories: public/prompts left alone — run with no arguments to rebuild it)")
    else:
        try:
            await build_shared()
        except AbortPage as e:
            sys.exit(f"shared prompts aborted: {e}\n(public/prompts left exactly as it was; no story was touched)")
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
