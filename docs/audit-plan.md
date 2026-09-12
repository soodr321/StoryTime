# StoryTime — end-to-end audit plan (2026-09-11)

Why this exists: two defects reached the family after fourteen model reviews and a hands-on pass —
phoneme clips that sound wrong, and narration that is too fast. Neither was catchable by reading code,
because both are *measurements*, and nobody was measuring. This plan replaces "review the app" with
"instrument the app, measure it against numbers, and keep the numbers as tests".

Method first, then scope. Each check names: **how** it is run, the **pass criterion** (a number or a
literal screen behaviour), and **who** can run it (automatable here, or only the owner on a real phone).

---

## 0. The four instruments (build once, reuse every audit)

| # | Instrument | What it does | Status |
|---|---|---|---|
| I1 | **Flow driver** | Playwright script that plays the app as a family: every mode, every level, every branch. Dumps each screen's full text plus a screenshot, and every console/page error. | exists (`scratchpad/rev/*.mjs`) — promote to `scripts/audit/flow.mjs` |
| I2 | **Audio probe** | Patches `HTMLAudioElement.play`, `speechSynthesis.speak` and `AudioBufferSourceNode.start` before load, and logs every sound the app makes, with its source, rate and duration, per mode. | exists (proved read mode is silent) — promote to `scripts/audit/audio-probe.mjs` |
| I3 | **Signal analyser** | Decodes the clip set and the narration and reports pitch (F0), loudness (RMS), duration, intra-clip pitch drift, words per minute, and the gap between word starts. | exists in `scripts/cut-phonemes.py` (`measure`) — extend to narration |
| I4 | **State prober** | After a driven session, reads IndexedDB and asserts exactly what was written (progress, attempts, review, sessions, sounds). | exists inline — promote to `scripts/audit/state.mjs` |

Anything a instrument can check becomes a test in `npm test` (see §11). An audit that does not leave
tests behind will be needed again next month.

---

## 1. Sound (the area that failed twice)

| Check | How | Pass criterion |
|---|---|---|
| 1.1 Every taught sound has a clip | I3 over `manifest.json` | all 18 present, none missing |
| 1.2 The set is **one voice** | I3 pitch per clip | every voiced clip within ±50% of the median F0 *(was 112–394 Hz: four speakers; now 117–158 Hz)* |
| 1.3 No clip changes voice inside itself | I3 first-half vs second-half F0 | drift < 40 Hz *(was 153 Hz on `e`)* |
| 1.4 Level-matched | I3 RMS | spread < 6 dB *(was 8.6 dB, now 3.6 dB)* |
| 1.5 A vowel can be stretched, a stop is not "tuh" | I3 duration by kind | vowel ≥ 150 ms, stop ≤ 60 ms |
| 1.6 A blended word sounds like one word | owner listens to `sat pin dog puff pat bat ten den cap gap sad` at both paces | owner's yes/no — the only criterion that counts |
| 1.7 Narration speed | I3 over `library/*/story.json` | 110–135 words per minute *(was 166; an adult reads aloud at ~150, shared reading with a 4-year-old is 100–120)* |
| 1.8 Karaoke is followable | I3 gaps between word starts | median ≥ 300 ms; no more than 10% under 150 ms |
| 1.9 Each mode makes exactly the sounds it promises | I2 per mode | "I read" = phoneme clips only, never narration or speech *(verified)*; "Nani reads" = narration + prompts + blends |
| 1.10 Nothing ever says the whole magic word before the child blends it | I2 during a magic word | no narration or TTS token containing the target between page start and the verdict |
| 1.11 Two sounds never overlap by accident | I2 timeline | no two `play()` starts within 50 ms unless it is the blend graph |
| 1.12 Audio stops when it should | I2 + I1 | Home, page turn, card open, app hidden, screen lock → every source stopped within 200 ms |
| 1.13 Interruptions | owner: phone call, Siri, other app's audio mid-story | playback resumes or offers "tap to hear this page", never silently dead |
| 1.14 Offline | I1 with the network cut after one play | narration and clips still play from cache; no spinner |
| 1.15 Volume at bedtime | owner on the phone at arm's length | audible at 2 notches; no clip louder than the narration |

## 2. Phonics correctness

| Check | How | Pass criterion |
|---|---|---|
| 2.1 Every library word the child is asked to read is decodable at that level | existing `validate-library.test.ts` | already gated |
| 2.2 No magic word resolves to a name or to the first token | added in v5 | already gated |
| 2.3 The read-back line is decodable and is a *sentence* | test + read-aloud | no line is one word repeated; ≥ 2 distinct words |
| 2.4 The extra-word lexicon says its own sounds | review `ILL_TRY_WORDS` against a phoneme mapping | no /z/-final spellings, no silent letters, no clusters before they are taught |
| 2.5 Teaching order and tricky words match Letters & Sounds phase 2 | table review against the published order | exact match, one new sound per calendar day |
| 2.6 The validator fails closed | fuzz: every word in the library, plus 200 English CVC words, at each level | never accepts an untaught grapheme, digraph, split digraph, cluster or exception |
| 2.7 What the app *says* about a sound matches the clip | owner listens to each teach routine | mouth cue, action and clip agree |

## 3. Flows, mode by mode

Driven by I1. Every cell is a full session, ending in a state assertion (I4).

| Level | "Nani reads" | "I read" | Listen-along | Listener sibling |
|---|---|---|---|---|
| 0 sounds (night 1) | n/a | n/a | ✔ | ✔ |
| 4 sounds (first decoding night) | ✔ | ✔ | n/a | ✔ |
| 8 / 12 / 16 sounds | ✔ | ✔ | n/a | ✔ |
| 23 sounds (all taught) | ✔ | ✔ | n/a | ✔ |

Within each: warm-up (due / none / snoozed), the word card (first try / nudge / model / skip / not yet),
the extra word (offered / taken / left), read-back (smooth / one word helped), build (spelled / together /
not tonight), Done, and the return to Home. Plus: resume from every one of those points after a reload;
switch child mid-session; the same story in the other mode; a family story with and without a recording.

Pass criterion: no dead tap anywhere; every screen states what the grown-up should say *at that moment*;
no state assertion surprises (§4).

## 4. State and persistence

| Check | How | Pass criterion |
|---|---|---|
| 4.1 Every write path has a test | unit tests with a mocked store | `recordFinish`, `recordEncoding`, `scheduleReview`, `recordAttempt`, `snoozeReview`, sessions, sounds, custom stories |
| 4.2 Nothing is written twice or lost when two writes race | I4 after a build + finish in the same tick | encoding and finish both survive |
| 4.3 A failed read never destroys data | inject a throw in each boot await | no save runs; the family is intact after a reload |
| 4.4 Quota | fill IndexedDB near the limit, then add a photo story | honest message, nothing corrupted |
| 4.5 Resume is exact | I4 after leaving at each point | page, results (with ids and the extra flag), mode |
| 4.6 The day boundary is one rule | static: every `toDateString()` / `nextMorning` call site | one `dayStamp()` helper; a 00:15 finish belongs to the night that started it |
| 4.7 Deleting a child removes their data | I4 | no orphaned `st:progress/attempts/review/session` keys |
| 4.8 Two children never see each other's progress | I1 + I4 | per-kid keys only |

## 5. Screens, copy and one-handed use

| Check | How | Pass criterion |
|---|---|---|
| 5.1 Taps from launch to the first word of the story | I1 count | ≤ 2 on a normal night |
| 5.2 Everything the adult must read at each decision | I1 text dump, read as a tired parent | ≤ 2 sentences on screen at the moment of the decision |
| 5.3 Tap targets | measured rects in I1 | ≥ 44 px, and ≥ 48 px for anything a child taps |
| 5.4 Thumb reach on a 390×844 phone | geometry from I1 | every primary action in the bottom half |
| 5.5 Text never clipped or overlapped | screenshots at 320, 390, 430 px wide and at 200% text | no clipping, no horizontal scroll |
| 5.6 The instruction is never behind another surface | static: every `setCaption` while a panel is open | none *(this was a real defect: the modelling script sat under the sheet)* |
| 5.7 Nothing red, no buzzer, no failure sound | static + screenshots | holds |

## 6. Device and platform (owner only)

iPhone Safari tab · iPhone home-screen app · iPad · Android Chrome, each: install, offline, screen lock
mid-story, phone call mid-story, rotation, low battery, 200% text, mute switch, Bluetooth speaker,
microphone permission (record a sound; voice follow), and a cold start after a week.

Pass criterion: the nightly ritual completes on each, or the failure is explained on screen.

## 7. Accessibility

Contrast ≥ 4.5:1 for body text and ≥ 3:1 for the word tiles (computed from the tokens); `prefers-reduced-motion`
honoured (already); every colour cue has a second cue (pink/blue words also underline); VoiceOver reads the
word card in a sensible order; the app works at 200% text; no information conveyed by colour alone.

## 8. Privacy and data

What leaves the phone, verified by I2 plus a network log: nothing, except speech recognition while voice
follow is on (documented, opt-in) and font/asset fetches from the app's own origin. Plus: the README and
in-app copy match the code; there is a way to export and to delete everything.

## 9. Performance and size

Cold start to the first tap < 2 s on a mid-range phone; bundle and audio budgets (app shell < 500 kB,
clip set < 400 kB, per-story audio < 1 MB); IndexedDB growth per family story with a photo; the audio cache
cannot evict the app shell; 60 fps on the finger-follow slide.

## 10. Content

Every story: level fit, magic-word targets, read-back line, page length (≤ 20 words), art, narration timing,
and the moral read aloud to a 4-year-old. Plus coverage: how many books exist at each level *(today: 4–7
sounds → 2 books, 8–15 → 3, 16+ → 10; the whole set-3 block unlocks nothing — a real gap)*.

## 11. What becomes a permanent test

Everything in §1.1–1.5, §1.7–1.8, §2.1–2.4, §2.6, §4.1–4.2, §4.5, §5.3, §5.6, §7 contrast, §9 budgets.
The rule: **a defect the family reports must leave a number behind**, not a fix.

## 12. The family's trial (the only criterion that matters)

A scorecard the owner fills in over three nights: did the ritual complete; did the child blend a word
without help; did anything have to be explained twice; what did the child ask to do again; what did the
grown-up have to read on screen. Anything scored badly comes back as a numbered check above.

---

## Findings this method has already produced

1. **The clip set was four different voices.** Measured: 112–394 Hz across the voiced clips, with `o` at
   334 Hz — a different speaker an octave up, in `dog got pot not hot top`. Also `e` changed voice inside
   the clip (153 Hz drift) because the cut window straddled the recording's tail. Fixed by cutting every
   vowel from its first steady window and dropping the mismatched source: now 117–158 Hz, drift ≤ 26 Hz.
2. **Loudness jumped from sound to sound** (8.6 dB spread) because bursts were peak-normalised against
   long nasals. Now RMS-matched to 3.6 dB.
3. **The narration ran at 166 words per minute**, faster than an adult reads aloud and well past a
   4-year-old following along. Re-rendered slower, plus a per-family pace control.
4. **"I read" is genuinely silent** — the audio probe proved it, so the speed complaint is about the
   recorded narration and the blend model, which is what was slowed.

## Order of work

1. Promote the four instruments into `scripts/audit/` and wire §11's numbers into `npm test`.
2. Run §1, §2, §4 in full (automatable tonight).
3. Run §3's matrix in full (automatable, ~40 driven sessions).
4. Hand the owner §6 and §12 with a one-page scorecard.
5. Fix what they find, each fix leaving a number behind.
