Reading additional input from stdin...
OpenAI Codex v0.154.0
--------
workdir: /Users/rish_ai/StoryTime
model: gpt-6-astra
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 01a09421-97c3-7c12-bcea-d0a105b535fe
--------
user
Do NOT read or execute files under .claude/, .agents/, or ~/.claude/. You are reviewing an AUDIT PLAN for a children's phonics reading PWA used at bedtime by a family with a 4-year-old. Read docs/audit-plan.md, and for context docs/plan-v5.md, src/screens/Story.tsx, src/lib/blend.ts, src/lib/audio/player.ts, src/lib/audio/speech.ts, scripts/cut-phonemes.py, scripts/gen-audio.py, scripts/audit/render-blend.py.

The plan exists because two defects reached the family despite many code reviews: phoneme clips that turned out to be four different speakers (112-394 Hz), and narration at 166 words per minute. Both were measurements nobody was measuring.

Critique the PLAN: (1) What will it MISS? Name specific failure modes of THIS app that none of the twelve areas or four instruments would catch. (2) Which pass criteria are wrong, unmeasurable, or at the wrong threshold? Be numeric and cite file:line. (3) The owner asked to 'experience the app as a parent and as a child, seeing what they see and hearing what they hear'. Give the concrete method an automated agent should use to capture and judge the REAL audio of a session in a headless browser, including exactly what to measure for narration SPEED, TONE and PRONUNCIATION, and how to judge phoneme quality beyond pitch and loudness. (4) Where should the audit start and what is the single highest-value check? Mark [P1]/[P2]. Do not modify files.
codex
I’ll read the plan and the specified implementation files, then assess whether the proposed measurements cover what the parent and child actually see and hear.
exec
/bin/zsh -lc "pwd; rg --files -g AGENTS.md -g '"'!'"\\.claude/**' -g '"'!'"\\.agents/**' -g '"'!node_modules/**'"' -g '"'!'"\\.git/**' docs src scripts 2>/dev/null" in /Users/rish_ai/StoryTime
 exited 1 in 0ms:
/Users/rish_ai/StoryTime

exec
/bin/zsh -lc 'nl -ba docs/audit-plan.md' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	# StoryTime — end-to-end audit plan (2026-09-11)
     2	
     3	Why this exists: two defects reached the family after fourteen model reviews and a hands-on pass —
     4	phoneme clips that sound wrong, and narration that is too fast. Neither was catchable by reading code,
     5	because both are *measurements*, and nobody was measuring. This plan replaces "review the app" with
     6	"instrument the app, measure it against numbers, and keep the numbers as tests".
     7	
     8	Method first, then scope. Each check names: **how** it is run, the **pass criterion** (a number or a
     9	literal screen behaviour), and **who** can run it (automatable here, or only the owner on a real phone).
    10	
    11	---
    12	
    13	## 0. The four instruments (build once, reuse every audit)
    14	
    15	| # | Instrument | What it does | Status |
    16	|---|---|---|---|
    17	| I1 | **Flow driver** | Playwright script that plays the app as a family: every mode, every level, every branch. Dumps each screen's full text plus a screenshot, and every console/page error. | exists (`scratchpad/rev/*.mjs`) — promote to `scripts/audit/flow.mjs` |
    18	| I2 | **Audio probe** | Patches `HTMLAudioElement.play`, `speechSynthesis.speak` and `AudioBufferSourceNode.start` before load, and logs every sound the app makes, with its source, rate and duration, per mode. | exists (proved read mode is silent) — promote to `scripts/audit/audio-probe.mjs` |
    19	| I3 | **Signal analyser** | Decodes the clip set and the narration and reports pitch (F0), loudness (RMS), duration, intra-clip pitch drift, words per minute, and the gap between word starts. | exists in `scripts/cut-phonemes.py` (`measure`) — extend to narration |
    20	| I4 | **State prober** | After a driven session, reads IndexedDB and asserts exactly what was written (progress, attempts, review, sessions, sounds). | exists inline — promote to `scripts/audit/state.mjs` |
    21	
    22	Anything a instrument can check becomes a test in `npm test` (see §11). An audit that does not leave
    23	tests behind will be needed again next month.
    24	
    25	---
    26	
    27	## 1. Sound (the area that failed twice)
    28	
    29	| Check | How | Pass criterion |
    30	|---|---|---|
    31	| 1.1 Every taught sound has a clip | I3 over `manifest.json` | all 18 present, none missing |
    32	| 1.2 The set is **one voice** | I3 pitch per clip | every voiced clip within ±50% of the median F0 *(was 112–394 Hz: four speakers; now 117–158 Hz)* |
    33	| 1.3 No clip changes voice inside itself | I3 first-half vs second-half F0 | drift < 40 Hz *(was 153 Hz on `e`)* |
    34	| 1.4 Level-matched | I3 RMS | spread < 6 dB *(was 8.6 dB, now 3.6 dB)* |
    35	| 1.5 A vowel can be stretched, a stop is not "tuh" | I3 duration by kind | vowel ≥ 150 ms, stop ≤ 60 ms |
    36	| 1.6 A blended word sounds like one word | owner listens to `sat pin dog puff pat bat ten den cap gap sad` at both paces | owner's yes/no — the only criterion that counts |
    37	| 1.7 Narration speed | I3 over `library/*/story.json` | 110–135 words per minute *(was 166; an adult reads aloud at ~150, shared reading with a 4-year-old is 100–120)* |
    38	| 1.8 Karaoke is followable | I3 gaps between word starts | median ≥ 300 ms; no more than 10% under 150 ms |
    39	| 1.9 Each mode makes exactly the sounds it promises | I2 per mode | "I read" = phoneme clips only, never narration or speech *(verified)*; "Nani reads" = narration + prompts + blends |
    40	| 1.10 Nothing ever says the whole magic word before the child blends it | I2 during a magic word | no narration or TTS token containing the target between page start and the verdict |
    41	| 1.11 Two sounds never overlap by accident | I2 timeline | no two `play()` starts within 50 ms unless it is the blend graph |
    42	| 1.12 Audio stops when it should | I2 + I1 | Home, page turn, card open, app hidden, screen lock → every source stopped within 200 ms |
    43	| 1.13 Interruptions | owner: phone call, Siri, other app's audio mid-story | playback resumes or offers "tap to hear this page", never silently dead |
    44	| 1.14 Offline | I1 with the network cut after one play | narration and clips still play from cache; no spinner |
    45	| 1.15 Volume at bedtime | owner on the phone at arm's length | audible at 2 notches; no clip louder than the narration |
    46	
    47	## 2. Phonics correctness
    48	
    49	| Check | How | Pass criterion |
    50	|---|---|---|
    51	| 2.1 Every library word the child is asked to read is decodable at that level | existing `validate-library.test.ts` | already gated |
    52	| 2.2 No magic word resolves to a name or to the first token | added in v5 | already gated |
    53	| 2.3 The read-back line is decodable and is a *sentence* | test + read-aloud | no line is one word repeated; ≥ 2 distinct words |
    54	| 2.4 The extra-word lexicon says its own sounds | review `ILL_TRY_WORDS` against a phoneme mapping | no /z/-final spellings, no silent letters, no clusters before they are taught |
    55	| 2.5 Teaching order and tricky words match Letters & Sounds phase 2 | table review against the published order | exact match, one new sound per calendar day |
    56	| 2.6 The validator fails closed | fuzz: every word in the library, plus 200 English CVC words, at each level | never accepts an untaught grapheme, digraph, split digraph, cluster or exception |
    57	| 2.7 What the app *says* about a sound matches the clip | owner listens to each teach routine | mouth cue, action and clip agree |
    58	
    59	## 3. Flows, mode by mode
    60	
    61	Driven by I1. Every cell is a full session, ending in a state assertion (I4).
    62	
    63	| Level | "Nani reads" | "I read" | Listen-along | Listener sibling |
    64	|---|---|---|---|---|
    65	| 0 sounds (night 1) | n/a | n/a | ✔ | ✔ |
    66	| 4 sounds (first decoding night) | ✔ | ✔ | n/a | ✔ |
    67	| 8 / 12 / 16 sounds | ✔ | ✔ | n/a | ✔ |
    68	| 23 sounds (all taught) | ✔ | ✔ | n/a | ✔ |
    69	
    70	Within each: warm-up (due / none / snoozed), the word card (first try / nudge / model / skip / not yet),
    71	the extra word (offered / taken / left), read-back (smooth / one word helped), build (spelled / together /
    72	not tonight), Done, and the return to Home. Plus: resume from every one of those points after a reload;
    73	switch child mid-session; the same story in the other mode; a family story with and without a recording.
    74	
    75	Pass criterion: no dead tap anywhere; every screen states what the grown-up should say *at that moment*;
    76	no state assertion surprises (§4).
    77	
    78	## 4. State and persistence
    79	
    80	| Check | How | Pass criterion |
    81	|---|---|---|
    82	| 4.1 Every write path has a test | unit tests with a mocked store | `recordFinish`, `recordEncoding`, `scheduleReview`, `recordAttempt`, `snoozeReview`, sessions, sounds, custom stories |
    83	| 4.2 Nothing is written twice or lost when two writes race | I4 after a build + finish in the same tick | encoding and finish both survive |
    84	| 4.3 A failed read never destroys data | inject a throw in each boot await | no save runs; the family is intact after a reload |
    85	| 4.4 Quota | fill IndexedDB near the limit, then add a photo story | honest message, nothing corrupted |
    86	| 4.5 Resume is exact | I4 after leaving at each point | page, results (with ids and the extra flag), mode |
    87	| 4.6 The day boundary is one rule | static: every `toDateString()` / `nextMorning` call site | one `dayStamp()` helper; a 00:15 finish belongs to the night that started it |
    88	| 4.7 Deleting a child removes their data | I4 | no orphaned `st:progress/attempts/review/session` keys |
    89	| 4.8 Two children never see each other's progress | I1 + I4 | per-kid keys only |
    90	
    91	## 5. Screens, copy and one-handed use
    92	
    93	| Check | How | Pass criterion |
    94	|---|---|---|
    95	| 5.1 Taps from launch to the first word of the story | I1 count | ≤ 2 on a normal night |
    96	| 5.2 Everything the adult must read at each decision | I1 text dump, read as a tired parent | ≤ 2 sentences on screen at the moment of the decision |
    97	| 5.3 Tap targets | measured rects in I1 | ≥ 44 px, and ≥ 48 px for anything a child taps |
    98	| 5.4 Thumb reach on a 390×844 phone | geometry from I1 | every primary action in the bottom half |
    99	| 5.5 Text never clipped or overlapped | screenshots at 320, 390, 430 px wide and at 200% text | no clipping, no horizontal scroll |
   100	| 5.6 The instruction is never behind another surface | static: every `setCaption` while a panel is open | none *(this was a real defect: the modelling script sat under the sheet)* |
   101	| 5.7 Nothing red, no buzzer, no failure sound | static + screenshots | holds |
   102	
   103	## 6. Device and platform (owner only)
   104	
   105	iPhone Safari tab · iPhone home-screen app · iPad · Android Chrome, each: install, offline, screen lock
   106	mid-story, phone call mid-story, rotation, low battery, 200% text, mute switch, Bluetooth speaker,
   107	microphone permission (record a sound; voice follow), and a cold start after a week.
   108	
   109	Pass criterion: the nightly ritual completes on each, or the failure is explained on screen.
   110	
   111	## 7. Accessibility
   112	
   113	Contrast ≥ 4.5:1 for body text and ≥ 3:1 for the word tiles (computed from the tokens); `prefers-reduced-motion`
   114	honoured (already); every colour cue has a second cue (pink/blue words also underline); VoiceOver reads the
   115	word card in a sensible order; the app works at 200% text; no information conveyed by colour alone.
   116	
   117	## 8. Privacy and data
   118	
   119	What leaves the phone, verified by I2 plus a network log: nothing, except speech recognition while voice
   120	follow is on (documented, opt-in) and font/asset fetches from the app's own origin. Plus: the README and
   121	in-app copy match the code; there is a way to export and to delete everything.
   122	
   123	## 9. Performance and size
   124	
   125	Cold start to the first tap < 2 s on a mid-range phone; bundle and audio budgets (app shell < 500 kB,
   126	clip set < 400 kB, per-story audio < 1 MB); IndexedDB growth per family story with a photo; the audio cache
   127	cannot evict the app shell; 60 fps on the finger-follow slide.
   128	
   129	## 10. Content
   130	
   131	Every story: level fit, magic-word targets, read-back line, page length (≤ 20 words), art, narration timing,
   132	and the moral read aloud to a 4-year-old. Plus coverage: how many books exist at each level *(today: 4–7
   133	sounds → 2 books, 8–15 → 3, 16+ → 10; the whole set-3 block unlocks nothing — a real gap)*.
   134	
   135	## 11. What becomes a permanent test
   136	
   137	Everything in §1.1–1.5, §1.7–1.8, §2.1–2.4, §2.6, §4.1–4.2, §4.5, §5.3, §5.6, §7 contrast, §9 budgets.
   138	The rule: **a defect the family reports must leave a number behind**, not a fix.
   139	
   140	## 12. The family's trial (the only criterion that matters)
   141	
   142	A scorecard the owner fills in over three nights: did the ritual complete; did the child blend a word
   143	without help; did anything have to be explained twice; what did the child ask to do again; what did the
   144	grown-up have to read on screen. Anything scored badly comes back as a numbered check above.
   145	
   146	---
   147	
   148	## Findings this method has already produced
   149	
   150	1. **The clip set was four different voices.** Measured: 112–394 Hz across the voiced clips, with `o` at
   151	   334 Hz — a different speaker an octave up, in `dog got pot not hot top`. Also `e` changed voice inside
   152	   the clip (153 Hz drift) because the cut window straddled the recording's tail. Fixed by cutting every
   153	   vowel from its first steady window and dropping the mismatched source: now 117–158 Hz, drift ≤ 26 Hz.
   154	2. **Loudness jumped from sound to sound** (8.6 dB spread) because bursts were peak-normalised against
   155	   long nasals. Now RMS-matched to 3.6 dB.
   156	3. **The narration ran at 166 words per minute**, faster than an adult reads aloud and well past a
   157	   4-year-old following along. Re-rendered slower, plus a per-family pace control.
   158	4. **"I read" is genuinely silent** — the audio probe proved it, so the speed complaint is about the
   159	   recorded narration and the blend model, which is what was slowed.
   160	
   161	## Order of work
   162	
   163	1. Promote the four instruments into `scripts/audit/` and wire §11's numbers into `npm test`.
   164	2. Run §1, §2, §4 in full (automatable tonight).
   165	3. Run §3's matrix in full (automatable, ~40 driven sessions).
   166	4. Hand the owner §6 and §12 with a one-page scorecard.
   167	5. Fix what they find, each fix leaving a number behind.

exec
/bin/zsh -lc 'nl -ba src/screens/Story.tsx' in /Users/rish_ai/StoryTime
exec
/bin/zsh -lc 'nl -ba docs/plan-v5.md' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	# StoryTime plan v5 — end-to-end review fixes (2026-09-11, night)
     2	
     3	Sources: two Opus reviews (state/data, and K-1 teacher + parent) plus a hands-on pass driving both modes
     4	end to end in a 390×844 phone viewport. Transcripts: docs/reviews/opus-state-v5.md, docs/reviews/opus-pedagogy-v5.md.
     5	Verified by hand before planning: the three worst claims below are real (repro noted).
     6	
     7	Context: a grown-up reads the story aloud; a 4-year-old reads the decodable "magic words". Modes:
     8	"Nani reads" (recorded narration, karaoke, stops before each magic word) and "I read" (sound off,
     9	grown-up reads, child taps the pink word). Everything is local to the phone; the adult judges every verdict.
    10	
    11	## A. Data integrity and the progression ladder (P1 — silently wrong today)
    12	
    13	A1. **The first read of any story throws away the build evidence.** `store.ts:72` `recordEncoding` returns when
    14	    the progress row does not exist yet, but the row is only created by `recordFinish` at the end of the story.
    15	    Since `todayFor` prefers unfinished stories, a family reading a new book each night records zero successful
    16	    builds; `readyToAdvance` requires one within 7 days, so the next sound is never offered.
    17	    Fix: create the row when absent. Test: encoding then finish on a fresh slug keeps both.
    18	
    19	A2. **A failed read on boot replaces the real family with fresh defaults and saves them.** `family.tsx:69` catches,
    20	    calls `setKids(defaultKids())` (the `!kids.length` guard always passes: that closure's `kids` is `[]`), then
    21	    `ready` flips and the two save effects (`:94`, `:96`) persist the defaults over the real kids and settings.
    22	    Fix: a `loadedOk` ref set only inside the try; both save effects gated on it; never seed defaults on the fatal path.
    23	
    24	A3. **Magic words resolving to the first token or a proper name.** `Story.tsx:79` `targetIdx` takes the first
    25	    normalised match. Repro in the library: `pat-and-the-tap` p5 `pat`→token 0 `"Pat"` (ms 111),
    26	    `tap-tap-tap` p4 `tap`→token 0 `"Tap!"` (ms 111), `sam-and-the-pit` p5 `dad`→token 4 `"Dad"`. In listen mode
    27	    `stopMsAt()` is then 111 ms, so the page blips and the card opens before the child has heard the page; and the
    28	    child is shown a lowercased proper name to decode. These are the only three books a beginner has.
    29	    Fix: prefer the first lowercase occurrence, fall back to the first occurrence only if there is none; add a
    30	    library test asserting no resolved target is index 0 or capitalised.
    31	
    32	A4. **`finish` is not atomic and the build races it.** `Story.tsx:354` fires `onBuilt()` (read-modify-write of
    33	    `st:progress:<kid>`) and `onYes()` in the same handler; `onYes` drives `done`, whose effect calls `finish`
    34	    (another read-modify-write of the same key). Whichever save lands second wins the whole object.
    35	    Fix: await the encoding before advancing; clear the session inside the try in `finish`.
    36	
    37	A5. **`pendingBuild` compares against the earliest failure**, so fail → succeed → fail never comes back
    38	    (`family.tsx:104`). Fix: compare against the latest failure per word.
    39	
    40	A6. **Review scheduling drifts across midnight** (`store.ts:108,115`): a word missed at 00:15 is due the day after
    41	    tomorrow; a success at 20:00 with interval 3 comes due mid-session. Fix: anchor both to 05:00 of the target
    42	    day; treat a session before 05:00 as the previous day.
    43	
    44	A7. **`removeKid` orphans progress/attempts/review keys** and can leave the app with no active child, which throws
    45	    in `WarmUp.tsx:14` and `AddStory.tsx:34` (both call `learnerOf` above their own null guard).
    46	    Fix: delete all four keys, drop the in-memory session, null-guard both screens.
    47	
    48	A8. **`shaky` disagrees with `scheduleReview` about "needed help"** (`family.tsx:79` ignores `prompted`).
    49	    Fix: include `prompted`.
    50	
    51	## B. The nightly ritual (P1 — the family's experience)
    52	
    53	B1. **Nights 1–3 have no story at all.** Answer Welcome honestly ("none yet"), teach `s`, and Home says
    54	    "Four sounds, then the first story. 3 to go." Zero books fit under 4 sounds; the bookshelf is entirely locked.
    55	    Fix: below 4 sounds the reader gets the listener-shaped session on any book — narration, a per-page talk
    56	    prompt, tap-a-word — with honest copy: "Tonight Nani reads it all. Your first magic word comes in 3 sleeps."
    57	    No decoding claim is made and nothing is recorded as a word result.
    58	
    59	B2. **A tap on a book while words are due does nothing.** `Library.tsx:22` returns silently; the book looks
    60	    enabled. Fix: open the warm-up from that tap (or say "two words first — 40 seconds"), never swallow it.
    61	
    62	B3. **One hard word blocks the story every night forever.** `store.ts:114` reschedules a failed word to tomorrow
    63	    with no back-off and no retirement, and the warm-up is the only way to the story.
    64	    Fix: after 3 failed returns, retire the word ("comes back when ck is stronger"); a one-tap "not tonight" on the
    65	    warm-up that records nothing.
    66	
    67	B4. **"skip building today" is recorded as a failure** (`SegmentPanel.tsx:56` → `onDone(false)`), which schedules
    68	    the word for tomorrow, pins it as `pendingBuild` forever and blocks advancement. It cannot tell "wrong" from
    69	    "not tonight". Fix: three outcomes — Spelled it / Try together / Not tonight (records nothing). Suppress the
    70	    build entirely in bedtime mode.
    71	
    72	B5. **The big story tile is not tappable** — the obvious target on Home does nothing (verified by driving).
    73	    Fix: make the tile start the default mode.
    74	
    75	B6. **No way to repeat or go back a page, in either mode, and no "Again" on Done.** Fix: a "↺ this page" control
    76	    in the readbar (listen mode replays, read mode just re-arms), a back-a-page control, and "Read it again" on Done.
    77	
    78	## C. The word card and the adult script (P1)
    79	
    80	C1. **In "I read", the modelling instruction is painted behind the panel.** `panelOpen` stays true through
    81	    `modelling`; the caption bar (z-index 4) sits under the panel (z-index 5), and read mode is deliberately
    82	    silent. At the moment a non-phonics parent taps "Show me", they get a silent sweep and no instruction.
    83	    Fix: render the adult script inside `MagicPanel` whenever the panel is open; keep the caption for listen mode.
    84	
    85	C2. **The card cannot be dismissed without a verdict.** In read mode the pink word is live from page open, so a
    86	    sibling's tap opens a card whose only exits are a false ✓, a false skip, or leaving the story.
    87	    Fix: a "↓ not yet" that returns to narrating and records nothing.
    88	
    89	C3. **"wait 5 seconds" with no timer, and the two prohibitions shown only after the parent has broken them.**
    90	    Fix: a silent 5-second ring on the card before the verdict buttons arm, with "don't give the first sound"
    91	    and "no guessing from the picture" visible on the first card, not only after "Needs help".
    92	
    93	## D. "I'll try" quarantine (P1)
    94	
    95	D1. It offers a second copy of the page's own magic word (`tap-tap-tap` p1, `sam-and-the-pit` p2) because `taken`
    96	    is only the first occurrence; and the capital guard exempts index 0, so `Pat` (a name) is offered.
    97	    Fix: exclude every token whose normalised form is a magic word on the page; drop the `i > 0` exemption.
    98	
    99	D2. Its result is scored exactly like a designed magic word: it feeds `recordAttempt` (the advancement gate) and
   100	    `scheduleReview`. A child who volunteers and stumbles is held back; one who declines is not.
   101	    Fix: `extra: true` on the result; excluded from `recordAttempt`; celebrated by name on Done.
   102	
   103	D3. The card it opens is titled "Magic word · Veer's turn" — indistinguishable from the designed word.
   104	    Fix: its own kicker ("Extra word · you asked for this one") and a softer verdict pair.
   105	
   106	D4. Not suppressed in bedtime mode, against the plan's own rule. Fix: add `&& !bedtime`.
   107	
   108	## E. The teach routine (P1)
   109	
   110	E1. **"Replay today's sound: s" teaches the next sound instead.** Home labels from `kid.gpcs.at(-1)`;
   111	    `TeachSound.tsx:23` always targets `LS_PHASE2_ORDER[kid.gpcs.length]`. The parent walks six steps for `a`
   112	    with "mark it taught anyway" under the disabled button — two new sounds on day one, which is exactly what the
   113	    one-per-day rule exists to prevent. Fix: pass the target grapheme in; replay shows steps 1–3 and has no
   114	    "Taught today" button.
   115	
   116	E2. **The routine is unreachable at 5+ sounds when not ready**, yet Settings tells the parent to use it.
   117	    Fix: a permanent "Sounds: teach or replay" entry in Settings and on Home; readiness stays a recommendation.
   118	
   119	E3. **The Settings level dropdown changes sounds without the matching tricky words**, so a child set to 16 sounds
   120	    still fails `fits()` on all seven set-4 books. Fix: apply the same tricky ladder Welcome uses.
   121	
   122	## F. What the child and the parent see (P2, high value)
   123	
   124	F1. **Done ends on a list of failures.** Fix: the child-facing screen shows only what went right, at size; the
   125	    full ledger moves behind a "grown-up: tonight's words" disclosure.
   126	
   127	F2. **The counters labelled "magic words" count something else** (stored results include extras; Settings sums only
   128	    the latest run per story, so the number can go down). Fix: count designed words from `page.magic`, exclude
   129	    extras, and label the Settings figure as "this month" or make it cumulative.
   130	
   131	F3. **"night N of 30" is one too high after tonight's story is finished** (`family.tsx:103` + `Home.tsx:42`).
   132	    Fix: drop the `+1` when today is already counted.
   133	
   134	F4. **A "My sounds" wall** — the sounds the child knows and the words they have read first-try, big, for showing a
   135	    grandparent. This is the only persistent thing that belongs to the child, and it doubles as the parent's
   136	    morning report. (Planned in docs/plan.md and never built.)
   137	
   138	## G. Lifecycle and leaks (P2)
   139	
   140	G1. `RecordSounds` never releases the microphone on unmount and leaks a blob URL per preview.
   141	G2. `AddStory`'s tap-along playback keeps playing after the screen closes.
   142	G3. Voice follow's `stopAt` is a stale closure: once the pink word is answered the cursor freezes for the page.
   143	G4. Finger-follow's cursor only accepts exactly `cursor + 1`, so a finger that skips a word (or returns to the next
   144	    line) freezes the trail for the rest of the page. Fix: advance to the furthest word before the block.
   145	G5. Timed narration stops with zero margin before the magic word (`Story.tsx:96`), unlike the untimed path's 350 ms.
   146	    Fix: a 120 ms lead-out so a boundary drift cannot leak the word's first phoneme.
   147	G6. `Library` "start another story" is hard-coded to listen, bypassing the mode picker.
   148	
   149	## H. Content (P2)
   150	
   151	H1. Nights 5–24 run on three books (4–7 sounds → 2, 8–15 → 3, 16+ → 10). The whole set-3 block unlocks nothing.
   152	    Fix: write two set-2/set-3 originals (`pit dad nap dig dog pot cot kid sock`), validator-checked.
   153	H2. Two read-back lines are degenerate: `tap-tap-tap` is "Tap, tap, tap." (one word three times) and
   154	    `pat-and-the-tap` is "Pat sat." (not a moral) — and these are the first two books a beginner meets.
   155	H3. A family story with no magic words can become tonight's story, leaving the child one line to read.
   156	
   157	## Out of scope, stated honestly
   158	- Real illustrations. Every page is one emoji; a bedtime book for this age is half picture. This needs art assets,
   159	  not code, and is the largest remaining gap.
   160	- A job for the sibling who is physically present during the reader's session (they have a profile, not a role).
   161	
   162	## Order of execution
   163	1. A1–A3 (data loss and the blocked ladder), then A4–A8.
   164	2. B1, B4, B2, B5, B6 (the ritual), then C1–C3 (the card), D1–D4 (quarantine), E1–E3 (teach).
   165	3. F1–F3, G1–G6.
   166	4. H1–H3 and F4 if the night allows; anything not done is listed in docs/state.md as not done.
   167	
   168	## Rules that must hold (unchanged)
   169	Never TTS for phoneme clips. No red/buzzer on a miss. Validator fails closed. Don't remove a feature to satisfy a
   170	reviewer. Neutral names in the public repo. The adult keeps every verdict; nothing the app hears judges the child.
   171	
   172	---
   173	
   174	# v5 FINAL — after Grok's review (docs/reviews/grok-plan-v5.md)
   175	
   176	Grok found several of the fixes above to be the wrong patch. Corrections, and the order actually executed:
   177	
   178	**Corrected fixes**
   179	- A3: "prefer lowercase" only repairs 1 of the 3 books. Ship ONE `resolveMagic(page, word)` used by both call sites
   180	  (`Story.tsx:79` and `:220` are the same bug implemented twice), AND rewrite the two pages the heuristic cannot
   181	  save (`tap-tap-tap` p4, `sam-and-the-pit` p5). The library assertion is "the resolved token is not capitalised",
   182	  not "index > 0" (a page may legally start with a CVC).
   183	- A2: keep seeding in-memory defaults (the "read tonight without saving" escape hatch needs them); gate only the
   184	  two SAVE effects on a `loadedOk` ref.
   185	- A4: it is two races, and it no-ops without A1. Ship A1+A4 as one atomic encoding write; `saveSession` is already
   186	  inside `finish`'s try.
   187	- B1: do not add machine states, do not flip `role`, do not call `recordFinish` as today. `listenAlong =
   188	  role==="reader" && gpcs.length < 4`; tonight's tile pinned to the same set-1 book (not "any book");
   189	  `recordFinish(..., { listenOnly: true })` stamps `history` and `lastFinished` but leaves `timesFinished` 0 and
   190	  writes no results/attempt/review, so night 4 still gets that book as the first decoding night.
   191	- B3: "retire until ck is stronger" is wrong (tap is set 1, ck is set 4) and a no-op unless `scheduleReview`
   192	  honours it. Ship "not tonight" as a `snoozeUntil` that clears the gate for tonight only.
   193	- B4: do not suppress the build at bedtime — with A1 that is the only advancement evidence and this family only
   194	  reads at bedtime. Keep it optional there, defaulting to "Not tonight".
   195	- B5: the tile must route to the warm-up when words are due, or it bypasses the gate B2/B3 protect.
   196	- B2: opening the warm-up is not enough; hand the tapped slug through so the book they tapped is what starts.
   197	- C3: drop the hard 5-second lock (MagicPanel is shared with the warm-up; 15–25 s of added waiting). Keep the two
   198	  prohibitions, visible on the first card.
   199	- D2: `extra` leaks into more sinks than the plan named. One `designed(results)` helper used by `recordAttempt`,
   200	  `scheduleReview`, `shaky`, `buildWord`, Settings and Done.
   201	- E1: replay keeps steps 1–4 (the trace matters); it drops only "Taught today" and the next level's tricky word.
   202	- G4: `advanceCursor`'s strict `cursor+1` is the documented design. Narrow fix only: a NEW touch that lands ahead
   203	  re-syncs the cursor; within one continuous slide the strict rule stands.
   204	
   205	**Dropped or deferred** (stated honestly rather than half-done): A6 (day boundary needs one `dayStamp` helper
   206	across six call sites, not a two-line change), A7 (unreachable from the UI; orphan keys are hygiene), A8 (a product
   207	choice, not corruption), B6 "Again" (collides with `finishedRef`; needs a page/results reset), G3 (the card already
   208	stops the recogniser), G5 (token-0 content was the real stop bug), F4 and H1 (features), F2/F3/G1/G2/G6 (small).
   209	
   210	**Also caught by Grok, added**: no wake lock — the app uses `setInterval` *because the phone dims*, which is the
   211	actual bedtime bug; and there are no tests for the write path all of §A depends on (needs an idb-keyval mock).
   212	
   213	**Execution order**: B1 · A3+H2 · A2 · A1+A4 · C2+C1 · D1–D4 · B4 · B2+B5 · E1+E3 · B3 · F1 · wake lock · G4-lite.

 succeeded in 0ms:
     1	import { useCallback, useEffect, useMemo, useRef, useState } from "react";
     2	import { useMachine } from "@xstate/react";
     3	import { storyMachine, type WordResult } from "../machine/story.machine";
     4	import type { Page, Story } from "../lib/content/types";
     5	import { TRICKY_PARTS } from "../lib/phonics/learner";
     6	import { checkLine, checkWord, normalise, type LearnerModel } from "../lib/phonics/validator";
     7	import { playNarration, stopAll, unlock, type Playing } from "../lib/audio/player";
     8	import { promptAsset, storyAsset } from "../lib/library";
     9	import { speakText, type SpeakHandle } from "../lib/audio/speech";
    10	import { useFamily } from "../lib/family";
    11	import { learnerOf } from "../lib/store";
    12	import { Art } from "../components/Art";
    13	import { MagicPanel } from "../components/MagicPanel";
    14	import { stretched, playBlend, stopBlend } from "../lib/blend";
    15	import { SegmentPanel } from "../components/SegmentPanel";
    16	import type { Verdict } from "../components/MagicPanel";
    17	import type { Mode } from "./Home";
    18	import { advanceCursor, hitWord, type WordRect } from "../lib/follow";
    19	import { pickIllTry } from "../lib/phonics/illtry";
    20	import { magicTokens, resolveMagic } from "../lib/phonics/target";
    21	import { designed, volunteered } from "../lib/results";
    22	import { keepAwake } from "../lib/wakelock";
    23	import { align } from "../lib/voice/align";
    24	import { startVoice, voiceSupported, type VoiceSession, type VoiceState } from "../lib/voice/session";
    25	import { BookIcon, HomeIcon, LockIcon, MoonIcon, SpeakerIcon, CheckIcon } from "../components/Icons";
    26	
    27	type Prompts = Record<string, { audio: string; ms: number }>;
    28	let promptsCache: Prompts | null = null;
    29	async function prompts(): Promise<Prompts> {
    30	  if (promptsCache) return promptsCache;
    31	  try { const r = await fetch(promptAsset("manifest.json")); promptsCache = r.ok ? ((await r.json()) as Prompts) : {}; } catch { promptsCache = {}; }
    32	  return promptsCache;
    33	}
    34	const isUrl = (a: string) => /^(data|blob):/.test(a);
    35	
    36	export function StoryScreen({ story, mode, resume, onHome }: { story: Story; mode: Mode; resume: boolean; onHome: () => void }) {
    37	  const fam = useFamily();
    38	  const kid = fam.activeKid!;
    39	  const learner = useMemo(() => learnerOf(kid), [kid]);
    40	  const listenAlong = fam.listensAlong(kid);   // a reader with fewer than four sounds: a real book, read to them, nothing to decode yet
    41	  const listener = kid.role === "listener" || listenAlong;
    42	  const listen = mode === "listen";
    43	  const bedtime = fam.settings.bedtime;
    44	  const reader = fam.settings.tonight ?? fam.settings.readers[0] ?? "Grown-up";
    45	
    46	  const init = resume && fam.session?.slug === story.slug ? { page: fam.session.page, results: fam.session.results as WordResult[] } : {};
    47	  const [snap, send] = useMachine(storyMachine, { input: { story, ...init } });
    48	  const ctx = snap.context;
    49	  const state = snap.value as string;
    50	  const page: Page | undefined = story.pages[ctx.page];
    51	  const playing = useRef<Playing | SpeakHandle | null>(null);
    52	  const [caption, setCaption] = useState("");
    53	  const [stalled, setStalled] = useState(false);
    54	  const [pageHeld, setPageHeld] = useState(false);
    55	  const [retry, setRetry] = useState(0);
    56	  const startedRef = useRef(false);
    57	  const finishedRef = useRef(false);
    58	  const runRef = useRef(0);
    59	  const [sweep, setSweep] = useState(0);
    60	
    61	  useEffect(() => {
    62	    if (state === "idle" || state === "done") return;
    63	    void fam.setSession({ kidId: kid.id, slug: story.slug, mode, page: ctx.page, results: ctx.results, updatedAt: Date.now() });
    64	  // eslint-disable-next-line react-hooks/exhaustive-deps
    65	  }, [ctx.page, ctx.results.length, state]);
    66	
    67	  // one knob for everything the app says: the narration, the blend model and the spoken prompts
    68	  const rate = (bedtime ? 0.88 : 1) * (fam.settings.pace === "normal" ? 1 : 0.85);
    69	  const speak = useCallback(async (src: string | null, text?: string) => {
    70	    if (text) setCaption(text);
    71	    playing.current?.stop();
    72	    if (src) { const p = playNarration(src, rate); playing.current = p; try { await p.done; } catch { /* caption is enough */ } }
    73	    else if (text) { const h = speakText(text, { rate }); playing.current = h; await h.done; }
    74	  }, [rate]);
    75	  const speakPrompt = useCallback(async (key: string, text: string) => {
    76	    const m = await prompts();
    77	    const s = story.prompts?.[key] ? storyAsset(story, story.prompts[key].audio) : m[key] ? promptAsset(m[key].audio) : null;
    78	    await speak(s, text);
    79	  }, [speak, story]);
    80	
    81	  /** first magic token on this page whose occurrence (page:word) has not been graded */
    82	  const doneIds = useMemo(() => new Set(ctx.results.map((r) => r.id ?? "")), [ctx.results]);
    83	  const pendingMagicIdx = useCallback((p: Page, pageNo: number) => { if (listener) return -1; for (const w of p.magic ?? []) { const i = resolveMagic(p, w); if (i >= 0 && !doneIds.has(`${pageNo}:${i}`)) return i; } return -1; }, [listener, doneIds]);
    84	
    85	  const narratePage = useCallback(async (p: Page, pageNo: number, opts: { stopAtMagic: boolean; onDone: () => void }): Promise<void> => {
    86	    const magicIdx = opts.stopAtMagic ? pendingMagicIdx(p, pageNo) : -1;
    87	    const run = ++runRef.current; const alive = () => run === runRef.current;
    88	    playing.current?.stop();
    89	    let stopped = false;
    90	    const reachMagic = () => { stopped = true; send({ type: "TOKEN", index: magicIdx }); send({ type: "MAGIC_REACHED", word: normalise(p.tokens[magicIdx].t), index: magicIdx }); };
    91	
    92	    const untimed = !p.tokens.some((t) => t.ms > 0);
    93	    if (p.audio && !(untimed && magicIdx >= 0)) {   // a parent recording has no word timings: it cannot stop cleanly before the magic word, so the first pass uses speech and the recording plays on the reread
    94	      const src = isUrl(p.audio) ? p.audio : storyAsset(story, p.audio);
    95	      const pl = playNarration(src, rate); playing.current = pl;
    96	      const timed = p.tokens.some((t) => t.ms > 0);
    97	      const durMs = () => (isFinite(pl.el.duration) && pl.el.duration > 0 ? pl.el.duration * 1000 : p.audioMs ?? Infinity);
    98	      const tokMs = (i: number) => (timed ? p.tokens[i].ms : durMs() !== Infinity ? (durMs() * i) / p.tokens.length : Infinity);
    99	      const stopMsAt = () => (magicIdx >= 0 ? (timed ? tokMs(magicIdx) : tokMs(magicIdx) - 350) : Infinity);
   100	      let last = -1;
   101	      // interval, not rAF: the magic-word stop must fire even when the phone screen dims or the tab is backgrounded
   102	      const raf = setInterval(() => {
   103	        const ms = pl.el.currentTime * 1000; const stopMs = stopMsAt();
   104	        if (ms >= stopMs) { clearInterval(raf); pl.stop(); reachMagic(); return; }
   105	        let i = -1; for (let k = 0; k < p.tokens.length; k++) if (tokMs(k) <= ms) i = k;
   106	        if (i !== last) { last = i; send({ type: "TOKEN", index: i }); }
   107	      }, 40);
   108	      const stall = new Promise<"stall">((res) => setTimeout(() => res("stall"), 5000));
   109	      const deadline = new Promise<"deadline">((res) => setTimeout(() => res("deadline"), ((p.audioMs ?? 20000) / rate) + 1500));
   110	      let ok = true;
   111	      try { const r = await Promise.race([pl.done.then(() => "done" as const), stall.then(() => (pl.el.currentTime === 0 ? "stall" : pl.done.then(() => "done" as const))), deadline]); if (r === "stall") ok = false; if (r === "deadline") pl.stop(); } catch { ok = false; }
   112	      clearInterval(raf);
   113	      if (!alive()) return;
   114	      if (!ok) { pl.stop(); setStalled(true); setCaption("Tap ▶ to hear this page."); return; }
   115	    } else {
   116	      const upto = magicIdx >= 0 ? magicIdx : p.tokens.length;
   117	      const text = p.tokens.slice(0, upto).map((t) => t.t).join(" ");
   118	      if (text) { const h = speakText(text, { rate, onWord: (i) => alive() && send({ type: "TOKEN", index: i }) }); playing.current = h; await h.done; }
   119	      if (!alive()) return;
   120	      if (magicIdx >= 0) { reachMagic(); return; }
   121	    }
   122	    if (!alive()) return;
   123	    if (!stopped && magicIdx >= 0) { reachMagic(); return; }
   124	    if (!stopped) { send({ type: "TOKEN", index: p.tokens.length }); if (magicIdx < 0 && opts.stopAtMagic) await new Promise((r) => setTimeout(r, 1400)); if (alive()) opts.onDone(); }
   125	  }, [send, story, rate, pendingMagicIdx]);
   126	
   127	  useEffect(() => {
   128	    setStalled(false); setPageHeld(false);
   129	    if (state === "narrating" && page) {
   130	      if (!listen) return;
   131	      let live = true;
   132	      const onDone = () => { if (!live) return; if (listener) setPageHeld(true); else send({ type: "NARRATION_DONE" }); };
   133	      void narratePage(page, ctx.page, { stopAtMagic: true, onDone });
   134	      return () => { live = false; };
   135	    }
   136	    if (state === "reread" && page) {
   137	      if (!listen) { send({ type: "RESUME" }); return; }
   138	      let live = true;
   139	      void narratePage(page, ctx.page, { stopAtMagic: false, onDone: () => live && send({ type: "REREAD_DONE" }) });
   140	      return () => { live = false; };
   141	    }
   142	    if (state === "magicWord" && ctx.mode !== "modelled" && listen) void speakPrompt("yours", "… this one is yours. Start at the first sound and slide through the word.");
   143	    if (state === "moral") {
   144	      if (!listen) { setCaption(`${reader} reads the moral. Then ${kid.name} tries the whole line.`); return; }
   145	      void (async () => { await speak(story.moral.audio ? (isUrl(story.moral.audio) ? story.moral.audio : storyAsset(story, story.moral.audio)) : null, story.moral.spoken); if (!listener) await speakPrompt("line", "Now you. Read your line."); })();
   146	    }
   147	    if (state === "done") {
   148	      if (!finishedRef.current) { finishedRef.current = true; void fam.finish(kid.id, story.slug, ctx.results, { listenOnly: listenAlong }); }
   149	      const okWords = ctx.results.filter((r) => r.ok).map((r) => r.word);
   150	      const said = okWords.length ? `You blended ${okWords.join(", ")}.` : "Good listening. Those words come back tomorrow.";
   151	      setCaption(said); if (listen) { const h = speakText(said, { rate }); playing.current = h; }
   152	    }
   153	  // eslint-disable-next-line react-hooks/exhaustive-deps
   154	  }, [state, ctx.page, retry]);
   155	
   156	  useEffect(() => { if (!startedRef.current) { startedRef.current = true; void unlock().then(() => send({ type: "START" })); } const awake = keepAwake(); return () => { awake(); stopAll(); stopBlend(); playing.current?.stop(); }; }, [send]);
   157	
   158	  const home = () => { runRef.current++; playing.current?.stop(); stopAll(); stopBlend(); onHome(); };
   159	  const inStory = state === "narrating" || state === "reread" || state === "magicWord" || state === "modelling";
   160	  const panelOpen = (state === "magicWord" || state === "modelling") && !!ctx.magic;
   161	
   162	  /** continuous-blend model, then hand the word back */
   163	  const together = async () => {
   164	    const run = ++runRef.current; const alive = () => run === runRef.current;
   165	    const word = ctx.magic!; const gs = checkWord(word, learner).graphemes;
   166	    send({ type: "NOT_YET" });
   167	    if (listen) await speakPrompt("notyet", "That's okay. Listen: I'll slide through the sounds, then you try."); else setCaption(`${reader}: slide through the sounds and let them run into the word (bouncy sounds like t and p stay short).`);
   168	    if (!alive()) return;
   169	    setCaption(stretched(gs) + " …");
   170	    if (listen) await playBlend(gs, { alive, rate, onProgress: setSweep });
   171	    else { const n = gs.length * 12; for (let i = 1; i <= n; i++) { await new Promise((r) => setTimeout(r, 70)); if (!alive()) return; setSweep(i / n); } }   // sound off: the app must not talk over the grown-up
   172	    setSweep(0);
   173	    if (!alive()) return;
   174	    // the model may end in the whole word (that is what a model is); it is recorded as "modelled", never as known
   175	    if (listen) await speakPrompt("yourturn", "Your turn: start here and slide through the word."); else setCaption(`Now ${kid.name}: start at the first sound and slide through the word.`);
   176	    if (alive()) send({ type: "MODEL_DONE" });
   177	  };
   178	
   179	  return (
   180	    <div className={"screen-wrap" + (panelOpen ? " panel-open" : "")}>
   181	      <header className="top">
   182	        <button className="home" onClick={home} aria-label="Home"><HomeIcon /></button>
   183	        <div className="title">{story.title}</div>
   184	        <div className="lvl">{listen ? (bedtime ? <><MoonIcon size={16} /> bedtime</> : <><SpeakerIcon size={16} /> listen</>) : <><BookIcon size={16} /> read</>}</div>
   185	      </header>
   186	
   187	      {inStory && page && (
   188	        <StoryView
   189	          page={page} pageNo={ctx.page} total={story.pages.length} token={listen ? ctx.token : -1} results={ctx.results}
   190	          readMode={!listen} listener={listener} reader={reader} kid={kid.name} stalled={stalled} pageHeld={pageHeld} hideArt={panelOpen} learner={learner} bedtime={bedtime} voiceFollow={!!fam.settings.voiceFollow && !bedtime}
   191	          onRetry={() => { void unlock(); setStalled(false); setRetry((n) => n + 1); }}
   192	          onMagicTap={(w, i, extra) => state === "narrating" && send({ type: "MAGIC_REACHED", word: w, index: i, extra })}
   193	          onWordTap={(tok) => { if (listener || !listen) { if (state === "narrating" && listen && !pageHeld) return; setCaption(tok); const h = speakText(tok, { rate }); playing.current = h; } }}
   194	          onNext={() => state === "narrating" && send({ type: "PAGE_NEXT" })}
   195	        />
   196	      )}
   197	
   198	      {panelOpen && (
   199	        <MagicPanel
   200	          word={ctx.magic!} learner={learner} modelling={state === "modelling"} modelledOnce={ctx.mode === "modelled"} sweep={sweep} kid={kid.name} reader={reader}
   201	          extra={ctx.extra} kicker={ctx.extra ? `Extra word · ${kid.name} asked for this one` : undefined}
   202	          modelScript={listen ? undefined : `${reader}: slide through the sounds and let them run into the word. Bouncy sounds like t and p stay short. Then ${kid.name} tries alone.`}
   203	          onDismiss={!listen ? () => send({ type: "DISMISS" }) : undefined}
   204	          onSound={() => send({ type: "SOUND_TAPPED" })}
   205	          onYes={async (v: Verdict) => { const w = ctx.magic!; if (listen) await speakPrompt(`yes:${w}`, `Yes! ${w}.`); else setCaption(`Yes! ${w}.`); send({ type: "YES", verdict: v }); }}
   206	          onTogether={together}
   207	          onSkip={async () => { const w = ctx.magic!; setCaption("We'll practise it tomorrow." + (listen ? "" : ` ${reader}, read the word for them once.`)); if (listen) { await playBlend(checkWord(w, learner).graphemes, { rate }); await speakPrompt("practise", "We'll practise it tomorrow."); } send({ type: "SKIP" }); }}
   208	        />
   209	      )}
   210	
   211	      {state === "moral" && <Moral story={story} learner={learner} listener={listener} kid={kid.name} reader={reader} listen={listen} bedtime={bedtime} setCaption={setCaption} buildWord={fam.pendingBuild ?? designed(ctx.results).find((r) => r.ok && r.mode === "first_try")?.word ?? null} onBuilt={(w, ok) => fam.encodingDone(story.slug, w, ok)} onYes={() => send({ type: "LINE_YES" })} />}
   212	      {state === "done" && <Done story={story} results={ctx.results} bedtime={bedtime} kid={kid.name} learner={learner} listenOnly={listener} onHome={home} />}
   213	
   214	      <div className="cap" aria-live="polite">{caption}</div>
   215	      {fam.toast && <div className="toast" role="status">{fam.toast}</div>}
   216	    </div>
   217	  );
   218	}
   219	
   220	function StoryView({ page, pageNo, total, token, results, readMode, listener, reader, kid, stalled, pageHeld, hideArt, learner, bedtime, voiceFollow, onRetry, onMagicTap, onWordTap, onNext }: {
   221	  page: Page; pageNo: number; total: number; token: number; results: WordResult[];
   222	  readMode: boolean; listener: boolean; reader: string; kid: string; stalled: boolean; pageHeld: boolean; hideArt: boolean; learner: LearnerModel; bedtime: boolean; voiceFollow: boolean;
   223	  onRetry: () => void; onMagicTap: (w: string, i: number, extra?: boolean) => void; onWordTap: (tok: string) => void; onNext: () => void;
   224	}) {
   225	  const resAt = (i: number) => results.find((r) => r.id === `${pageNo}:${i}`);
   226	  const firstIdx = new Set((page.magic ?? []).map((w) => resolveMagic(page, w)).filter((i) => i >= 0));   // the same resolver the narration stop uses
   227	  const pending = listener ? [] : [...firstIdx].filter((i) => i >= 0 && !resAt(i));
   228	  // trailing punctuation sits outside the highlight: the child decodes letters, not full stops
   229	  const split = (tok: string) => { const m = tok.match(/^([^A-Za-z]*)([A-Za-z]+(?:['’][A-Za-z]+)?)([^A-Za-z]*)$/); return m ? [m[1], m[2], m[3]] : ["", tok, ""]; };
   230	  const last = pageNo + 1 >= total;
   231	
   232	  // finger-follow (read mode): pointer = word under the finger, cursor = the adult's reading position
   233	  const sentenceRef = useRef<HTMLParagraphElement>(null);
   234	  const cardRef = useRef<HTMLDivElement>(null);   // the finger travels under the print, so the whole card listens
   235	  const [pointer, setPointer] = useState(-1);
   236	  const [cursor, setCursor] = useState(-1);
   237	  const drag = useRef<{ x: number; y: number; on: boolean; rects: WordRect[]; id: number } | null>(null);
   238	  useEffect(() => { setPointer(-1); setCursor(-1); drag.current = null; }, [pageNo]);
   239	  const blocked = (i: number) => firstIdx.has(i) && !resAt(i);
   240	  const land = (i: number, fresh = false) => {
   241	    if (i < 0) return;
   242	    setPointer(i);
   243	    setCursor((c) => {
   244	      if (!fresh || i <= c) return advanceCursor(c, i, blocked);
   245	      let limit = i; for (let j = c + 1; j <= i; j++) if (blocked(j)) { limit = j - 1; break; }   // never across a word the child still owes
   246	      return Math.max(c, limit);
   247	    });
   248	  };
   249	  const measure = (): WordRect[] => Array.from(sentenceRef.current?.querySelectorAll<HTMLElement>("[data-i]") ?? []).map((el) => { const b = el.getBoundingClientRect(); return { index: Number(el.dataset.i), left: b.left, right: b.right, top: b.top, bottom: b.bottom }; });
   250	  const onDown = (e: React.PointerEvent) => { if (!readMode) return; drag.current = { x: e.clientX, y: e.clientY, on: false, rects: [], id: e.pointerId }; };
   251	  const onMove = (e: React.PointerEvent) => {
   252	    const d = drag.current; if (!d || !readMode) return;
   253	    let fresh = false;
   254	    if (!d.on) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return; d.on = true; fresh = true; d.rects = measure(); try { cardRef.current?.setPointerCapture(d.id); } catch { /* not supported */ } }   // a tap stays a tap: the pink button still clicks
   255	    land(hitWord(d.rects, e.clientX, e.clientY), fresh);
   256	  };
   257	  const onUp = () => { drag.current = null; };
   258	  const wordCls = (i: number, base: string) => (readMode ? base + (i === pointer ? " now" : i <= cursor ? " read" : "") : base);
   259	
   260	  // "I'll try": one extra decodable word per page, chosen on page open, offered only until the grown-up has read past it
   261	  const extra = useMemo(() => (readMode && !listener && !bedtime ? pickIllTry(page, learner, magicTokens(page), (i) => !!resAt(i)) : -1),   // never a copy of the designed word, never at bedtime
   262	  // eslint-disable-next-line react-hooks/exhaustive-deps
   263	  [page, pageNo, readMode, listener, learner, bedtime]);
   264	
   265	  // follow my voice (opt-in): the recogniser only ever moves the cursor forward, never onto the pending child word
   266	  const [voice, setVoice] = useState<VoiceState>("off");
   267	  const session = useRef<VoiceSession | null>(null);
   268	  const anchor = useRef(-1);
   269	  const cursorRef = useRef(-1); cursorRef.current = cursor;
   270	  const tokensNorm = useMemo(() => page.tokens.map((t) => normalise(t.t)), [page]);
   271	  const stopVoice = () => { session.current?.stop(); session.current = null; };
   272	  useEffect(() => { anchor.current = cursorRef.current; }, [pointer]);   // a finger or tap correction invalidates the running alignment
   273	  useEffect(() => { if (hideArt) { stopVoice(); setVoice((v) => (v === "listening" || v === "starting" ? "stopped" : v)); } }, [hideArt]);   // the word card: never listen to the child
   274	  useEffect(() => () => stopVoice(), [pageNo]);
   275	  const startFollow = () => {
   276	    stopVoice(); anchor.current = cursorRef.current;
   277	    session.current = startVoice({
   278	      onState: setVoice,
   279	      onHeard: (words, final) => {
   280	        const stopAt = pending.length ? pending[0] : -1;
   281	        const next = align({ tokens: tokensNorm, anchor: anchor.current, heard: words, stopAt });
   282	        if (next > cursorRef.current) { setCursor(next); setPointer(next); }
   283	        if (final) anchor.current = Math.max(anchor.current, next);
   284	      },
   285	    });
   286	  };
   287	  return (
   288	    <main className="story">
   289	      {/* the picture is hidden while a magic word is open: the child reads the letters, not the picture */}
   290	      <div className={"art-box" + (hideArt ? " veiled" : "")}>{hideArt ? <span className="veil"><LockIcon size={28} />read the letters</span> : <Art art={page.art} />}</div>
   291	      <div className={"text-card" + (readMode ? " follow" : "")} ref={cardRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}>
   292	        <div className="pg">Page {pageNo + 1} of {total}</div>
   293	        <p className={"sentence" + (readMode ? " follow" : "")} ref={sentenceRef}>
   294	          {page.tokens.map((t, i) => {
   295	            const n = normalise(t.t);
   296	            const magic = !listener && firstIdx.has(i);
   297	            const res = magic ? resAt(i) : undefined;
   298	            const cls = wordCls(i, ["w", i === token ? "now" : "", i < token ? "read" : "", magic ? "magic" : "", magic && res ? (res.ok ? "done" : "skipped") : ""].join(" "));
   299	            const [lead, core0, punct] = split(t.t);
   300	            const core = magic ? core0.toLowerCase() : core0;   // a magic word is shown in the letterforms the child was taught
   301	            if (readMode && magic && !res) return <span key={i} className="tokwrap">{lead}<button className={cls + " tap"} data-i={i} onClick={() => onMagicTap(n, i)}>{core}</button>{punct} </span>;
   302	            if (readMode && i === extra) {
   303	              const r = resAt(i);
   304	              if (r) return <span key={i} className="tokwrap">{lead}<span className={wordCls(i, "w magic " + (r.ok ? "done" : "skipped"))} data-i={i}>{core.toLowerCase()}</span>{punct} </span>;
   305	              if (i > cursor) return <span key={i} className="tokwrap">{lead}<button className={cls + " try"} data-i={i} onClick={() => onMagicTap(n, i, true)}>{core.toLowerCase()}</button>{punct} </span>;   // offered until the grown-up reads past it
   306	            }
   307	            if (listener) return <span key={i} className="tokwrap">{lead}<button className={cls + " listener-tap"} onClick={() => onWordTap(t.t)}>{core}</button>{punct} </span>;   // read mode: grey words are the grown-up's, never tap-to-hear
   308	            if (readMode) return <span key={i} className="tokwrap">{lead}<span className={cls} data-i={i} onClick={() => land(i, true)}>{core}</span>{punct} </span>;   // tap-only alternative to the slide: the next word moves the cursor
   309	            return <span key={i} className="tokwrap">{lead}<span className={cls}>{core}</span>{punct} </span>;
   310	          })}
   311	        </p>
   312	        {stalled && <div className="readbar"><button className="next" onClick={onRetry}>▶ Try again</button></div>}
   313	        {readMode && !stalled && (
   314	          <div className="readbar">
   315	            <span className="script">{pending.length ? <><b>{reader}</b> reads, sliding a finger under the words. <b>{kid}</b> reads the <em className="pinkword">pink word</em>: tap it, then say the sounds and blend.</> : <><b>{reader}</b> reads the page, finger under the words. Then go on.</>}{extra >= 0 && extra > cursor && !resAt(extra) && <> <small className="legend">Also decodable: <b>{normalise(page.tokens[extra].t)}</b> — tap it if {kid} wants a go.</small></>}</span>
   316	            {voiceFollow && voiceSupported() && (
   317	              <div className="row center voicebar">
   318	                {voice === "off" || voice === "stopped" ? <button className="small" onClick={startFollow}>{voice === "stopped" ? "Tap to follow again" : "Follow my voice"}</button>
   319	                  : voice === "starting" ? <span className="legend">starting the microphone…</span>
   320	                  : voice === "listening" ? <button className="small live" onClick={() => { stopVoice(); setVoice("off"); }}>Listening · stop</button>
   321	                  : voice === "denied" ? <span className="legend">Microphone not allowed here. Slide a finger under the words instead.</span>
   322	                  : <span className="legend">Voice follow is not available here (offline or unsupported). Slide a finger under the words instead.</span>}
   323	              </div>
   324	            )}
   325	            <button className="next" disabled={pending.length > 0} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
   326	          </div>
   327	        )}
   328	        {listener && !readMode && !stalled && (
   329	          <div className="readbar">
   330	            <span className="script">{pageHeld ? <><b>{reader}</b>: {["“What happened on this page?”", "“Point to the picture. What is it?”", "“Which word did you like? Tap it.”", "“What do you think happens next?”"][pageNo % 4]}</> : "Listen…"}</span>
   331	            <button className="next" disabled={!pageHeld} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
   332	          </div>
   333	        )}
   334	      </div>
   335	    </main>
   336	  );
   337	}
   338	
   339	/**
   340	 * Read-back routine: the child tries the WHOLE line first. If a word needs help, the grown-up taps it:
   341	 * the app shows regular vs tricky parts (tricky word) or stretches the sounds (decodable word),
   342	 * the child re-reads that word, then re-reads the whole line smoothly before ✓.
   343	 */
   344	function Moral({ story, learner, listener, kid, reader, listen, bedtime, setCaption, buildWord, onBuilt, onYes }: { story: Story; learner: LearnerModel; listener: boolean; kid: string; reader: string; listen: boolean; bedtime: boolean; setCaption: (s: string) => void; buildWord: string | null; onBuilt: (w: string, ok: boolean) => Promise<void>; onYes: () => void }) {
   345	  const line = checkLine(story.moral.line, learner);
   346	  const raw = story.moral.line.split(/\s+/);
   347	  const parts = raw.map((w, i) => { const m = w.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/); const r = line.results[i]; const core = m ? m[2] : w; const shown = r?.ok ? (r.kind === "tricky" ? (r.word === "i" ? "I" : r.word) : core.toLowerCase()) : core; return { lead: m ? m[1] : "", core: shown, punct: m ? m[3] : "" }; });   // taught letterforms; punctuation outside
   348	  const words = parts.map((p) => p.core);
   349	  const [stage, setStage] = useState<"try" | "help" | "word" | "reread" | "build">("try");
   350	  // after the read-back: one-word dictation on a word the child just blended (skipped when none)
   351	  const finishLine = () => { if (buildWord) { setStage("build"); setCaption(`${reader}: say "${buildWord}". ${kid} counts the sounds, then builds it.`); } else onYes(); };
   352	  const [helped, setHelped] = useState<number | null>(null);
   353	  const help = async (i: number) => {
   354	    const r = line.results[i]; setHelped(i);
   355	    if (!r.ok) return;
   356	    if (r.kind === "tricky") {
   357	      setCaption(`${words[i]} is a tricky word. The underlined part is the odd bit. Just say the word, then read the line again.`);
   358	      if (listen) speakText(words[i], {});   // a tricky word is taught as a whole, so hearing it is fine
   359	    } else {
   360	      setCaption(`${stretched(r.graphemes)} … ${reader}: slide through the sounds, but let ${kid} say the word.`);
   361	      await playBlend(r.graphemes);   // never the whole word: that would be echoing, not blending
   362	      setStage("word"); return;       // stay on this word until the grown-up confirms the child blended it
   363	    }
   364	    setStage("reread");
   365	  };
   366	  if (stage === "build" && buildWord) return (
   367	    <div className="screen-wrap panel-open">
   368	      <main className="moral"><div className="kicker">One more: build a word</div><p className="spoken">“{story.moral.spoken}”</p></main>
   369	      {/* the encoding write and the finish write both read-modify-write the same progress row: never race them */}
   370	      <SegmentPanel word={buildWord} learner={learner} kid={kid} reader={reader} listen={listen} bedtime={bedtime} onDone={async (outcome) => { if (outcome !== "not_tonight") await onBuilt(buildWord, outcome === "spelled"); onYes(); }} />
   371	    </div>
   372	  );
   373	  return (
   374	    <main className="moral">
   375	      <div className="kicker">The end</div>
   376	      <p className="spoken">“{story.moral.spoken}”</p>
   377	      {!listener && (
   378	        <>
   379	          <div className="kicker">{stage === "try" ? `${kid} reads the whole line` : stage === "help" ? "tap the word that needs help" : stage === "word" ? `${kid} blends that word` : "now the whole line again, smoothly"}</div>
   380	          <p className="line">
   381	            {line.results.map((r, i) => {
   382	              const tp = r.ok && r.kind === "tricky" ? (TRICKY_PARTS[r.word] ?? `|${r.word}`).split("|") : null;
   383	              return (
   384	                <span key={i} className="tokwrap">{parts[i].lead}<button className={"lw " + (r.ok && r.kind === "tricky" ? "tricky" : "magic") + (helped === i ? " helped" : "")} disabled={stage === "try"} onClick={() => help(i)}>
   385	                  {tp ? <><span>{words[i].slice(0, tp[0].length)}</span><u className="odd">{words[i].slice(tp[0].length)}</u></> : words[i]}
   386	                </button>{parts[i].punct}</span>
   387	              );
   388	            })}
   389	          </p>
   390	          <div className="legend"><i className="sw magic" /> sound it out <i className="sw tricky" /> tricky word: <u className="odd">odd bit</u> underlined</div>
   391	          <div className="script"><b>{reader}</b>: {stage === "try" ? "let them read the whole line first." : stage === "help" ? "tap the word they stuck on." : stage === "word" ? "wait for them to slide through it and say it as one word." : "ask for the whole line once more, smoothly."}</div>
   392	        </>
   393	      )}
   394	      <div className="btns">
   395	        {listener ? <button className="yes" onClick={onYes}>The end ✓</button> : stage === "try" ? (
   396	          <><button className="no" onClick={() => setStage("help")}>Needs help on a word</button><button className="yes" onClick={finishLine}><CheckIcon /> Read it smoothly</button></>
   397	        ) : stage === "help" ? (
   398	          <button className="no" onClick={() => setStage("try")}>← back</button>
   399	        ) : stage === "word" ? (
   400	          <><button className="no" onClick={() => helped !== null && help(helped)}>Show me again</button><button className="yes" onClick={() => setStage("reread")}>✓ They blended it</button></>
   401	        ) : (
   402	          <><button className="no" onClick={() => setStage("help")}>Another word</button><button className="yes" onClick={finishLine}>✓ Read it smoothly</button></>
   403	        )}
   404	      </div>
   405	    </main>
   406	  );
   407	}
   408	
   409	/** Specific feedback, not a trophy: what the child actually did with each word. */
   410	function Done({ story, results, bedtime, kid, learner, listenOnly, onHome }: { story: Story; results: WordResult[]; bedtime: boolean; kid: string; learner: LearnerModel; listenOnly: boolean; onHome: () => void }) {
   411	  const ok = results.filter((r) => r.ok);
   412	  const tried = volunteered(results);
   413	  const later = designed(results).filter((r) => !r.ok);
   414	  const [ledger, setLedger] = useState(false);   // the child's screen shows the wins; the ledger is the grown-up's
   415	  const line = (r: WordResult) => {
   416	    const gs = checkWord(r.word, learner).graphemes.join("-");
   417	    if (!r.ok) return `${r.word} · comes back in tomorrow's warm-up`;
   418	    if (r.mode === "first_try") return `${r.word} · slid through ${gs} first try${r.extra ? " (asked for this one)" : ""}`;
   419	    if (r.mode === "prompted") return `${r.word} · blended it after a nudge`;
   420	    return `${r.word} · heard it slid through, then did it`;
   421	  };
   422	  return (
   423	    <main className="done">
   424	      {!bedtime && (ok.length > 0 || listenOnly) && <Confetti />}
   425	      <div className="badge rise">{bedtime ? <MoonIcon size={84} /> : <Art art={story.pages[0].art} />}</div>
   426	      <h2 className="rise">{story.title}</h2>
   427	      {ok.length > 0 && <ul className="results">{ok.map((r, i) => <li key={(r.id ?? r.word) + i} className="ok">{line(r)}</li>)}</ul>}
   428	      <p className="show">{bedtime ? "Lights low. One real book, then sleep." : listenOnly ? `A whole story, ${kid}! Tell someone what happened.` : ok.length ? `Now go find someone and read them your ${ok.length === 1 ? "word" : "words"}, ${kid}!` : `Good listening, ${kid}. Those words come back tomorrow for a warm-up.`}</p>
   429	      {!bedtime && ok.length > 0 && <p className="bigwords">{ok.map((r, i) => <span key={(r.id ?? r.word) + i}>{r.word}</span>)}</p>}
   430	      {tried.length > 0 && <p className="note">…and {kid} asked to try <b>{tried.map((r) => r.word).join(", ")}</b> without being asked.</p>}
   431	      <div className="btns"><button className="yes" onClick={onHome}><CheckIcon /> Done</button></div>
   432	      {later.length > 0 && (ledger
   433	        ? <ul className="results grownup-ledger">{later.map((r, i) => <li key={(r.id ?? r.word) + i} className="no">{line(r)}</li>)}</ul>
   434	        : <button className="skip" onClick={() => setLedger(true)}>grown-up: tonight's words →</button>)}
   435	    </main>
   436	  );
   437	}
   438	
   439	function Confetti() {
   440	  const bits = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ l: (i * 37) % 100, d: (i % 6) * 0.15, c: ["#f3c7e6", "#d8ecd2", "#ffe9a8", "#dbe7f7"][i % 4] })), []);
   441	  return <div className="confetti" aria-hidden>{bits.map((b, i) => <i key={i} style={{ left: `${b.l}%`, animationDelay: `${b.d}s`, background: b.c }} />)}</div>;
   442	}

exec
/bin/zsh -lc 'nl -ba src/lib/blend.ts; nl -ba src/lib/audio/player.ts; nl -ba src/lib/audio/speech.ts' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	/**
     2	 * Continuous blending model ("slide through the word").
     3	 *
     4	 * Real recordings (family voice first, then the cut Commons clips), scheduled on one Web Audio
     5	 * timeline built from each clip's decoded length: continuants are looped inside their steady
     6	 * part to the target hold, vowels hold no longer than the clip, stops are their burst only and
     7	 * the next sound starts right after it (closure is speech; an artificial gap is not). The sweep
     8	 * follows that timeline per grapheme. Cancellable: Home/hide stops every scheduled source.
     9	 * Falls back to back-to-back clips (a segmented aid, not a continuous model) without Web Audio.
    10	 */
    11	import { playClip } from "./audio/player";
    12	import { GRAPHEME_SOUND } from "./phonics/learner";
    13	import { soundSource, soundVersion } from "./sounds";
    14	
    15	export const CONTINUANTS = new Set(["s", "ss", "f", "ff", "m", "n", "l", "ll", "r", "h"]);
    16	export const VOWELS = new Set(["a", "e", "i", "o", "u"]);
    17	// a model is a stretch, not a reading: a teacher holds each sound about half a second
    18	const TARGET_MS = (g: string) => (CONTINUANTS.has(g) ? 520 : VOWELS.has(g) ? 420 : 0);
    19	const LOOP_EDGE = 0.03;   // seconds kept out of the loop region at each end of a continuant
    20	
    21	let ctx: AudioContext | null = null;
    22	const buffers = new Map<string, Promise<AudioBuffer>>();
    23	let live: AudioBufferSourceNode[] = [];
    24	
    25	/** Create/resume the graph inside a user gesture (called from unlock()). */
    26	export function unlockBlendAudio(): void {
    27	  try {
    28	    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    29	    if (ctx.state === "suspended") void ctx.resume();
    30	  } catch { ctx = null; }
    31	}
    32	
    33	/** Stop anything still scheduled (Home, hide, a new model starting). */
    34	export function stopBlend(): void {
    35	  for (const s of live) { try { s.stop(); } catch { /* already ended */ } }
    36	  live = [];
    37	}
    38	if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.hidden) stopBlend(); });
    39	
    40	async function buffer(clip: string): Promise<AudioBuffer> {
    41	  const src = await soundSource(clip);
    42	  const key = `${src.url}#${soundVersion(clip)}`;
    43	  let p = buffers.get(key);
    44	  if (!p) {
    45	    p = fetch(src.url).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)).then((buf) => {
    46	      if (!src.startMs && !src.endMs) return buf;
    47	      // a family recording carries trim offsets: cut the decoded buffer to the sound itself
    48	      const s = Math.floor(((src.startMs ?? 0) / 1000) * buf.sampleRate), e = Math.min(buf.length, Math.ceil(((src.endMs ?? buf.duration * 1000) / 1000) * buf.sampleRate));
    49	      const out = ctx!.createBuffer(1, Math.max(1, e - s), buf.sampleRate); out.copyToChannel(buf.getChannelData(0).subarray(s, e), 0); return out;
    50	    });
    51	    buffers.set(key, p);
    52	  }
    53	  return p;
    54	}
    55	
    56	export interface BlendOpts { rate?: number; alive?: () => boolean; onProgress?: (fraction: number) => void }
    57	
    58	/** One scheduled sound: when it starts, how long it is heard, and its share of the sweep. */
    59	export interface Slot { g: string; start: number; hold: number }
    60	
    61	/** Build the timeline (seconds from 0) from decoded clip lengths. Exported for tests. */
    62	export function timeline(graphemes: string[], dur: (g: string) => number, rate = 1): Slot[] {
    63	  const slots: Slot[] = []; let t = 0;
    64	  graphemes.forEach((g, i) => {
    65	    const clip = dur(g);
    66	    const kind = CONTINUANTS.has(g) ? "continuant" : VOWELS.has(g) ? "vowel" : "stop";
    67	    // vowels are cut from a steady window, so they can be looped to the target like a continuant
    68	    const hold = kind === "stop" ? clip : TARGET_MS(g) / rate / 1000;
    69	    const fade = kind === "stop" ? 0 : Math.min(0.07, hold / 3, i + 1 < graphemes.length ? Math.max(0.01, dur(graphemes[i + 1]) / 3) : 0.07);
    70	    slots.push({ g, start: t, hold });
    71	    t += kind === "stop" ? hold : hold - fade;   // the next sound starts inside this one's fade; after a burst it starts right away
    72	  });
    73	  return slots;
    74	}
    75	
    76	/** Play the graphemes as one continuous, overlapping stretch. Resolves when the last sound fades. */
    77	export async function playBlend(graphemes: string[], opts: BlendOpts = {}): Promise<void> {
    78	  const alive = opts.alive ?? (() => true);
    79	  const rate = opts.rate ?? 1;
    80	  unlockBlendAudio();
    81	  if (ctx && ctx.state !== "closed") {
    82	    try {
    83	      const bufs = await Promise.all(graphemes.map((g) => buffer(GRAPHEME_SOUND[g].clip)));
    84	      if (!alive()) return;
    85	      stopBlend();
    86	      const dur = (g: string) => bufs[graphemes.indexOf(g)].duration;
    87	      const slots = timeline(graphemes, dur, rate);
    88	      const t0 = ctx.currentTime + 0.05;
    89	      const total = slots[slots.length - 1].start + slots[slots.length - 1].hold;
    90	      slots.forEach((s, i) => {
    91	        const src = ctx!.createBufferSource(); src.buffer = bufs[i];
    92	        const gain = ctx!.createGain(); src.connect(gain); gain.connect(ctx!.destination);
    93	        const at = t0 + s.start; const stop = CONTINUANTS.has(s.g) || VOWELS.has(s.g);
    94	        const fade = stop ? Math.min(0.07, s.hold / 3) : 0;
    95	        if ((CONTINUANTS.has(s.g) || VOWELS.has(s.g)) && bufs[i].duration > LOOP_EDGE * 3 && s.hold > bufs[i].duration) { src.loop = true; src.loopStart = LOOP_EDGE; src.loopEnd = bufs[i].duration - LOOP_EDGE; }   // a 180 ms "sss" or a 190 ms "a" held to the target
    96	        gain.gain.setValueAtTime(i === 0 || !stop ? 1 : 0.0001, at);
    97	        if (i > 0 && stop) gain.gain.exponentialRampToValueAtTime(1, at + fade);
    98	        if (stop) { gain.gain.setValueAtTime(1, at + s.hold - fade); gain.gain.exponentialRampToValueAtTime(0.0001, at + s.hold); }
    99	        src.start(at, 0, stop ? s.hold : undefined);
   100	        live.push(src); src.onended = () => { live = live.filter((x) => x !== src); };
   101	      });
   102	      await new Promise<void>((res) => {
   103	        let lastT = ctx!.currentTime, stuck = 0;
   104	        const id = setInterval(() => {
   105	          const now = ctx!.currentTime; const el = now - t0;
   106	          if (now === lastT) stuck++; else stuck = 0; lastT = now;                                  // a suspended context never advances: bounded wait
   107	          const i = Math.max(0, slots.findIndex((s, k) => el < s.start + s.hold && (k + 1 >= slots.length || el < slots[k + 1].start)));
   108	          const s = slots[i]; const within = Math.min(1, Math.max(0, (el - s.start) / s.hold));
   109	          opts.onProgress?.(Math.min(1, (i + within) / slots.length));                              // the sweep follows the timeline per grapheme
   110	          if (el >= total || !alive() || stuck > 50) { clearInterval(id); if (!alive() || stuck > 50) stopBlend(); opts.onProgress?.(1); res(); }
   111	        }, 30);
   112	      });
   113	      return;
   114	    } catch { /* fall through to the simple player */ }
   115	  }
   116	  // fallback: back-to-back clips through the singleton player (segmented, not continuous)
   117	  for (let i = 0; i < graphemes.length; i++) {
   118	    if (!alive()) return;
   119	    let p; try { p = playClip((await soundSource(GRAPHEME_SOUND[graphemes[i]].clip)).url); } catch { continue; }
   120	    opts.onProgress?.(i / graphemes.length);
   121	    await new Promise<void>((res) => { const t0 = Date.now(); const id = setInterval(() => { const el = p.el; if (el.ended || Date.now() - t0 > 700) { clearInterval(id); res(); } }, 30); });
   122	  }
   123	  opts.onProgress?.(1);
   124	}
   125	
   126	/** Caption for a blend: no dots, no gaps — the whole word as one stretched shape. */
   127	export const stretched = (graphemes: string[]) => graphemes.map((g) => (CONTINUANTS.has(g) || VOWELS.has(g) ? GRAPHEME_SOUND[g].label.replace(/(.)\1+/g, "$1$1$1") : GRAPHEME_SOUND[g].label)).join("");
   128	/** Kept for the parent summary. */
   129	export const dotted = (graphemes: string[]) => graphemes.map((g) => GRAPHEME_SOUND[g]?.label ?? g).join("·");
     1	/**
     2	 * One global <audio> element for narration (unlocked on the first user tap and
     3	 * reused by swapping src — iOS blocks new elements created off-gesture) and one
     4	 * singleton element for short clips (phonemes, prompts) so rapid taps never stack.
     5	 *
     6	 * Each play() returns a Playing whose listeners are its own: a superseded track's
     7	 * late `play()` rejection ("interrupted by a new load request") must never touch
     8	 * the listeners of the track that replaced it.
     9	 */
    10	let narration: HTMLAudioElement | null = null;
    11	let clip: HTMLAudioElement | null = null;
    12	let unlocked = false;
    13	
    14	function make(): HTMLAudioElement {
    15	  const a = document.createElement("audio");
    16	  a.setAttribute("playsinline", "");
    17	  a.preload = "auto";
    18	  a.style.display = "none";
    19	  document.body.appendChild(a); // detached media elements can be collected mid-play
    20	  return a;
    21	}
    22	const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
    23	
    24	/** Call from a user gesture (the Start tap). Safe to call repeatedly. */
    25	export async function unlock(): Promise<void> {
    26	  narration ??= make();
    27	  clip ??= make();
    28	  if (unlocked) return;
    29	  const silent = "data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAAAAE00QSBpc29tbXA0MgAAAAhmcmVlAAAAAG1kYXQ=";
    30	  // every engine must be kicked synchronously inside the tap; awaiting one first can spend the user activation
    31	  const kicks: Promise<unknown>[] = [];
    32	  for (const a of [narration, clip]) { try { a.src = silent; kicks.push(a.play().then(() => a.pause())); } catch { /* still counts as gestured on most engines */ } }
    33	  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance("")); } catch { /* no speech engine */ }
    34	  try { const { unlockBlendAudio } = await import("../blend"); unlockBlendAudio(); } catch { /* no web audio */ }
    35	  unlocked = true;
    36	  await withTimeout(Promise.allSettled(kicks), 400);
    37	}
    38	
    39	export interface Playing {
    40	  /** Resolves when playback ends or is stopped. Rejects only on a load error. */
    41	  done: Promise<void>;
    42	  stop: () => void;
    43	  el: HTMLAudioElement;
    44	}
    45	
    46	const cleanups = new WeakMap<HTMLAudioElement, () => void>();
    47	const blobUrls = new Map<string, string>();
    48	/** iOS plays data: URLs badly (rate changes go silent, `ended` is unreliable); hand it an object URL instead. */
    49	function resolveSrc(src: string): string {
    50	  if (!src.startsWith("data:")) return src;
    51	  const hit = blobUrls.get(src); if (hit) return hit;
    52	  if (blobUrls.size >= 6) { const [k, v] = blobUrls.entries().next().value as [string, string]; URL.revokeObjectURL(v); blobUrls.delete(k); }
    53	  try {
    54	    const [head, b64] = src.split(",", 2); const mime = head.slice(5, head.indexOf(";")) || "audio/mp4";
    55	    const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    56	    const url = URL.createObjectURL(new Blob([bytes], { type: mime })); blobUrls.set(src, url); return url;
    57	  } catch { return src; }
    58	}
    59	function playOn(el: HTMLAudioElement, src: string, rate = 1, range?: { startMs?: number; endMs?: number }): Playing {
    60	  cleanups.get(el)?.();               // a superseded track must not keep listeners on the shared element
    61	  el.pause();
    62	  el.src = resolveSrc(src);            // assigning src resets the clock; writing currentTime before load throws on WebKit
    63	  const onMeta = () => { try { el.playbackRate = rate; if (range?.startMs) el.currentTime = range.startMs / 1000; } catch { /* not supported for this source */ } };
    64	  el.addEventListener("loadedmetadata", onMeta, { once: true });
    65	  let settled = false;
    66	  let resolve!: () => void, reject!: (e: unknown) => void;
    67	  const done = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    68	  const off = () => { el.removeEventListener("ended", onEnded); el.removeEventListener("error", onError); el.removeEventListener("timeupdate", onTime); el.removeEventListener("loadedmetadata", onMeta); };
    69	  const finish = () => { if (settled) return; settled = true; off(); resolve(); };
    70	  const onEnded = () => finish();
    71	  const onError = () => { if (!settled) { settled = true; off(); reject(new Error(`audio failed: ${src}`)); } };
    72	  // safety net: some engines drop `ended` after a stall; treat reaching the end as ended
    73	  const onTime = () => { if ((el.duration && el.currentTime >= el.duration - 0.05) || (range?.endMs && el.currentTime * 1000 >= range.endMs)) { el.pause(); finish(); } };
    74	  el.addEventListener("ended", onEnded);
    75	  el.addEventListener("error", onError);
    76	  el.addEventListener("timeupdate", onTime);
    77	  cleanups.set(el, () => { if (!settled) { settled = true; off(); resolve(); } });
    78	  void el.play().catch((e) => { if (!settled) { settled = true; off(); reject(e); } });
    79	  return { done, stop: () => { if (settled) return; el.pause(); finish(); }, el };
    80	}
    81	
    82	export function playNarration(src: string, rate = 1): Playing {
    83	  narration ??= make();
    84	  clip?.pause();
    85	  return playOn(narration, src, rate);
    86	}
    87	
    88	export function playClip(src: string, range?: { startMs?: number; endMs?: number }): Playing {
    89	  clip ??= make();
    90	  return playOn(clip, src, 1, range);
    91	}
    92	
    93	export function stopAll(): void {
    94	  narration?.pause();
    95	  clip?.pause();
    96	}
     1	/**
     2	 * On-device speech (Web Speech API) for family stories and single-word taps.
     3	 * $0, offline, no server. Word boundaries fire on Chrome and Safari; when they do
     4	 * not, the caller's highlighting simply stays on the sentence.
     5	 */
     6	export interface SpeakHandle { done: Promise<void>; stop: () => void }
     7	
     8	let voice: SpeechSynthesisVoice | null | undefined;
     9	function pickVoice(): SpeechSynthesisVoice | null {
    10	  if (voice !== undefined) return voice;
    11	  const vs = window.speechSynthesis?.getVoices?.() ?? [];
    12	  voice = vs.find((v) => /en-US/i.test(v.lang) && /samantha|ava|allison|aria|jenny|google us/i.test(v.name)) ?? vs.find((v) => /en-US/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? null;   // one accent everywhere: the narrator is US
    13	  return voice;
    14	}
    15	if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voice = undefined; pickVoice(); };
    16	
    17	export function speakText(text: string, opts: { rate?: number; onWord?: (index: number) => void }): SpeakHandle {
    18	  if (typeof window === "undefined" || !window.speechSynthesis) return { done: Promise.resolve(), stop: () => {} };
    19	  const synth = window.speechSynthesis;
    20	  synth.cancel();
    21	  const u = new SpeechSynthesisUtterance(text);
    22	  const v = pickVoice(); if (v) u.voice = v;
    23	  u.rate = 0.9 * (opts.rate ?? 1);
    24	  u.pitch = 1.05;
    25	  // map character offsets to token indexes
    26	  const starts: number[] = []; let pos = 0;
    27	  for (const tok of text.split(" ")) { starts.push(pos); pos += tok.length + 1; }
    28	  let settled = false, resolve!: () => void;
    29	  const done = new Promise<void>((r) => { resolve = r; });
    30	  const finish = () => { if (!settled) { settled = true; resolve(); } };
    31	  u.onboundary = (e) => { if (e.name === "word" && opts.onWord) { let i = 0; for (let k = 0; k < starts.length; k++) if (starts[k] <= e.charIndex) i = k; opts.onWord(i); } };
    32	  u.onend = finish; u.onerror = finish;
    33	  const queued = setTimeout(() => synth.speak(u), 0);       // iOS drops an utterance queued in the same tick as cancel()
    34	  // Safari sometimes never fires onend for cancelled utterances
    35	  const guard = setTimeout(finish, Math.max(2000, text.length * 120));
    36	  return { done: done.then(() => clearTimeout(guard)), stop: () => { clearTimeout(queued); synth.cancel(); finish(); } };   // a stopped utterance must not start later from the queue
    37	}

exec
/bin/zsh -lc 'nl -ba scripts/cut-phonemes.py; nl -ba scripts/gen-audio.py; nl -ba scripts/audit/render-blend.py' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	#!/usr/bin/env python3
     2	"""
     3	Cut the pinned Commons IPA recordings (assets/phonemes-src/) into pure instructional sounds
     4	using scripts/phoneme-cuts.json, and write public/sounds/<clip>.wav + manifest.json.
     5	
     6	Why WAV: a 40 ms plosive burst cannot survive AAC priming/edit-list handling on every engine;
     7	22.05 kHz mono 16-bit WAV is ~44 bytes/ms, decodes everywhere, and the whole set is < 400 KB.
     8	Never TTS here: every clip is a real recording (CC BY-SA, attribution in manifest.json).
     9	Check after cutting: python3 scripts/cut-phonemes.py --check prints a 10 ms voicing map per clip.
    10	"""
    11	import hashlib, json, shutil, struct, subprocess, sys
    12	from pathlib import Path
    13	
    14	ROOT = Path(__file__).resolve().parents[1]
    15	SRC = ROOT / "assets" / "phonemes-src"
    16	OUT = ROOT / "public" / "sounds"
    17	CUTS = json.loads((ROOT / "scripts" / "phoneme-cuts.json").read_text())
    18	SOURCES = json.loads((SRC / "sources.json").read_text())
    19	
    20	def ffmpeg():
    21	    f = shutil.which("ffmpeg")
    22	    if f: return f
    23	    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
    24	
    25	def wav_samples(path):
    26	    d = path.read_bytes(); i = 12; sr = 22050; data = b""
    27	    while i < len(d) - 8:
    28	        cid = d[i:i + 4]; sz = struct.unpack("<I", d[i + 4:i + 8])[0]
    29	        if cid == b"fmt ": sr = struct.unpack("<I", d[i + 12:i + 16])[0]
    30	        if cid == b"data": data = d[i + 8:i + 8 + sz]
    31	        i += 8 + sz + (sz & 1)
    32	    import array; a = array.array("h"); a.frombytes(data[: len(data) // 2 * 2]); return sr, a
    33	
    34	TARGET_RMS_DB = -17.0
    35	
    36	def decode(path, start_ms=None, end_ms=None):
    37	    """ffmpeg-decode a slice to mono float samples at 22.05 kHz."""
    38	    FF = ffmpeg(); args = [FF, "-loglevel", "error"]
    39	    if start_ms is not None: args += ["-ss", f"{start_ms / 1000}", "-t", f"{(end_ms - start_ms) / 1000}"]
    40	    args += ["-i", str(path), "-ar", "22050", "-ac", "1", "-f", "s16le", "-"]
    41	    raw = subprocess.run(args, capture_output=True, check=True).stdout
    42	    import array; a = array.array("h"); a.frombytes(raw[: len(raw) // 2 * 2])
    43	    return 22050, [v / 32768 for v in a]
    44	
    45	def _f0(x, sr):
    46	    """lowest lag with near-maximal normalised autocorrelation (octave-safe); None when unvoiced."""
    47	    n = min(len(x), sr // 2)
    48	    if n < sr // 40: return None
    49	    m = sum(x[:n]) / n; w = [v - m for v in x[:n]]
    50	    e0 = sum(v * v for v in w)
    51	    if e0 <= 0: return None
    52	    lo, hi = sr // 400, sr // 60
    53	    best = []
    54	    for lag in range(lo, min(hi, n - 1)):
    55	        s = 0.0
    56	        for k in range(0, n - lag, 3): s += w[k] * w[k + lag]
    57	        best.append(s * 3 / e0)
    58	    if not best: return None
    59	    mx = max(best)
    60	    if mx < 0.3: return None
    61	    for i, v in enumerate(best):
    62	        if v >= 0.85 * mx: return sr / (lo + i)
    63	    return None
    64	
    65	def measure(path, start_ms=None, end_ms=None):
    66	    import math
    67	    sr, x = decode(path, start_ms, end_ms)
    68	    rms = math.sqrt(sum(v * v for v in x) / max(1, len(x)))
    69	    peak = max((abs(v) for v in x), default=0.0)
    70	    half = len(x) // 2
    71	    a, b = _f0(x[:half], sr), _f0(x[half:], sr)
    72	    return {"rms_db": 20 * math.log10(rms + 1e-9), "peak_db": 20 * math.log10(peak + 1e-9),
    73	            "f0": round(_f0(x, sr) or 0), "drift": round(abs((b or 0) - (a or 0))) if a and b else 0}
    74	
    75	def check():
    76	    for clip in sorted(k for k in CUTS if not k.startswith("_")):
    77	        p = OUT / f"{clip}.wav"
    78	        if not p.exists(): print(f"{clip}: missing"); continue
    79	        sr, a = wav_samples(p); hop = sr // 100; n = len(a) // hop
    80	        def rms(k): s = a[k * hop:(k + 1) * hop]; return (sum(v * v for v in s) / max(1, len(s))) ** 0.5 / 32768
    81	        def zcr(k): s = a[k * hop:(k + 1) * hop]; return sum(1 for j in range(1, len(s)) if (s[j - 1] < 0) != (s[j] < 0)) / max(1, len(s))
    82	        line = "".join("." if rms(k) < 0.02 else ("H" if zcr(k) > 0.3 else "V") for k in range(n))
    83	        print(f"{clip:3s} {len(a) * 1000 // sr:4d} ms  {CUTS[clip]['kind']:10s} {line}")
    84	
    85	def main():
    86	    if "--check" in sys.argv: return check()
    87	    FF = ffmpeg(); OUT.mkdir(parents=True, exist_ok=True)
    88	    for old in OUT.glob("*.m4a"): old.unlink()
    89	    man = {}
    90	    for clip, c in CUTS.items():
    91	        if clip.startswith("_"): continue
    92	        src = SRC / f"{c['src']}.ogg"; meta = SOURCES[c["src"]]
    93	        if hashlib.sha256(src.read_bytes()).hexdigest() != meta["sha256"]: sys.exit(f"{src} does not match the pinned hash; offsets would be wrong")
    94	        dur = (c["end"] - c["start"]) / 1000
    95	        fades = ([f"afade=t=in:st=0:d={c['fadeIn'] / 1000}"] if c["fadeIn"] else []) + [f"afade=t=out:st={dur - c['fadeOut'] / 1000}:d={c['fadeOut'] / 1000}"]   # a 0 ms fade-in is treated by ffmpeg as "fade everything"
    96	        af = ",".join(fades)
    97	        # loudness, not peak: a 25 ms burst peak-normalised sits far louder than a 200 ms nasal, so the
    98	        # blend used to jump in volume from sound to sound. Continuants and vowels are matched on RMS.
    99	        stats = measure(src, c["start"], c["end"])
   100	        gain = (-6.0 - stats["peak_db"]) if c["kind"] == "stop" else (TARGET_RMS_DB - stats["rms_db"])
   101	        gain = max(-12.0, min(24.0, gain))
   102	        if stats["peak_db"] + gain > -1.0: gain = -1.0 - stats["peak_db"]   # never clip
   103	        subprocess.run([FF, "-loglevel", "error", "-y", "-ss", f"{c['start'] / 1000}", "-t", f"{dur}", "-i", str(src),
   104	                        "-af", f"volume={gain:.2f}dB,{af}", "-ar", "22050", "-ac", "1", "-c:a", "pcm_s16le", str(OUT / f"{clip}.wav")], check=True)
   105	        after = measure(OUT / f"{clip}.wav")
   106	        man[clip] = {"audio": f"{clip}.wav", "ms": c["end"] - c["start"], "kind": c["kind"], "recorded": True,
   107	                     "f0": after["f0"], "f0_drift": after["drift"], "rms_db": round(after["rms_db"], 1),
   108	                     "source": f"https://commons.wikimedia.org/wiki/File:{meta['title']}", "license": meta["license"], "artist": meta["artist"],
   109	                     "edit": f"cut {c['start']}–{c['end']} ms of the original to the isolated sound, level-matched ({gain:+.1f} dB)"}
   110	        print(f"  {clip:3s} {man[clip]['ms']:4d} ms  {c['kind']:10s} F0={man[clip]['f0'] or '-':>4} drift={man[clip]['f0_drift']:>4} {man[clip]['rms_db']:>6} dB  {meta['title']}")
   111	    (OUT / "manifest.json").write_text(json.dumps(man, indent=1))
   112	    print(f"{len(man)} clips → public/sounds/ (WAV; attribution + edit note in manifest.json)")
   113	
   114	if __name__ == "__main__": main()
     1	#!/usr/bin/env python3
     2	"""
     3	Generate narration audio + word timings for every story in library/, plus the
     4	shared narrator prompts, into public/library/<slug>/ and public/prompts/.
     5	
     6	  python3 scripts/gen-audio.py            # all stories
     7	  python3 scripts/gen-audio.py fox-and-crow
     8	
     9	Voice: edge-tts en-IN-NeerjaNeural ($0, word boundaries built in). Audio is a
    10	deploy-time artefact: public/library/**/*.m4a is gitignored. Recorded phoneme
    11	clips live in public/sounds/ and are committed; this script only creates
    12	nothing under public/sounds/ — phoneme clips are real recordings fetched by
    13	scripts/fetch-phonemes.py (Wikimedia Commons IPA set, CC BY-SA).
    14	
    15	Requires: pip install edge-tts ; ffmpeg on PATH (or imageio-ffmpeg).
    16	"""
    17	import asyncio, json, os, re, shutil, subprocess, sys
    18	from pathlib import Path
    19	
    20	try:
    21	    import edge_tts
    22	except ImportError:
    23	    sys.exit("pip install edge-tts")
    24	
    25	ROOT = Path(__file__).resolve().parents[1]
    26	LIB, PUB = ROOT / "library", ROOT / "public"
    27	NANI, RATE = "en-US-AndrewMultilingualNeural", "-28%"   # US voice; slow enough for a 4-year-old to follow the words (~130 wpm, owner 2026-09-11)
    28	
    29	def ffmpeg():
    30	    f = shutil.which("ffmpeg")
    31	    if f: return f
    32	    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
    33	FF = ffmpeg()
    34	
    35	def norm(s): return re.sub(r"[^a-z]", "", s.lower())
    36	
    37	async def tts(text, out_m4a, voice=NANI, rate=RATE):
    38	    """Synthesize text → m4a (AAC, plays on iOS). Returns (duration_ms, [(word, start_ms)])."""
    39	    tmp = out_m4a.with_suffix(".mp3"); words = []
    40	    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    41	    with open(tmp, "wb") as f:
    42	        async for ch in com.stream():
    43	            if ch["type"] == "audio": f.write(ch["data"])
    44	            elif ch["type"] == "WordBoundary": words.append((ch["text"], ch["offset"] / 1e4))
    45	    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(tmp), "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1", str(out_m4a)], check=True)
    46	    tmp.unlink()
    47	    probe = subprocess.run([FF, "-i", str(out_m4a)], capture_output=True, text=True).stderr
    48	    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
    49	    ms = int((int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])) * 1000)
    50	    return ms, words
    51	
    52	def align(tokens, words):
    53	    """Map TTS word boundaries onto display tokens 1:1 by normalised text, in order.
    54	    A token may span several TTS words (e.g. 'Caw!' vs 'Caw'); a TTS word may never span tokens.
    55	    Returns list of start_ms per token, or raises with a clear message."""
    56	    out, wi = [], 0
    57	    for ti, tok in enumerate(tokens):
    58	        target = norm(tok)
    59	        if not target:  # pure punctuation token
    60	            out.append(words[wi][1] if wi < len(words) else (out[-1] if out else 0)); continue
    61	        acc, start = "", None
    62	        while wi < len(words) and len(acc) < len(target):
    63	            w, ms = words[wi]
    64	            if start is None: start = ms
    65	            acc += norm(w); wi += 1
    66	        if acc != target:
    67	            raise SystemExit(f"alignment failed at token {ti} {tok!r}: tts gave {acc!r}")
    68	        out.append(int(start))
    69	    if wi != len(words):
    70	        raise SystemExit(f"alignment failed: {len(words) - wi} unused tts words")
    71	    return out
    72	
    73	async def build_story(slug):
    74	    src = LIB / slug / "story.json"; story = json.loads(src.read_text())
    75	    out = PUB / "library" / slug; out.mkdir(parents=True, exist_ok=True)
    76	    for i, p in enumerate(story["pages"], 1):
    77	        text = p.pop("text", None) or " ".join(t["t"] for t in p["tokens"])
    78	        toks = text.split(" ")
    79	        ms, words = await tts(text, out / f"p{i}.m4a")
    80	        starts = align(toks, words)
    81	        p["tokens"] = [{"t": t, "ms": s} for t, s in zip(toks, starts)]
    82	        p["audio"], p["audioMs"] = f"p{i}.m4a", ms
    83	        print(f"  {slug} p{i}: {ms} ms, {len(toks)} tokens")
    84	    ms, _ = await tts(story["moral"]["spoken"], out / "moral.m4a")
    85	    story["moral"]["audio"], story["moral"]["audioMs"] = "moral.m4a", ms
    86	    # story-specific narrator prompts (magic word feedback)
    87	    story["prompts"] = {}
    88	    for p in story["pages"]:
    89	        for w in p.get("magic", []):
    90	            for key, text in ((f"yes:{w}", f"Yes! {w}."), (f"word:{w}", f"{w}.")):
    91	                m, _ = await tts(text, out / f"{key.replace(':', '-')}.m4a"); story["prompts"][key] = {"audio": f"{key.replace(':', '-')}.m4a", "ms": m}
    92	    (out / "story.json").write_text(json.dumps(story, ensure_ascii=False, indent=1))
    93	    src.write_text(json.dumps(story, ensure_ascii=False, indent=1))  # tokens + timings are part of the contract
    94	
    95	SHARED = {
    96	    "yours": "This one is yours. Can you read it?",
    97	    "fast": "Now say it fast.",
    98	    "notyet": "That's okay. Listen to me blend it, then you try.",
    99	    "yourturn": "Your turn.",
   100	    "practise": "We'll practise it tomorrow.",
   101	    "line": "Now you. Read your line.",
   102	    "done": "Beautiful reading. This story goes on your shelf.",
   103	    "pick": "Pick today's story. One tap.",
   104	}
   105	async def build_shared():
   106	    out = PUB / "prompts"; out.mkdir(parents=True, exist_ok=True); man = {}
   107	    for k, text in SHARED.items():
   108	        ms, _ = await tts(text, out / f"{k}.m4a"); man[k] = {"audio": f"{k}.m4a", "ms": ms}
   109	    (out / "manifest.json").write_text(json.dumps(man, indent=1))
   110	    print("  shared prompts done (phoneme clips come from scripts/fetch-phonemes.py, not TTS)")
   111	
   112	async def main():
   113	    slugs = sys.argv[1:] or [p.name for p in LIB.iterdir() if (p / "story.json").exists()]
   114	    await build_shared()
   115	    for s in slugs: print(s); await build_story(s)
   116	
   117	asyncio.run(main())
     1	#!/usr/bin/env python3
     2	"""
     3	Render a word the way src/lib/blend.ts schedules it (same holds, loops and crossfades) and measure
     4	whether the result sounds like one person: pitch continuity across the word, and level continuity.
     5	This is the offline stand-in for listening; the owner's ears remain the real gate (audit-plan 1.6).
     6	
     7	    python3 scripts/audit/render-blend.py sat pin dog puff
     8	"""
     9	import json, math, struct, sys
    10	from pathlib import Path
    11	
    12	ROOT = Path(__file__).resolve().parents[2]
    13	SOUNDS = ROOT / "public" / "sounds"
    14	MAN = json.loads((SOUNDS / "manifest.json").read_text())
    15	# mirrors src/lib/blend.ts
    16	CONT = {"s", "f", "m", "n", "l", "r", "h"}
    17	VOWELS = {"a", "e", "i", "o", "u"}
    18	TARGET = lambda g: 520 if g in CONT else 420 if g in VOWELS else 0
    19	LOOP_EDGE = 0.03
    20	GRAPHEME_CLIP = {"c": "k", "ck": "k", "ff": "f", "ll": "l", "ss": "s"}
    21	
    22	def readwav(p):
    23	    d = p.read_bytes(); i = 12; sr = 22050; data = b""
    24	    while i < len(d) - 8:
    25	        cid = d[i:i + 4]; sz = struct.unpack("<I", d[i + 4:i + 8])[0]
    26	        if cid == b"fmt ": sr = struct.unpack("<I", d[i + 12:i + 16])[0]
    27	        if cid == b"data": data = d[i + 8:i + 8 + sz]
    28	        i += 8 + sz + (sz & 1)
    29	    a = struct.unpack(f"<{len(data) // 2}h", data[: len(data) // 2 * 2])
    30	    return sr, [v / 32768 for v in a]
    31	
    32	def graphemes(word):
    33	    out = []; i = 0
    34	    while i < len(word):
    35	        two = word[i:i + 2]
    36	        if two in ("ck", "ff", "ll", "ss"): out.append(two); i += 2
    37	        else: out.append(word[i]); i += 1
    38	    return out
    39	
    40	def f0(x, sr):
    41	    n = min(len(x), sr // 2)
    42	    if n < sr // 40: return None
    43	    m = sum(x[:n]) / n; w = [v - m for v in x[:n]]
    44	    e0 = sum(v * v for v in w)
    45	    if e0 <= 0: return None
    46	    lo, hi = sr // 400, sr // 60
    47	    best = []
    48	    for lag in range(lo, min(hi, n - 1)):
    49	        s = 0.0
    50	        for k in range(0, n - lag, 3): s += w[k] * w[k + lag]
    51	        best.append(s * 3 / e0)
    52	    if not best: return None
    53	    mx = max(best)
    54	    if mx < 0.3: return None
    55	    for i, v in enumerate(best):
    56	        if v >= 0.85 * mx: return sr / (lo + i)
    57	    return None
    58	
    59	def render(word, rate=1.0):
    60	    gs = graphemes(word)
    61	    sr = 22050; bufs = []
    62	    for g in gs:
    63	        clip = GRAPHEME_CLIP.get(g, g)
    64	        s, x = readwav(SOUNDS / f"{clip}.wav"); bufs.append(x); sr = s
    65	    out = [0.0] * int(sr * 6); t = 0.0
    66	    for i, g in enumerate(gs):
    67	        buf = bufs[i]; clip_s = len(buf) / sr
    68	        stop = g not in CONT and g not in VOWELS
    69	        hold = clip_s if stop else TARGET(g) / rate / 1000
    70	        fade = 0.0 if stop else min(0.07, hold / 3)
    71	        n = int(hold * sr)
    72	        start = int(t * sr)
    73	        le, lo_ = int(LOOP_EDGE * sr), len(buf) - int(LOOP_EDGE * sr)
    74	        for k in range(n):
    75	            src = buf[k] if k < len(buf) else buf[le + (k - lo_) % max(1, lo_ - le)]
    76	            g_in = min(1.0, k / max(1, int(fade * sr))) if (i > 0 and not stop) else 1.0
    77	            g_out = min(1.0, (n - k) / max(1, int(fade * sr))) if not stop else 1.0
    78	            if start + k < len(out): out[start + k] += src * g_in * g_out
    79	        t += hold if stop else hold - fade * 0.5
    80	    return sr, out[: int((t + 0.1) * sr)]
    81	
    82	def main():
    83	    words = sys.argv[1:] or ["sat", "pin", "dog", "puff"]
    84	    print(f"{'word':8s} {'ms':>5s}  pitch through the word (20 ms hops, one voice = one number)")
    85	    for w in words:
    86	        sr, x = render(w)
    87	        hops = []
    88	        step = int(0.06 * sr)
    89	        for k in range(0, len(x) - step, step):
    90	            p = f0(x[k:k + step * 2], sr)
    91	            hops.append(round(p) if p else None)
    92	        voiced = sorted(h for h in hops if h)
    93	        # trim the extremes: a 25 ms burst is not periodic, so the hop that straddles one reports nonsense
    94	        trim = voiced[len(voiced) // 8: len(voiced) - len(voiced) // 8] or voiced
    95	        spread = (max(trim) - min(trim)) / trim[len(trim) // 2] * 100 if trim else 0
    96	        print(f"{w:8s} {len(x) * 1000 // sr:5d}  {' '.join(str(h) if h else '·' for h in hops)}   spread {spread:.0f}%")
    97	    print("\npass: every word's voiced hops sit inside ~25% of each other (one speaker, no octave jumps)")
    98	
    99	if __name__ == "__main__": main()

exec
/bin/zsh -lc 'nl -ba src/lib/blend.ts' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	/**
     2	 * Continuous blending model ("slide through the word").
     3	 *
     4	 * Real recordings (family voice first, then the cut Commons clips), scheduled on one Web Audio
     5	 * timeline built from each clip's decoded length: continuants are looped inside their steady
     6	 * part to the target hold, vowels hold no longer than the clip, stops are their burst only and
     7	 * the next sound starts right after it (closure is speech; an artificial gap is not). The sweep
     8	 * follows that timeline per grapheme. Cancellable: Home/hide stops every scheduled source.
     9	 * Falls back to back-to-back clips (a segmented aid, not a continuous model) without Web Audio.
    10	 */
    11	import { playClip } from "./audio/player";
    12	import { GRAPHEME_SOUND } from "./phonics/learner";
    13	import { soundSource, soundVersion } from "./sounds";
    14	
    15	export const CONTINUANTS = new Set(["s", "ss", "f", "ff", "m", "n", "l", "ll", "r", "h"]);
    16	export const VOWELS = new Set(["a", "e", "i", "o", "u"]);
    17	// a model is a stretch, not a reading: a teacher holds each sound about half a second
    18	const TARGET_MS = (g: string) => (CONTINUANTS.has(g) ? 520 : VOWELS.has(g) ? 420 : 0);
    19	const LOOP_EDGE = 0.03;   // seconds kept out of the loop region at each end of a continuant
    20	
    21	let ctx: AudioContext | null = null;
    22	const buffers = new Map<string, Promise<AudioBuffer>>();
    23	let live: AudioBufferSourceNode[] = [];
    24	
    25	/** Create/resume the graph inside a user gesture (called from unlock()). */
    26	export function unlockBlendAudio(): void {
    27	  try {
    28	    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    29	    if (ctx.state === "suspended") void ctx.resume();
    30	  } catch { ctx = null; }
    31	}
    32	
    33	/** Stop anything still scheduled (Home, hide, a new model starting). */
    34	export function stopBlend(): void {
    35	  for (const s of live) { try { s.stop(); } catch { /* already ended */ } }
    36	  live = [];
    37	}
    38	if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.hidden) stopBlend(); });
    39	
    40	async function buffer(clip: string): Promise<AudioBuffer> {
    41	  const src = await soundSource(clip);
    42	  const key = `${src.url}#${soundVersion(clip)}`;
    43	  let p = buffers.get(key);
    44	  if (!p) {
    45	    p = fetch(src.url).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)).then((buf) => {
    46	      if (!src.startMs && !src.endMs) return buf;
    47	      // a family recording carries trim offsets: cut the decoded buffer to the sound itself
    48	      const s = Math.floor(((src.startMs ?? 0) / 1000) * buf.sampleRate), e = Math.min(buf.length, Math.ceil(((src.endMs ?? buf.duration * 1000) / 1000) * buf.sampleRate));
    49	      const out = ctx!.createBuffer(1, Math.max(1, e - s), buf.sampleRate); out.copyToChannel(buf.getChannelData(0).subarray(s, e), 0); return out;
    50	    });
    51	    buffers.set(key, p);
    52	  }
    53	  return p;
    54	}
    55	
    56	export interface BlendOpts { rate?: number; alive?: () => boolean; onProgress?: (fraction: number) => void }
    57	
    58	/** One scheduled sound: when it starts, how long it is heard, and its share of the sweep. */
    59	export interface Slot { g: string; start: number; hold: number }
    60	
    61	/** Build the timeline (seconds from 0) from decoded clip lengths. Exported for tests. */
    62	export function timeline(graphemes: string[], dur: (g: string) => number, rate = 1): Slot[] {
    63	  const slots: Slot[] = []; let t = 0;
    64	  graphemes.forEach((g, i) => {
    65	    const clip = dur(g);
    66	    const kind = CONTINUANTS.has(g) ? "continuant" : VOWELS.has(g) ? "vowel" : "stop";
    67	    // vowels are cut from a steady window, so they can be looped to the target like a continuant
    68	    const hold = kind === "stop" ? clip : TARGET_MS(g) / rate / 1000;
    69	    const fade = kind === "stop" ? 0 : Math.min(0.07, hold / 3, i + 1 < graphemes.length ? Math.max(0.01, dur(graphemes[i + 1]) / 3) : 0.07);
    70	    slots.push({ g, start: t, hold });
    71	    t += kind === "stop" ? hold : hold - fade;   // the next sound starts inside this one's fade; after a burst it starts right away
    72	  });
    73	  return slots;
    74	}
    75	
    76	/** Play the graphemes as one continuous, overlapping stretch. Resolves when the last sound fades. */
    77	export async function playBlend(graphemes: string[], opts: BlendOpts = {}): Promise<void> {
    78	  const alive = opts.alive ?? (() => true);
    79	  const rate = opts.rate ?? 1;
    80	  unlockBlendAudio();
    81	  if (ctx && ctx.state !== "closed") {
    82	    try {
    83	      const bufs = await Promise.all(graphemes.map((g) => buffer(GRAPHEME_SOUND[g].clip)));
    84	      if (!alive()) return;
    85	      stopBlend();
    86	      const dur = (g: string) => bufs[graphemes.indexOf(g)].duration;
    87	      const slots = timeline(graphemes, dur, rate);
    88	      const t0 = ctx.currentTime + 0.05;
    89	      const total = slots[slots.length - 1].start + slots[slots.length - 1].hold;
    90	      slots.forEach((s, i) => {
    91	        const src = ctx!.createBufferSource(); src.buffer = bufs[i];
    92	        const gain = ctx!.createGain(); src.connect(gain); gain.connect(ctx!.destination);
    93	        const at = t0 + s.start; const stop = CONTINUANTS.has(s.g) || VOWELS.has(s.g);
    94	        const fade = stop ? Math.min(0.07, s.hold / 3) : 0;
    95	        if ((CONTINUANTS.has(s.g) || VOWELS.has(s.g)) && bufs[i].duration > LOOP_EDGE * 3 && s.hold > bufs[i].duration) { src.loop = true; src.loopStart = LOOP_EDGE; src.loopEnd = bufs[i].duration - LOOP_EDGE; }   // a 180 ms "sss" or a 190 ms "a" held to the target
    96	        gain.gain.setValueAtTime(i === 0 || !stop ? 1 : 0.0001, at);
    97	        if (i > 0 && stop) gain.gain.exponentialRampToValueAtTime(1, at + fade);
    98	        if (stop) { gain.gain.setValueAtTime(1, at + s.hold - fade); gain.gain.exponentialRampToValueAtTime(0.0001, at + s.hold); }
    99	        src.start(at, 0, stop ? s.hold : undefined);
   100	        live.push(src); src.onended = () => { live = live.filter((x) => x !== src); };
   101	      });
   102	      await new Promise<void>((res) => {
   103	        let lastT = ctx!.currentTime, stuck = 0;
   104	        const id = setInterval(() => {
   105	          const now = ctx!.currentTime; const el = now - t0;
   106	          if (now === lastT) stuck++; else stuck = 0; lastT = now;                                  // a suspended context never advances: bounded wait
   107	          const i = Math.max(0, slots.findIndex((s, k) => el < s.start + s.hold && (k + 1 >= slots.length || el < slots[k + 1].start)));
   108	          const s = slots[i]; const within = Math.min(1, Math.max(0, (el - s.start) / s.hold));
   109	          opts.onProgress?.(Math.min(1, (i + within) / slots.length));                              // the sweep follows the timeline per grapheme
   110	          if (el >= total || !alive() || stuck > 50) { clearInterval(id); if (!alive() || stuck > 50) stopBlend(); opts.onProgress?.(1); res(); }
   111	        }, 30);
   112	      });
   113	      return;
   114	    } catch { /* fall through to the simple player */ }
   115	  }
   116	  // fallback: back-to-back clips through the singleton player (segmented, not continuous)
   117	  for (let i = 0; i < graphemes.length; i++) {
   118	    if (!alive()) return;
   119	    let p; try { p = playClip((await soundSource(GRAPHEME_SOUND[graphemes[i]].clip)).url); } catch { continue; }
   120	    opts.onProgress?.(i / graphemes.length);
   121	    await new Promise<void>((res) => { const t0 = Date.now(); const id = setInterval(() => { const el = p.el; if (el.ended || Date.now() - t0 > 700) { clearInterval(id); res(); } }, 30); });
   122	  }
   123	  opts.onProgress?.(1);
   124	}
   125	
   126	/** Caption for a blend: no dots, no gaps — the whole word as one stretched shape. */
   127	export const stretched = (graphemes: string[]) => graphemes.map((g) => (CONTINUANTS.has(g) || VOWELS.has(g) ? GRAPHEME_SOUND[g].label.replace(/(.)\1+/g, "$1$1$1") : GRAPHEME_SOUND[g].label)).join("");
   128	/** Kept for the parent summary. */
   129	export const dotted = (graphemes: string[]) => graphemes.map((g) => GRAPHEME_SOUND[g]?.label ?? g).join("·");

exec
/bin/zsh -lc 'nl -ba docs/plan-v5.md' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	# StoryTime plan v5 — end-to-end review fixes (2026-09-11, night)
     2	
     3	Sources: two Opus reviews (state/data, and K-1 teacher + parent) plus a hands-on pass driving both modes
     4	end to end in a 390×844 phone viewport. Transcripts: docs/reviews/opus-state-v5.md, docs/reviews/opus-pedagogy-v5.md.
     5	Verified by hand before planning: the three worst claims below are real (repro noted).
     6	
     7	Context: a grown-up reads the story aloud; a 4-year-old reads the decodable "magic words". Modes:
     8	"Nani reads" (recorded narration, karaoke, stops before each magic word) and "I read" (sound off,
     9	grown-up reads, child taps the pink word). Everything is local to the phone; the adult judges every verdict.
    10	
    11	## A. Data integrity and the progression ladder (P1 — silently wrong today)
    12	
    13	A1. **The first read of any story throws away the build evidence.** `store.ts:72` `recordEncoding` returns when
    14	    the progress row does not exist yet, but the row is only created by `recordFinish` at the end of the story.
    15	    Since `todayFor` prefers unfinished stories, a family reading a new book each night records zero successful
    16	    builds; `readyToAdvance` requires one within 7 days, so the next sound is never offered.
    17	    Fix: create the row when absent. Test: encoding then finish on a fresh slug keeps both.
    18	
    19	A2. **A failed read on boot replaces the real family with fresh defaults and saves them.** `family.tsx:69` catches,
    20	    calls `setKids(defaultKids())` (the `!kids.length` guard always passes: that closure's `kids` is `[]`), then
    21	    `ready` flips and the two save effects (`:94`, `:96`) persist the defaults over the real kids and settings.
    22	    Fix: a `loadedOk` ref set only inside the try; both save effects gated on it; never seed defaults on the fatal path.
    23	
    24	A3. **Magic words resolving to the first token or a proper name.** `Story.tsx:79` `targetIdx` takes the first
    25	    normalised match. Repro in the library: `pat-and-the-tap` p5 `pat`→token 0 `"Pat"` (ms 111),
    26	    `tap-tap-tap` p4 `tap`→token 0 `"Tap!"` (ms 111), `sam-and-the-pit` p5 `dad`→token 4 `"Dad"`. In listen mode
    27	    `stopMsAt()` is then 111 ms, so the page blips and the card opens before the child has heard the page; and the
    28	    child is shown a lowercased proper name to decode. These are the only three books a beginner has.
    29	    Fix: prefer the first lowercase occurrence, fall back to the first occurrence only if there is none; add a
    30	    library test asserting no resolved target is index 0 or capitalised.
    31	
    32	A4. **`finish` is not atomic and the build races it.** `Story.tsx:354` fires `onBuilt()` (read-modify-write of
    33	    `st:progress:<kid>`) and `onYes()` in the same handler; `onYes` drives `done`, whose effect calls `finish`
    34	    (another read-modify-write of the same key). Whichever save lands second wins the whole object.
    35	    Fix: await the encoding before advancing; clear the session inside the try in `finish`.
    36	
    37	A5. **`pendingBuild` compares against the earliest failure**, so fail → succeed → fail never comes back
    38	    (`family.tsx:104`). Fix: compare against the latest failure per word.
    39	
    40	A6. **Review scheduling drifts across midnight** (`store.ts:108,115`): a word missed at 00:15 is due the day after
    41	    tomorrow; a success at 20:00 with interval 3 comes due mid-session. Fix: anchor both to 05:00 of the target
    42	    day; treat a session before 05:00 as the previous day.
    43	
    44	A7. **`removeKid` orphans progress/attempts/review keys** and can leave the app with no active child, which throws
    45	    in `WarmUp.tsx:14` and `AddStory.tsx:34` (both call `learnerOf` above their own null guard).
    46	    Fix: delete all four keys, drop the in-memory session, null-guard both screens.
    47	
    48	A8. **`shaky` disagrees with `scheduleReview` about "needed help"** (`family.tsx:79` ignores `prompted`).
    49	    Fix: include `prompted`.
    50	
    51	## B. The nightly ritual (P1 — the family's experience)
    52	
    53	B1. **Nights 1–3 have no story at all.** Answer Welcome honestly ("none yet"), teach `s`, and Home says
    54	    "Four sounds, then the first story. 3 to go." Zero books fit under 4 sounds; the bookshelf is entirely locked.
    55	    Fix: below 4 sounds the reader gets the listener-shaped session on any book — narration, a per-page talk
    56	    prompt, tap-a-word — with honest copy: "Tonight Nani reads it all. Your first magic word comes in 3 sleeps."
    57	    No decoding claim is made and nothing is recorded as a word result.
    58	
    59	B2. **A tap on a book while words are due does nothing.** `Library.tsx:22` returns silently; the book looks
    60	    enabled. Fix: open the warm-up from that tap (or say "two words first — 40 seconds"), never swallow it.
    61	
    62	B3. **One hard word blocks the story every night forever.** `store.ts:114` reschedules a failed word to tomorrow
    63	    with no back-off and no retirement, and the warm-up is the only way to the story.
    64	    Fix: after 3 failed returns, retire the word ("comes back when ck is stronger"); a one-tap "not tonight" on the
    65	    warm-up that records nothing.
    66	
    67	B4. **"skip building today" is recorded as a failure** (`SegmentPanel.tsx:56` → `onDone(false)`), which schedules
    68	    the word for tomorrow, pins it as `pendingBuild` forever and blocks advancement. It cannot tell "wrong" from
    69	    "not tonight". Fix: three outcomes — Spelled it / Try together / Not tonight (records nothing). Suppress the
    70	    build entirely in bedtime mode.
    71	
    72	B5. **The big story tile is not tappable** — the obvious target on Home does nothing (verified by driving).
    73	    Fix: make the tile start the default mode.
    74	
    75	B6. **No way to repeat or go back a page, in either mode, and no "Again" on Done.** Fix: a "↺ this page" control
    76	    in the readbar (listen mode replays, read mode just re-arms), a back-a-page control, and "Read it again" on Done.
    77	
    78	## C. The word card and the adult script (P1)
    79	
    80	C1. **In "I read", the modelling instruction is painted behind the panel.** `panelOpen` stays true through
    81	    `modelling`; the caption bar (z-index 4) sits under the panel (z-index 5), and read mode is deliberately
    82	    silent. At the moment a non-phonics parent taps "Show me", they get a silent sweep and no instruction.
    83	    Fix: render the adult script inside `MagicPanel` whenever the panel is open; keep the caption for listen mode.
    84	
    85	C2. **The card cannot be dismissed without a verdict.** In read mode the pink word is live from page open, so a
    86	    sibling's tap opens a card whose only exits are a false ✓, a false skip, or leaving the story.
    87	    Fix: a "↓ not yet" that returns to narrating and records nothing.
    88	
    89	C3. **"wait 5 seconds" with no timer, and the two prohibitions shown only after the parent has broken them.**
    90	    Fix: a silent 5-second ring on the card before the verdict buttons arm, with "don't give the first sound"
    91	    and "no guessing from the picture" visible on the first card, not only after "Needs help".
    92	
    93	## D. "I'll try" quarantine (P1)
    94	
    95	D1. It offers a second copy of the page's own magic word (`tap-tap-tap` p1, `sam-and-the-pit` p2) because `taken`
    96	    is only the first occurrence; and the capital guard exempts index 0, so `Pat` (a name) is offered.
    97	    Fix: exclude every token whose normalised form is a magic word on the page; drop the `i > 0` exemption.
    98	
    99	D2. Its result is scored exactly like a designed magic word: it feeds `recordAttempt` (the advancement gate) and
   100	    `scheduleReview`. A child who volunteers and stumbles is held back; one who declines is not.
   101	    Fix: `extra: true` on the result; excluded from `recordAttempt`; celebrated by name on Done.
   102	
   103	D3. The card it opens is titled "Magic word · Veer's turn" — indistinguishable from the designed word.
   104	    Fix: its own kicker ("Extra word · you asked for this one") and a softer verdict pair.
   105	
   106	D4. Not suppressed in bedtime mode, against the plan's own rule. Fix: add `&& !bedtime`.
   107	
   108	## E. The teach routine (P1)
   109	
   110	E1. **"Replay today's sound: s" teaches the next sound instead.** Home labels from `kid.gpcs.at(-1)`;
   111	    `TeachSound.tsx:23` always targets `LS_PHASE2_ORDER[kid.gpcs.length]`. The parent walks six steps for `a`
   112	    with "mark it taught anyway" under the disabled button — two new sounds on day one, which is exactly what the
   113	    one-per-day rule exists to prevent. Fix: pass the target grapheme in; replay shows steps 1–3 and has no
   114	    "Taught today" button.
   115	
   116	E2. **The routine is unreachable at 5+ sounds when not ready**, yet Settings tells the parent to use it.
   117	    Fix: a permanent "Sounds: teach or replay" entry in Settings and on Home; readiness stays a recommendation.
   118	
   119	E3. **The Settings level dropdown changes sounds without the matching tricky words**, so a child set to 16 sounds
   120	    still fails `fits()` on all seven set-4 books. Fix: apply the same tricky ladder Welcome uses.
   121	
   122	## F. What the child and the parent see (P2, high value)
   123	
   124	F1. **Done ends on a list of failures.** Fix: the child-facing screen shows only what went right, at size; the
   125	    full ledger moves behind a "grown-up: tonight's words" disclosure.
   126	
   127	F2. **The counters labelled "magic words" count something else** (stored results include extras; Settings sums only
   128	    the latest run per story, so the number can go down). Fix: count designed words from `page.magic`, exclude
   129	    extras, and label the Settings figure as "this month" or make it cumulative.
   130	
   131	F3. **"night N of 30" is one too high after tonight's story is finished** (`family.tsx:103` + `Home.tsx:42`).
   132	    Fix: drop the `+1` when today is already counted.
   133	
   134	F4. **A "My sounds" wall** — the sounds the child knows and the words they have read first-try, big, for showing a
   135	    grandparent. This is the only persistent thing that belongs to the child, and it doubles as the parent's
   136	    morning report. (Planned in docs/plan.md and never built.)
   137	
   138	## G. Lifecycle and leaks (P2)
   139	
   140	G1. `RecordSounds` never releases the microphone on unmount and leaks a blob URL per preview.
   141	G2. `AddStory`'s tap-along playback keeps playing after the screen closes.
   142	G3. Voice follow's `stopAt` is a stale closure: once the pink word is answered the cursor freezes for the page.
   143	G4. Finger-follow's cursor only accepts exactly `cursor + 1`, so a finger that skips a word (or returns to the next
   144	    line) freezes the trail for the rest of the page. Fix: advance to the furthest word before the block.
   145	G5. Timed narration stops with zero margin before the magic word (`Story.tsx:96`), unlike the untimed path's 350 ms.
   146	    Fix: a 120 ms lead-out so a boundary drift cannot leak the word's first phoneme.
   147	G6. `Library` "start another story" is hard-coded to listen, bypassing the mode picker.
   148	
   149	## H. Content (P2)
   150	
   151	H1. Nights 5–24 run on three books (4–7 sounds → 2, 8–15 → 3, 16+ → 10). The whole set-3 block unlocks nothing.
   152	    Fix: write two set-2/set-3 originals (`pit dad nap dig dog pot cot kid sock`), validator-checked.
   153	H2. Two read-back lines are degenerate: `tap-tap-tap` is "Tap, tap, tap." (one word three times) and
   154	    `pat-and-the-tap` is "Pat sat." (not a moral) — and these are the first two books a beginner meets.
   155	H3. A family story with no magic words can become tonight's story, leaving the child one line to read.
   156	
   157	## Out of scope, stated honestly
   158	- Real illustrations. Every page is one emoji; a bedtime book for this age is half picture. This needs art assets,
   159	  not code, and is the largest remaining gap.
   160	- A job for the sibling who is physically present during the reader's session (they have a profile, not a role).
   161	
   162	## Order of execution
   163	1. A1–A3 (data loss and the blocked ladder), then A4–A8.
   164	2. B1, B4, B2, B5, B6 (the ritual), then C1–C3 (the card), D1–D4 (quarantine), E1–E3 (teach).
   165	3. F1–F3, G1–G6.
   166	4. H1–H3 and F4 if the night allows; anything not done is listed in docs/state.md as not done.
   167	
   168	## Rules that must hold (unchanged)
   169	Never TTS for phoneme clips. No red/buzzer on a miss. Validator fails closed. Don't remove a feature to satisfy a
   170	reviewer. Neutral names in the public repo. The adult keeps every verdict; nothing the app hears judges the child.
   171	
   172	---
   173	
   174	# v5 FINAL — after Grok's review (docs/reviews/grok-plan-v5.md)
   175	
   176	Grok found several of the fixes above to be the wrong patch. Corrections, and the order actually executed:
   177	
   178	**Corrected fixes**
   179	- A3: "prefer lowercase" only repairs 1 of the 3 books. Ship ONE `resolveMagic(page, word)` used by both call sites
   180	  (`Story.tsx:79` and `:220` are the same bug implemented twice), AND rewrite the two pages the heuristic cannot
   181	  save (`tap-tap-tap` p4, `sam-and-the-pit` p5). The library assertion is "the resolved token is not capitalised",
   182	  not "index > 0" (a page may legally start with a CVC).
   183	- A2: keep seeding in-memory defaults (the "read tonight without saving" escape hatch needs them); gate only the
   184	  two SAVE effects on a `loadedOk` ref.
   185	- A4: it is two races, and it no-ops without A1. Ship A1+A4 as one atomic encoding write; `saveSession` is already
   186	  inside `finish`'s try.
   187	- B1: do not add machine states, do not flip `role`, do not call `recordFinish` as today. `listenAlong =
   188	  role==="reader" && gpcs.length < 4`; tonight's tile pinned to the same set-1 book (not "any book");
   189	  `recordFinish(..., { listenOnly: true })` stamps `history` and `lastFinished` but leaves `timesFinished` 0 and
   190	  writes no results/attempt/review, so night 4 still gets that book as the first decoding night.
   191	- B3: "retire until ck is stronger" is wrong (tap is set 1, ck is set 4) and a no-op unless `scheduleReview`
   192	  honours it. Ship "not tonight" as a `snoozeUntil` that clears the gate for tonight only.
   193	- B4: do not suppress the build at bedtime — with A1 that is the only advancement evidence and this family only
   194	  reads at bedtime. Keep it optional there, defaulting to "Not tonight".
   195	- B5: the tile must route to the warm-up when words are due, or it bypasses the gate B2/B3 protect.
   196	- B2: opening the warm-up is not enough; hand the tapped slug through so the book they tapped is what starts.
   197	- C3: drop the hard 5-second lock (MagicPanel is shared with the warm-up; 15–25 s of added waiting). Keep the two
   198	  prohibitions, visible on the first card.
   199	- D2: `extra` leaks into more sinks than the plan named. One `designed(results)` helper used by `recordAttempt`,
   200	  `scheduleReview`, `shaky`, `buildWord`, Settings and Done.
   201	- E1: replay keeps steps 1–4 (the trace matters); it drops only "Taught today" and the next level's tricky word.
   202	- G4: `advanceCursor`'s strict `cursor+1` is the documented design. Narrow fix only: a NEW touch that lands ahead
   203	  re-syncs the cursor; within one continuous slide the strict rule stands.
   204	
   205	**Dropped or deferred** (stated honestly rather than half-done): A6 (day boundary needs one `dayStamp` helper
   206	across six call sites, not a two-line change), A7 (unreachable from the UI; orphan keys are hygiene), A8 (a product
   207	choice, not corruption), B6 "Again" (collides with `finishedRef`; needs a page/results reset), G3 (the card already
   208	stops the recogniser), G5 (token-0 content was the real stop bug), F4 and H1 (features), F2/F3/G1/G2/G6 (small).
   209	
   210	**Also caught by Grok, added**: no wake lock — the app uses `setInterval` *because the phone dims*, which is the
   211	actual bedtime bug; and there are no tests for the write path all of §A depends on (needs an idb-keyval mock).
   212	
   213	**Execution order**: B1 · A3+H2 · A2 · A1+A4 · C2+C1 · D1–D4 · B4 · B2+B5 · E1+E3 · B3 · F1 · wake lock · G4-lite.

exec
/bin/zsh -lc 'nl -ba src/lib/audio/player.ts; nl -ba src/lib/audio/speech.ts' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	/**
     2	 * One global <audio> element for narration (unlocked on the first user tap and
     3	 * reused by swapping src — iOS blocks new elements created off-gesture) and one
     4	 * singleton element for short clips (phonemes, prompts) so rapid taps never stack.
     5	 *
     6	 * Each play() returns a Playing whose listeners are its own: a superseded track's
     7	 * late `play()` rejection ("interrupted by a new load request") must never touch
     8	 * the listeners of the track that replaced it.
     9	 */
    10	let narration: HTMLAudioElement | null = null;
    11	let clip: HTMLAudioElement | null = null;
    12	let unlocked = false;
    13	
    14	function make(): HTMLAudioElement {
    15	  const a = document.createElement("audio");
    16	  a.setAttribute("playsinline", "");
    17	  a.preload = "auto";
    18	  a.style.display = "none";
    19	  document.body.appendChild(a); // detached media elements can be collected mid-play
    20	  return a;
    21	}
    22	const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
    23	
    24	/** Call from a user gesture (the Start tap). Safe to call repeatedly. */
    25	export async function unlock(): Promise<void> {
    26	  narration ??= make();
    27	  clip ??= make();
    28	  if (unlocked) return;
    29	  const silent = "data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAAAAE00QSBpc29tbXA0MgAAAAhmcmVlAAAAAG1kYXQ=";
    30	  // every engine must be kicked synchronously inside the tap; awaiting one first can spend the user activation
    31	  const kicks: Promise<unknown>[] = [];
    32	  for (const a of [narration, clip]) { try { a.src = silent; kicks.push(a.play().then(() => a.pause())); } catch { /* still counts as gestured on most engines */ } }
    33	  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance("")); } catch { /* no speech engine */ }
    34	  try { const { unlockBlendAudio } = await import("../blend"); unlockBlendAudio(); } catch { /* no web audio */ }
    35	  unlocked = true;
    36	  await withTimeout(Promise.allSettled(kicks), 400);
    37	}
    38	
    39	export interface Playing {
    40	  /** Resolves when playback ends or is stopped. Rejects only on a load error. */
    41	  done: Promise<void>;
    42	  stop: () => void;
    43	  el: HTMLAudioElement;
    44	}
    45	
    46	const cleanups = new WeakMap<HTMLAudioElement, () => void>();
    47	const blobUrls = new Map<string, string>();
    48	/** iOS plays data: URLs badly (rate changes go silent, `ended` is unreliable); hand it an object URL instead. */
    49	function resolveSrc(src: string): string {
    50	  if (!src.startsWith("data:")) return src;
    51	  const hit = blobUrls.get(src); if (hit) return hit;
    52	  if (blobUrls.size >= 6) { const [k, v] = blobUrls.entries().next().value as [string, string]; URL.revokeObjectURL(v); blobUrls.delete(k); }
    53	  try {
    54	    const [head, b64] = src.split(",", 2); const mime = head.slice(5, head.indexOf(";")) || "audio/mp4";
    55	    const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    56	    const url = URL.createObjectURL(new Blob([bytes], { type: mime })); blobUrls.set(src, url); return url;
    57	  } catch { return src; }
    58	}
    59	function playOn(el: HTMLAudioElement, src: string, rate = 1, range?: { startMs?: number; endMs?: number }): Playing {
    60	  cleanups.get(el)?.();               // a superseded track must not keep listeners on the shared element
    61	  el.pause();
    62	  el.src = resolveSrc(src);            // assigning src resets the clock; writing currentTime before load throws on WebKit
    63	  const onMeta = () => { try { el.playbackRate = rate; if (range?.startMs) el.currentTime = range.startMs / 1000; } catch { /* not supported for this source */ } };
    64	  el.addEventListener("loadedmetadata", onMeta, { once: true });
    65	  let settled = false;
    66	  let resolve!: () => void, reject!: (e: unknown) => void;
    67	  const done = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    68	  const off = () => { el.removeEventListener("ended", onEnded); el.removeEventListener("error", onError); el.removeEventListener("timeupdate", onTime); el.removeEventListener("loadedmetadata", onMeta); };
    69	  const finish = () => { if (settled) return; settled = true; off(); resolve(); };
    70	  const onEnded = () => finish();
    71	  const onError = () => { if (!settled) { settled = true; off(); reject(new Error(`audio failed: ${src}`)); } };
    72	  // safety net: some engines drop `ended` after a stall; treat reaching the end as ended
    73	  const onTime = () => { if ((el.duration && el.currentTime >= el.duration - 0.05) || (range?.endMs && el.currentTime * 1000 >= range.endMs)) { el.pause(); finish(); } };
    74	  el.addEventListener("ended", onEnded);
    75	  el.addEventListener("error", onError);
    76	  el.addEventListener("timeupdate", onTime);
    77	  cleanups.set(el, () => { if (!settled) { settled = true; off(); resolve(); } });
    78	  void el.play().catch((e) => { if (!settled) { settled = true; off(); reject(e); } });
    79	  return { done, stop: () => { if (settled) return; el.pause(); finish(); }, el };
    80	}
    81	
    82	export function playNarration(src: string, rate = 1): Playing {
    83	  narration ??= make();
    84	  clip?.pause();
    85	  return playOn(narration, src, rate);
    86	}
    87	
    88	export function playClip(src: string, range?: { startMs?: number; endMs?: number }): Playing {
    89	  clip ??= make();
    90	  return playOn(clip, src, 1, range);
    91	}
    92	
    93	export function stopAll(): void {
    94	  narration?.pause();
    95	  clip?.pause();
    96	}
     1	/**
     2	 * On-device speech (Web Speech API) for family stories and single-word taps.
     3	 * $0, offline, no server. Word boundaries fire on Chrome and Safari; when they do
     4	 * not, the caller's highlighting simply stays on the sentence.
     5	 */
     6	export interface SpeakHandle { done: Promise<void>; stop: () => void }
     7	
     8	let voice: SpeechSynthesisVoice | null | undefined;
     9	function pickVoice(): SpeechSynthesisVoice | null {
    10	  if (voice !== undefined) return voice;
    11	  const vs = window.speechSynthesis?.getVoices?.() ?? [];
    12	  voice = vs.find((v) => /en-US/i.test(v.lang) && /samantha|ava|allison|aria|jenny|google us/i.test(v.name)) ?? vs.find((v) => /en-US/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? null;   // one accent everywhere: the narrator is US
    13	  return voice;
    14	}
    15	if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voice = undefined; pickVoice(); };
    16	
    17	export function speakText(text: string, opts: { rate?: number; onWord?: (index: number) => void }): SpeakHandle {
    18	  if (typeof window === "undefined" || !window.speechSynthesis) return { done: Promise.resolve(), stop: () => {} };
    19	  const synth = window.speechSynthesis;
    20	  synth.cancel();
    21	  const u = new SpeechSynthesisUtterance(text);
    22	  const v = pickVoice(); if (v) u.voice = v;
    23	  u.rate = 0.9 * (opts.rate ?? 1);
    24	  u.pitch = 1.05;
    25	  // map character offsets to token indexes
    26	  const starts: number[] = []; let pos = 0;
    27	  for (const tok of text.split(" ")) { starts.push(pos); pos += tok.length + 1; }
    28	  let settled = false, resolve!: () => void;
    29	  const done = new Promise<void>((r) => { resolve = r; });
    30	  const finish = () => { if (!settled) { settled = true; resolve(); } };
    31	  u.onboundary = (e) => { if (e.name === "word" && opts.onWord) { let i = 0; for (let k = 0; k < starts.length; k++) if (starts[k] <= e.charIndex) i = k; opts.onWord(i); } };
    32	  u.onend = finish; u.onerror = finish;
    33	  const queued = setTimeout(() => synth.speak(u), 0);       // iOS drops an utterance queued in the same tick as cancel()
    34	  // Safari sometimes never fires onend for cancelled utterances
    35	  const guard = setTimeout(finish, Math.max(2000, text.length * 120));
    36	  return { done: done.then(() => clearTimeout(guard)), stop: () => { clearTimeout(queued); synth.cancel(); finish(); } };   // a stopped utterance must not start later from the queue
    37	}

exec
/bin/zsh -lc "nl -ba src/screens/Story.tsx | sed -n '250,470p'" in /Users/rish_ai/StoryTime
 succeeded in 0ms:
   250	  const onDown = (e: React.PointerEvent) => { if (!readMode) return; drag.current = { x: e.clientX, y: e.clientY, on: false, rects: [], id: e.pointerId }; };
   251	  const onMove = (e: React.PointerEvent) => {
   252	    const d = drag.current; if (!d || !readMode) return;
   253	    let fresh = false;
   254	    if (!d.on) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return; d.on = true; fresh = true; d.rects = measure(); try { cardRef.current?.setPointerCapture(d.id); } catch { /* not supported */ } }   // a tap stays a tap: the pink button still clicks
   255	    land(hitWord(d.rects, e.clientX, e.clientY), fresh);
   256	  };
   257	  const onUp = () => { drag.current = null; };
   258	  const wordCls = (i: number, base: string) => (readMode ? base + (i === pointer ? " now" : i <= cursor ? " read" : "") : base);
   259	
   260	  // "I'll try": one extra decodable word per page, chosen on page open, offered only until the grown-up has read past it
   261	  const extra = useMemo(() => (readMode && !listener && !bedtime ? pickIllTry(page, learner, magicTokens(page), (i) => !!resAt(i)) : -1),   // never a copy of the designed word, never at bedtime
   262	  // eslint-disable-next-line react-hooks/exhaustive-deps
   263	  [page, pageNo, readMode, listener, learner, bedtime]);
   264	
   265	  // follow my voice (opt-in): the recogniser only ever moves the cursor forward, never onto the pending child word
   266	  const [voice, setVoice] = useState<VoiceState>("off");
   267	  const session = useRef<VoiceSession | null>(null);
   268	  const anchor = useRef(-1);
   269	  const cursorRef = useRef(-1); cursorRef.current = cursor;
   270	  const tokensNorm = useMemo(() => page.tokens.map((t) => normalise(t.t)), [page]);
   271	  const stopVoice = () => { session.current?.stop(); session.current = null; };
   272	  useEffect(() => { anchor.current = cursorRef.current; }, [pointer]);   // a finger or tap correction invalidates the running alignment
   273	  useEffect(() => { if (hideArt) { stopVoice(); setVoice((v) => (v === "listening" || v === "starting" ? "stopped" : v)); } }, [hideArt]);   // the word card: never listen to the child
   274	  useEffect(() => () => stopVoice(), [pageNo]);
   275	  const startFollow = () => {
   276	    stopVoice(); anchor.current = cursorRef.current;
   277	    session.current = startVoice({
   278	      onState: setVoice,
   279	      onHeard: (words, final) => {
   280	        const stopAt = pending.length ? pending[0] : -1;
   281	        const next = align({ tokens: tokensNorm, anchor: anchor.current, heard: words, stopAt });
   282	        if (next > cursorRef.current) { setCursor(next); setPointer(next); }
   283	        if (final) anchor.current = Math.max(anchor.current, next);
   284	      },
   285	    });
   286	  };
   287	  return (
   288	    <main className="story">
   289	      {/* the picture is hidden while a magic word is open: the child reads the letters, not the picture */}
   290	      <div className={"art-box" + (hideArt ? " veiled" : "")}>{hideArt ? <span className="veil"><LockIcon size={28} />read the letters</span> : <Art art={page.art} />}</div>
   291	      <div className={"text-card" + (readMode ? " follow" : "")} ref={cardRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}>
   292	        <div className="pg">Page {pageNo + 1} of {total}</div>
   293	        <p className={"sentence" + (readMode ? " follow" : "")} ref={sentenceRef}>
   294	          {page.tokens.map((t, i) => {
   295	            const n = normalise(t.t);
   296	            const magic = !listener && firstIdx.has(i);
   297	            const res = magic ? resAt(i) : undefined;
   298	            const cls = wordCls(i, ["w", i === token ? "now" : "", i < token ? "read" : "", magic ? "magic" : "", magic && res ? (res.ok ? "done" : "skipped") : ""].join(" "));
   299	            const [lead, core0, punct] = split(t.t);
   300	            const core = magic ? core0.toLowerCase() : core0;   // a magic word is shown in the letterforms the child was taught
   301	            if (readMode && magic && !res) return <span key={i} className="tokwrap">{lead}<button className={cls + " tap"} data-i={i} onClick={() => onMagicTap(n, i)}>{core}</button>{punct} </span>;
   302	            if (readMode && i === extra) {
   303	              const r = resAt(i);
   304	              if (r) return <span key={i} className="tokwrap">{lead}<span className={wordCls(i, "w magic " + (r.ok ? "done" : "skipped"))} data-i={i}>{core.toLowerCase()}</span>{punct} </span>;
   305	              if (i > cursor) return <span key={i} className="tokwrap">{lead}<button className={cls + " try"} data-i={i} onClick={() => onMagicTap(n, i, true)}>{core.toLowerCase()}</button>{punct} </span>;   // offered until the grown-up reads past it
   306	            }
   307	            if (listener) return <span key={i} className="tokwrap">{lead}<button className={cls + " listener-tap"} onClick={() => onWordTap(t.t)}>{core}</button>{punct} </span>;   // read mode: grey words are the grown-up's, never tap-to-hear
   308	            if (readMode) return <span key={i} className="tokwrap">{lead}<span className={cls} data-i={i} onClick={() => land(i, true)}>{core}</span>{punct} </span>;   // tap-only alternative to the slide: the next word moves the cursor
   309	            return <span key={i} className="tokwrap">{lead}<span className={cls}>{core}</span>{punct} </span>;
   310	          })}
   311	        </p>
   312	        {stalled && <div className="readbar"><button className="next" onClick={onRetry}>▶ Try again</button></div>}
   313	        {readMode && !stalled && (
   314	          <div className="readbar">
   315	            <span className="script">{pending.length ? <><b>{reader}</b> reads, sliding a finger under the words. <b>{kid}</b> reads the <em className="pinkword">pink word</em>: tap it, then say the sounds and blend.</> : <><b>{reader}</b> reads the page, finger under the words. Then go on.</>}{extra >= 0 && extra > cursor && !resAt(extra) && <> <small className="legend">Also decodable: <b>{normalise(page.tokens[extra].t)}</b> — tap it if {kid} wants a go.</small></>}</span>
   316	            {voiceFollow && voiceSupported() && (
   317	              <div className="row center voicebar">
   318	                {voice === "off" || voice === "stopped" ? <button className="small" onClick={startFollow}>{voice === "stopped" ? "Tap to follow again" : "Follow my voice"}</button>
   319	                  : voice === "starting" ? <span className="legend">starting the microphone…</span>
   320	                  : voice === "listening" ? <button className="small live" onClick={() => { stopVoice(); setVoice("off"); }}>Listening · stop</button>
   321	                  : voice === "denied" ? <span className="legend">Microphone not allowed here. Slide a finger under the words instead.</span>
   322	                  : <span className="legend">Voice follow is not available here (offline or unsupported). Slide a finger under the words instead.</span>}
   323	              </div>
   324	            )}
   325	            <button className="next" disabled={pending.length > 0} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
   326	          </div>
   327	        )}
   328	        {listener && !readMode && !stalled && (
   329	          <div className="readbar">
   330	            <span className="script">{pageHeld ? <><b>{reader}</b>: {["“What happened on this page?”", "“Point to the picture. What is it?”", "“Which word did you like? Tap it.”", "“What do you think happens next?”"][pageNo % 4]}</> : "Listen…"}</span>
   331	            <button className="next" disabled={!pageHeld} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
   332	          </div>
   333	        )}
   334	      </div>
   335	    </main>
   336	  );
   337	}
   338	
   339	/**
   340	 * Read-back routine: the child tries the WHOLE line first. If a word needs help, the grown-up taps it:
   341	 * the app shows regular vs tricky parts (tricky word) or stretches the sounds (decodable word),
   342	 * the child re-reads that word, then re-reads the whole line smoothly before ✓.
   343	 */
   344	function Moral({ story, learner, listener, kid, reader, listen, bedtime, setCaption, buildWord, onBuilt, onYes }: { story: Story; learner: LearnerModel; listener: boolean; kid: string; reader: string; listen: boolean; bedtime: boolean; setCaption: (s: string) => void; buildWord: string | null; onBuilt: (w: string, ok: boolean) => Promise<void>; onYes: () => void }) {
   345	  const line = checkLine(story.moral.line, learner);
   346	  const raw = story.moral.line.split(/\s+/);
   347	  const parts = raw.map((w, i) => { const m = w.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/); const r = line.results[i]; const core = m ? m[2] : w; const shown = r?.ok ? (r.kind === "tricky" ? (r.word === "i" ? "I" : r.word) : core.toLowerCase()) : core; return { lead: m ? m[1] : "", core: shown, punct: m ? m[3] : "" }; });   // taught letterforms; punctuation outside
   348	  const words = parts.map((p) => p.core);
   349	  const [stage, setStage] = useState<"try" | "help" | "word" | "reread" | "build">("try");
   350	  // after the read-back: one-word dictation on a word the child just blended (skipped when none)
   351	  const finishLine = () => { if (buildWord) { setStage("build"); setCaption(`${reader}: say "${buildWord}". ${kid} counts the sounds, then builds it.`); } else onYes(); };
   352	  const [helped, setHelped] = useState<number | null>(null);
   353	  const help = async (i: number) => {
   354	    const r = line.results[i]; setHelped(i);
   355	    if (!r.ok) return;
   356	    if (r.kind === "tricky") {
   357	      setCaption(`${words[i]} is a tricky word. The underlined part is the odd bit. Just say the word, then read the line again.`);
   358	      if (listen) speakText(words[i], {});   // a tricky word is taught as a whole, so hearing it is fine
   359	    } else {
   360	      setCaption(`${stretched(r.graphemes)} … ${reader}: slide through the sounds, but let ${kid} say the word.`);
   361	      await playBlend(r.graphemes);   // never the whole word: that would be echoing, not blending
   362	      setStage("word"); return;       // stay on this word until the grown-up confirms the child blended it
   363	    }
   364	    setStage("reread");
   365	  };
   366	  if (stage === "build" && buildWord) return (
   367	    <div className="screen-wrap panel-open">
   368	      <main className="moral"><div className="kicker">One more: build a word</div><p className="spoken">“{story.moral.spoken}”</p></main>
   369	      {/* the encoding write and the finish write both read-modify-write the same progress row: never race them */}
   370	      <SegmentPanel word={buildWord} learner={learner} kid={kid} reader={reader} listen={listen} bedtime={bedtime} onDone={async (outcome) => { if (outcome !== "not_tonight") await onBuilt(buildWord, outcome === "spelled"); onYes(); }} />
   371	    </div>
   372	  );
   373	  return (
   374	    <main className="moral">
   375	      <div className="kicker">The end</div>
   376	      <p className="spoken">“{story.moral.spoken}”</p>
   377	      {!listener && (
   378	        <>
   379	          <div className="kicker">{stage === "try" ? `${kid} reads the whole line` : stage === "help" ? "tap the word that needs help" : stage === "word" ? `${kid} blends that word` : "now the whole line again, smoothly"}</div>
   380	          <p className="line">
   381	            {line.results.map((r, i) => {
   382	              const tp = r.ok && r.kind === "tricky" ? (TRICKY_PARTS[r.word] ?? `|${r.word}`).split("|") : null;
   383	              return (
   384	                <span key={i} className="tokwrap">{parts[i].lead}<button className={"lw " + (r.ok && r.kind === "tricky" ? "tricky" : "magic") + (helped === i ? " helped" : "")} disabled={stage === "try"} onClick={() => help(i)}>
   385	                  {tp ? <><span>{words[i].slice(0, tp[0].length)}</span><u className="odd">{words[i].slice(tp[0].length)}</u></> : words[i]}
   386	                </button>{parts[i].punct}</span>
   387	              );
   388	            })}
   389	          </p>
   390	          <div className="legend"><i className="sw magic" /> sound it out <i className="sw tricky" /> tricky word: <u className="odd">odd bit</u> underlined</div>
   391	          <div className="script"><b>{reader}</b>: {stage === "try" ? "let them read the whole line first." : stage === "help" ? "tap the word they stuck on." : stage === "word" ? "wait for them to slide through it and say it as one word." : "ask for the whole line once more, smoothly."}</div>
   392	        </>
   393	      )}
   394	      <div className="btns">
   395	        {listener ? <button className="yes" onClick={onYes}>The end ✓</button> : stage === "try" ? (
   396	          <><button className="no" onClick={() => setStage("help")}>Needs help on a word</button><button className="yes" onClick={finishLine}><CheckIcon /> Read it smoothly</button></>
   397	        ) : stage === "help" ? (
   398	          <button className="no" onClick={() => setStage("try")}>← back</button>
   399	        ) : stage === "word" ? (
   400	          <><button className="no" onClick={() => helped !== null && help(helped)}>Show me again</button><button className="yes" onClick={() => setStage("reread")}>✓ They blended it</button></>
   401	        ) : (
   402	          <><button className="no" onClick={() => setStage("help")}>Another word</button><button className="yes" onClick={finishLine}>✓ Read it smoothly</button></>
   403	        )}
   404	      </div>
   405	    </main>
   406	  );
   407	}
   408	
   409	/** Specific feedback, not a trophy: what the child actually did with each word. */
   410	function Done({ story, results, bedtime, kid, learner, listenOnly, onHome }: { story: Story; results: WordResult[]; bedtime: boolean; kid: string; learner: LearnerModel; listenOnly: boolean; onHome: () => void }) {
   411	  const ok = results.filter((r) => r.ok);
   412	  const tried = volunteered(results);
   413	  const later = designed(results).filter((r) => !r.ok);
   414	  const [ledger, setLedger] = useState(false);   // the child's screen shows the wins; the ledger is the grown-up's
   415	  const line = (r: WordResult) => {
   416	    const gs = checkWord(r.word, learner).graphemes.join("-");
   417	    if (!r.ok) return `${r.word} · comes back in tomorrow's warm-up`;
   418	    if (r.mode === "first_try") return `${r.word} · slid through ${gs} first try${r.extra ? " (asked for this one)" : ""}`;
   419	    if (r.mode === "prompted") return `${r.word} · blended it after a nudge`;
   420	    return `${r.word} · heard it slid through, then did it`;
   421	  };
   422	  return (
   423	    <main className="done">
   424	      {!bedtime && (ok.length > 0 || listenOnly) && <Confetti />}
   425	      <div className="badge rise">{bedtime ? <MoonIcon size={84} /> : <Art art={story.pages[0].art} />}</div>
   426	      <h2 className="rise">{story.title}</h2>
   427	      {ok.length > 0 && <ul className="results">{ok.map((r, i) => <li key={(r.id ?? r.word) + i} className="ok">{line(r)}</li>)}</ul>}
   428	      <p className="show">{bedtime ? "Lights low. One real book, then sleep." : listenOnly ? `A whole story, ${kid}! Tell someone what happened.` : ok.length ? `Now go find someone and read them your ${ok.length === 1 ? "word" : "words"}, ${kid}!` : `Good listening, ${kid}. Those words come back tomorrow for a warm-up.`}</p>
   429	      {!bedtime && ok.length > 0 && <p className="bigwords">{ok.map((r, i) => <span key={(r.id ?? r.word) + i}>{r.word}</span>)}</p>}
   430	      {tried.length > 0 && <p className="note">…and {kid} asked to try <b>{tried.map((r) => r.word).join(", ")}</b> without being asked.</p>}
   431	      <div className="btns"><button className="yes" onClick={onHome}><CheckIcon /> Done</button></div>
   432	      {later.length > 0 && (ledger
   433	        ? <ul className="results grownup-ledger">{later.map((r, i) => <li key={(r.id ?? r.word) + i} className="no">{line(r)}</li>)}</ul>
   434	        : <button className="skip" onClick={() => setLedger(true)}>grown-up: tonight's words →</button>)}
   435	    </main>
   436	  );
   437	}
   438	
   439	function Confetti() {
   440	  const bits = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ l: (i * 37) % 100, d: (i % 6) * 0.15, c: ["#f3c7e6", "#d8ecd2", "#ffe9a8", "#dbe7f7"][i % 4] })), []);
   441	  return <div className="confetti" aria-hidden>{bits.map((b, i) => <i key={i} style={{ left: `${b.l}%`, animationDelay: `${b.d}s`, background: b.c }} />)}</div>;
   442	}

exec
/bin/zsh -lc "nl -ba src/lib/audio/player.ts; nl -ba src/lib/audio/speech.ts; nl -ba docs/plan-v5.md | sed -n '130,260p'" in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	/**
     2	 * One global <audio> element for narration (unlocked on the first user tap and
     3	 * reused by swapping src — iOS blocks new elements created off-gesture) and one
     4	 * singleton element for short clips (phonemes, prompts) so rapid taps never stack.
     5	 *
     6	 * Each play() returns a Playing whose listeners are its own: a superseded track's
     7	 * late `play()` rejection ("interrupted by a new load request") must never touch
     8	 * the listeners of the track that replaced it.
     9	 */
    10	let narration: HTMLAudioElement | null = null;
    11	let clip: HTMLAudioElement | null = null;
    12	let unlocked = false;
    13	
    14	function make(): HTMLAudioElement {
    15	  const a = document.createElement("audio");
    16	  a.setAttribute("playsinline", "");
    17	  a.preload = "auto";
    18	  a.style.display = "none";
    19	  document.body.appendChild(a); // detached media elements can be collected mid-play
    20	  return a;
    21	}
    22	const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
    23	
    24	/** Call from a user gesture (the Start tap). Safe to call repeatedly. */
    25	export async function unlock(): Promise<void> {
    26	  narration ??= make();
    27	  clip ??= make();
    28	  if (unlocked) return;
    29	  const silent = "data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAAAAE00QSBpc29tbXA0MgAAAAhmcmVlAAAAAG1kYXQ=";
    30	  // every engine must be kicked synchronously inside the tap; awaiting one first can spend the user activation
    31	  const kicks: Promise<unknown>[] = [];
    32	  for (const a of [narration, clip]) { try { a.src = silent; kicks.push(a.play().then(() => a.pause())); } catch { /* still counts as gestured on most engines */ } }
    33	  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance("")); } catch { /* no speech engine */ }
    34	  try { const { unlockBlendAudio } = await import("../blend"); unlockBlendAudio(); } catch { /* no web audio */ }
    35	  unlocked = true;
    36	  await withTimeout(Promise.allSettled(kicks), 400);
    37	}
    38	
    39	export interface Playing {
    40	  /** Resolves when playback ends or is stopped. Rejects only on a load error. */
    41	  done: Promise<void>;
    42	  stop: () => void;
    43	  el: HTMLAudioElement;
    44	}
    45	
    46	const cleanups = new WeakMap<HTMLAudioElement, () => void>();
    47	const blobUrls = new Map<string, string>();
    48	/** iOS plays data: URLs badly (rate changes go silent, `ended` is unreliable); hand it an object URL instead. */
    49	function resolveSrc(src: string): string {
    50	  if (!src.startsWith("data:")) return src;
    51	  const hit = blobUrls.get(src); if (hit) return hit;
    52	  if (blobUrls.size >= 6) { const [k, v] = blobUrls.entries().next().value as [string, string]; URL.revokeObjectURL(v); blobUrls.delete(k); }
    53	  try {
    54	    const [head, b64] = src.split(",", 2); const mime = head.slice(5, head.indexOf(";")) || "audio/mp4";
    55	    const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    56	    const url = URL.createObjectURL(new Blob([bytes], { type: mime })); blobUrls.set(src, url); return url;
    57	  } catch { return src; }
    58	}
    59	function playOn(el: HTMLAudioElement, src: string, rate = 1, range?: { startMs?: number; endMs?: number }): Playing {
    60	  cleanups.get(el)?.();               // a superseded track must not keep listeners on the shared element
    61	  el.pause();
    62	  el.src = resolveSrc(src);            // assigning src resets the clock; writing currentTime before load throws on WebKit
    63	  const onMeta = () => { try { el.playbackRate = rate; if (range?.startMs) el.currentTime = range.startMs / 1000; } catch { /* not supported for this source */ } };
    64	  el.addEventListener("loadedmetadata", onMeta, { once: true });
    65	  let settled = false;
    66	  let resolve!: () => void, reject!: (e: unknown) => void;
    67	  const done = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    68	  const off = () => { el.removeEventListener("ended", onEnded); el.removeEventListener("error", onError); el.removeEventListener("timeupdate", onTime); el.removeEventListener("loadedmetadata", onMeta); };
    69	  const finish = () => { if (settled) return; settled = true; off(); resolve(); };
    70	  const onEnded = () => finish();
    71	  const onError = () => { if (!settled) { settled = true; off(); reject(new Error(`audio failed: ${src}`)); } };
    72	  // safety net: some engines drop `ended` after a stall; treat reaching the end as ended
    73	  const onTime = () => { if ((el.duration && el.currentTime >= el.duration - 0.05) || (range?.endMs && el.currentTime * 1000 >= range.endMs)) { el.pause(); finish(); } };
    74	  el.addEventListener("ended", onEnded);
    75	  el.addEventListener("error", onError);
    76	  el.addEventListener("timeupdate", onTime);
    77	  cleanups.set(el, () => { if (!settled) { settled = true; off(); resolve(); } });
    78	  void el.play().catch((e) => { if (!settled) { settled = true; off(); reject(e); } });
    79	  return { done, stop: () => { if (settled) return; el.pause(); finish(); }, el };
    80	}
    81	
    82	export function playNarration(src: string, rate = 1): Playing {
    83	  narration ??= make();
    84	  clip?.pause();
    85	  return playOn(narration, src, rate);
    86	}
    87	
    88	export function playClip(src: string, range?: { startMs?: number; endMs?: number }): Playing {
    89	  clip ??= make();
    90	  return playOn(clip, src, 1, range);
    91	}
    92	
    93	export function stopAll(): void {
    94	  narration?.pause();
    95	  clip?.pause();
    96	}
     1	/**
     2	 * On-device speech (Web Speech API) for family stories and single-word taps.
     3	 * $0, offline, no server. Word boundaries fire on Chrome and Safari; when they do
     4	 * not, the caller's highlighting simply stays on the sentence.
     5	 */
     6	export interface SpeakHandle { done: Promise<void>; stop: () => void }
     7	
     8	let voice: SpeechSynthesisVoice | null | undefined;
     9	function pickVoice(): SpeechSynthesisVoice | null {
    10	  if (voice !== undefined) return voice;
    11	  const vs = window.speechSynthesis?.getVoices?.() ?? [];
    12	  voice = vs.find((v) => /en-US/i.test(v.lang) && /samantha|ava|allison|aria|jenny|google us/i.test(v.name)) ?? vs.find((v) => /en-US/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? null;   // one accent everywhere: the narrator is US
    13	  return voice;
    14	}
    15	if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voice = undefined; pickVoice(); };
    16	
    17	export function speakText(text: string, opts: { rate?: number; onWord?: (index: number) => void }): SpeakHandle {
    18	  if (typeof window === "undefined" || !window.speechSynthesis) return { done: Promise.resolve(), stop: () => {} };
    19	  const synth = window.speechSynthesis;
    20	  synth.cancel();
    21	  const u = new SpeechSynthesisUtterance(text);
    22	  const v = pickVoice(); if (v) u.voice = v;
    23	  u.rate = 0.9 * (opts.rate ?? 1);
    24	  u.pitch = 1.05;
    25	  // map character offsets to token indexes
    26	  const starts: number[] = []; let pos = 0;
    27	  for (const tok of text.split(" ")) { starts.push(pos); pos += tok.length + 1; }
    28	  let settled = false, resolve!: () => void;
    29	  const done = new Promise<void>((r) => { resolve = r; });
    30	  const finish = () => { if (!settled) { settled = true; resolve(); } };
    31	  u.onboundary = (e) => { if (e.name === "word" && opts.onWord) { let i = 0; for (let k = 0; k < starts.length; k++) if (starts[k] <= e.charIndex) i = k; opts.onWord(i); } };
    32	  u.onend = finish; u.onerror = finish;
    33	  const queued = setTimeout(() => synth.speak(u), 0);       // iOS drops an utterance queued in the same tick as cancel()
    34	  // Safari sometimes never fires onend for cancelled utterances
    35	  const guard = setTimeout(finish, Math.max(2000, text.length * 120));
    36	  return { done: done.then(() => clearTimeout(guard)), stop: () => { clearTimeout(queued); synth.cancel(); finish(); } };   // a stopped utterance must not start later from the queue
    37	}
   130	
   131	F3. **"night N of 30" is one too high after tonight's story is finished** (`family.tsx:103` + `Home.tsx:42`).
   132	    Fix: drop the `+1` when today is already counted.
   133	
   134	F4. **A "My sounds" wall** — the sounds the child knows and the words they have read first-try, big, for showing a
   135	    grandparent. This is the only persistent thing that belongs to the child, and it doubles as the parent's
   136	    morning report. (Planned in docs/plan.md and never built.)
   137	
   138	## G. Lifecycle and leaks (P2)
   139	
   140	G1. `RecordSounds` never releases the microphone on unmount and leaks a blob URL per preview.
   141	G2. `AddStory`'s tap-along playback keeps playing after the screen closes.
   142	G3. Voice follow's `stopAt` is a stale closure: once the pink word is answered the cursor freezes for the page.
   143	G4. Finger-follow's cursor only accepts exactly `cursor + 1`, so a finger that skips a word (or returns to the next
   144	    line) freezes the trail for the rest of the page. Fix: advance to the furthest word before the block.
   145	G5. Timed narration stops with zero margin before the magic word (`Story.tsx:96`), unlike the untimed path's 350 ms.
   146	    Fix: a 120 ms lead-out so a boundary drift cannot leak the word's first phoneme.
   147	G6. `Library` "start another story" is hard-coded to listen, bypassing the mode picker.
   148	
   149	## H. Content (P2)
   150	
   151	H1. Nights 5–24 run on three books (4–7 sounds → 2, 8–15 → 3, 16+ → 10). The whole set-3 block unlocks nothing.
   152	    Fix: write two set-2/set-3 originals (`pit dad nap dig dog pot cot kid sock`), validator-checked.
   153	H2. Two read-back lines are degenerate: `tap-tap-tap` is "Tap, tap, tap." (one word three times) and
   154	    `pat-and-the-tap` is "Pat sat." (not a moral) — and these are the first two books a beginner meets.
   155	H3. A family story with no magic words can become tonight's story, leaving the child one line to read.
   156	
   157	## Out of scope, stated honestly
   158	- Real illustrations. Every page is one emoji; a bedtime book for this age is half picture. This needs art assets,
   159	  not code, and is the largest remaining gap.
   160	- A job for the sibling who is physically present during the reader's session (they have a profile, not a role).
   161	
   162	## Order of execution
   163	1. A1–A3 (data loss and the blocked ladder), then A4–A8.
   164	2. B1, B4, B2, B5, B6 (the ritual), then C1–C3 (the card), D1–D4 (quarantine), E1–E3 (teach).
   165	3. F1–F3, G1–G6.
   166	4. H1–H3 and F4 if the night allows; anything not done is listed in docs/state.md as not done.
   167	
   168	## Rules that must hold (unchanged)
   169	Never TTS for phoneme clips. No red/buzzer on a miss. Validator fails closed. Don't remove a feature to satisfy a
   170	reviewer. Neutral names in the public repo. The adult keeps every verdict; nothing the app hears judges the child.
   171	
   172	---
   173	
   174	# v5 FINAL — after Grok's review (docs/reviews/grok-plan-v5.md)
   175	
   176	Grok found several of the fixes above to be the wrong patch. Corrections, and the order actually executed:
   177	
   178	**Corrected fixes**
   179	- A3: "prefer lowercase" only repairs 1 of the 3 books. Ship ONE `resolveMagic(page, word)` used by both call sites
   180	  (`Story.tsx:79` and `:220` are the same bug implemented twice), AND rewrite the two pages the heuristic cannot
   181	  save (`tap-tap-tap` p4, `sam-and-the-pit` p5). The library assertion is "the resolved token is not capitalised",
   182	  not "index > 0" (a page may legally start with a CVC).
   183	- A2: keep seeding in-memory defaults (the "read tonight without saving" escape hatch needs them); gate only the
   184	  two SAVE effects on a `loadedOk` ref.
   185	- A4: it is two races, and it no-ops without A1. Ship A1+A4 as one atomic encoding write; `saveSession` is already
   186	  inside `finish`'s try.
   187	- B1: do not add machine states, do not flip `role`, do not call `recordFinish` as today. `listenAlong =
   188	  role==="reader" && gpcs.length < 4`; tonight's tile pinned to the same set-1 book (not "any book");
   189	  `recordFinish(..., { listenOnly: true })` stamps `history` and `lastFinished` but leaves `timesFinished` 0 and
   190	  writes no results/attempt/review, so night 4 still gets that book as the first decoding night.
   191	- B3: "retire until ck is stronger" is wrong (tap is set 1, ck is set 4) and a no-op unless `scheduleReview`
   192	  honours it. Ship "not tonight" as a `snoozeUntil` that clears the gate for tonight only.
   193	- B4: do not suppress the build at bedtime — with A1 that is the only advancement evidence and this family only
   194	  reads at bedtime. Keep it optional there, defaulting to "Not tonight".
   195	- B5: the tile must route to the warm-up when words are due, or it bypasses the gate B2/B3 protect.
   196	- B2: opening the warm-up is not enough; hand the tapped slug through so the book they tapped is what starts.
   197	- C3: drop the hard 5-second lock (MagicPanel is shared with the warm-up; 15–25 s of added waiting). Keep the two
   198	  prohibitions, visible on the first card.
   199	- D2: `extra` leaks into more sinks than the plan named. One `designed(results)` helper used by `recordAttempt`,
   200	  `scheduleReview`, `shaky`, `buildWord`, Settings and Done.
   201	- E1: replay keeps steps 1–4 (the trace matters); it drops only "Taught today" and the next level's tricky word.
   202	- G4: `advanceCursor`'s strict `cursor+1` is the documented design. Narrow fix only: a NEW touch that lands ahead
   203	  re-syncs the cursor; within one continuous slide the strict rule stands.
   204	
   205	**Dropped or deferred** (stated honestly rather than half-done): A6 (day boundary needs one `dayStamp` helper
   206	across six call sites, not a two-line change), A7 (unreachable from the UI; orphan keys are hygiene), A8 (a product
   207	choice, not corruption), B6 "Again" (collides with `finishedRef`; needs a page/results reset), G3 (the card already
   208	stops the recogniser), G5 (token-0 content was the real stop bug), F4 and H1 (features), F2/F3/G1/G2/G6 (small).
   209	
   210	**Also caught by Grok, added**: no wake lock — the app uses `setInterval` *because the phone dims*, which is the
   211	actual bedtime bug; and there are no tests for the write path all of §A depends on (needs an idb-keyval mock).
   212	
   213	**Execution order**: B1 · A3+H2 · A2 · A1+A4 · C2+C1 · D1–D4 · B4 · B2+B5 · E1+E3 · B3 · F1 · wake lock · G4-lite.

codex
The central gap is that the plan logs audio calls and analyses source clips, but never records the browser’s actual output. I also found concrete mismatches: read-back help bypasses the pace setting, and the offline blend renderer uses different fades and timing from the live player.
web search: 
web search: site.playwright.dev ignoreDefaultArgs mute-audio ...
web search: 
web search: https://playwright.dev/docs/api/class-browsertype
codex
**[P1] The plan can still pass while the app sounds wrong.** Its main weakness is the evidence chain: I2 records playback *requests*, I3 measures assets, and the blend renderer approximates production. None records and judges the final browser output. That repeats the conditions that allowed the original defects through.

I reviewed the requested files without modifying files or accessing the prohibited directories. The findings below distinguish implementation evidence from proposed checks; I did not audition a session.

**1. What the plan will miss**

The broad owner trials could discover almost anything, but these failure modes have no explicit, reliable detection method.

- **[P1] Correct files, wrong deployed experience.** Narration is generated into gitignored deployment assets, while the speed check targets `library/*/story.json`. Old cached audio paired with new timings can pass metadata checks, speak too fast, highlight incorrectly and disclose a magic word. Test the served bytes and service-worker upgrade path, including an existing installation—not just offline playback after one successful play. See [gen-audio.py:9](/Users/rish_ai/StoryTime/scripts/gen-audio.py:9), [gen-audio.py:79](/Users/rish_ai/StoryTime/scripts/gen-audio.py:79), [audit-plan.md:37](/Users/rish_ai/StoryTime/docs/audit-plan.md:37).

- **[P1] A pace control that applies inconsistently.** Story narration uses the family/bedtime rate, but moral read-back help calls `playBlend(r.graphemes)` without it; tricky-word help calls `speakText(words[i], {})`. A bedtime slow setting produces rate **0.748**, yet those help paths use their defaults. Vowel holds therefore change from approximately **562 ms to 420 ms**, and continuants from **695 ms to 520 ms**, just when the child needs help. The matrix needs settings × audio-path assertions. See [Story.tsx:68](/Users/rish_ai/StoryTime/src/screens/Story.tsx:68), [Story.tsx:353](/Users/rish_ai/StoryTime/src/screens/Story.tsx:353).

- **[P1] Robotic or misleading blends that pass the offline approximation.** The renderer uses linear fades and advances by `hold − fade × 0.5`; production uses exponential envelopes and a different overlap calculation. Its loop simulation also differs, and its continuant set omits grapheme aliases `ss/ff/ll`, which production includes. Thus `puff` can be classified differently in the supposed reference renderer. It also reads bundled WAVs rather than the family’s selected/trimmed recording. See [render-blend.py:16](/Users/rish_ai/StoryTime/scripts/audit/render-blend.py:16), [render-blend.py:68](/Users/rish_ai/StoryTime/scripts/audit/render-blend.py:68), [blend.ts:15](/Users/rish_ai/StoryTime/src/lib/blend.ts:15), [blend.ts:69](/Users/rish_ai/StoryTime/src/lib/blend.ts:69), [blend.ts:95](/Users/rish_ai/StoryTime/src/lib/blend.ts:95).

- **[P1] Correct pronunciation metadata, wrong audible instruction.** The generated shared prompt says “Can you read it?”, while the displayed caption instructs the child to start at the first sound and slide. Tone, accent consistency, word stress and these speech/caption discrepancies have no systematic comparison. See [gen-audio.py:96](/Users/rish_ai/StoryTime/scripts/gen-audio.py:96), [Story.tsx:142](/Users/rish_ai/StoryTime/src/screens/Story.tsx:142).

- **[P1] Cancellation succeeds briefly, then stale asynchronous work starts speaking.** `speakPrompt()` awaits the manifest before starting audio without checking whether its screen is still active. Skip also awaits a blend and then starts a prompt without a cancellation guard. A check only **200 ms after Home** misses speech starting **500 ms later**. Delay the manifest/decode response, leave, release the response, and observe through completion. See [Story.tsx:75](/Users/rish_ai/StoryTime/src/screens/Story.tsx:75), [Story.tsx:207](/Users/rish_ai/StoryTime/src/screens/Story.tsx:207).

- **[P1] Family-recording trims disappear in the fallback.** The Web Audio path applies `startMs/endMs`; the fallback passes only the recording URL to `playClip`, ignores pace, and moves on after **700 ms**. A recording containing room noise or spoken setup can therefore behave differently when Web Audio fails. Force that failure with a trimmed recording fixture. See [blend.ts:46](/Users/rish_ai/StoryTime/src/lib/blend.ts:46), [blend.ts:116](/Users/rish_ai/StoryTime/src/lib/blend.ts:116).

- **[P1] “Local” speech sends family text to a remote synthesizer.** Voice selection never checks `localService`. Page network logs are insufficient evidence about traffic initiated by a browser/OS speech service. Record the selected voice and test synthesis with host-level network denial. The Web Speech specification explicitly distinguishes local and remote voices. See [speech.ts:12](/Users/rish_ai/StoryTime/src/lib/audio/speech.ts:12), [audit-plan.md:119](/Users/rish_ai/StoryTime/docs/audit-plan.md:119), [Web Speech specification](https://webaudio.github.io/web-speech-api/#dom-speechsynthesisvoice-localservice).

- **[P2] Individually successful nights, permanently stalled learning.** Isolated sessions and correct database writes do not establish a functioning progression policy. Simulate **30 nights**: optional building repeatedly declined, failed reviews, snoozes, replaying taught sounds, and crossing the **3→4, 7→8 and 15→16** boundaries. Assert what becomes available and why. The v5 corrections explicitly identify bedtime building as essential advancement evidence. See [audit-plan.md:63](/Users/rish_ai/StoryTime/docs/audit-plan.md:63), [plan-v5.md:193](/Users/rish_ai/StoryTime/docs/plan-v5.md:193).

**2. Pass criteria that need changing**

The replacement numbers below are proposed engineering/product gates, not established developmental norms.

| Priority | Existing criterion | Problem and replacement |
|---|---|---|
| **[P1]** | One voice: F0 within **±50%** of median; [line 32](/Users/rish_ai/StoryTime/docs/audit-plan.md:32) | At a 140 Hz median, **70–210 Hz** passes—a 3:1 span. Different speakers can share F0; one speaker can vary it. Establish recording provenance and perceptual voice consistency. Use F0 only as an anomaly indicator. Pitch alone also cannot establish the claimed count of four speakers. |
| **[P1]** | Within-clip drift **<40 Hz**; [line 33](/Users/rish_ai/StoryTime/docs/audit-plan.md:33) | A 40 Hz rise is **33% at 120 Hz**, but **13% at 300 Hz**. Use a framewise contour, semitones and voicing confidence. More seriously, `measure()` returns drift **0** when either half has no F0 estimate: unknown becomes a pass. See [cut-phonemes.py:71](/Users/rish_ai/StoryTime/scripts/cut-phonemes.py:71). |
| **[P1]** | Vowel **≥150 ms**, stop **≤60 ms**; [line 35](/Users/rish_ai/StoryTime/docs/audit-plan.md:35) | Silence can satisfy either; a truncated stop can pass. Duration does not establish phoneme identity or absence of schwa. Require an identifiable intended phone, preserved release/voicing cues, and no added vowel or syllable. Use phone-specific reference ranges. |
| **[P1]** | Narration **110–135 WPM**, measured from JSON; [line 37](/Users/rish_ai/StoryTime/docs/audit-plan.md:37) | The source target and heard target are different. A 130 WPM file becomes **130, 114.4, 110.5 or 97.2 WPM** across the four settings combinations. Measure actual output separately for each preset. Treat **100–120 WPM at bedtime** as an initial owner-calibrated target, not a universal rule. |
| **[P1]** | Karaoke: median word-start gap **≥300 ms**; [line 38](/Users/rish_ai/StoryTime/docs/audit-plan.md:38) | Uniformly spaced **166 WPM** speech has approximately **361 ms** between words and passes. Entirely incorrect highlights can also pass. Compare visible highlight changes with independently aligned audible onsets: initial gate **p95 absolute error ≤100 ms**, maximum **≤200 ms**, with tighter handling at withheld words. |
| **[P1]** | No whole target before verdict; [line 40](/Users/rish_ai/StoryTime/docs/audit-plan.md:40) | It misses the first phoneme leaking. Timed narration polls every **40 ms** and stops at the target timestamp with no lead margin. Also, the affirmative handler speaks “Yes! target” *before* sending `YES`, so “verdict” needs a precise event definition. Require **zero audible target-phone leakage before assistance/answer authorization**, distinguishing first attempt, modelling and adult feedback. See [Story.tsx:99](/Users/rish_ai/StoryTime/src/screens/Story.tsx:99), [Story.tsx:205](/Users/rish_ai/StoryTime/src/screens/Story.tsx:205). |
| **[P1]** | No two starts within **50 ms**; [line 41](/Users/rish_ai/StoryTime/docs/audit-plan.md:41) | A ten-second narration and a prompt starting one second later overlap but pass. Immediately replacing a source can fail despite no overlap. Measure **audible interval intersections**, allowing only explicitly intended blends. |
| **[P2]** | RMS spread **<6 dB**; “2 notches”; [line 34](/Users/rish_ai/StoryTime/docs/audit-plan.md:34), [line 45](/Users/rish_ai/StoryTime/docs/audit-plan.md:45) | Six dB permits roughly **2× amplitude**; RMS does not equate a stop burst’s perceived loudness with a vowel’s. Measure narration/prompts using loudness metrics, short clips with active-window energy and peak/crest factor, and the final mix for clipping. “2 notches” requires a named device, output route and fixed distance. |
| **[P2]** | Never target token 0; sentence means **≥2 distinct words**; [line 52](/Users/rish_ai/StoryTime/docs/audit-plan.md:52) | The token-0 prohibition contradicts the final v5 correction allowing an initial CVC. “Cat dog” satisfies the sentence test. Require correct occurrence resolution, a meaningful sentence and an appropriate read-back task. See [plan-v5.md:179](/Users/rish_ai/StoryTime/docs/plan-v5.md:179). |
| **[P2]** | Word-tile contrast **3:1**; [line 113](/Users/rish_ai/StoryTime/docs/audit-plan.md:113) | Text needs **4.5:1** unless it qualifies as large text: **18 pt regular or 14 pt bold**. A tile is not itself an exemption. Check rendered states/backgrounds, not just design tokens. [WCAG contrast requirement](https://www.w3.org/TR/WCAG22/#contrast-minimum). |

Also, “owner’s yes/no—the only criterion that counts” is too weak for repeatability. Keep the owner’s judgment, but attach the exact recording, timestamp and rubric. Conversely, “every defect must leave a number” is too restrictive: a wrong phoneme needs an annotated audio regression fixture, not an invented scalar.

**3. A concrete method for hearing the real session**

**[P1] Add a browser-output recorder to I2.** Keep the API logs for attribution, but capture the final audio mix independently.

1. **Run the deployed production build in a pinned Linux browser environment with a dedicated PulseAudio sink.** Route both browser and native speech-service output there. Example setup for the future audit runner:

   ```sh
   pactl load-module module-null-sink sink_name=storytime_audit rate=48000 channels=2
   pactl set-default-sink storytime_audit
   ffmpeg -f pulse -sample_rate 48000 -channels 2 \
     -i storytime_audit.monitor -c:a pcm_s24le session.wav
   ```

   Verify every relevant sink input actually routes there; use an isolated audio server to exclude unrelated applications. PulseAudio provides monitor sources, and FFmpeg supports recording a named PulseAudio source. [PulseAudio modules](https://wiki.freedesktop.org/www/Software/PulseAudio/Documentation/User/Modules/), [FFmpeg documentation](https://www.ffmpeg.org/ffmpeg-devices.html#pulse).

2. **Launch headless Chromium with audio enabled.**

   ```js
   const browser = await chromium.launch({
     channel: "chromium",
     headless: true,
     ignoreDefaultArgs: ["--mute-audio"]
   });
   ```

   Use real UI taps to unlock playback; do not replace playback functions or force permissive autoplay. Playwright explicitly documents removing `--mute-audio`. [Browser launch documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-launch).

3. **Prove capture works before judging the app.** Independently exercise HTML audio, Web Audio and speech synthesis. Require audible samples from all supported paths and record browser, codec and voice details. An empty voice list or silent TTS is **unsupported coverage**, never proof that the app is silent. Do not substitute another TTS engine and claim to have tested the selected browser voice.

4. **Capture a continuous session with synchronized visuals.** Save lossless WAV, timestamped screen frames/video, DOM/accessibility state, actions, audio events and served asset hashes. Calibrate audio/video timing with a simultaneous visual/audio marker before the session. Preserve silences, waiting and transitions; do not normalize the master recording. Exercise narration → card → sound taps → model → retry/skip → reread → moral/help → Done → Home, including delayed and rapid interactions.

5. **Judge the recording in two passes.** First give an audio-capable evaluator the actual sound without the expected transcript or target word, asking what it hears and where it becomes unclear. Then supply synchronized visuals and intended text for comparison. Parent pass: “What must I do or say now?” Child pass: “Which letters am I meant to attend to, and what sound reaches me?” Require timestamped evidence; this simulates viewing perspectives, not a child’s comprehension.

Measure the following:

- **SPEED:** Independently transcribe, then align verified words to the captured waveform. Calculate **`60 × words / seconds`** from first audible word onset to last word offset, retaining natural phrase pauses but excluding adult interaction waits and file padding. Report each page and preset, fastest five-word span, syllables/second, speech-only articulation rate, and pause durations. Long silences must not disguise rushed phrases. Proposed initial bedtime gate: **100–120 WPM**, flag five-word spans above **150 WPM** and unexplained mid-phrase gaps above **1 second**. Do not apply page-WPM limits mechanically to “Your turn.”

- **TONE:** Measure voiced F0 median and p10–p90 range in **semitones**, phrase contours, intensity changes, phrase-final slowing, pause placement and voice/timbre transitions. Compare equivalent utterances against an owner-approved bedtime reference. Initially flag corresponding phrase loudness jumps above **3 LU** and sustained pitch shifts above **3 semitones** for review. These are anomaly flags; they cannot establish warmth. Separately score calmness, naturalness, warmth and absence of startling emphasis on an anchored **1–5** rubric, with examples and timestamps.

- **PRONUNCIATION:** Compare an independent transcription with the displayed text before forced alignment; alignment alone can force the intended words onto wrong speech. Audit names, tricky words, vowels and final consonants against the intended accent, plus agreement between narrator, prompts, isolated sounds and whole words. Require **zero unresolved target-word substitutions, added syllables or missing phones**. An ASR disagreement triggers listening review rather than automatic rejection.

- **PHONEME QUALITY BEYOND PITCH/LOUDNESS:** Inspect spectrograms and listen for vowel identity/formants, voicing, stop release and voice-onset timing, fricative spectra, nasal identity, aspiration and unwanted schwa. Check onset/tail truncation, breath/room noise, clipping and clicks at cuts and loop joins. Then assess intelligibility in actual blends and minimal-pair contrasts: `pat/bat`, `ten/den`, `cap/gap`, `sat/sad`. Test every taught sound and alias in the positions the library uses, at every effective pace and with family overrides. Sustaining a waveform cleanly does not establish that it sounds like a natural word.

This captures the browser’s real digital output. Phone speakers, mute behavior, Bluetooth and the family’s native voices still require a device pass; a desktop recording cannot certify those.

**4. Where to start**

**[P1] Start with one normal bedtime session on the deployed app, using the family’s actual settings.** Record it before promoting four instruments or running forty synthetic sessions. Include one deliberate “needs help” branch so the session crosses all audio systems.

**The single highest-value check is actual-output narration WPM for the first story page, measured from captured PCM and independently verified words.** It directly retests the reported 166-WPM failure and validates deployment, caching, playback rate and measurement together.

Then calibrate the harness against known bad examples: the old fast narration, mixed voices, a wrong same-pitch vowel, an added schwa, a loop click and a deliberately offset highlight. **[P1] An instrument that passes those examples cannot certify the repair.** Expand the matrix and longitudinal checks after that.
tokens used
61,842
**[P1] The plan can still pass while the app sounds wrong.** Its main weakness is the evidence chain: I2 records playback *requests*, I3 measures assets, and the blend renderer approximates production. None records and judges the final browser output. That repeats the conditions that allowed the original defects through.

I reviewed the requested files without modifying files or accessing the prohibited directories. The findings below distinguish implementation evidence from proposed checks; I did not audition a session.

**1. What the plan will miss**

The broad owner trials could discover almost anything, but these failure modes have no explicit, reliable detection method.

- **[P1] Correct files, wrong deployed experience.** Narration is generated into gitignored deployment assets, while the speed check targets `library/*/story.json`. Old cached audio paired with new timings can pass metadata checks, speak too fast, highlight incorrectly and disclose a magic word. Test the served bytes and service-worker upgrade path, including an existing installation—not just offline playback after one successful play. See [gen-audio.py:9](/Users/rish_ai/StoryTime/scripts/gen-audio.py:9), [gen-audio.py:79](/Users/rish_ai/StoryTime/scripts/gen-audio.py:79), [audit-plan.md:37](/Users/rish_ai/StoryTime/docs/audit-plan.md:37).

- **[P1] A pace control that applies inconsistently.** Story narration uses the family/bedtime rate, but moral read-back help calls `playBlend(r.graphemes)` without it; tricky-word help calls `speakText(words[i], {})`. A bedtime slow setting produces rate **0.748**, yet those help paths use their defaults. Vowel holds therefore change from approximately **562 ms to 420 ms**, and continuants from **695 ms to 520 ms**, just when the child needs help. The matrix needs settings × audio-path assertions. See [Story.tsx:68](/Users/rish_ai/StoryTime/src/screens/Story.tsx:68), [Story.tsx:353](/Users/rish_ai/StoryTime/src/screens/Story.tsx:353).

- **[P1] Robotic or misleading blends that pass the offline approximation.** The renderer uses linear fades and advances by `hold − fade × 0.5`; production uses exponential envelopes and a different overlap calculation. Its loop simulation also differs, and its continuant set omits grapheme aliases `ss/ff/ll`, which production includes. Thus `puff` can be classified differently in the supposed reference renderer. It also reads bundled WAVs rather than the family’s selected/trimmed recording. See [render-blend.py:16](/Users/rish_ai/StoryTime/scripts/audit/render-blend.py:16), [render-blend.py:68](/Users/rish_ai/StoryTime/scripts/audit/render-blend.py:68), [blend.ts:15](/Users/rish_ai/StoryTime/src/lib/blend.ts:15), [blend.ts:69](/Users/rish_ai/StoryTime/src/lib/blend.ts:69), [blend.ts:95](/Users/rish_ai/StoryTime/src/lib/blend.ts:95).

- **[P1] Correct pronunciation metadata, wrong audible instruction.** The generated shared prompt says “Can you read it?”, while the displayed caption instructs the child to start at the first sound and slide. Tone, accent consistency, word stress and these speech/caption discrepancies have no systematic comparison. See [gen-audio.py:96](/Users/rish_ai/StoryTime/scripts/gen-audio.py:96), [Story.tsx:142](/Users/rish_ai/StoryTime/src/screens/Story.tsx:142).

- **[P1] Cancellation succeeds briefly, then stale asynchronous work starts speaking.** `speakPrompt()` awaits the manifest before starting audio without checking whether its screen is still active. Skip also awaits a blend and then starts a prompt without a cancellation guard. A check only **200 ms after Home** misses speech starting **500 ms later**. Delay the manifest/decode response, leave, release the response, and observe through completion. See [Story.tsx:75](/Users/rish_ai/StoryTime/src/screens/Story.tsx:75), [Story.tsx:207](/Users/rish_ai/StoryTime/src/screens/Story.tsx:207).

- **[P1] Family-recording trims disappear in the fallback.** The Web Audio path applies `startMs/endMs`; the fallback passes only the recording URL to `playClip`, ignores pace, and moves on after **700 ms**. A recording containing room noise or spoken setup can therefore behave differently when Web Audio fails. Force that failure with a trimmed recording fixture. See [blend.ts:46](/Users/rish_ai/StoryTime/src/lib/blend.ts:46), [blend.ts:116](/Users/rish_ai/StoryTime/src/lib/blend.ts:116).

- **[P1] “Local” speech sends family text to a remote synthesizer.** Voice selection never checks `localService`. Page network logs are insufficient evidence about traffic initiated by a browser/OS speech service. Record the selected voice and test synthesis with host-level network denial. The Web Speech specification explicitly distinguishes local and remote voices. See [speech.ts:12](/Users/rish_ai/StoryTime/src/lib/audio/speech.ts:12), [audit-plan.md:119](/Users/rish_ai/StoryTime/docs/audit-plan.md:119), [Web Speech specification](https://webaudio.github.io/web-speech-api/#dom-speechsynthesisvoice-localservice).

- **[P2] Individually successful nights, permanently stalled learning.** Isolated sessions and correct database writes do not establish a functioning progression policy. Simulate **30 nights**: optional building repeatedly declined, failed reviews, snoozes, replaying taught sounds, and crossing the **3→4, 7→8 and 15→16** boundaries. Assert what becomes available and why. The v5 corrections explicitly identify bedtime building as essential advancement evidence. See [audit-plan.md:63](/Users/rish_ai/StoryTime/docs/audit-plan.md:63), [plan-v5.md:193](/Users/rish_ai/StoryTime/docs/plan-v5.md:193).

**2. Pass criteria that need changing**

The replacement numbers below are proposed engineering/product gates, not established developmental norms.

| Priority | Existing criterion | Problem and replacement |
|---|---|---|
| **[P1]** | One voice: F0 within **±50%** of median; [line 32](/Users/rish_ai/StoryTime/docs/audit-plan.md:32) | At a 140 Hz median, **70–210 Hz** passes—a 3:1 span. Different speakers can share F0; one speaker can vary it. Establish recording provenance and perceptual voice consistency. Use F0 only as an anomaly indicator. Pitch alone also cannot establish the claimed count of four speakers. |
| **[P1]** | Within-clip drift **<40 Hz**; [line 33](/Users/rish_ai/StoryTime/docs/audit-plan.md:33) | A 40 Hz rise is **33% at 120 Hz**, but **13% at 300 Hz**. Use a framewise contour, semitones and voicing confidence. More seriously, `measure()` returns drift **0** when either half has no F0 estimate: unknown becomes a pass. See [cut-phonemes.py:71](/Users/rish_ai/StoryTime/scripts/cut-phonemes.py:71). |
| **[P1]** | Vowel **≥150 ms**, stop **≤60 ms**; [line 35](/Users/rish_ai/StoryTime/docs/audit-plan.md:35) | Silence can satisfy either; a truncated stop can pass. Duration does not establish phoneme identity or absence of schwa. Require an identifiable intended phone, preserved release/voicing cues, and no added vowel or syllable. Use phone-specific reference ranges. |
| **[P1]** | Narration **110–135 WPM**, measured from JSON; [line 37](/Users/rish_ai/StoryTime/docs/audit-plan.md:37) | The source target and heard target are different. A 130 WPM file becomes **130, 114.4, 110.5 or 97.2 WPM** across the four settings combinations. Measure actual output separately for each preset. Treat **100–120 WPM at bedtime** as an initial owner-calibrated target, not a universal rule. |
| **[P1]** | Karaoke: median word-start gap **≥300 ms**; [line 38](/Users/rish_ai/StoryTime/docs/audit-plan.md:38) | Uniformly spaced **166 WPM** speech has approximately **361 ms** between words and passes. Entirely incorrect highlights can also pass. Compare visible highlight changes with independently aligned audible onsets: initial gate **p95 absolute error ≤100 ms**, maximum **≤200 ms**, with tighter handling at withheld words. |
| **[P1]** | No whole target before verdict; [line 40](/Users/rish_ai/StoryTime/docs/audit-plan.md:40) | It misses the first phoneme leaking. Timed narration polls every **40 ms** and stops at the target timestamp with no lead margin. Also, the affirmative handler speaks “Yes! target” *before* sending `YES`, so “verdict” needs a precise event definition. Require **zero audible target-phone leakage before assistance/answer authorization**, distinguishing first attempt, modelling and adult feedback. See [Story.tsx:99](/Users/rish_ai/StoryTime/src/screens/Story.tsx:99), [Story.tsx:205](/Users/rish_ai/StoryTime/src/screens/Story.tsx:205). |
| **[P1]** | No two starts within **50 ms**; [line 41](/Users/rish_ai/StoryTime/docs/audit-plan.md:41) | A ten-second narration and a prompt starting one second later overlap but pass. Immediately replacing a source can fail despite no overlap. Measure **audible interval intersections**, allowing only explicitly intended blends. |
| **[P2]** | RMS spread **<6 dB**; “2 notches”; [line 34](/Users/rish_ai/StoryTime/docs/audit-plan.md:34), [line 45](/Users/rish_ai/StoryTime/docs/audit-plan.md:45) | Six dB permits roughly **2× amplitude**; RMS does not equate a stop burst’s perceived loudness with a vowel’s. Measure narration/prompts using loudness metrics, short clips with active-window energy and peak/crest factor, and the final mix for clipping. “2 notches” requires a named device, output route and fixed distance. |
| **[P2]** | Never target token 0; sentence means **≥2 distinct words**; [line 52](/Users/rish_ai/StoryTime/docs/audit-plan.md:52) | The token-0 prohibition contradicts the final v5 correction allowing an initial CVC. “Cat dog” satisfies the sentence test. Require correct occurrence resolution, a meaningful sentence and an appropriate read-back task. See [plan-v5.md:179](/Users/rish_ai/StoryTime/docs/plan-v5.md:179). |
| **[P2]** | Word-tile contrast **3:1**; [line 113](/Users/rish_ai/StoryTime/docs/audit-plan.md:113) | Text needs **4.5:1** unless it qualifies as large text: **18 pt regular or 14 pt bold**. A tile is not itself an exemption. Check rendered states/backgrounds, not just design tokens. [WCAG contrast requirement](https://www.w3.org/TR/WCAG22/#contrast-minimum). |

Also, “owner’s yes/no—the only criterion that counts” is too weak for repeatability. Keep the owner’s judgment, but attach the exact recording, timestamp and rubric. Conversely, “every defect must leave a number” is too restrictive: a wrong phoneme needs an annotated audio regression fixture, not an invented scalar.

**3. A concrete method for hearing the real session**

**[P1] Add a browser-output recorder to I2.** Keep the API logs for attribution, but capture the final audio mix independently.

1. **Run the deployed production build in a pinned Linux browser environment with a dedicated PulseAudio sink.** Route both browser and native speech-service output there. Example setup for the future audit runner:

   ```sh
   pactl load-module module-null-sink sink_name=storytime_audit rate=48000 channels=2
   pactl set-default-sink storytime_audit
   ffmpeg -f pulse -sample_rate 48000 -channels 2 \
     -i storytime_audit.monitor -c:a pcm_s24le session.wav
   ```

   Verify every relevant sink input actually routes there; use an isolated audio server to exclude unrelated applications. PulseAudio provides monitor sources, and FFmpeg supports recording a named PulseAudio source. [PulseAudio modules](https://wiki.freedesktop.org/www/Software/PulseAudio/Documentation/User/Modules/), [FFmpeg documentation](https://www.ffmpeg.org/ffmpeg-devices.html#pulse).

2. **Launch headless Chromium with audio enabled.**

   ```js
   const browser = await chromium.launch({
     channel: "chromium",
     headless: true,
     ignoreDefaultArgs: ["--mute-audio"]
   });
   ```

   Use real UI taps to unlock playback; do not replace playback functions or force permissive autoplay. Playwright explicitly documents removing `--mute-audio`. [Browser launch documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-launch).

3. **Prove capture works before judging the app.** Independently exercise HTML audio, Web Audio and speech synthesis. Require audible samples from all supported paths and record browser, codec and voice details. An empty voice list or silent TTS is **unsupported coverage**, never proof that the app is silent. Do not substitute another TTS engine and claim to have tested the selected browser voice.

4. **Capture a continuous session with synchronized visuals.** Save lossless WAV, timestamped screen frames/video, DOM/accessibility state, actions, audio events and served asset hashes. Calibrate audio/video timing with a simultaneous visual/audio marker before the session. Preserve silences, waiting and transitions; do not normalize the master recording. Exercise narration → card → sound taps → model → retry/skip → reread → moral/help → Done → Home, including delayed and rapid interactions.

5. **Judge the recording in two passes.** First give an audio-capable evaluator the actual sound without the expected transcript or target word, asking what it hears and where it becomes unclear. Then supply synchronized visuals and intended text for comparison. Parent pass: “What must I do or say now?” Child pass: “Which letters am I meant to attend to, and what sound reaches me?” Require timestamped evidence; this simulates viewing perspectives, not a child’s comprehension.

Measure the following:

- **SPEED:** Independently transcribe, then align verified words to the captured waveform. Calculate **`60 × words / seconds`** from first audible word onset to last word offset, retaining natural phrase pauses but excluding adult interaction waits and file padding. Report each page and preset, fastest five-word span, syllables/second, speech-only articulation rate, and pause durations. Long silences must not disguise rushed phrases. Proposed initial bedtime gate: **100–120 WPM**, flag five-word spans above **150 WPM** and unexplained mid-phrase gaps above **1 second**. Do not apply page-WPM limits mechanically to “Your turn.”

- **TONE:** Measure voiced F0 median and p10–p90 range in **semitones**, phrase contours, intensity changes, phrase-final slowing, pause placement and voice/timbre transitions. Compare equivalent utterances against an owner-approved bedtime reference. Initially flag corresponding phrase loudness jumps above **3 LU** and sustained pitch shifts above **3 semitones** for review. These are anomaly flags; they cannot establish warmth. Separately score calmness, naturalness, warmth and absence of startling emphasis on an anchored **1–5** rubric, with examples and timestamps.

- **PRONUNCIATION:** Compare an independent transcription with the displayed text before forced alignment; alignment alone can force the intended words onto wrong speech. Audit names, tricky words, vowels and final consonants against the intended accent, plus agreement between narrator, prompts, isolated sounds and whole words. Require **zero unresolved target-word substitutions, added syllables or missing phones**. An ASR disagreement triggers listening review rather than automatic rejection.

- **PHONEME QUALITY BEYOND PITCH/LOUDNESS:** Inspect spectrograms and listen for vowel identity/formants, voicing, stop release and voice-onset timing, fricative spectra, nasal identity, aspiration and unwanted schwa. Check onset/tail truncation, breath/room noise, clipping and clicks at cuts and loop joins. Then assess intelligibility in actual blends and minimal-pair contrasts: `pat/bat`, `ten/den`, `cap/gap`, `sat/sad`. Test every taught sound and alias in the positions the library uses, at every effective pace and with family overrides. Sustaining a waveform cleanly does not establish that it sounds like a natural word.

This captures the browser’s real digital output. Phone speakers, mute behavior, Bluetooth and the family’s native voices still require a device pass; a desktop recording cannot certify those.

**4. Where to start**

**[P1] Start with one normal bedtime session on the deployed app, using the family’s actual settings.** Record it before promoting four instruments or running forty synthetic sessions. Include one deliberate “needs help” branch so the session crosses all audio systems.

**The single highest-value check is actual-output narration WPM for the first story page, measured from captured PCM and independently verified words.** It directly retests the reported 166-WPM failure and validates deployment, caching, playback rate and measurement together.

Then calibrate the harness against known bad examples: the old fast narration, mixed voices, a wrong same-pitch vowel, an added schwa, a loop click and a deliberately offset highlight. **[P1] An instrument that passes those examples cannot certify the repair.** Expand the matrix and longitudinal checks after that.
