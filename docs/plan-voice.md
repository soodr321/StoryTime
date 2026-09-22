# One voice, once: fixing every sound StoryTime makes — v5 (APPROVED)

Status: **APPROVED**. Grok 4.6 GO and Gemini 3.8 Flash GO on v4; their closing [P2]s folded here as v5.
Four review rounds; every round caught a defect that would have shipped.
Owner: Claude (reviewer) · Implementation: Sonnet agent.
Voice choice: the parent's, by ear. Nothing downstream guesses.

## What changed from v1, and who caught it

v1 was wrong in ways that mattered. Recorded so the same mistakes are not re-proposed:

| v1 said | Why it was wrong | Found by |
|---|---|---|
| Generate a blend clip for all 504 library words | Those are *narration* words (`because`, `afternoon`). A stretched TTS model of them teaches the wrong thing, and 447 files are unnecessary. **Tap-to-hear should slice the page narration** — `playClip` already takes `{startMs,endMs}` and every page already has `tokens[].ms`. Same voice, same take, zero new files. | Grok |
| Take `words` timestamps from the TTS response | Throws away `realign()` (`gen-audio.py:105`), which exists *because* edge-tts WordBoundary drifted up to 1.9 s. Bad timings make the app **speak the magic word** the child was meant to read. | Grok |
| `playbackRate` resampling is the cause | Browsers time-stretch (WSOLA/phase vocoder), not resample. The artifact is phase dispersion and transient smearing. And neural TTS at `speaking_rate` ≤0.6 slurs too — slow-at-synthesis is not free. | Gemini |
| "Same for `SegmentPanel` and `WarmUp`" | `SegmentPanel.tsx:50` already plays the *isolated phoneme* on a tile tap, which is correct. v1 would have destroyed the segmenting exercise. | Gemini |
| Three `speakText` sites | There are **nine**. Plus `speech.ts` hardcodes `u.rate = 0.9 *` **and** `u.pitch = 1.05`, so even "Web Speech at 1.0" is slowed and pitched. | Grok |
| Rebuild the sounds manifest | `build-sounds.py:45` re-runs `import-voice-pack.py`, which **re-trims and re-cuts every clip** — violating B1 in the same plan. Provenance must be metadata-only. | Grok |
| Target 115 wpm heard | The complaint was *robotic*, not *slow*. Articulation is already ~121 wpm once the 420 ms sentence pauses are removed; 115 overall is a **+39% speed-up at bedtime nobody asked for**. | Grok (Gemini agreed on direction, proposed 75–85) |
| Git revert as rollback | `public/library/` and `public/prompts/` are **gitignored**. Git restores JS, not the voice. | Grok |
| Surface Kathryn's credit in the UI (B4) | Already done — `Settings.tsx:56` and `RecordSounds.tsx:114`. Verify, don't churn. | Grok |

Independently found by verification: the runtime audio cache is **`maxEntries: 120`** against **384 shipped audio assets** — the LRU already thrashes, so most audio is not offline today.

## Measured state (2026-09-19, live)

Four voices, three degraded, plus a fourth surface v1 missed entirely (`public/prompts/`, 9 files).

| Surface | Source | Rate actually applied | Heard |
|---|---|---|---|
| Narration | edge-tts Andrew, synth −35% | × 0.85 (× 0.88 more at bedtime) via `playbackRate` | **94 wpm** (83 bedtime); file is 110 |
| Letter sounds | Kathryn J. Davis recordings | none | **correct — leave alone** |
| Prompts (`yes:{w}`, `word:{w}`, done/fast/line…) | edge-tts Andrew | falls through to `speakText` when a file is missing | third voice on miss |
| Blend model, clip hit (147 files) | edge-tts −55%, `playClip` locked to 1.0 | none | acceptable |
| Blend model, clip miss | Web Speech | 0.9 × 0.55 × 0.85 = **0.42** | a drawl |
| Any word tapped | Web Speech | 0.9 × 0.85 = **0.77**, pitch 1.05 | a different person mid-sentence |
| Family narration | Web Speech | 0.77 | same |

`playWord` already ignores `rate` on a clip hit, so WarmUp/Teach's 0.85 is dead code today.

## Principles (acceptance criteria)

1. **One slowdown, at synthesis.** No speech path applies a playback-time rate. Enforced by a runtime spy, not a grep.
2. **In a library session, speech is the chosen narrator or Kathryn — never the OS voice.** Deliberately *not* "exactly two sources": a parent's recorded page and family-recorded phonemes are better than either and must keep working.
3. **Never TTS a phoneme, never say a letter's name.** Unchanged.
4. **Fail loud.** No key, or no chosen voice ⇒ the generator **refuses to overwrite** `public/library` and `public/prompts`. No silent edge-tts fallback.
5. **Never model a word the child was about to read.** A whole-word clip must not be reachable before the child's attempt.
6. **Timings are measured from the file, never trusted from a vendor.**

## Work

### A. Narrator

- **A1.** `DEEPINFRA_API_KEY` from `.env.local` (gitignored). **Done — key verified live.**
- **A2 — RESOLVED 2026-09-20. The narrator is Kokoro `af_sarah` at `speed: 0.65`** (~108 wpm on a
  full two-sentence page), chosen by the parent by ear from a nine-speed sweep. Apache-licensed
  weights, word timestamps confirmed live, runs locally as well as hosted. Everything downstream
  uses exactly this voice and speed; no other voice appears in a library session.
  *(Original blocking criteria, kept for the record:)* First cut published (14 candidates, one sentence).
  Empirically confirmed on live calls: **Inworld 37–38 word timestamps, Kokoro 21, Qwen 0.**
  **Qwen is eliminated** — it cannot drive karaoke. Before the final pick, extend the test to a
  **full *Dad Did Nap* page** (multi-sentence, with the 420 ms joins), a magic prompt, a CVC model,
  and a name + exclamation. One sentence is not enough evidence.
- **A2b (blocking, legal).** Read the ToS for the shortlisted vendor. This app **ships** generated
  audio publicly from two hosts. A voice whose terms forbid redistribution cannot be picked,
  whatever it sounds like. Kokoro's weights are Apache-2.0; hosted Inworld is not the same question.
- **A3. ASR is the timing source; vendors never are.** v2 said "keep `realign()`" and then described
  the pipeline that defeats it. Two concrete failures:
  `align()` requires an exact 1:1 vendor-word/token match and `SystemExit`s otherwise — and A2
  measured **Kokoro 21 timestamps against a 24-token page, Inworld 37–38**, so both new vendors
  **crash before `realign()` runs**. And `realign()` returns the *vendor's* times when Whisper finds
  no transcript or matches <60% of tokens, which is v1's bug with a log line.
  The contract: synthesise the file (joins included) → **`realign()` measures that file and owns
  `tokens[].ms` and the new `tokens[].endMs`** → vendor timestamps may fill unmatched holes only
  after a successful anchor → **if Whisper cannot measure, abort and do not overwrite `story.json`**
  (principles 4 and 6). `align()` must stop being a hard gate on vendor word counts.
  **Atomic publish.** v3 said "abort and do not overwrite `story.json`" — but `build_story` writes
  each `p{i}.m4a` *inside* the page loop and `story.json` only at the end, so a Whisper failure on
  page 5 leaves **new audio beside old timings** on disk: F3's pairing bug, manufactured by the
  generator before any phone cache is involved. G1's snapshot is a human restore, not a publish.
  Synthesise into a staging directory and swap audio + `tokens[].ms` + `tokens[].endMs` together,
  or delete the new audio on abort.
  **Fail closed on the words that matter.** A 60% anchor can *interpolate* the magic token and the
  token before it — which is precisely how the karaoke stop and the C1 clamp would get a guessed
  time. Those two tokens must be ASR-matched or the page aborts. Hole-fill is interpolation between
  ASR anchors, never a vendor 1:1 zip (Kokoro's 21 against 24 tokens admits no such zip).
  Gate `ms < endMs ≤ next.ms` (last token `≤ audioMs`) before writing. (Grok, round 3.)
  **Every token gets an `endMs`** — matched tokens take Whisper's `w.end`; unmatched (interpolated)
  tokens take `next.ms`. Never omit it: a listener can tap an interpolated word, and an absent `endMs`
  sends C1 back to inventing `nextStart` as the end — the `the`=100 ms / sentence-final=1,640 ms bug
  C1 exists to kill. (Grok, round 4.)
  **Join-offset rule:** sentences are synthesised separately and concatenated with 420 ms joins, so a
  vendor timestamp filling a hole in sentence *n*>1 must be offset by the cumulative duration of the
  preceding sentences **and their joins** before it is written. If a vendor gives starts only, clamp
  any synthetic `endMs` strictly to the next token's anchor. (Gemini, round 3.)
- **A4.** **Three rate sites, not one**: `Story.tsx:69`, `WarmUp.tsx:32`, `TeachSound.tsx:38`.
  (`blend.test.ts` passing 0.85 into `timeline()` is hold duration, E1-exempt.) Target **~100 wpm as heard**, band **90–110** — today's tracking speed, minus the stretching.
  Delete the 0.85 and 0.88 multipliers. Parent confirms the final pace by ear.
- **A5. Reviewers split; resolved toward Grok.** Gemini argued a single ~100 wpm take is a 20–32%
  bedtime speed-up with no recourse. But the take is generated *natively at whatever pace sounds
  right when heard at bedtime* — the number is set by ear, not arithmetic, so there is no speed-up
  to recover from. Bedtime's ×0.88 **is** the stretch this plan exists to kill. Dual takes double the
  library and add a whole class of timing-mismatch bugs for a knob whose only current function is to
  apply the artifact. **Remove the "Reading pace" control** (and bedtime's extra slowdown). A second pre-rendered
  take needs a **second `tokens[].ms` track** — native-slow is not a linear stretch — and shipping
  `p1.slow.m4a` against `p1`'s timings mis-highlights and can leak the magic word. One good take.
  If the parent wants two paces after hearing it, that is dual files *and* dual `tokens` tracks,
  selected together. Also update the bedtime Settings copy, which still promises a "slower voice".
  **F1 tests bedtime as a *mode*** (palette, moon, the one take heard in bedtime conditions), which
  resolves Gemini's contradiction: there is no bedtime-specific *audio* left to test.
- **A6. Done 2026-09-20.** `public/prompts/` regenerated in the narrator's voice, extended with
  `word:{w}` for the 66 `TEACH.*.words` chips and the 8 `TRICKY_PHASE2` words (C3), all through
  A7d's carrier. `scripts/prompt-coverage.test.ts` is E3's prompt half. Still open: pointing
  Teach and SegmentPanel's "say the word" at the new clips, which is C3's other half.

- **A7. The blend clips must become the narrator's voice too — a hole in v1–v5, found 2026-09-20.**
  `gen-blends.py:23` hardcodes `VOICE = "en-US-AndrewMultilingualNeural"` at `RATE = "-55%"`. Every
  earlier version of this plan argued about *which words* get a blend clip (C2) and never once said
  the 147 existing clips are in the **old** voice. Ship A3/A6 alone and narration becomes Sarah while
  the slow model of `nap` — the single moment the child most needs to trust — stays Andrew. That is
  principle 2 failing at the worst possible point.
  - **A7a. Never synthesise a bare word — use a carrier phrase and slice it out.** Found by the
    parent's ear 2026-09-20 ("the beginning of all 4 words are wrong at all speeds") and confirmed
    acoustically: Kokoro given one isolated word produces a missing or vestigial onset consonant.
    Measured spectral centroid over the first 60 ms — `sat` bare came out **616 688 969 Hz**, which
    is a vowel: there is no /s/ in it at all. The word the child heard was "at".
    Not a speed problem — it is identical at every speed — and punctuation (`"Sat."`) does not fix
    it. `"sat, sat, sat."` does not fix the FIRST instance either, which is the proof of mechanism:
    **it is utterance-initial position that breaks, not isolation.** The acoustic model has not
    settled when the first phoneme is due.
    The fix is C1's pattern at generation time: synthesise `"The word is {w}, okay."`, then cut the
    token out using Kokoro's word timestamps with **the same clamp C1 uses**
    (`end = min(asrEnd + pad, nextStart)`, `pad = min(60 ms, room)`) so no part of the next word
    bleeds in. Verified across all four benchmark words at both candidate speeds:
    | word | bare | carrier-sliced | target |
    |---|---|---|---|
    | sat | 616 688 969 | **6122 5969 6291** | /s/ fricative, high |
    | nap | 646 418 460 | **298 346 401** | /n/ nasal murmur, low |
    | pin | 2181 3261 4039 | **3202 3455 3506** | /p/ aspiration, sustained |
    | dog | 3725 2767 4405 | **5198 4028 → 1303** | /d/ burst then vowel |
    Durations also improve to 555–811 ms (Andrew ships 853–981 ms), inside the working-memory window.
    **Gate this**: assert the onset centroid of every regenerated clip against the expected class for
    its initial grapheme (fricative high, nasal low, stop burst-then-drop). This is the one automated
    check that genuinely detects the defect — Whisper cannot, because its language prior transcribes
    an onsetless "at" as "sat".
  - **A7b. Every bare-word synthesis site, and there are more than C3's.** Measured 2026-09-20:
    | live site | form | onset centroid | verdict |
    |---|---|---|---|
    | `gen-audio.py:291` `word:{w}` | `f"{w}."` | 650 854 496 | **broken** — this is the form already shipping |
    | `gen-audio.py:291` `yes:{w}` | `f"Yes! {w}."` | 1434 1512 1326 | **also broken** |
    | carrier-and-slice | `"The word is {w}, okay."` | 6122 5969 6291 | correct |
    `yes:{w}` is the surprise and it contradicts the obvious reading: the word is not utterance-initial
    there, yet the onset is still weak — the `!` inserts a pause that resets the model just as a fresh
    utterance does. So **position after a sentence break is as bad as position zero**, and every
    `word:{w}` and `yes:{w}` clip — the celebration Veer hears on every word he gets right — carries
    the defect today. All of them move to carrier-and-slice, not just C3's 66+8.
  - **A7c. The onset gate needs a fourth class: vowel-initial.** C2's set contains 11 vowel-initial
    words (`a am at i in is it off on up us`). A "high centroid expected" rule fails every one of
    them. Vowel-initial words assert the opposite — no high-frequency onset — and vowel *quality*
    there is not measurable by centroid at all, so those clips fall to the parent's ear plus the
    duration envelope. Fail closed: a word whose initial grapheme has no class rule does not ship.
  - **A7d. It is not just isolated words — it is every sentence in every book. Implemented
    2026-09-20 in `gen-audio.py`.** A7a/A7b describe the defect as a property of bare-word
    synthesis. It is not: the model is unsettled after **any** sentence-ending full stop, including
    one in the middle of a single continuous synthesis call, so ordinary multi-sentence page
    narration carries it too. 75 of the library's 99 pages have two or more sentences.
    Measured over the 8 books that had already shipped in `af_sarah`, across their 88
    sentence-opening words: a **phantom word in front of the opening word on 41%** of them
    ("They sat on the mat." for "Sat on the mat.", "A pat was hot." for "Pat was hot."), and
    **6 of the 9 sibilant openings with no /s/ in them at all** (median 1,874 Hz where an /s/
    reads 4,000–6,100). This is also why 8 of the 16 books could not be generated at all: a
    compressed opening token measured `ms=800 endMs=800`, a zero-width span, and `realign()`
    correctly refused the page.
    - **The fix is A7a's carrier, applied per sentence and generalised.** Every sentence is
      synthesised as `"Listen, {sentence}"` and the carrier is cut back off at the quietest 10 ms
      frame in front of the payload. A **comma** lead-in, never a full stop: `"Okay. Sat on the
      mat."` produces the same phantom as the bare sentence does, which is the proof that
      per-sentence calls were never the cause and that one continuous per-page call cannot fix it.
    - **A ladder of carriers, because one is not enough.** `"Listen,"` ends in /n/, and before a
      payload that also opens on a sonorant (`"Woof!"`) the two run together with no boundary to
      cut at. `"Yes,"`, `"Wait,"`, `"Look,"` and `"Listen to this,"` follow; a sentence that no
      carrier can cut cleanly aborts the page. Measured on the 8 blocked books' sentences,
      `"Listen,"` alone covers 26 of 28 and the ladder covers the rest.
    - **The pause architecture is restored, not inherited.** The cut removes Kokoro's own ~580 ms
      leading pad along with the carrier. Without putting it back, every pause in the library
      shortens by a third (a page opened ~580 ms in and sentences sat ~1,850 ms apart). The
      generator now pads each sentence's lead back to a constant, so the pacing the parent
      approved by ear is unchanged — and is now deterministic rather than a vendor artefact.
    - **The cost, so the parent can listen for it.** A payload after a comma is read as a
      continuation: the opening of each sentence lands **30–65 Hz lower** (≈250 Hz → ≈200 Hz over
      the first ~900 ms). Every carrier tried behaved the same way, so this is the price of a
      present consonant, not a bad carrier choice. F1 is where it gets judged.
    - **A7c's fail-closed rule cannot be the rule for narration.** Refusing every word whose
      initial grapheme has no class rule would refuse most of the library. The automated gate is
      therefore: no phantom word in front of the opening token (Whisper + edit distance), plus an
      onset-centroid assertion for the two classes that separate on measured data — sibilants
      (4.0–6.1 kHz present, 0.6–2.3 kHz absent) and /m n/ (350–700 Hz present, 1.1–5.9 kHz
      absent). Four classes measured and rejected as ungateable: **/f/** (the same `fan.` read
      4,273 Hz on one call and 1,515 Hz on the next with the onset audibly present both times),
      **/h/**, **voiced /th/** (`"They were scared."` reads 338 Hz when it is completely correct),
      and stops, liquids and glides. Those fall to the parent's ear, as A7's own gate 1 says.
    - **The "1.6–2.8x elongated opening word" was a measurement bug, not the defect.** All 26 of
      the 49 shipped pages showing it are exactly the 26 whose `tokens[0].ms` is `0` — Whisper
      stretches the word that opens a segment back to the segment boundary, and that boundary sits
      inside the file's leading silence. A word cannot begin during silence, so `asr_words()` now
      moves a measured start forward to where sound actually begins. Left alone it would have
      started the karaoke highlight 580 ms early and made C1's first-word tap play silence.
    - **What still aborted afterwards was Whisper, not Kokoro, and the gate was not touched.** Six
      of the sixteen books failed `realign()` on the first full run. Three were stochastic — a
      zero-width ASR span on audio that measures clean — and a re-synthesis cleared them, so a page
      is now re-synthesised up to `PAGE_TRIES` times before it aborts. Every Kokoro call is a fresh
      sample, so that is a different take rather than the same audio measured twice.
      The other three failed **identically on all four retries**, and all three for one reason:
      Whisper spells `hare` "hair", `howled` "held", `dal` "doll" and `Nani` "Nanny". The matcher
      dropped those words, so the token lost its real measurement *and* got a synthetic one — and
      the synthetic time landed inside the measured span of the word before it (`dal` interpolated
      to 7,300 ms while `making` was measured to 7,540 ms), which is what failed
      `endMs <= next.ms`. So `_match_tokens()` now bridges the unambiguous case: one unmatched token
      with exactly one unclaimed heard word between its matched neighbours **is** that word, however
      Whisper spelled it. The times stay ASR's and only the spelling is overruled, so those three
      pages now measure with no interpolated token at all. This is not A3's forbidden "raw
      positional zip" — that was zipping a vendor's 21 timestamps onto 24 tokens across a page;
      this is a single hole with a confirmed ASR anchor on each side and exactly one candidate in
      it. A hole of two or more tokens is still left alone and still fails loud.
  - **Reconcile the three duration numbers before implementation.** v7 says target ~1.0–1.3 s
    trimmed; A7a measured carrier-sliced clips at 555–811 ms; and "a model is deliberately slower
    than narration" implies longer still. These conflict. The carrier-sliced measurement is the real
    one — it is what the child will hear — and it already sits near Andrew's shipping 853–981 ms.
    Set the CI envelope from the chosen speed's measured set with margin; do not encode 1.0–1.3 s
    as a gate that the actual fix would fail.
  - Regenerate every clip in C2's set with the chosen narrator.
  - **The blend speed is its own decision, made by ear, and it is not 0.65.** A blend model is
    deliberately slower than narration. But Gemini's round-1 warning bites hardest here: a TTS model
    given a very low speed slurs vowels, and a slurred CVC is not merely ugly, it teaches the wrong
    phonemes. Sweep the narrator across blend speeds, listen to real CVCs (`sat`, `nap`, `pin`,
    `dog`), and pick the slowest that still articulates every phoneme cleanly.
  - **Gate it — but not the way v6 first said.** "Run the existing phoneme/ASR instruments over the
    clips" is unexecutable and would have been theatre (Gemini, round 5): the phoneme gate was built
    for isolated single-phoneme wavs and has no forced aligner, and Whisper's language prior will
    happily transcribe a badly slurred `nap` as "nap". Neither can judge vowel quality. Instead:
    1. **The parent's ear is the articulation gate.** The CVC sweep decides the speed. Automation
       catches regressions, it does not choose.
    2. **Whisper exact whole-word match** per clip (`heard.strip().lower() == word`) — catches a
       dropped consonant or a truncated clip, which it genuinely can do.
    3. **Post-trim duration envelope**, asserted in CI. Measured: the trimmed Andrew `sat.m4a`
       ships at **920 ms**; Sarah at 0.55 is 2,090 ms before trim. Bound it and fail the build
       outside the bound.
  - **A working-memory ceiling, not just a slurring floor.** At speed ≤0.35 a CVC runs 2.6–3.4 s.
    A four-year-old cannot hold the initial consonant across three seconds to bind it to the coda —
    the clip is then well-articulated and pedagogically useless. Target a **trimmed ~1.0–1.3 s**,
    which puts the usable range around 0.55–0.65, not lower. (Gemini, round 5.)
  - **`gen-blends.py` already trims** (`:52`: bidirectional `silenceremove` at −50 dB, a deliberate
    120 ms breath either side so the opening stop is not clipped, then `loudnorm`). Keep it; Kokoro's
    padding is handled by the existing filter. Do not add a second trim.
  - **`public/blends/` is NOT gitignored — 148 files are tracked.** v7 asserted the opposite and was
    wrong (Grok, round 6; `git check-ignore` confirms `.gitignore` names only `public/library/` and
    `public/prompts/`). Two consequences. Good: git restore is a real rollback for blends, so G1's
    snapshot is not the only safety net here. Bad: **"purge then write" is a destructive operation on
    tracked files** — purge, then a failed key or a gate rejection, and the published tree is empty
    or half Sarah/half Andrew while `playWord` falls through to the OS drawl.
    Required, exactly as A3: **synthesise into staging, swap only on full success** (whole C2 set
    written *and* gated), leave the published tree untouched on abort, and **only after a successful
    swap** delete files outside C2's set — so `a.m4a`/`the.m4a` cannot linger as Andrew.
  - **Principle 4 extends to `public/blends/`.** `gen-blends.py` is a second publisher with no key
    or voice gate, still hardcoding Andrew. No key or no chosen voice ⇒ do not touch the tree at
    all: no purge, and never an edge-tts fallback. `deploy-vercel.sh` does not check blends; add it.
  - Bump `AUDIO_V` with this, like every other audio change (E6/G2).

- **A7e. The cut, not the carrier, is what breaks sentence starts. Measured 2026-09-21.**
  `cae82dd` shipped carrier-and-slice per sentence and the parent still heard the defect at every
  period. Measurement settles where it lives:
  - **Synthesis is fine.** Every shipped carrier restores full duration on the payload's first word:
    `Listen,` 425 ms · `Yes,` 425 ms · `Wait,` 400 ms · `Look,` 425 ms · `And so,` 450 ms, against
    363 ms bare and a ~420 ms mid-sentence target. The carrier ladder works.
  - **The published file does not.** Sentence-initial words carry **65 ms of audible audio**
    (Whisper reports 90 ms) against 300 ms mid-sentence. The word is synthesised whole and then lost.
  - **Mechanism:** the cut searches forward for a frame below −30 dB. A stop consonant *begins with a
    silent closure*, and so does the gap after the carrier's comma, so the search walks through the
    carrier gap, through the payload's first word, and latches onto a later closure — leaving only a
    trailing burst. That is why the surviving fragment is ~65 ms almost regardless of the word, which
    superficially resembles the model's own 22% compression signature and misled one reviewer.
  - **Fix: stop searching for silence. Cut by alignment.** Run Whisper on the carrier+payload render,
    take `carrier_last_word.end` and `payload_first_word.start`, cut at the **midpoint of that gap**,
    snap to the nearest zero crossing within ±10 ms, and apply a ~3 ms fade-in. The cut then lands
    squarely in the pause, clear of both the carrier's offset and the payload's closure.
  - **Keep the closure when the payload starts with a stop.** Whisper's word start is the **burst**,
    not the closure — a /p t k b d g/ word begins with 50–120 ms of near-silence that Whisper does not
    include. So after taking the midpoint, clamp it: `cut = min(cut, payload_first_word.start − 40 ms)`
    when the first letter is a stop, if the gap allows. And **never re-trim the payload's leading
    silence with a dB rule afterwards — that trim *is* the closure.** (Grok, round 7.)
  - **Gate (this is the one that would have caught it):** a **paired same-token duration ratio** on
    the FINAL rendered page — `dur(token, sentence-initial) / median(dur(same token, non-initial))
    ≥ 0.6`. Pairing on the same token is what stops naturally-short words like `a` and `the` from
    false-positiving, which a global floor cannot do (Grok). Where a token never appears
    non-initially in that book, fall back to ≥ 180 ms and ≥ 0.5 × the page median (Gemini). Run it on
    the final audio, not the uncut synth, so that it fails whether the carrier or the cut is at fault.
    Running the same ratio on the uncut render is **diagnostic**: fail-before-cut blames the carrier,
    pass-before-cut-and-fail-after blames the cutter. Phoneme-invariant, so it survives vowel-initial words where the centroid gate failed,
    and immune to Whisper's language prior, which transcribes a clipped word correctly but still
    reports its true 90 ms span. On failure, re-render with the next carrier in the ladder; if the
    ladder is exhausted, abort the page rather than publish it. (Midpoint cut: Gemini and Grok
    independently.)
  - **Both reviewers diagnosed this wrong, in the same direction, and the reason is worth recording.**
    Each concluded the carrier had failed — Gemini from the consistency of the ~22% survival ratio,
    Grok from the claim that the shipped carriers "were never measured." They had been: `Listen,`
    425 ms, `Yes,` 425 ms, `Wait,` 400 ms, `Look,` 425 ms, against a ~420 ms target. Grok proposed the
    decisive experiment itself — *Whisper the uncut carrier render and read the first payload word* —
    and that test returns **long**, which is its own criterion for blaming the cutter. A measurement
    that takes one API call beat two careful arguments; make the measurement first next time.
  - **Structural alternative worth trying if the cut stays fragile (Grok):** stop synthesising
    sentences in isolation. Render `previous_sentence + " and " + current_sentence`, align, and split
    on the `and`. The preceding sentence is a better carrier than any invented preface, and the
    payload is then never utterance-initial at all.

### B. Letter sounds — metadata only

- **B1.** Do not regenerate, re-cut, re-trim or TTS Kathryn's clips. **Do not run `build-sounds.py`.**
- **B2.** Stamp **the pack that actually built the wavs** onto the existing clip records — do not
  copy `_pack` over family edit strings just to green E4; the records still name
  `assets/voice-pack/…` takes. Stamp provenance in `public/sounds/manifest.json`;
  stop `import-voice-pack.py` hardcoding `"artist": "family"` for future packs. **No audio is touched.**
- **B3.** Re-run the existing gates read-only; `phoneme-exceptions.json` unchanged.
- **B4.** **Already shipped** (`Settings.tsx:56`, `RecordSounds.tsx:114`). Verify still rendered; add a
  test so it cannot be removed. No UI churn.

### C. Tap-to-hear, blends, and the nine Web Speech sites

- **C1. Tap-to-hear = a slice of the page narration — via a NEW isolator, not today's `playClip`.**
  The product idea survives v2 review; the mechanism did not. Both reviewers rejected it and the
  measured library proves them right: median inter-word gap **340 ms**, **18% under 200 ms**,
  **30% under 250 ms**, and **four places where the word before a magic word is ≤140 ms away**
  (`a`→`nap` 80 ms, `a`→`pat.` 80 ms, `he`→`got` 120 ms, `a`→`net.` 140 ms). `playClip` enforces
  `endMs` on `timeupdate`, which Safari fires at ~250 ms — so tapping `a` plays `nap` and the app
  speaks the word the child was about to read. That is principle 5, and it is the bug `realign()`
  exists to prevent. `Story.tsx` already polls at 40 ms for exactly this reason.

  The isolator contract, which must exist before C1 is implemented:
  - **Index, never text.** `onWordTap` currently passes `t.t` (`Story.tsx:320`), so duplicate
    `the`/`Dad` cannot select a slice. Change the signature to pass the token index.
  - **`endMs` comes from ASR word-end**, serialised into `tokens[]` by `realign()` (Whisper already
    computes it; we discard it today). Never `nextStart`, which is 100 ms for `the` and 1,640 ms for
    a sentence-final word — clipped and padded-with-silence respectively.
  - **Clamp against the NEXT ANCHORED TOKEN, unconditionally.** v3's clamp was *"never past a pending
    magic word"* — which is **dead code by construction**: `pendingMagicIdx` returns −1 for listeners
    (`Story.tsx:87`) and word taps render only `if (listener)` (`Story.tsx:320`), so the guard could
    never fire on the one path that has taps. It must not depend on magic-word state at all:
    `sliceEnd = min(asrEnd + pad, nextStart)`, with **`pad = min(60, room)`** — a ceiling,
    never a floor — and **`room = max(0, min(nextStart, joinStart) − asrEnd)`**. The zero floor is not
    cosmetic: Whisper `base.en` sometimes predicts `asrEnd > nextStart`, which without it yields a
    negative pad and an inverted interval before `min()` is even reached. (Gemini, round 4.) v3's "pad ≥60 ms" walks straight into `nap` at an 80 ms gap.
    This matters because Whisper `base.en` word-ends routinely land *on* the next word's onset, so
    `asrEnd` alone does not separate them — the `min()` is the load-bearing part, not the ASR. (Grok, round 3.)
  - **Cut with Web Audio buffer slicing — exclusively.** No `<audio>` poll fallback. At an 80 ms gap
    with a 60 ms pad the margin before a magic word is **20 ms**; a 40 ms timer cannot honour that
    under main-thread hitching on mobile Safari, and an `<audio>` element cannot apply a gain ramp
    from JS at all. Use `AudioBufferSourceNode` scheduled playback with a `GainNode` linear ramp
    (5–10 ms) at both edges — sample-accurate cutoff, no click. Reuse the `blend.ts` family-trim
    pattern. (Gemini, round 3.)
  - **On `decodeAudioData` failure the fallback is silence** — never `playClip`/`playOn`, which
    `play()`s from 0 and seeks on `loadedmetadata`. The assertion has to be about samples that reach
    the speaker, and only a pre-cut buffer can guarantee that. A poll pauses *after* the sample is out.
  - **`await ctx.resume()` before scheduling.** `onWordTap` is a user gesture, but iOS Safari
    suspends a shared `AudioContext` during idle listening, and a suspended context schedules silently.
  - **Pre-decode the active page's `p{i}.m4a` on mount** and hold the `AudioBuffer` in memory, so a tap
    is instant rather than paying fetch + `decodeAudioData` latency. (Gemini, round 4.)
  - **`asr_words()` must keep `w.end`** — `gen-audio.py:98` currently discards it
    (`(w.word.strip(), float(w.start) * 1000)`). No `endMs` exists until that line changes.
  - **Untimed family pages** (`ms === 0`) take D3, never a slice.
- **C2. Blend clips only for words that are actually modelled**: magic words, I'll-try words,
  `TEACH.*.blend` CVCs, moral-line decodables. **Library words only** — family magic words do not
  exist until a parent types one, so including them means E3 never greens and C7 never deletes the
  0.42 OS-voice drawl. Gate = *every library word `playWord` can be asked to model has a clip*.
- **C3. `TEACH.*.words` (`apple`, `ant`, `as`) are not blend targets** — they exist so the child hears
  the sound *inside a word*. **Artefact:** the 66 Teach chip words get narrator **normal-pace** whole
  words via the existing `word:{w}` prompt set (built by `gen-audio.py`, currently unused at runtime);
  extend that set in A3/A6 and point Teach and SegmentPanel's "say the word" at it. Not the −55%
  blend model, and not a page slice — `apple`/`ink`/`under` appear on no page.
- **C4.** `SegmentPanel` tile taps keep playing the **isolated phoneme**. Unchanged. (v1 would have broken this.)
- **C5. Disposition all nine `speakText` sites explicitly** — `TeachSound.tsx` ×2, `Story.tsx` ×5,
  `SegmentPanel.tsx` ×1, `blend.ts` ×1. Each becomes narrator audio, a narration slice, a prompt
  clip, or silence. None keeps the OS voice in a library session. **Each of the five `Story.tsx`
  sites is mapped one by one in the implementation PR**, and E5 asserts no branch in `Story.tsx`
  reaches `window.speechSynthesis` during a library session. Three sites v3 left with no artefact
  at all (Grok, round 3):
  | Site | Says | Disposition |
  |---|---|---|
  | `Story.tsx:155` | `You blended ${okWords}.` — dynamic, no file can pre-exist | the existing `done` prompt, then **silence**. Never composed OS speech. |
  | `Story.tsx:376` | moral-line tricky word | `word:{w}` clips for the eight `TRICKY_PHASE2` words (`the a I is to no go into`) |
  | `TeachSound.tsx:37` | Teach tricky chips | the same eight clips |
  The five `Story.tsx` sites are **`:74`** (null-src `speak()` — the missing-prompt path F1 listens
  to; silence, never OS voice), **`:122`** (family/untimed → D2), `:155`, `:197` (→ C1), `:376`.
- **C6.** `speech.ts`: delete `0.9 *` and `pitch = 1.05`. Web Speech survives only for family stories.
- **C7.** Delete the **whole `speakText` fallback** on the library `playWord` path
  (`blend.ts:157`), not merely the `0.55 *` multiplier — after C2 a cache miss still reaches it.
- **C8.** Keep `playBlend` (phoneme chain) for family stories only, and label it so. It is not a narrator.

### D. Family stories

- **D1.** "Record it in your own voice" is the primary path (`record.ts` exists), per page-group.
- **D2.** Web Speech fallback plays at a true 1.0 and the UI says plainly it is the phone's voice.
- **D3.** Family word taps: **whole word or silence.** Never the phoneme chain — sounding out
  `the`/`to`/`go` is pedagogically forbidden. (v1 said "phoneme chain or nothing"; that was wrong.)

### E. Gates

- **E1.** Runtime spy on `HTMLMediaElement.prototype.playbackRate`, `defaultPlaybackRate`,
  `SpeechSynthesisUtterance.rate/pitch`, and `AudioBufferSourceNode.playbackRate` — asserts 1.0 on
  every speech path. `playBlend`'s hold duration is explicitly exempt (it is silence, not stretch).
- **E2.** **Replaces `narration-rate.test.ts`, which must be deleted in the A4 commit** — it asserts
  aggregate 95–145 wpm and will go red the moment the pace changes (G5). Assert **articulation rate** (speech excluding inter-sentence pauses) and **pause
  architecture** separately. Aggregate wpm on a three-word page is meaningless.
- **E3.** Modelled-word coverage (C2) + **prompt coverage** (A6). Missing clip fails the build.
- **E4.** Per-clip provenance matches `_pack`; credit string still rendered.
- **E5.** Scoped to **library listen-mode**: no OS-voice path reachable. Teach, WarmUp and dictation
  are covered by C5's no-OS-voice net and by F1, not by E5. Family stories exempt by design.
- **E6.** `AUDIO_V` and the Workbox `cacheName` both bump in the same commit as any audio change.

### F. Verification a human can hear

- **F1.** The one take must be heard in **daytime as well as bedtime**. Listening page from the
  **deployed** assets covering: page narration, magic-word model,
  tapped words, letter sounds, **Teach**, **WarmUp**, dictation "say the word", a **tricky** word,
  **bedtime**, a **missing prompt**, and a **family page**. Before and after.
- **F2.** Playwright drives a full library session recording **engine identity** per utterance —
  **four engines**: Web Speech, `<audio>` URL, IndexedDB blob, and **`AudioBufferSourceNode.start`**
  (C1's slices are Web Audio; without this spy every tap looks like silence). Not URL prefixes.
  The session must include a **word tap** and a **"Not yet" model**, because `playWord`'s `speakText`
  lives in `blend.ts:157` — an E5 that only greps `Story.tsx` will not see it. Asserts no OS voice.
- **F3.** Install-on-phone check: the PWA that already has `?v=6` cached must not pair new timings
  with old audio.

### G. Rollback and cache (new — v1 had none)

- **G1.** `public/library/` and `public/prompts/` are gitignored. **Snapshot the current m4a tree**
  before regenerating; keep it until F1 passes on the phone that already has the app installed.
- **G2.** Bump `AUDIO_V` **and** the Workbox `cacheName`. Vercel's instant rollback does not empty
  a service worker.
- **G3.** Budget the **post-plan** inventory with headroom, not today's. Shipped audio is currently
  **392 files / 15.4 MB** — not a quota problem, a slot problem. Raise
  `maxEntries` above that plus C3's 66 chip words and the eight tricky clips. "Precache tonight's book" is a **runtime `cache.addAll` after the pick** —
  Workbox globs cannot know tonight's book at build time.
- **G4.** Deploy both hosts. `deploy-pages.sh` checks `p1.m4a`; `deploy-vercel.sh` does not — fix that.
- **G5.** **A4 + C6 + E1 ship in one commit.** E1 spies `SpeechSynthesisUtterance.rate`, which stays
  red until C6 removes the 0.9 multiplier, so it cannot ride along with A4 alone. E2 can land earlier.
  **Do not land red gates on `main` alone.** The deploy scripts run vitest; gates encoding the
  future contract must ship in the same commit as A4.

## Sequencing

1. B2/B4, E4, G1/G3 — no key needed, no audio touched, exposes the truth and makes rollback possible.
2. **A2 + A2b — blocking.** Parent picks; ToS cleared. Generator refuses to run until both.
3. A3/A4/A6 **+ A7** + E6/G2 in one commit with A4's multiplier deletion (per G5) — all audio
   regeneration and the single `AUDIO_V`/cacheName bump land together, or an install pairs one
   voice's clips with another's. **C6 lands here too if
   E1 is enabled here; otherwise E1 waits for step 4.** `main` stays green throughout — the deploy
   scripts run vitest, so a red gate blocks an unrelated bedtime fix.
4. C1–C8, then E1/E2/E3/E5.
5. D, then F1/F2/F3.
6. Round-3 review below.

## Review protocol

- **Before implementation:** Grok 4.6 and Gemini 3.8 Flash both return GO on this document.
- **Implementation:** a Sonnet agent. Claude reviews every change against these criteria and does not
  accept "tests pass" as evidence for anything in F.
- **After implementation:** the same two models review the **outcome** — given the F1 listening page,
  the F2 engine-identity report, measured articulation rate and pause architecture, coverage numbers,
  the manifest diff, and the cache/rollback state. Iterate to GO from both. Skips recorded in
  `docs/state.md` with reasons.

## Out of scope

The padlocked illustration, the 5.5 s freeze after a verdict, story pacing, and the rest of the
bedtime-flow findings. Real, separately tracked. This plan is about what the app *sounds* like.
