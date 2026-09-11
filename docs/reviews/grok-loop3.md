The review needs the rest of the pasted source from the offloaded prompt; I’ll load that file only and then review from it.**FAIL.** Two family simulations still strand or mis-teach before this is safe for nightly use.

**Simulation.** Grandmother + 4.5-year-old at “none yet”: nights 1–4 can be four 90-second teaches *or* all of `s a t p` in one sitting (Home keeps offering “today’s sound” until four). Night 4+ always opens **Pat and the Tap** (alphabetical `todayFor`), which asks for **tap** and **sat** only — four of six pages have no turn, and **p** barely appears until the read-back. One nudge on a two-word story is 50% first-try, so `readyToAdvance` never fires; they can loop the same easy book all week. Father + set-4 child: Settings chips can accidentally mark later sounds taught; if he doesn’t touch Settings, `todayFor` still serves the first *decodable* title, and the set-4 story we have (**The Fox and the Crow**) only asks for **did / sat / got / sad** — none of **ck e u r**. One nudge on four words is 75%, so the next-sound card stays dark and the week is old CVC on repeat.

---

**[P1] `src/lib/store.ts` `readyToAdvance` — 80% of 2–4 words is 100%.**  
`firstTryRate` is per finished story (`first_try / results.length`) with `words > 0`. Pat and the Tap has two magic words (need 2/2). Tap, Tap, Tap has three (need 3/3). Fox and Crow has four (3/4 = 75%, fail). A single honest “after a nudge” freezes the next sound forever for both children.  
**Change:** score a rolling pool of the last ~10 magic-word attempts at this `gpcCount` (warm-up included or not, but not a 2-item story). Keep the “two sessions + a successful build” shape, but do not treat one miss on a tiny story as “not ready for `i` / `h`.”

**[P1] `src/lib/family.tsx` `todayFor` + the set-1/set-4 books — today’s story does not practise the newest sound.**  
`todayFor` takes `unfinished[0]` after `fits()` (can-decode, not right-level), and `LIBRARY` is A–Z. Beginner always gets Pat and the Tap before Tap, Tap, Tap. Set-4 child can be fed any easier book that still `fits`. Fox and Crow never uses **ck/e/u/r**. Pat and the Tap never uses **pat** as a target (page 5 has the word; it is not in `magic`).  
**Change:** pick the unfinished-or-due story with the most magic words containing `kid.gpcs.at(-1)`; if none, the least-recent that does. In `pat-and-the-tap/story.json` page 5, set `"magic": ["pat"]`. In `fox-and-crow` (or a real set-4 original), replace at least two targets with set-4 words the validator already allows (`red`, `run`, `duck`, `sock`, `get`).

**[P1] `src/screens/Settings.tsx` `KidEditor` — hearing a sound teaches it, and 0–3 cannot be represented.**  
Each chip does `playClip` **and** `gpcs: ALL_GPCS.slice(0, i + 1)`. Father tapping **h** to listen just taught s–h. The level `<select>` only has `4, 8, 12, 16, 23`, so a true beginner who opens Settings cannot stay on 1–3 sounds and may jump to four.  
**Change:** tap = play only. Long-press or a separate “Taught ✓” commits the prefix. Add `0,1,2,3` to the dropdown (labels: none / s / s a t / s a t p).

**[P1] `src/screens/Home.tsx` + `TeachSound.tsx` — first four sounds have no spacing.**  
Home: “Teach today’s sound” while `gpcs.length < 4`. TeachSound: `advanceReady = ready || gpcs.length < 4` with no same-day lock. Grandmother can mark **s, a, t, p** taught in ~6 minutes, then the story asks for a blend of all four.  
**Change:** one new GPC per calendar day for the first four (same `Taught today ✓` disabled copy as the later gate: “come back tomorrow to teach the next”). Same-day is only a replay of the sound already marked.

**[P2] `library/pat-and-the-tap/story.json` and `library/tap-tap-tap/story.json` — too few turns, empty pages.**  
Pat: magic on pages 2 and 3 only. Tap, Tap, Tap: 1, 3, 5. A 4.5-year-old sits through 6–9s of karaoke with nothing to do, then blends two or three words in the whole ritual. That bores them and under-teaches blending.  
**Change:** one target on every page that already contains a set-1 CVC (`tap` on Tap page 4; `pat` on Pat page 5; add a decodable on the empty pages or cut those pages). Cap narration so the child gets a turn about every 20–30 seconds.

**[P2] `src/screens/Story.tsx` `Moral` / `encodingDone` — a failed build never comes back.**  
`buildWord` is the first `first_try` only; `recordEncoding` stores `ok: false` and `readyToAdvance` ignores failures. The child can miss the dictation every night and never see that word in warm-up.  
**Change:** on `ok: false`, `scheduleReview` that word for `nextMorning` with `last: "skip"`, and offer the same word again at the next story’s build step until one success.

**[P2] `src/App.tsx` fatal storage — copy lies, grandmother is stuck.**  
The screen says they can still read a story; the only buttons are Try again and Reset saved data.  
**Change:** add “Read tonight without saving” → `Welcome`/`Home` with `fatal` still set, `finish`/`setSession` already no-op on throw.

**[P2] `src/lib/family.tsx` `nights` — teach-only evenings do not count.**  
`nights` is unique dates in story `history`. After four real nights of **s/a/t/p**, Home still shows **night 1 of 30**.  
**Change:** stamp a night when TeachSound commits a GPC (or when warm-up completes), not only on `recordFinish`.

---

Biggest effect on the child’s reading: **stop picking today’s book alphabetically, and put the newest taught sound in the magic words** (`todayFor` + retarget Pat/Fox). Right now a beginner practises **sat/tap** without **p**, and a set-4 child can look “ready” (or never ready) on **sat/did/got/sad** without ever blending **ck/e/u/r**.
