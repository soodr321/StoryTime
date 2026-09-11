As an experienced K–1 reading teacher, I love the systematic bones of this app. The continuous blending, explicitly held adult verdicts, and dictation are top-tier synthetic phonics practice. 

However, looking closely at the family experience—especially the listener sibling, the family story authoring, and the specific mechanics of your early routines—there are still critical pedagogical gaps and UX oversights that will cause tears, frustration, or missed learning opportunities.

Here are the 10 concrete issues you need to fix.

### Pedagogical Gaps & Broken Scaffolds

**1. [P1] The Welcome Screen skips teaching the foundational sounds entirely.**
* **File:** `WelcomeScreen.tsx`
* **Issue:** Level 1 is set to `{ n: 4, label: "s a t p", hint: "just started" }`. If a parent of a true beginner selects this, `kid.gpcs` is populated with `s, a, t, p`. The app assumes these are *already mastered* and immediately throws the child into a story expecting them to read "sat" and "pat", permanently skipping the `TeachSound` introduction for the first 4 sounds.
* **Fix:** Add a true beginner level: `{ n: 0, label: "None yet", hint: "starting from scratch" }`. If selected, they start with 0 sounds and are prompted to learn `s` today.

**2. [P1] Punctuation is trapped inside the magic word highlight.**
* **File:** `Story.tsx` (`StoryView`)
* **Issue:** When rendering the text, the UI renders the raw token `{t.t}` inside the `.w.magic` highlight button. If the token is `"pit."`, the period is wrapped in pink. A 4.5-year-old taught to decode every symbol inside the box will literally point to the period and ask, "What sound does the dot make?"
* **Fix:** Use a regex to separate trailing punctuation (e.g., `match(/^([a-zA-Z]+)(.*)$/)`) and render the punctuation *outside* the `.w.magic` element.

**3. [P1] Capital letters in the read-back line will stump the child.**
* **File:** `Story.tsx` (`Moral`)
* **Issue:** In the original story *Sam and the Pit*, the read-back line is `"Sam sat in a pit."` The child has only ever been taught the lowercase `s` (in the trace box). Throwing an untaught capital `S` at them in a Phase 2 assessment will cause them to freeze. 
* **Fix:** For early phonics, standardize the read-back assessment to lowercase. Render the line as `story.moral.line.toLowerCase().split(/\s+/)` so they are tested strictly on the letterforms they know.

**4. [P1] Magic Word Theft (Multiple occurrences on one page).**
* **File:** `story.machine.ts` and `Story.tsx` (`StoryView`)
* **Issue:** `WordResult.id` groups by `${page}:${word}`. If the word "pit" appears twice on page 2, reading the first occurrence saves a `done` result for "pit". The second "pit" immediately turns green and becomes an untappable `span` in read mode. You rob the child of reading it the second time, which ruins fluency building.
* **Fix:** Change the `WordResult.id` to track the exact token index (`${page}:${tokenIndex}`) and update `resFor` to check by index so every instance must be read.

**5. [P1] The `TeachSound` routine spoils active recall for start sounds.**
* **File:** `TeachSound.tsx`
* **Issue:** In Step 3, clicking a word chip plays the word, waits 0.9s, and unconditionally plays the target phoneme. If the prompt is "What sound does it start with?", 0.9 seconds is not enough time for a 4.5-year-old to process, articulate the sound, and do the action. The app gives away the answer.
* **Fix:** Only auto-play `hear()` after the word if `t.position === "end"`. For start sounds, remove the `setTimeout` and let the child answer; the parent can manually tap the big sound button to confirm.

### Motivation, Sibling Experience & Missing Features

**6. [P2] Dictation (`SegmentPanel`) lacks distractor vowels.**
* **File:** `SegmentPanel.tsx`
* **Issue:** The tile `bank` is populated with the target word plus the 6 most recently taught sounds. If the target is "pit" and the recent sounds are all consonants (`b, f, ff, l, ll, ss`), the bank will contain no other vowels. Distinguishing `/i/` from `/a/` is the hardest part of spelling CVC words; without distractor vowels, they don't have to listen to the middle sound carefully.
* **Fix:** Force the bank to always include at least one taught vowel that is *not* in the target word.

**7. [P2] The Listener sibling's print awareness is visually disrupted.**
* **File:** `Story.tsx` (`StoryView`) and `index.css`
* **Issue:** For the younger sibling, every single word on the page is rendered as a `<button className="w tap">` so they can tap to hear it. The CSS for `.w.tap` adds `padding: 4px 8px`. This will physically blow apart the sentence, creating massive, unnatural gaps between words, teaching the toddler terrible print spacing.
* **Fix:** Create a `.w.listener-tap` class that retains the pointer/click target but removes the extra horizontal padding so the sentence looks like a real book.

**8. [P2] `AddStory` wastes a massive instructional opportunity.**
* **File:** `AddStory.tsx`
* **Issue:** If a parent writes a custom page with zero decodable words (e.g., "The dog ran away."), the app passively notes "none decodable on this page". 
* **Fix:** Add a parent nudge! When candidates are empty, display: *"Tip: Tweak your sentence to include a word like [list 2-3 words generated from kid.gpcs] so your child has something to read!"*

**9. [P2] *Fox and Crow* read-back line misses the fable's point.**
* **File:** `library/fox-and-crow/story.json`
* **Issue:** The current read-back line is "It is sad." While decodable, it completely misses the moral about flattery and tricks. 
* **Fix:** Change the line to "A trick is sad." or "The trick is sad." Both "trick" (t-r-i-ck) and "sad" (s-a-d) are perfectly decodable at Phase 2 Set 4, and "the/a" are taught tricky words. It connects the phonics directly back to the story's meaning.

**10. [P2] The 30-nights counter ends in an anti-climax.**
* **File:** `Home.tsx`
* **Issue:** Reaching 30 nights of reading just silently renders "night 30 of 30" on the week strip. For a 4.5-year-old, completing a 30-day streak requires a massive intrinsic/extrinsic climax to cement the habit.
* **Fix:** If `nights >= 30`, replace the week strip entirely with a giant "Reading Champion!" celebration card (add confetti, or unlock a special avatar/story). 

***

### Verdict: FAIL
The core mechanics are fantastic, but the app fails on **Item 1**. The Welcome Screen bug skips the foundational instruction for a true beginner. 

**Biggest Effect:** Fixing the **Welcome Screen (Item 1)**. If a parent clicks "just started" and the app immediately throws a true beginner into a story expecting them to read "sat" and "pat" without ever explicitly teaching those sounds, the child will fail, cry, and the parent will delete the app on Day 1.
