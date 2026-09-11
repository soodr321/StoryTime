Here is the review of StoryTime v2 across the four requested lenses.

### Lens 1: UX / Friction (4.5yo + Parent)
1. **[P1] Red "Say it together" button.** The research explicitly requested "no buzzer/red on a miss". However, the `.no` button uses a red background (`#f6d5cf`) and red text (`#7a2a1c`). This penalizes a struggle.
   * **Fix:** In `src/index.css`, change the `.no` button to a supportive, neutral color (e.g., soft grey or blue).
2. **[P2] Grandparent script size.** Grandparents need a big-type script. The helper script (`.script`) is currently set to `16px`, which is too small for older eyes trying to read off a shared phone screen.
   * **Fix:** In `src/index.css`, increase `.script` to `20px` or larger.
3. **[P2] Bedtime mode adult script copy.** Bedtime mode changes the text color to off-white, but the script still literally says "Papa reads the **grey** words". This will confuse tired parents looking for grey text.
   * **Fix:** In `src/screens/Story.tsx`, update the copy to just say "Papa reads the story" or adjust the CSS so the adult's text is actually greyed out in bedtime mode.

### Lens 2: Family Edge Cases
4. **[P1] Session overwrite for siblings.** The in-flight session uses a single, global IndexedDB key (`K.session = "st:session"`). If Sibling A is mid-story and Sibling B switches profiles to play a different story, Sibling A's resume state is permanently overwritten and lost.
   * **Fix:** In `src/lib/store.ts`, change the IDB key to be per-child: `st:session:${kidId}`. Update `saveSession` and `loadSession` to accept and use the `kidId`.
5. **[P1] Sibling taps break Family Stories.** If a younger sibling (`listener`) taps a word while a family story is actively narrating, `speakText` calls `synth.cancel()`, permanently killing the page's audio. The XState machine never receives `NARRATION_DONE` and gets stuck in `narrating` forever.
   * **Fix:** In `src/screens/Story.tsx` (`onWordTap`), only allow the tap if the state is NOT actively narrating: `if ((listener || !listen) && state !== "narrating")`.
6. **[P2] Locked Library stories.** If a parent *removes* a taught sound in Settings, `fits()` becomes false. A previously finished story becomes `.locked` in the Library and cannot be opened again, which will frustrate kids wanting to reread favorites.
   * **Fix:** In `src/screens/Library.tsx`, allow bypass if the story is already finished: `disabled={!ok && !p}`.

### Lens 3: Engineering Correctness
7. **[P1] Event Listener Leak in Audio Player.** `playOn` adds `ended`, `error`, and `timeupdate` listeners to the `<audio>` element, but does not remove them when a track is superseded (paused and swapped mid-play). The old listeners will fire when the *new* track finishes, causing delayed, erratic state machine transitions and a massive memory leak.
   * **Fix:** In `src/lib/audio/player.ts` (`playOn`), track the cleanup function on the element itself or ensure prior listeners are explicitly removed before attaching new ones.
8. **[P1] Skipped Magic Words.** In `narratePage`, if the audio naturally ends exactly before or precisely at `stopMs` (highly likely if the magic word is the last word on the page), the `raf` loop exits with `stopped = false`. It skips `reachMagic()` and jumps straight to the next page.
   * **Fix:** In `src/screens/Story.tsx`, after `await pl.done`, manually force `reachMagic()` if it was never triggered: `if (!stopped && opts.stopAtMagic && magicIdx >= 0) reachMagic();`.
9. **[P1] iOS Safari Web Speech Failure.** `unlock()` beautifully plays silent `<audio>` to unlock media elements, but completely forgets to unlock `window.speechSynthesis`. On iOS Safari, if the very first story clicked is a Family Story, the speech audio will silently fail.
   * **Fix:** In `src/lib/audio/player.ts`, add `window.speechSynthesis?.speak(new SpeechSynthesisUtterance(""))` to the `unlock()` gesture loop.
10. **[P1] StrictMode Progress Double-Increment.** `fam.finish` unconditionally calls `recordFinish` inside a `useEffect` watching for `state === "done"`. React 18 StrictMode will run this twice, artificially incrementing the child's `timesFinished` count by 2 every time they read a book.
    * **Fix:** In `src/screens/Story.tsx`, use a `useRef` flag to ensure the completion logic only runs once per story session.

### Lens 4: Family Story Builder
11. **[P2] Single-line paragraph pacing.** The story builder splits pages by `\n+`. If a tired parent pastes a 3-sentence story onto a single line, it generates only 1 page. The "Save" button silently disables itself (since it requires `pages.length >= 2`), leaving the parent stuck with no error message.
    * **Fix:** In `src/screens/AddStory.tsx`, change the split regex to auto-split sentences if newlines are missing, e.g., `text.split(/(?<=[.?!])\s+|\n+/)`.
12. **[P2] Missing Camera Roll capability.** The documentation/comment implies parents can "Pick an emoji (or a photo from the camera roll)", but the code rigidly maps over a hardcoded `EMOJI` array with no upload logic whatsoever.
    * **Fix:** Update the comment to align with the current emoji-only implementation, or actually implement `<input type="file" accept="image/*" />`.

***

### Verdict: FAIL
The family cannot use this tomorrow. The iOS Web Speech failure, audio listener memory leaks, missing magic words at the ends of pages, and sibling session overwrites will immediately break the core loop and cause friction.

**3 Changes That Would Most Increase Daily Return:**
1. **Fix the session overwrite per-child (Finding 4)** so bedtime interruptions and sharing the device between siblings is flawless.
2. **Fix the magic word skipping bug (Finding 8)** so the child never misses their moment to shine if their word happens to end a sentence.
3. **Fix the Audio memory leak and iOS unlock (Findings 7 & 9)** so the app's audio engine is rock solid and doesn't permanently freeze the app in the middle of a story.
