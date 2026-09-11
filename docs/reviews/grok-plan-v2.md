I'll read the plan and the implementation files you named, then review them as a K-1 phonics teacher and as someone who ships iPhone PWAs.The plan is thin on iOS PWA mic behavior and clip-cutting. I’ll pull the rest of the audio, PWA, and phonics code so the findings map to what actually ships.There's already a prior plan review on disk. I'll read the audio, store, and PWA pieces next, plus current iOS Speech Recognition constraints.I’ll check the actual phoneme files and current iOS Speech Recognition behavior so the clip-cutting and PWA findings aren’t guesswork.The plan solves the right three problems (broken phoneme clips, no print-following in “I read”, Indian-English narrator) and then aims the implementation at the wrong tools. Finger-follow is the product. Wikimedia auto-cutting and live `webkitSpeechRecognition` karaoke are the risks. Several numbered steps will fail on a home-screen iPhone or teach the 4-year-old the wrong print-to-voice map.

---

## Phoneme clips

**[P1] “Cut the first isolated segment” is false for the files you actually download.**

`scripts/fetch-phonemes.py` pulls the *current* Commons objects, then keeps the first 1.2 s plus 100 ms pad. That is why `s.m4a` / `t.m4a` / `p.m4a` / `m.m4a` are all **1.30 s**. The live files are not “sound, then example”:

- `Voiceless_alveolar_sibilant.ogg` is labelled **`[sa asa]`** (2024 Isotalo remaster). There is no isolated `[s]`. First-segment cutting yields **`sa`**, which is exactly the “sss-aa-aa-sss” the parent heard.
- `Voiceless_alveolar_plosive.ogg` is labelled **`[ata]`**, 1.9 s. There is no isolated `[t]`. “First segment” is the leading **`[a]`**.

A generic cutter cannot be the plan. For 19 clips, write a `cuts.json` of `start_ms` / `end_ms` after a human listen, then `ffmpeg -ss -t` with a short fade. Keep the original `.ogg`. Automated voicing is a **check**, not a cutter.

**[P1] Burst + ~60 ms will still be “tuh”, and a voiced/hiss map will wreck nasals and liquids.**

Stops are silence + burst + vowel. English aspirated `/t/` VOT is ~40–80 ms; 60 ms after the burst of `[ata]` is already into `[a]`. Voiced `/b d g/` have near-zero VOT, so 60 ms is “buh/duh/guh”.

A 20 ms voiced/hiss map is the wrong feature for a mixed set:

| Class | What to keep | What “hiss = good” does |
|---|---|---|
| `s f h` | unvoiced, high ZCR, cut at first F0 | OK |
| `m n l r` | voiced nasal/liquid, cut at the F2 jump into a vowel | throws the clip away or keeps the VCV |
| vowels | 280–350 ms of stable formants from the **middle** | irrelevant |
| `t p k` | burst + **25–40 ms**, 10 ms fade, no formants after | maybe |
| `b d g` | burst−10 ms to burst+**15–25 ms** | fails |

Acceptance is not a frame histogram. Play `s`, `t`, `m` alone, then blend **sat / pin / dog / puff**. Reject any clip with a second vowel or a letter name.

**[P1] Cutting stops without changing `blend.ts` reintroduces gaps.**

```15:16:src/lib/blend.ts
const HOLD_MS = (g: string) => (CONTINUANTS.has(g) ? 450 : VOWELS.has(g) ? 320 : 230);
const XFADE_MS = 70;
```

`src.start(t, 0, hold + fade)` on a ~40 ms buffer plays 40 ms of burst then **~190 ms of digital silence**. That fights the “never a gap” contract. Same item as the cutter must set stop hold to `min(clipMs, 80)` and start the vowel during the burst, not after a 230 ms hold. A 70 ms crossfade on a 40 ms stop is the whole stop.

**[P1] US Andrew + British `/ɒ/` + leftover `en-IN` synthesis is three accents.**

`o` is `Open_back_rounded_vowel.ogg` (`/ɒ/`, L&S “dog”). US Andrew will say *got/pot/not* as `/ɑ/`. Magic words in the library include `got`, `pot`, `not`. And the live fallback is still Indian English:

```12:12:src/lib/audio/speech.ts
voice = vs.find((v) => /en-IN/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang) && /female|samantha|karen|moira/i.test(v.name)) ?? ...
```

That path still speaks family stories with no recording, listener tap-to-hear, and the “I read” captions. Changing `NANI` in `gen-audio.py` is not enough. Pick **one** accent for Commons vowels, edge-tts, and `pickVoice()`. If the narrator is US, swap `o` to an unrounded `/ɑ/` recording.

**[P2] CC BY-SA 3.0:** a cut is a derivative work. Keep attribution and note the edit in `manifest.json`. Fine if the cutter is a table of offsets.

---

## Family-recorded sounds

**[P1] Uncoached MediaRecorder will reproduce the bug you are trying to kill.**

Parents say letter names (“ess”, “tee”) or a full “tuh”. That is the failure `fetch-phonemes.py` was written to avoid. The plan has no coaching, no listen-back, no max length, no silence trim, no reject.

Minimum gate, same screen:

1. Script: stretchy `sss mmm nnn fff lll rrr`; bouncy `t p k b d g` with almost no “uh”; **never the letter name**.
2. Record → autoplay → Keep / Redo.
3. Trim leading/trailing silence on save.
4. Reject > ~1.2 s (they said a word or a name).
5. One resolver used by tiles, `playBlend`, Teach, Warm-up, SegmentPanel. Today every call site goes through `soundAsset()` → `/sounds/${clip}.m4a`.

**[P1] Short iOS `audio/mp4` clips are the empty-file case `record.ts` already documents.** `MediaRecorder.start()` with no timeslice is required, but a 300 ms tap-and-release still yields an invalid mp4. Force a minimum hold (~500 ms) then trim. `decodeAudioData` on AAC from IndexedDB is historically flaky on WebKit; have an `<audio>` fallback in `playBlend` (it already falls back, but only when the whole graph throws).

**[P2] “14 of 23 recorded” counts graphemes, not sounds.** `c` / `k` / `ck` share `k`; `ff`/`f`, `ll`/`l`, `ss`/`s` share clips. Ask for ~19 unique sounds. Recording `/k/` three times is busywork and invites three different “kuh”s.

**[P2] `blend.ts` caches `AudioBuffer`s by URL.** A family re-record must drop that entry or the old Commons clip keeps playing until reload.

---

## Web Speech API on iOS Safari / home-screen PWA

The constraints section already says “historically flaky”. The plan then specifies the exact pattern that fails: **interim results + auto-restart + stop during the word card + resume**.

**[P1] `recognition.start()` needs a user gesture. `onend` is not one. After MagicPanel, auto-resume will not be reliable.**

On iPhone:

- Constructor is `webkitSpeechRecognition`.
- Secure context only (GitHub Pages is fine).
- `start()` must run in the tap’s call stack. Restarting from `onend` after silence sometimes works for a few cycles; restarting after a 20-second word card **usually does not**. `InvalidStateError` / `aborted` / silent no-op.
- Re-`new`ing the recogniser every restart plays the Siri start chime. Use one singleton.
- WebKit’s `continuous` is not Chrome’s. `true` accumulates transcript history and throttles (WebKit bug 288963, still open against Safari 18). On iOS set `continuous = false` and treat `onend` as “this utterance ended”.
- `interimResults = true` is on-device **until** it isn’t: noise, similar words, a pause, then it falls through to Apple’s cloud recogniser. The disclosure is not hypothetical. Offline bedtime = no voice follow-along. The plan already says “No offline voice”; the UI must show that, not a spinning mic.
- Native `SFSpeechRecognizer` cap behind this API: **~60 s per session**, ~1000 requests/hour/device. A silence-restart loop over a six-page story will hit it.
- Playing phoneme tiles uses the audio session and kills recognition. Abort (not ignore) while the word card is open, or the child’s blend will skip-ahead the rest of the page.
- `getUserMedia` / `MediaRecorder` and `SpeechRecognition` **do not share the mic** on iOS. Plan item 5 (recognise *while* the parent records) is the wrong architecture.

Home-screen PWA is not “Safari with a different icon”:

- Standalone is a separate WebKit process. Mic / speech permission granted in the Safari tab often **does not** carry to the home-screen app.
- Wake Lock was broken in installed iOS PWAs until 18.4. Bedtime reading dims the screen and dies the recogniser. `visibilitychange` must abort; a dimmed phone is not “still following”.
- Test matrix the plan must name: **iPhone Safari tab, iPhone Add-to-Home-Screen standalone, iPad, Android Chrome**. Chrome ignores `continuous` and emits only `isFinal`. One aligner, two result shapes.

**[P1] The API has no word timestamps.** You get a growing transcript string. Karaoke in “Nani reads” works because `tokens[].ms` is aligned to `audio.currentTime`. ASR cannot do that. You are fuzzy-matching a lagging string against remaining tokens. The plan’s own “~0.5 s lag” at adult rate (2–3 words/s) is **one to two words behind**. For a 4-year-old using the highlight as “the word being said”, that trains the wrong mapping.

Concrete iOS contract to write into the plan (or don’t ship voice follow-along):

1. Mic is **off** until a tap on “Follow my voice”.
2. Singleton, `lang = 'en-US'`, `continuous = false`, `interimResults = true`.
3. Silence `onend` → `setTimeout(start, 200)` **only while that page is still in the same gesture session**; after 3 failures, drop to finger-follow and stop looping.
4. MagicPanel: `abort()`, drop pending results, show **“Tap to follow again”**. Do not claim auto-resume.
5. `visibilitychange` / Home → abort.
6. Never start recognition from a `useEffect`.
7. Do not run beside `MediaRecorder`.

Push-to-talk is the only pattern iOS developers currently call stable. Continuous bedtime karaoke is not.

---

## Pedagogy of highlighting while a grown-up reads

The parent’s request is right: in “I read”, `token` is hardcoded off, so nothing lights.

```182:182:src/screens/Story.tsx
token={listen ? ctx.token : -1}
```

The CSS (`.w.now` / `.w.read`) and `TOKEN` events already exist. The missing feature is a **zero-lag pointer under the word**, not a speech recogniser.

**[P1] Skip-ahead, never-block alignment is the opposite of K–1 print referencing.**

Concept of word (Clay / shared reading): one spoken word ↔ one printed word, **at the same moment**. The teacher’s finger *is* the highlight. A 4-year-old who “knows letters and most sounds” is still learning that match. Therefore:

- Highlight must not lag the voice by a word.
- Highlight must not jump past a word the adult said.
- Highlight must not jump to a later token because ASR hallucinated `branch` during `crow`.
- The pending **pink** word must never light from the adult track (plan gets this right). Also ignore ASR hits on that word, or a child blurting it ends the adult’s sentence early.
- Function words (`a`, `the`, `to`, `of`) dominate these pages (`A crow found a big piece of cheese`) and are exactly what ASR drops. Unlimited skip-ahead will leapfrog them and teach the child to skip them too.

If you keep ASR at all, the aligner is: **accept the next token, or skip at most one closed-class word**. Never skip to token+3. Never move the highlight from a low-confidence interim. Catch-up is a **tap on the word just said**, already mentioned in constraints and missing from the numbered steps.

**[P1] Finger-follow is the primary interaction, not the fallback.**

What a K–1 teacher does: point, then say, or point with the voice. Sliding a finger under the line with the word under the finger lighting **now** is that practice. ASR that is 0.5 s late is worse than no highlight.

Build this first, on the existing machine:

- `pointerdown` / `pointermove` on the sentence, `setPointerCapture`, `elementFromPoint`, `send({ type: "TOKEN", index })`.
- `touch-action: none` on `.sentence` so iOS does not scroll the page mid-slide.
- Stop at the pending magic word; sliding onto it does not open the card and does not mark it read.
- Pass `token={ctx.token}` in read mode (today it is always `-1`).
- Hit targets: `.w` is `min-height: 40px` with `padding: 1px 5px`. Below the 48 px rule in `docs/plan.md`. Fat-finger follow on a phone will light the neighbour. Increase padding and line-height before this ships; “iPad likely” is not an excuse for the bedtime iPhone.

Do not add tap-to-hear on grey words. That turns the adult’s fluent model into echo.

A moving underline on the current word beats painting every previous word `.read` for this age. The karaoke trail is fine as a secondary cue.

---

## The other two items

**[P1] Item 5 — ASR while recording a family story — cannot work on iPhone as specified.**

You cannot run `MediaRecorder` and `webkitSpeechRecognition` on the same mic. The API still would not give per-word `ms`. The code already knows untimed parent audio cannot stop before a magic word (`Story.tsx` ~line 86).

Replace with **tap-as-you-record** (or tap-on-playback): each word tap stores `Date.now() - t0` into `tokens[].ms`, the format `gen-audio.py` already writes. Offline, no Apple/Google, actually aligns. Do this when you touch family stories; do not block clip-fixing or finger-follow on it.

**[P2] “I’ll try” on every decodable grey word will wreck bedtime.**

Stories are written as **one child turn per page**. Opening every CVC (`big`, `sat`, `did`…) turns a 6-page fable into a decoding slog, and if the adult has already said the word the child is echoing, not blending. Google Read Along’s own research: kids freeze on “every word must go green”.

Cap: **one extra word per page**, grown-up confirms, and only a word not yet highlighted (upcoming, not echoing). Still fail closed through `checkMagicWord` (CVC, not tricky). Do not let this compete with the designed pink word.

**[P2] Privacy copy is currently a lie the moment ASR exists.** README: “No account, no ads, no microphone, nothing leaves the phone.” Finger-follow default is correct; rewrite the promise **before** the toggle ships, in-app and in README. Opt-in per session, not a buried forever flag.

**[P2] `gen-audio.py` writes timings back into `library/*/story.json`.** Regenerating with Andrew will rewrite every `ms`. Run the library contract tests; confirm Andrew’s `WordBoundary` events still 1:1 with `align()`. Male `-8%` may need a different rate than Neerja.

---

## Prioritised changes to the plan

1. **[P1] Reorder.** (a) Hand-cut phoneme table + retune `HOLD_MS` + one accent across Commons / edge-tts / `pickVoice()`. (b) Finger-follow in “I read” as the default, reusing `TOKEN` + `.w.now`. (c) Family sound recorder with coaching, listen-back, trim, minimum hold. (d) ASR as opt-in enhancement with the iOS gesture contract above. (e) “I’ll try” with a cap. (f) Family timings by tap-as-you-record, not ASR-during-record.

2. **[P1] Replace the cutter spec.** No “first isolated segment”, no universal 60 ms, no hiss map as a cutter. `cuts.json` per file; class-specific windows; human sign-off on sat/pin/dog/puff. Keep originals.

3. **[P1] Write the iOS SpeechRecognition contract into the plan**, including: singleton, no `start()` from `useEffect`/`onend` after the word card, “Tap to follow again”, abort on MagicPanel and on hide, `continuous=false` on iOS, no timestamps so no karaoke-quality claim, test standalone vs Safari tab, no coexistence with `MediaRecorder`.

4. **[P1] Align the adult-read highlighter with print referencing:** next-token match, skip at most one function word, never light the pink word from the adult track, catch-up tap specified in the steps. If lag is a word, do not use ASR as the print cue.

5. **[P1] One sound resolver** (family blob beats Commons) used by every clip call site; invalidate the `blend.ts` buffer cache; unique-sound progress, not 23.

6. **[P2] Privacy strings, 48 px word hit targets, wake lock, Andrew alignment check, “I’ll try” bedtime cap.**

Do not start item 3 or item 5 as written. Item 1 as written will recut `[sa asa]` and `[ata]` into another wrong set, then the blend graph will put holes between the stops. Fix the clips by hand, put a finger under the line, and treat Apple’s recogniser as a nice-to-have that the home-screen PWA is allowed to refuse.
