# StoryTime plan v5 — end-to-end review fixes (2026-09-11, night)

Sources: two Opus reviews (state/data, and K-1 teacher + parent) plus a hands-on pass driving both modes
end to end in a 390×844 phone viewport. Transcripts: docs/reviews/opus-state-v5.md, docs/reviews/opus-pedagogy-v5.md.
Verified by hand before planning: the three worst claims below are real (repro noted).

Context: a grown-up reads the story aloud; a 4-year-old reads the decodable "magic words". Modes:
"Nani reads" (recorded narration, karaoke, stops before each magic word) and "I read" (sound off,
grown-up reads, child taps the pink word). Everything is local to the phone; the adult judges every verdict.

## A. Data integrity and the progression ladder (P1 — silently wrong today)

A1. **The first read of any story throws away the build evidence.** `store.ts:72` `recordEncoding` returns when
    the progress row does not exist yet, but the row is only created by `recordFinish` at the end of the story.
    Since `todayFor` prefers unfinished stories, a family reading a new book each night records zero successful
    builds; `readyToAdvance` requires one within 7 days, so the next sound is never offered.
    Fix: create the row when absent. Test: encoding then finish on a fresh slug keeps both.

A2. **A failed read on boot replaces the real family with fresh defaults and saves them.** `family.tsx:69` catches,
    calls `setKids(defaultKids())` (the `!kids.length` guard always passes: that closure's `kids` is `[]`), then
    `ready` flips and the two save effects (`:94`, `:96`) persist the defaults over the real kids and settings.
    Fix: a `loadedOk` ref set only inside the try; both save effects gated on it; never seed defaults on the fatal path.

A3. **Magic words resolving to the first token or a proper name.** `Story.tsx:79` `targetIdx` takes the first
    normalised match. Repro in the library: `pat-and-the-tap` p5 `pat`→token 0 `"Pat"` (ms 111),
    `tap-tap-tap` p4 `tap`→token 0 `"Tap!"` (ms 111), `sam-and-the-pit` p5 `dad`→token 4 `"Dad"`. In listen mode
    `stopMsAt()` is then 111 ms, so the page blips and the card opens before the child has heard the page; and the
    child is shown a lowercased proper name to decode. These are the only three books a beginner has.
    Fix: prefer the first lowercase occurrence, fall back to the first occurrence only if there is none; add a
    library test asserting no resolved target is index 0 or capitalised.

A4. **`finish` is not atomic and the build races it.** `Story.tsx:354` fires `onBuilt()` (read-modify-write of
    `st:progress:<kid>`) and `onYes()` in the same handler; `onYes` drives `done`, whose effect calls `finish`
    (another read-modify-write of the same key). Whichever save lands second wins the whole object.
    Fix: await the encoding before advancing; clear the session inside the try in `finish`.

A5. **`pendingBuild` compares against the earliest failure**, so fail → succeed → fail never comes back
    (`family.tsx:104`). Fix: compare against the latest failure per word.

A6. **Review scheduling drifts across midnight** (`store.ts:108,115`): a word missed at 00:15 is due the day after
    tomorrow; a success at 20:00 with interval 3 comes due mid-session. Fix: anchor both to 05:00 of the target
    day; treat a session before 05:00 as the previous day.

A7. **`removeKid` orphans progress/attempts/review keys** and can leave the app with no active child, which throws
    in `WarmUp.tsx:14` and `AddStory.tsx:34` (both call `learnerOf` above their own null guard).
    Fix: delete all four keys, drop the in-memory session, null-guard both screens.

A8. **`shaky` disagrees with `scheduleReview` about "needed help"** (`family.tsx:79` ignores `prompted`).
    Fix: include `prompted`.

## B. The nightly ritual (P1 — the family's experience)

B1. **Nights 1–3 have no story at all.** Answer Welcome honestly ("none yet"), teach `s`, and Home says
    "Four sounds, then the first story. 3 to go." Zero books fit under 4 sounds; the bookshelf is entirely locked.
    Fix: below 4 sounds the reader gets the listener-shaped session on any book — narration, a per-page talk
    prompt, tap-a-word — with honest copy: "Tonight Nani reads it all. Your first magic word comes in 3 sleeps."
    No decoding claim is made and nothing is recorded as a word result.

B2. **A tap on a book while words are due does nothing.** `Library.tsx:22` returns silently; the book looks
    enabled. Fix: open the warm-up from that tap (or say "two words first — 40 seconds"), never swallow it.

B3. **One hard word blocks the story every night forever.** `store.ts:114` reschedules a failed word to tomorrow
    with no back-off and no retirement, and the warm-up is the only way to the story.
    Fix: after 3 failed returns, retire the word ("comes back when ck is stronger"); a one-tap "not tonight" on the
    warm-up that records nothing.

B4. **"skip building today" is recorded as a failure** (`SegmentPanel.tsx:56` → `onDone(false)`), which schedules
    the word for tomorrow, pins it as `pendingBuild` forever and blocks advancement. It cannot tell "wrong" from
    "not tonight". Fix: three outcomes — Spelled it / Try together / Not tonight (records nothing). Suppress the
    build entirely in bedtime mode.

B5. **The big story tile is not tappable** — the obvious target on Home does nothing (verified by driving).
    Fix: make the tile start the default mode.

B6. **No way to repeat or go back a page, in either mode, and no "Again" on Done.** Fix: a "↺ this page" control
    in the readbar (listen mode replays, read mode just re-arms), a back-a-page control, and "Read it again" on Done.

## C. The word card and the adult script (P1)

C1. **In "I read", the modelling instruction is painted behind the panel.** `panelOpen` stays true through
    `modelling`; the caption bar (z-index 4) sits under the panel (z-index 5), and read mode is deliberately
    silent. At the moment a non-phonics parent taps "Show me", they get a silent sweep and no instruction.
    Fix: render the adult script inside `MagicPanel` whenever the panel is open; keep the caption for listen mode.

C2. **The card cannot be dismissed without a verdict.** In read mode the pink word is live from page open, so a
    sibling's tap opens a card whose only exits are a false ✓, a false skip, or leaving the story.
    Fix: a "↓ not yet" that returns to narrating and records nothing.

C3. **"wait 5 seconds" with no timer, and the two prohibitions shown only after the parent has broken them.**
    Fix: a silent 5-second ring on the card before the verdict buttons arm, with "don't give the first sound"
    and "no guessing from the picture" visible on the first card, not only after "Needs help".

## D. "I'll try" quarantine (P1)

D1. It offers a second copy of the page's own magic word (`tap-tap-tap` p1, `sam-and-the-pit` p2) because `taken`
    is only the first occurrence; and the capital guard exempts index 0, so `Pat` (a name) is offered.
    Fix: exclude every token whose normalised form is a magic word on the page; drop the `i > 0` exemption.

D2. Its result is scored exactly like a designed magic word: it feeds `recordAttempt` (the advancement gate) and
    `scheduleReview`. A child who volunteers and stumbles is held back; one who declines is not.
    Fix: `extra: true` on the result; excluded from `recordAttempt`; celebrated by name on Done.

D3. The card it opens is titled "Magic word · Veer's turn" — indistinguishable from the designed word.
    Fix: its own kicker ("Extra word · you asked for this one") and a softer verdict pair.

D4. Not suppressed in bedtime mode, against the plan's own rule. Fix: add `&& !bedtime`.

## E. The teach routine (P1)

E1. **"Replay today's sound: s" teaches the next sound instead.** Home labels from `kid.gpcs.at(-1)`;
    `TeachSound.tsx:23` always targets `LS_PHASE2_ORDER[kid.gpcs.length]`. The parent walks six steps for `a`
    with "mark it taught anyway" under the disabled button — two new sounds on day one, which is exactly what the
    one-per-day rule exists to prevent. Fix: pass the target grapheme in; replay shows steps 1–3 and has no
    "Taught today" button.

E2. **The routine is unreachable at 5+ sounds when not ready**, yet Settings tells the parent to use it.
    Fix: a permanent "Sounds: teach or replay" entry in Settings and on Home; readiness stays a recommendation.

E3. **The Settings level dropdown changes sounds without the matching tricky words**, so a child set to 16 sounds
    still fails `fits()` on all seven set-4 books. Fix: apply the same tricky ladder Welcome uses.

## F. What the child and the parent see (P2, high value)

F1. **Done ends on a list of failures.** Fix: the child-facing screen shows only what went right, at size; the
    full ledger moves behind a "grown-up: tonight's words" disclosure.

F2. **The counters labelled "magic words" count something else** (stored results include extras; Settings sums only
    the latest run per story, so the number can go down). Fix: count designed words from `page.magic`, exclude
    extras, and label the Settings figure as "this month" or make it cumulative.

F3. **"night N of 30" is one too high after tonight's story is finished** (`family.tsx:103` + `Home.tsx:42`).
    Fix: drop the `+1` when today is already counted.

F4. **A "My sounds" wall** — the sounds the child knows and the words they have read first-try, big, for showing a
    grandparent. This is the only persistent thing that belongs to the child, and it doubles as the parent's
    morning report. (Planned in docs/plan.md and never built.)

## G. Lifecycle and leaks (P2)

G1. `RecordSounds` never releases the microphone on unmount and leaks a blob URL per preview.
G2. `AddStory`'s tap-along playback keeps playing after the screen closes.
G3. Voice follow's `stopAt` is a stale closure: once the pink word is answered the cursor freezes for the page.
G4. Finger-follow's cursor only accepts exactly `cursor + 1`, so a finger that skips a word (or returns to the next
    line) freezes the trail for the rest of the page. Fix: advance to the furthest word before the block.
G5. Timed narration stops with zero margin before the magic word (`Story.tsx:96`), unlike the untimed path's 350 ms.
    Fix: a 120 ms lead-out so a boundary drift cannot leak the word's first phoneme.
G6. `Library` "start another story" is hard-coded to listen, bypassing the mode picker.

## H. Content (P2)

H1. Nights 5–24 run on three books (4–7 sounds → 2, 8–15 → 3, 16+ → 10). The whole set-3 block unlocks nothing.
    Fix: write two set-2/set-3 originals (`pit dad nap dig dog pot cot kid sock`), validator-checked.
H2. Two read-back lines are degenerate: `tap-tap-tap` is "Tap, tap, tap." (one word three times) and
    `pat-and-the-tap` is "Pat sat." (not a moral) — and these are the first two books a beginner meets.
H3. A family story with no magic words can become tonight's story, leaving the child one line to read.

## Out of scope, stated honestly
- Real illustrations. Every page is one emoji; a bedtime book for this age is half picture. This needs art assets,
  not code, and is the largest remaining gap.
- A job for the sibling who is physically present during the reader's session (they have a profile, not a role).

## Order of execution
1. A1–A3 (data loss and the blocked ladder), then A4–A8.
2. B1, B4, B2, B5, B6 (the ritual), then C1–C3 (the card), D1–D4 (quarantine), E1–E3 (teach).
3. F1–F3, G1–G6.
4. H1–H3 and F4 if the night allows; anything not done is listed in docs/state.md as not done.

## Rules that must hold (unchanged)
Never TTS for phoneme clips. No red/buzzer on a miss. Validator fails closed. Don't remove a feature to satisfy a
reviewer. Neutral names in the public repo. The adult keeps every verdict; nothing the app hears judges the child.

---

# v5 FINAL — after Grok's review (docs/reviews/grok-plan-v5.md)

Grok found several of the fixes above to be the wrong patch. Corrections, and the order actually executed:

**Corrected fixes**
- A3: "prefer lowercase" only repairs 1 of the 3 books. Ship ONE `resolveMagic(page, word)` used by both call sites
  (`Story.tsx:79` and `:220` are the same bug implemented twice), AND rewrite the two pages the heuristic cannot
  save (`tap-tap-tap` p4, `sam-and-the-pit` p5). The library assertion is "the resolved token is not capitalised",
  not "index > 0" (a page may legally start with a CVC).
- A2: keep seeding in-memory defaults (the "read tonight without saving" escape hatch needs them); gate only the
  two SAVE effects on a `loadedOk` ref.
- A4: it is two races, and it no-ops without A1. Ship A1+A4 as one atomic encoding write; `saveSession` is already
  inside `finish`'s try.
- B1: do not add machine states, do not flip `role`, do not call `recordFinish` as today. `listenAlong =
  role==="reader" && gpcs.length < 4`; tonight's tile pinned to the same set-1 book (not "any book");
  `recordFinish(..., { listenOnly: true })` stamps `history` and `lastFinished` but leaves `timesFinished` 0 and
  writes no results/attempt/review, so night 4 still gets that book as the first decoding night.
- B3: "retire until ck is stronger" is wrong (tap is set 1, ck is set 4) and a no-op unless `scheduleReview`
  honours it. Ship "not tonight" as a `snoozeUntil` that clears the gate for tonight only.
- B4: do not suppress the build at bedtime — with A1 that is the only advancement evidence and this family only
  reads at bedtime. Keep it optional there, defaulting to "Not tonight".
- B5: the tile must route to the warm-up when words are due, or it bypasses the gate B2/B3 protect.
- B2: opening the warm-up is not enough; hand the tapped slug through so the book they tapped is what starts.
- C3: drop the hard 5-second lock (MagicPanel is shared with the warm-up; 15–25 s of added waiting). Keep the two
  prohibitions, visible on the first card.
- D2: `extra` leaks into more sinks than the plan named. One `designed(results)` helper used by `recordAttempt`,
  `scheduleReview`, `shaky`, `buildWord`, Settings and Done.
- E1: replay keeps steps 1–4 (the trace matters); it drops only "Taught today" and the next level's tricky word.
- G4: `advanceCursor`'s strict `cursor+1` is the documented design. Narrow fix only: a NEW touch that lands ahead
  re-syncs the cursor; within one continuous slide the strict rule stands.

**Dropped or deferred** (stated honestly rather than half-done): A6 (day boundary needs one `dayStamp` helper
across six call sites, not a two-line change), A7 (unreachable from the UI; orphan keys are hygiene), A8 (a product
choice, not corruption), B6 "Again" (collides with `finishedRef`; needs a page/results reset), G3 (the card already
stops the recogniser), G5 (token-0 content was the real stop bug), F4 and H1 (features), F2/F3/G1/G2/G6 (small).

**Also caught by Grok, added**: no wake lock — the app uses `setInterval` *because the phone dims*, which is the
actual bedtime bug; and there are no tests for the write path all of §A depends on (needs an idb-keyval mock).

**Execution order**: B1 · A3+H2 · A2 · A1+A4 · C2+C1 · D1–D4 · B4 · B2+B5 · E1+E3 · B3 · F1 · wake lock · G4-lite.
