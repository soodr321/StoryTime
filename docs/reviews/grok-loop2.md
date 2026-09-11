The review source was truncated in the chat. I'll load the full pasted prompt so I can review only that source, without touching the project.The first chunk ends mid-Story screen. I'll keep reading the rest of the pasted source.Still missing MagicPanel, TeachSound, blend, and the rest of the stories. Loading those next.**FAIL.** Loop 2 added the right routines (continuous blend, adult verdicts, dictation, TeachSound, readiness card) and then left three holes that undo them: helped work is stored as mastery, the next sound can be taught on night one, and several exception words can be “sounded out.” A grandmother will over-teach; a 4.5-year-old will guess or echo.

---

**1. [P1] `src/screens/Home.tsx` + `src/screens/Library.tsx` — warm-up and shaky reread are not actually mandatory**

Home hides Listen/I-read while `review.length > 0`, but the “or {name} picks: …” button still calls `onStart(alt, "listen", false)`, and the bookshelf starts any fitted story with no review check. `WarmUp.tsx` also has “skip to the story →”.

**Change:** The only way into a story when words are due is `WarmUpScreen` completing `reviewDone` (remove skip). The alt-story button and `LibraryScreen` `onStart` must route through the same gate. A shaky slug from `todayFor` should be the only Home tile until that story is finished with no modelled/skipped words.

---

**2. [P1] `src/screens/WarmUp.tsx` — “Show me” then “✓ First try” marks the word as known**

Story mode uses the machine: `NOT_YET` sets `mode: "modelled"`, so a later ✓ is stored as modelled. Warm-up does not. `together()` plays the blend, then `onYes` calls `record(true, "first_try")`. `scheduleReview` then sets `interval * 3` and `last: "ok"`.

**Change:** Mirror the story machine. After `onTogether`, the only ✓ is “They slid through it after the model” (`ok: true`, `mode: "modelled"`). Do not enable First try / After a nudge until a fresh unmodelled attempt.

---

**3. [P1] `src/lib/store.ts` `scheduleReview` + `readyToAdvance` — a nudge counts as mastery**

`prompted` takes the same path as `first_try` (interval ×3, `last: "ok"`). `readyToAdvance` counts `ok && mode !== "modelled"`, so prompted fills the 80%.

**Change:** Only `first_try` grows the interval. `prompted` → due tomorrow, `last: "help"`. Ready-to-advance = two recent sessions with ≥80% **first_try** (not prompted), `due === 0`, and one **recent** successful encode.

---

**4. [P1] `src/lib/store.ts` `recordFinish` + `src/screens/Home.tsx` — next sound is taught with no evidence**

Dictation writes `encoding[]`, then `recordFinish` replaces the story record and **drops** `encoding`. `readyToAdvance`’s “one word built” flag almost never survives a finished story, so the dashed Ready card rarely appears. The always-on row still says `teach it (90 s) →` from night one. Nani will teach `i` before `sat` is easy.

**Change:** `all[slug] = { ...prev, ..., encoding: prev?.encoding }`. Hide/disable the next-sound row until `advanceReady`. `TeachSoundScreen` “Taught today ✓” is disabled unless `advanceReady` (keep a Settings override behind a confirm: “They have not blended independently yet”).

---

**5. [P1] `src/lib/phonics/validator.ts` — untaught exceptions are treated as decodable magic words**

`checkWord` only special-cases words already in `learner.tricky`. If `is` / `to` / `no` / `go` / `a` / `I` / `into` are not ticked, they parse as `i-s`, `t-o`, etc. `checkMagicWord` then accepts them because they are “decodable,” not tricky. `AddStory` will offer `is` and `put` as pink words. The child is trained to read `is` as /ɪsss/ and `put` as /pʌt/. Only `the` is saved, because `th` is in `LATER_GRAPHEMES`.

**Change:** Keep a locked exception list (`the, a, I, is, to, no, go, into, put, of, do`). If the word is in that list and not in `learner.tricky`, fail closed: “tricky word, not taught yet” — never GPC-parse it. Same for `checkLine` / `fits`.

---

**6. [P1] `src/screens/TeachSound.tsx` + `src/lib/phonics/teach.ts` — “What sound does it start with?” for `ck` `ff` `ll` `ss`**

Step 3 always says that. The example words are `duck/sock/kick`, `off/puff/huff`, `bell/doll/hill`, `hiss/kiss/mess`. The child will say /d/ for `duck`. That teaches the wrong isolation habit on the exact lesson that “two letters, one sound, at the end.”

**Change:** Per-GPC prompt in `Teach`: `position: "start" | "end"`. For `ck/ff/ll/ss` (and any final example): “Do the action when you hear the sound at the **end**.” Play the word, then the isolated phoneme clip, not a question about the first sound.

---

**7. [P1] `src/lib/phonics/teach.ts` — blend for `g` is `d-o-g` while `o` is untaught**

Order is `g, o, c, k`. On the `g` night the child has `s a t p i n m d` only. `dog` gifts an unknown vowel (and invites picture/guess “dog”).

**Change:** `g.blend: ["d","i","g"]` (or `t-a-g`). Every `blend` array must be a subset of `LS_PHASE2_ORDER.slice(0, indexOf(g)+1)`. Add a one-line assert in the teach data.

---

**8. [P1] `src/screens/TeachSound.tsx` — new sounds never bring the matching tricky words**

Welcome copies `LEVELS` tricky sets. “Taught today ✓” only does `gpcs: ALL_GPCS.slice(0, n+1)`. A set-1 start plus four TeachSound nights yields eight GPCs and **no** `the/a/I`. Then `is` is either blocked by item 5 or sounded out wrongly. Set-2 stories that need those words never `fits()`, so the child is stuck on Pat/Sam or jumps via Settings.

**Change:** When `gpcs.length` hits 8/12/16/23, insert a sixth TeachSound step for the new tricky word(s) using `TRICKY_PARTS` (regular vs odd bit, say the word as a whole, never blend `the`). “Taught today” adds both the GPC and that tricky set.

---

**9. [P2] `src/components/MagicPanel.tsx` + skip copy in `src/screens/Story.tsx` — the whole word is given before an independent blend is finished**

The child-facing hint is `Did {kid} say **tap** as one word?` while the tiles are still the task. After skip, the device says `` `${w}. We'll practise it tomorrow.` ``

**Change:** Verdict copy: “Did they say it as **one word**?” with no orthographic whole word. After skip, play `playBlend` once more; do not speak the word. Say the whole word only on a successful ✓ (`Yes! {w}.`) — that part can stay.

---

**10. [P2] `src/components/SegmentPanel.tsx` + `Moral` in `src/screens/Story.tsx` — encoding and read-back do the work for the child**

`SegmentPanel` already draws the right number of boxes (no finger-counting), and “Try together” plays isolated clips with 250 ms **gaps** (the model Loop 1 removed for reading). `Moral.help()` plays the stretch and jumps to “whole line again” with no ✓ that the child actually blended the stuck word. `pat-and-the-tap` also uses `pat` as a magic word after the name “Pat” has been heard on every page — that is memory, not decoding.

**Change:** Dictation: hide boxes until the adult taps “they held up N fingers,” then show N boxes; model with `playBlend` (stretch) then one slow count, not gapped letter-sounds. Read-back: after help, stay on that word until ✓, then the line. Replace the page-5 magic word `pat` with another satp CVC that is not the character’s name (`sip`/`tip` if you add `i`, or keep set-1 and use `tap` only once in the book).

---

**Biggest effect on the child’s reading:** items 2–4 together — **only a first-try blend counts, and the next sound stays locked until that is true (and `encoding` is not wiped).** Right now Nani can model, tap ✓ First try, skip warm-up via the second book, and teach a new sound the same night. That is how a 4.5-year-old ends up “knowing 16 letters” and still guessing `sat`.
