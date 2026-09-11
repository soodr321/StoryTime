The review needs the full pasted source, so I’ll load the truncated prompt first and then work only from that text.The source is split across the prompt file; I’ll keep reading until I have every screen and phonics file.**FAIL.** A 4.5-year-old who onboards honestly (lowest sounds) either gets no story, or is asked to blend Phase 4 clusters (`must`, `trick`) they have not been taught to blend. That is the habit-forming failure.

---

**1. [P1] `library/fox-and-crow/story.json` (same pattern in the other six) + `src/lib/phonics/validator.ts` — Phase 4 clusters given as Phase 2 “magic.”**  
`must` is CVCC (m-u-s-t); the read-back `It is a trick.` is CCVC (t-r-i-ck). Letters & Sounds does not teach adjacent-consonant blending until Phase 4. A set-4 child will guess the whole word or echo Nani.  
**Change:** In `checkMagicWord`, fail closed if `graphemes.length > 3` (Phase 2 = CVC only), reason: `"must" has four sounds; stick to three (sat, got, sad)`. Replace magic `must` with a CVC already on a rewritten line (e.g. page 4: `The fox sat.` → magic `sat` is already used; use `red` only after `r` is taught, or drop magic on that page). Change `moral.line` from `It is a trick.` to a CVC line at this level, e.g. `It is sad.`

**2. [P1] `src/lib/library.ts` `fits()` + `src/screens/Welcome.tsx` + library — empty Home after honest onboarding.**  
Welcome defaults to `s a t p`. Every bundled story is `ls-phase2-set4`, and `fits()` also requires `checkLine(story.moral.line)`. Home then shows: `No story fits {name}'s sounds yet.` Grandmother will either quit or tick extra sounds so the child is thrown at `must`/`trick`.  
**Change:** Ship at least one story per set (set 1 magic: `sat/pat/tap`; set 2: `did/sit`; …). Relax `fits()` to magic words only; if the moral line fails, swap in a level-matched line from a small bank (`Sat.`, `It is sad.`) instead of hiding the book.

**3. [P1] `src/screens/Home.tsx` + `src/App.tsx` — yesterday’s hard words are optional.**  
The warm-up is a card they can ignore; `WarmUpScreen onDone` returns to Home, not into the story. A 4.5-year-old will hit `Nani reads` every time; skipped/modelled words never get the retrieval pass the store already schedules.  
**Change:** If `review.length > 0` and there is no resumable session, do not render the mode buttons. `onWarmUp` is the only path. `WarmUpScreen onDone` should call `onStart(today, "listen", false)` (pass the story in), not `setRoute({ name: "home" })`.

**4. [P1] `src/screens/Story.tsx` `together()` — the model gives the answer.**  
After the stretch blend it runs `speakPrompt(\`word:${word}\`, word)` then “Your turn: say the sounds, then blend.” The child will echo `must`, not blend.  
**Change:** Delete the whole-word prompt. Sequence: stretch only → `Your turn: say the sounds, then blend.` Speak the whole word only after ✓.

**5. [P1] `src/screens/Story.tsx` `StoryView` — tap-to-hear whole words in “I read.”**  
`if (listener || readMode) return <button … onWordTap>` → TTS of `cheese`, `wanted`, `praised`. That is “look at the word, get told it,” the exact habit synthetic phonics exists to stop.  
**Change:** In `readMode`, only pending magic tokens are buttons (`onMagicTap`). All other tokens are `<span>`. Grey words stay Nani’s job, as the script already says.

**6. [P1] `src/lib/family.tsx` `todayFor()` — new plot every night after a shaky read.**  
First unfinished title wins (`ant-and-grasshopper` forever). A night with modelled/skipped words still advances. At 4.5, fluency is the same five CVC words tomorrow, not a new Aesop.  
**Change:** If the most recently finished story’s `results` include any `!ok` or `mode !== "independent"`, return that story and set the Home kicker to `Same story — smoother today`. Only rotate when the last run was all independent or sounded.

**7. [P1] `src/screens/AddStory.tsx` — the example line is illegal.**  
Placeholder `{kid.name}'s line` is `It is a mango.` `ng` is in `LATER_GRAPHEMES`, so Save stays disabled and the error looks like the parent failed.  
**Change:** Generate the placeholder from `learner` (e.g. set 1: `A tap.`; set 4: `It is sad.`). Never show a word `checkLine` would reject.

**8. [P2] `src/screens/Welcome.tsx` `finish()` — tricky-word set does not match `LEVELS`.**  
`n >= 8 ? ALL_TRICKY.slice(0, n >= 16 ? 5 : 3) : []` → set 3 never gets `is`; set 5 never gets `no/go/into`. Morals that use `is` then fail `fits()`.  
**Change:** Copy `LEVELS` exactly: set2 `the,a,I`; set3 `+ is`; set4 `+ to`; set5 all of `TRICKY_PHASE2`. Introduce `the`/`I` at set 1 if you want a readable first moral.

**9. [P2] `src/screens/Home.tsx` “Next sound” + `src/screens/Settings.tsx` `KidEditor` — letter-name trap.**  
Welcome plays the clip; Home/Settings only show print `r` / `h` / `ck`. Grandmother will say “ar,” “aitch,” “see-kay.”  
**Change:** Tapping the next-sound `<b>` and each Settings `.tog` runs `playClip(soundAsset(GRAPHEME_SOUND[g].clip))`. Caption: `this is the sound, not the letter name.`

**10. [P2] `src/screens/Story.tsx` done prompt + `Done()` — still praises the wrong thing.**  
Spoken: `Beautiful reading.` Result line: `{word} · read it straight off`. That frames sight-reading as the win, after you already renamed the mode `independent`.  
**Change:** Done speech: `You blended {ok.map(w).join(", ")}.` Independent line: `{word} · blended it by yourself`. Keep confetti off unless at least one word was `sounded` or `independent` (already true) — drop the word “beautiful.”

---

**Biggest effect on the child’s reading:** items **1 + 2** together — CVC-only magic/read-back, and a story that actually exists at the sounds Welcome just collected. Until then the app either does not run or trains guessing on `must`/`trick`.
