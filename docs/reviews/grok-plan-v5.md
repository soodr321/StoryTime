I'll start by reading the review skill and the plan, then go through every file the plan names so the critique is grounded in the actual code.The `/review` skill is for code diffs, not a plan critique — I'll read the named files and the surrounding machine/data model myself.The named files match the plan’s claims on the surface; next I’ll check tests, routing, and the review transcripts so I can challenge the plan’s diagnosis, not just restating it.A3’s “prefer lowercase” heuristic already looks incomplete against the actual books — I’ll verify the rest of the claims the same way.The plan is a strong bug list with accurate line numbers and three real, hand-verified failures. As a *fix plan* it is not safe to execute as written. Several “fixes” are the wrong patch, several will break a path that currently works, and the execution order is written for the reviewers’ taxonomy rather than for a 4-year-old at bedtime tonight.

---

## 1. Fixes that are wrong, risky, or will break something that works

### [P1] A3 — “prefer lowercase” does not fix two of the three cited books, and the proposed test is false

The diagnosis is real. `targetIdx` at `src/screens/Story.tsx:79` is first-normalised-match, so:

- `library/pat-and-the-tap/story.json` p5 `magic: ["pat"]` → token 0 `"Pat"` (`ms: 111`)
- `library/tap-tap-tap/story.json` p4 `magic: ["tap"]` → token 0 `"Tap!"` (`ms: 111`)
- `library/sam-and-the-pit/story.json` p5 `magic: ["dad"]` → token 4 `"Dad"` (`ms: 2125`)

Preferring the first lowercase token only repairs **Pat and the Tap p5** (there is a later `"pat,"`). It does **not** repair Tap, Tap, Tap p4 (no later `tap`) or Sam p5 (no later `dad`). After the planned change, listen mode still stops at 111 ms on p4 and the card still opens on a name on p5.

The proposed library test — “no resolved target is index 0 or capitalised” — is the wrong invariant:

- A page that *starts* with a genuine CVC (`sat on the step`) is legal and would fail.
- Two of the three cited pages still fail it after the resolver change, unless you also rewrite the JSON, which A3 never lists.
- `scripts/validate-library.test.ts:59` already documents the opposite rule: first occurrence is the target.

This is a **content** bug. Token 0 as the magic word makes `stopMsAt()` at `Story.tsx:96` equal `tokMs(0) ≈ 111`, so the page blips. G5’s 120 ms lead-out does not help: 111 − 120 is still “stop immediately”.

Worse: the resolver is **duplicated**. `StoryView` rebuilds the same `findIndex` at `Story.tsx:220` as `firstIdx`. Fixing only line 79 desyncs listen-mode stop from read-mode pink highlight. `pickIllTry` is fed that same `firstIdx` (`:246`), so on Pat p5 today the extra word *is* the intended `"pat,"`. A3 and D1 are one bug.

**Do this instead:** extract one `resolveMagic(page, word)` used at `:79`, `:220`, and as `taken` for D1. Prefer the first token whose display form is not capitalised; if none, keep the first match. Then **rewrite the two pages the heuristic cannot save** (a clause before `"Tap!"`; retarget Sam p5 off `Dad`). Put the real test in `scripts/validate-library.test.ts`: resolved index > 0, and the matched token is not `^[A-Z]`.

### [P1] B1 — “any book, listener-shaped, nothing recorded as a word result” will skip the first decoding night

`todayFor` (`family.tsx:80`) returns null because `storiesFor` (`:77`) filters `fits()`, and no story fits under 4 sounds. That part is right.

The fix as written will break the ladder:

- `Story.tsx:144` always calls `fam.finish` on `done`. `recordFinish` (`store.ts:64`) increments `timesFinished` and writes `history`.
- `todayFor` treats `progress[slug]` as finished (`family.tsx:87`). If nights 1–3 “finish” Pat and the Tap as a listen-along, night 4 (first decoding night) **will not get that book**.
- “Any book” can serve Fox and Crow to a child who knows `s`. Honest copy does not undo that choice.
- Reusing `kid.role === "listener"` (`Story.tsx:37`) persists a role. Welcome/Settings will then think the reader is the sibling.

Do **not** add machine states. Do **not** flip `role`. Pin tonight’s tile to the same set-1 book; session-local `listenAlong`; `recordFinish({ listenOnly: true })` that stamps `history` but leaves `timesFinished === 0`. Details in §4.

### [P1] A2 — “never seed defaults on the fatal path” breaks the escape hatch

The wipe is real. The boot `catch` at `family.tsx:69` closes over `kids === []`, so `setKids(defaultKids())` always runs, then `ready` flips and the save effects at `:94` and `:96` persist defaults over real data.

The proposed “never seed” collides with `App.tsx:28` (“Read tonight without saving”). That path needs in-memory kids. If `kids` stays `[]`, `Home.tsx:32` returns `null` and the family stares at a header.

Gate **saves** on `loadedOk`. Still seed in-memory defaults when `ignoreFatal` is used. Never `saveKids` / `saveSettings` unless the try-path completed.

### [P1] A4 is incomplete without A1, and it is two races, not one

`Story.tsx:354` fires `onBuilt` (`encodingDone`) and `onYes` (`LINE_YES` → `done` → `finish`) in the same handler. `recordEncoding` and `recordFinish` are both read-modify-write of `st:progress:<kid>`. `encodingDone` on failure also `scheduleReview`s (`family.tsx:101`), and `finish` `scheduleReview`s the story results (`:113`) — a second race on `st:review:<kid>`.

“Await encoding before advancing” without A1 still no-ops: `recordEncoding` (`store.ts:72`) returns when the row does not exist, which is exactly the first-read case. `saveSession` is already inside `finish`’s `try` (`family.tsx:113`); that part of the plan is already done.

One write: `recordEncoding` creates a stub row if missing; Moral `await`s `encodingDone` before `LINE_YES`; `recordFinish` keeps `...prev` (it already does). Do not invent a second session-clear.

### [P1] B4 + bedtime-only family vs A1 — suppressing the build deadlocks the ladder again

`SegmentPanel.tsx:56` `onDone(false)` is a real false failure. Three outcomes are right.

“Suppress the build entirely in bedtime mode” plus A1 means a family that only ever opens this app after dinner **never stores encoding**, and `readyToAdvance` (`store.ts:90`) never goes true. That is this family.

Keep a 20-second optional build at bedtime, defaulting to “Not tonight” (records nothing). Do not hide the only advancement evidence behind a mode they will not leave.

### [P1] B3 retirement is unspecified and will bounce

`scheduleReview` (`store.ts:114`) really does send every miss to tomorrow with interval 1, and Home/Library really do gate on `review.length`. A one-tap “not tonight” that “records nothing” leaves `due <= now`, so the gate is still there tomorrow morning.

“Comes back when ck is stronger” is the wrong trigger: `tap` is a set-1 word; `ck` is set 4 (`learner.ts:7-11`). Retirement that does not also change `scheduleReview` is undone the next time the word is a magic word (it still is). Without a `snoozeUntil` (tonight’s gate) and a `retired` flag that `scheduleReview` honours, this fix is a no-op or a lurker.

### [P1] B5 as written bypasses the warm-up

`Home.tsx:64` is a `div role="group"` — the tile is inert. Making it “start the default mode” while `review.length > 0` (the warm-up card is **below** the tile, `:78`) skips the only gate B2/B3 are trying to preserve. The tile must call `onWarmUp` when words are due, else `onStart(today, bedtime ? "listen" : "listen", false)`.

### [P1] B2 does not thread through to the tapped book

`Library.tsx:22` swallows the tap. Opening warm-up is right. `WarmUp.tsx:27` then `onDone` → Home (`App.tsx:46`), and Home’s `todayFor` may not be the book they tapped. You need `onWarmUp` on `LibraryScreen` **and** a “then start this slug” handoff, or the tap still feels broken.

### [P2] C3 — a hard 5-second arm will be hated at bedtime, and it lives in a shared component

The copy at `MagicPanel.tsx:46` is a lie (buttons are live). The prohibitions at `:73` really do appear only after “Needs help”. Putting them on the first card is cheap and correct.

Hard-disabling ✓ for 5 s on every word, in a panel already used by `WarmUp.tsx:43`, adds 15–25 s of waiting to a successful child and to every warm-up. On the 390×844 viewport they drove, C1 (script in panel) + C3 (ring + prohibitions) + C2 (dismiss) will clip the sheet. Show the two prohibitions immediately; do not lock the buttons. If you want a timer, first word of the night only, and pass `armAfterMs={0}` from WarmUp.

### [P2] A8 is not obviously a bug

`shaky` (`family.tsx:79`) ignores `prompted`; `scheduleReview` (`store.ts:114`) does not. That can be intentional: modelled/skipped → reread the same book; prompted → new book + those words in warm-up. Forcing them to agree makes a one-nudge night a stuck book, which fights B3. Treat as a product choice, not a silent-corruption P1.

### [P2] A6/A7/G3/G4 are overstated

- **A6:** `nextMorning` (`store.ts:108`) already anchors misses to 05:00. The real hole is “00:15 is still last night”. Success-at-20:00 “comes due mid-session” is not how `dueReview` is loaded (`family.tsx:74` — on kid change, not on a timer). And if you 05:00-anchor reviews but leave `nights` / `teachDays` / `doneTonight` / `WeekStrip` on `toDateString()` midnight (`family.tsx:103`, `Home.tsx:12,36,42,45`), a 00:15 finish still jumps the night counter. Incomplete if done alone. Demote.
- **A7:** Settings refuses to remove the last child (`Settings.tsx:27`). `activeKid` already falls back to `kids[0]` (`family.tsx:73`). The WarmUp/AddStory throws are real as unguarded `learnerOf(kid!)` (`WarmUp.tsx:14` before `:35`; `AddStory.tsx:34`) but not reachable from the UI. Orphaned keys are P2 hygiene.
- **G3:** Opening the card already `stopVoice()`s (`Story.tsx:258`). The UI then says “Tap to follow again” (`:304`). The stale `stopAt` dies with that session. Not a silent freeze.
- **G4:** `advanceCursor` only accepting `cursor + 1` is the documented v4 design (`docs/plan-v2.md` B5; tests in `follow.test.ts:18-22`). Jumping to “furthest before the block” paints skipped words as read. Line wrap of consecutive indices already works.

### [P2] B6 “Read it again” collides with `finishedRef`

`done` already accepts `START` (`story.machine.ts:98`). `Story.tsx:53,145` `finishedRef` will swallow the second `recordFinish`, and page/results are not reset. Shipping an Again button without resetting `{page, results, finishedRef}` either no-ops or double-counts a night. Underspecified; defer.

### [P2] E1 replay “steps 1–3 only” drops the trace the 4-year-old needs

Passing the grapheme in is the actual fix (`Home.tsx:45` vs `TeachSound.tsx:23`). Cutting replay to steps 1–3 drops “See it and trace it”. Keep 1–4, drop “Taught today” and the *next* level’s tricky word. `App.tsx:45` has no `g` on the teach route today.

---

## 2. Mis-prioritised — what I would do first, what I would drop

The plan’s order is “data integrity, then ritual, then the card”. That is reviewer-shaped. This family, tonight, with a 4-year-old and Welcome = “none yet”:

**Do first (this session)**

1. **[P1] B1** — there is no story on nights 1–3. Everything else is hypothetical until night 4.
2. **[P1] A3 + the two JSON rewrites + one resolver** — night 4’s only two books are the blip-and-name books. G5 does not substitute.
3. **[P1] A2** — one IDB exception wipes the family. Tiny change, catastrophic if skipped.
4. **[P1] A1 + A4 as one atomic encoding write** — this is the ladder, not three tickets.
5. **[P1] C2 then C1** — sibling tap / silent Show-me. C2 is the trap; C1 is the script. See §4.
6. **[P1] D1–D4 together** — one `extra` flag, not four PRs. D4 is a one-line regression against `docs/plan-v2.md` line 18.

**Do next**

- B4 (three build outcomes; optional at bedtime, not suppressed).
- B2 + B5 (never swallow a tap; tile respects warm-up).
- E1 (pass `g`; replay ≠ next sound). E3 (Settings dropdown applies Welcome’s tricky ladder at `Welcome.tsx:30`).
- B3 as **snooze tonight**, not “retire until ck”.
- F1 (Done currently lists ` · tomorrow` at `Story.tsx:398` — the child-facing miss).

**Drop from this plan / demote to later**

| Item | Why drop |
|---|---|
| A6, A8 | Wrong layer or not a bug |
| A7 | UI-blocked; orphan keys later |
| B6 | Machine/finishedRef underspecified |
| C3 timer | Keep the two sentences; drop the lock |
| G3, G4 | Working as designed |
| G5 | Token-0 content is the real stop bug |
| F4, H1 | Features; H1 does not help nights 1–4 |
| F2, F3, G1, G2, G6 | Real, small, not tonight |

H2 (degenerate morals on the first two books) belongs with A3, not in the “if the night allows” bucket. Those *are* the beginner books.

---

## 3. What the plan misses

A review of this app, for this family, should have caught these and did not.

**[P1] Magic targeting is implemented twice.** `Story.tsx:79` and `:220`. Any A3 patch that touches only `:79` ships a split brain. The library contract (`validate-library.test.ts:50-61`) never asserts “not token 0” and never asserts “not a capitalised match”, despite commenting that first occurrence wins.

**[P1] Warm-up at bedtime is the ritual killer, and B3 does not say so.** Home (`Home.tsx:78`) and Library (`Library.tsx:22`) make due words the only door to the story. A 4-year-old who stumbled on `tap` last night cannot hear Nani until the adult finishes a graded warm-up. The plan’s “not tonight” is the right idea and is buried inside a retirement scheme. Bedtime should snooze the gate in one tap.

**[P1] `extra` leaks into every aggregator, not just `recordAttempt`.** D2 names two sinks. Also: `shaky` (`family.tsx:79`), `readyToAdvance` via `words`/`firstTry` (`family.tsx:113`, `store.ts:84-88`), Settings “magic words” (`Settings.tsx:12-22`), Done’s failure list (`Story.tsx:395-408`), and `buildWord` (`Story.tsx:205` — an extra first-try can become tonight’s dictation). One helper, `designed(results)`.

**[P1] No wake lock, by their own comment.** `Story.tsx:98` uses `setInterval` *because the phone dims*. Karaoke at bedtime on a phone with a 30 s auto-lock is a product bug. The plan has G5 (120 ms) and not this.

**[P2] Day boundary is not one function.** Review due, `nights`, `teachDays`, `taughtToday`, `doneTonight`, `WeekStrip` (`Home.tsx:12,23,36,42,45`; `TeachSound.tsx:18-19`) each have their own midnight. A6 cannot be a two-line `scheduleReview` change.

**[P2] Family stories with zero magic words are saveable** (`AddStory.tsx:80` spreads magic only if chosen) and then eligible for `todayFor` as unfinished. H3 states the symptom and not the save-time guard (`fits` of an empty-magic story is `checkLine` only).

**[P2] `TeachSound` “mark it taught anyway”** (`TeachSound.tsx:48`) still burns the one-per-day rule for the *next* sound after E1. Replay is not the only footgun.

**[P2] G1 is right; G2’s mic claim is stale.** `RecordSounds.tsx` never stops `rec.current` on unmount and never `revokeObjectURL`s (`:68`, `:102`). `AddStory.tsx:48` *does* stop the recorder; the leftover is `timingEl` / `playClip` playback (`:70`).

**[P2] Home’s alt-story button already forces listen** (`Home.tsx:97`), same class of bug as G6 (`Library.tsx:46`). Plan only names G6.

**[P2] Set 3 still unlocks nothing** — confirmed, no `ls-phase2-set3` JSON. H1 is true and is not how you spend the night before the child has four sounds.

**[P2] There are no tests for the write path the whole of §A depends on.** `store.test.ts` checks `defaultKids` and `fits`. `recordEncoding`, `recordFinish`, `scheduleReview`, `readyToAdvance`, `pendingBuild` are untested. A1’s “encoding then finish on a fresh slug” is the first test that should exist, and it needs an idb-keyval mock the repo does not have.

Out of scope they were right to name: real art, sibling-as-role. They should also have named: one `dayStamp(now)` helper; a `designed()` helper; a single `resolveMagic`.

---

## 4. The three biggest fixes — implementation I would actually ship

### B1 — a story on nights 1–3  [P1]

**Do not** add states. **Do not** set `role: "listener"`. **Do not** call `recordFinish` as today.

**Data model** (`store.ts`)

```ts
// StoryProgress stays; timesFinished remains “decoding finishes only”
recordFinish(kidId, slug, results, opts?: { listenOnly?: boolean })
```

- `listenOnly: true`: append `history` (week strip + `nights`), set `lastFinished`, **do not** increment `timesFinished`, **do not** replace `results` if decoding results already exist, **do not** `recordAttempt` / `scheduleReview`.
- `todayFor` unfinished test stays `!progress[s.slug]` **or**, cleaner, `!(progress[s.slug]?.timesFinished)`. Use `timesFinished` so a listen-along row does not consume the first decoding night.

**Selection** (`family.tsx:77-90`, `Home.tsx:44-96`)

- `listenAlong = kid.role === "reader" && kid.gpcs.length < 4`.
- `todayFor`: if `listenAlong`, return the same set-1 book every night (`pat-and-the-tap` — first set-1 by title in `LIBRARY`). Not “any book”, not Fox and Crow.
- Home: show the tile + one button (“Tonight Nani reads it all”) + `Your first magic word comes in ${4 - gpcs.length} sleeps.` Hide “I read”. Library may offer the two set-1 books as listen-along; leave set-4 locked.

**Story session** (`Story.tsx:37-38, 80, 246`)

```ts
const listenAlong = listener || kid.gpcs.length < 4;
```

Thread `listenAlong` everywhere `listener` currently suppresses magic (`pendingMagicIdx`, pink buttons, I’ll try, moral decode). `mode` stays `"listen"`. Machine unchanged: `narrating` → `PAGE_NEXT` → `moral` → `done` (already the listener path, `Story.tsx:313-317, 379`).

On `done` (`:144`): `fam.finish(..., { listenOnly: listenAlong })`.

**Test that proves it**

```ts
// store.test.ts (mock idb-keyval)
await recordFinish("k", "pat-and-the-tap", [], { listenOnly: true });
const p = await loadProgress("k");
expect(p["pat-and-the-tap"].timesFinished).toBe(0);
expect(p["pat-and-the-tap"].history).toHaveLength(1);

// family todayFor: kid.gpcs = [] → pat-and-the-tap
// after the listenOnly finish, todayFor still → pat-and-the-tap
// after kid.gpcs = satp, todayFor still → pat-and-the-tap (timesFinished 0)
// after a real finish with results, todayFor → tap-tap-tap
```

Machine test: none new (no new events). Optional: a Story-level assertion that `pendingMagicIdx` is −1 when `gpcs.length < 4` even if `role === "reader"`.

---

### C1 + C2 — self-contained word card  [P1]

C2 first (trap), then C1 (script). C3’s timer is not part of this.

**Machine** (`story.machine.ts`)

```ts
| { type: "DISMISS" }   // Ev

closeMagic: assign({ magic: null, magicIdx: -1, mode: "first_try" })

// magicWord.on:
DISMISS: { target: "narrating", actions: "closeMagic" }
```

No `record`. No `nextPage`. Do not `reenter` in a way that replays listen audio — **only send `DISMISS` from read mode.** In read mode the `narrating` effect already no-ops (`Story.tsx:127` `if (!listen) return`), so returning to `narrating` just closes the panel and leaves the pink word live. In listen mode the same transition would retrigger `narratePage` from the top (`:124-131`) and re-leak or re-stop; do not offer the button there.

`modelling` ignores `DISMISS` (same as it already ignores `YES`, test at `story.machine.test.ts:38-40`).

**MagicPanel** (`MagicPanel.tsx:15-17, 30-74`)

- Keep `kicker`. Add `onDismiss?: () => void` and `modelScript?: string`.
- When `modelling`, replace/augment `panel-h` with `modelScript` (the string `together()` already builds at `Story.tsx:164`). Do not also rely on `.cap` (`index.css:103`, z-index 4 under `.panel` z-index 5). That is C1. Listen mode keeps `.cap` + `speakPrompt` (`Story.tsx:139, 164, 172`) — they can hear it.
- When `onDismiss` is passed, always show `↓ not yet` (not only after “Needs help”). That is C2. WarmUp does not pass it.

Do not dump every caption into the panel “whenever it is open”. The verdict hints are already there (`:46, :54, :62`). C1 is the modelling script, which is currently only in `.cap`.

**Story wiring** (`Story.tsx:189, 196-202`)

```ts
onMagicTap={(w, i) => state === "narrating" && send({ type: "MAGIC_REACHED", word: w, index: i })}
// MagicPanel:
onDismiss={!listen ? () => send({ type: "DISMISS" }) : undefined}
modelScript={/* the read-mode string from together() */}
```

**Test that proves it**

```ts
// story.machine.test.ts
it("DISMISS returns to narrating and records nothing", () => {
  const a = createActor(storyMachine, { input: { story } }).start();
  a.send({ type: "START" });
  a.send({ type: "NARRATION_DONE" });
  a.send({ type: "MAGIC_REACHED", word: "sat", index: 1 });
  a.send({ type: "DISMISS" });
  expect(a.getSnapshot().value).toBe("narrating");
  expect(a.getSnapshot().context.results).toEqual([]);
  expect(a.getSnapshot().context.magic).toBeNull();
});
it("DISMISS is ignored while modelling", () => {
  // NOT_YET → modelling; DISMISS stays modelling; MODEL_DONE → magicWord
});
```

Manual on the 390 viewport: I read, tap pink, `↓ not yet`, page still there, no warm-up word tomorrow; tap “Show me”, instruction visible *on the sheet* while the silent sweep runs.

---

### D1–D4 — quarantine the extra word  [P1]

One flag, one picker change, one call-site. Do not ship D1 without D2.

**Picker** (`illtry.ts:21-31`) — D1 + D4’s call-site

```ts
export function pickIllTry(page, learner, taken, graded): number {
  const magicWords = new Set((page.magic ?? []).map(normalise));
  for (let i = 0; i < page.tokens.length; i++) {
    if (taken.has(i) || graded(i)) continue;
    const t = page.tokens[i].t;
    if (/^[A-Z]/.test(t)) continue;          // drop the i > 0 exemption
    const w = normalise(t);
    if (magicWords.has(w)) continue;         // every copy of the designed word
    if (!ILL_TRY_WORDS.has(w)) continue;
    if (!checkMagicWord(w, learner).ok) continue;
    return i;
  }
  return -1;
}
```

Call site (`Story.tsx:246`):

```ts
const extra = useMemo(
  () => (readMode && !listener && !bedtime ? pickIllTry(...) : -1),
  [...]
);
```

Pass `bedtime` into `StoryView` (it does not take it today). That is D4, matching `docs/plan-v2.md` line 18.

**Machine / result** (`story.machine.ts:9-11, 25-29, 50, 53-58`)

```ts
export interface WordResult {
  id?: string; word: string; ok: boolean; mode: VerdictMode; extra?: boolean;
}
// Ev:
| { type: "MAGIC_REACHED"; word: string; index: number; extra?: boolean }
// Ctx: extra: boolean  (default false)
// openMagic copies event.extra
// record copies extra: context.extra onto the new result
```

`onMagicTap` must pass `extra: i === extra` (`Story.tsx:189, 287`). Designed taps stay `extra: false`.

**Every sink uses one helper** (this is the part D2 under-specifies):

```ts
const designed = (rs: { extra?: boolean }[]) => rs.filter((r) => !r.extra);
```

Apply in `family.tsx:113` (`recordAttempt` words / firstTry / firstTryRate, `scheduleReview`), `family.tsx:79` (`shaky`), `Story.tsx:205` (`buildWord`), `Settings.tsx:12`, Done (`Story.tsx:395`).

**Panel** (`MagicPanel.tsx:31`, Story `:197`) — D3

```ts
kicker={ctx.extra ? "Extra word · you asked for this one" : undefined}
```

Softer pair on extra: “They had a go” → `YES` / “Leave it” → `DISMISS` (records nothing) rather than `SKIP` (which is a scored miss if anyone forgets the filter). If `DISMISS` is not wired yet, `SKIP` plus `extra: true` is the fallback, but then D2’s filter is mandatory.

**Tests that prove it**

```ts
// illtry.test.ts — D1
it("does not offer a second copy of the page magic word", () => {
  const p = page("he went tap, tap, tap.", ["tap"]);
  expect(pickIllTry(p, learner, new Set([2]), () => false)).toBe(-1);
});
it("does not offer a capitalised token at index 0", () => {
  const p = page("Pat sat on the step.", []);
  expect(pickIllTry(p, learner, new Set(), () => false)).toBe(1); // sat, not Pat
});

// story.machine.test.ts — D2
it("records extra:true and designed() drops it", () => {
  a.send({ type: "MAGIC_REACHED", word: "man", index: 1, extra: true });
  a.send({ type: "YES", verdict: "first_try" });
  expect(a.getSnapshot().context.results[0]).toMatchObject({ word: "man", extra: true });
});

// store/family — extra skip does not appear in dueReview; extra first_try does not change firstTryRate
```

A fixture from real JSON: `tap-tap-tap` p1 (`magic: ["tap"]`, three `tap`s) must return −1; `sam-and-the-pit` p2 (`pit.` then `pit`) must return −1.

---

**Bottom line:** treat v5 as a correctly *observed* list and an unsafe *patch* list. Ship B1 without finishing books, A3 as resolver-plus-JSON, A2 as save-gating, A1+A4 as one write, then the card (C2/C1) and the extra-word flag (D). Do not execute A3’s test, B1’s “any book”, B4’s bedtime suppression, B3’s “until ck”, or C3’s hard timer as specified.
