Here is my review as a systematic synthetic phonics teacher. While the foundational engine (validating GPCs, preventing guessing, CVC-shaping) is excellent, there are critical pedagogical flaws in how the app scripts the grown-up's behavior and handles custom audio. 

Here are the gaps that will cause frustration or teach bad habits:

**[P1] Echoing instead of blending (Moral Read-back)**
* **File:** `src/screens/Story.tsx` (`Moral` component)
* **Issue:** When a child needs help on a decodable word, the code calls `speakText(r.word)` and sets the caption to include the whole word (`${r.word}. Now ${kid}: say the sounds...`). This forces the device and/or the parent to say the whole word *before* the child tries. The child will just parrot the word, completely bypassing the cognitive work of blending.
* **Fix:** Remove `if (listen) speakText(r.word, {});` entirely. Change the caption to: `"Grown-up: stretch the sounds together, but let ${kid} say the word."` Only use `playBlend` to stretch the sounds. 

**[P1] Grown-up explicitly instructed to say the word (Together mode)**
* **File:** `src/screens/Story.tsx` (`together` function)
* **Issue:** In read mode, the caption scripts the parent: `"Grown-up: stretch the sounds together, no gaps, then say the word."` Again, this violates the golden rule of phonics modeling. The parent must never do the final blend for the child. 
* **Fix:** Change the caption to: `"Grown-up: stretch the sounds together, no gaps. Do NOT say the whole word."`

**[P1] Magic Word Audio Leak (Linear Interpolation)**
* **File:** `src/screens/Story.tsx` (`narratePage`)
* **Issue:** For family stories, the parent records the page without word-level timestamps (`!timed`). The app uses linear math `(durMs() * i) / p.tokens.length` to guess where the magic word is and pause before it. Because humans pause and read with expression, this will inevitably cut off too late and leak the magic word, ruining the decoding task.
* **Fix:** If `!timed && stopAtMagic && magicIdx >= 0`, do NOT play `p.audio` during the `narrating` pass. Instead, fallback to `speakText(text)` to ensure a clean pause before the magic word, and save the rich Nani recording solely for the `reread` state. 

**[P1] Cannot reread library books in 'I read' mode (Fluency block)**
* **File:** `src/screens/Library.tsx`
* **Issue:** Rereading familiar texts is how early readers build fluency. However, tapping a book in the library hardcodes `onStart(s, "listen", false)`. Because the `Home` screen picks the "today" story independently, a child can *never* select a past library book and practice it in "I read" mode. 
* **Fix:** Change `Library.tsx` to render the "Nani reads" / "I read" mode picker buttons when a book is tapped, instead of instantly launching into listen mode.

**[P1] Phase 4 consonant cluster in Phase 2 UI**
* **File:** `src/screens/Welcome.tsx`
* **Issue:** The hint for level 16 says `"reads trick, run, red"`. The word `trick` contains adjacent consonants (t-r), which is a Phase 4 blend explicitly and correctly rejected by your own `validator.ts` at Phase 2. This sets a false expectation for parents.
* **Fix:** Change `"reads trick"` to a valid Phase 2 CVC word ending in ck, such as `"reads duck"`, `"reads neck"`, or `"reads rock"`.

**[P1] Teaching letter names via Tricky Word UI**
* **File:** `src/screens/Story.tsx` (`Moral` component)
* **Issue:** The tricky word help caption formats letters in quotes: `"${reg}" is regular, "${odd}" is the tricky bit`. A parent reading this will say the letter names (e.g., "e is the tricky bit" for the word 'the'). Using letter names undermines pure sounds.
* **Fix:** Change the caption to point instead of spelling: `"${words[i]}" is a tricky word. The underlined part is tricky. Just say the word, then read the line again."`

**[P1] Stripping punctuation breaks custom magic words**
* **File:** `src/screens/AddStory.tsx`
* **Issue:** When generating magic word candidates, the code uses `.replace(/[’']s$/, "")` to strip possessives. If a parent selects `"sam"`, it fails to match the actual page token (`"Sam's"` -> normalized to `"sams"`) in `StoryView`. The magic word will silently fail to appear on the page, leaving parents confused.
* **Fix:** Remove `.replace(/[’']s$/, "")` from candidate generation. Let the normal phonics engine properly reject `m-s` as an untaught adjacent consonant cluster. 

**[P2] Hardcoded "Nani" breaks immersion**
* **File:** `src/screens/Story.tsx` (`Moral` component)
* **Issue:** In read mode, the caption hardcodes `"Nani reads the moral."` even if the family configured "Papa" or "Mama" as the active reader for tonight.
* **Fix:** Dynamically use the `reader` variable: `setCaption(`${reader} reads the moral. Then the child tries the whole line.`);`

**[P2] Uppercase Tricky Word matching fails visually**
* **File:** `src/lib/phonics/learner.ts`
* **Issue:** The `TRICKY_PARTS` object uses `"I"` as a key. Since `checkWord` normalizes all words to lowercase `"i"`, the lookup in the Moral screen fails (`TRICKY_PARTS["i"]` is undefined). It falls back to `|i`, which works visually but is an unintended oversight.
* **Fix:** Change the key from `"I"` to `"i"` in the `TRICKY_PARTS` dictionary.

***

### Verdict: FAIL

**The ONE change with the biggest effect:** 
You must fix the **Moral read-back and Together mode scripts to STOP the grown-up (and device) from saying the whole word** for decodable words. If the adult or the app says the word before the child blends it, the child will simply parrot the answer from short-term auditory memory. This completely bypasses the cognitive work of phonological blending, defeating the entire purpose of the app. Stretch the sounds, but leave the final blend to the child.
