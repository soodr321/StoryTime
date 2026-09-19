### 1. Is Item 2 (Write Set-3 Books) the Right Next Thing?

* **[P1] Must change.** Do not write new stories yet. Build the **defensive touch and bedtime visual fixes from Item 4 first**.
* **Why:**
  * **The technical failure mode breaks tonight:** A 4-year-old in bed does not tap with precision; they mash tiles, drag fingers, and lean their palm against the phone bezel. If multiple audio instances fire simultaneously, the Web Audio context can glitch or desynchronize. Furthermore, at 2% screen brightness with Night Shift active, subtle font weights, low-contrast decodable word highlights, and karaoke tracking can become invisible on mobile displays.
  * **Build order:** Fixing audio concurrency (limiting/debouncing tile spam), adding edge touch rejection, and verifying 2% brightness color contrast takes roughly 2 hours of code. Creating 3 polished books (authoring constrained text, human narration at 116 wpm, blend recording, phonetic gating, and karaoke timestamp alignment) takes days. Do not build content on an unhardened bedtime player.

---

### 2. What Will Go Wrong with the Set-3 Books Specifically?

* **[P1] Must change.** Set 3 faces three major hurdles:

  1. **The `c` / `k` / `ck` Orthography Trap:**
     * *The inventory:* Set 3 adds `g, o, c, k` to `s, a, t, p, i, n, m, d`. Vowels available are strictly **a, i, o** (no **e**, no **u**).
     * *The trap:* In English, single-syllable decodable words ending in a short vowel followed by a `/k/` sound are almost exclusively spelled with the digraph **ck** (*sock, lock, rock, pick, pack, kick, tick, dock*). But **`ck` is deferred to Set 4**.
     * *The consequence:* The child knows the sound `/k/`, but can only use `c` or `k` at the *beginning* of words (*cat, cot, cap, can, kid, kit*). You cannot end words with `/k/` without breaking decodability rules or failing the phonics validator. Combined with missing consonants (`b, h, r, l, f, w`), the available word list is small (*dog, cat, pig, pot, pan, top, kid, cup-invalid, hop-invalid, run-invalid*).
  2. **Aesop/Panchatantra Narrative Strain:**
     * Attempting to squeeze traditional fables into this tiny vocabulary forces jarring compromises. If the adult reads rich prose and the child reads the decodables, inserting isolated words like `cat`, `pot`, or `nod` into complex storylines feels disjointed. Set-3 stories need to be brief, situational vignettes tailored directly to the vocabulary, not forced adaptations of classic literature.
  3. **Two Books is Dangerously Inadequate:**
     * The plan schedules only two Set-3 books. A 4-year-old learning one sound a day spends 4–6 days consolidating Set 3. By night 3, having only two books means they are no longer decoding graphemes—**they have memorized the story and recital cadence by heart**. You need at least **4 to 5 short stories** at this level to ensure genuine decoding.

---

### 3. The Mixed Art Decision (Victorian Plates vs. Modern Flat Vector)

* **[P1] Must change.** Drop the Milo Winter plates entirely and **standardize on the flat vector house style**.
* **What breaks:**
  * **Bedtime Optical Collapse (2% Brightness + Night Shift):** 1919 Milo Winter illustrations rely on detailed line work, watercolor washes, and sepia tones. Under heavy night-shift amber at 2% OLED/LCD brightness, those details blend into a muddy, indistinct brown smudge. In contrast, flat vector silhouettes with defined stroke weights and a tuned palette stay legible in the dark.
  * **Visual & Cognitive Coherence:** Mixing detailed 20th-century storybook plates with modern geometric vector mascots on the same shelf creates unnecessary visual clutter.
  * **Phonics Focus:** Intricate illustrations invite guessing based on background imagery rather than focusing on decodable text.
* **What to do instead:**
  * Keep the flat vector style across all stories. For the Aesop fables, create simple, single-stroke iconic drawings (e.g., a clean silhouette of a crow and a pitcher). They render sharply at low brightness, preserve battery life, and maintain a consistent app identity.

---

### 4. What is Missing from the Plan?

* **[P1] Infant Typography (Single-Story `ɑ` and `ɡ`):**
  * Standard web fonts (Inter, San Francisco, Roboto) default to double-storey `a` and two-storey `g`.
  * In early synthetic phonics, 4-year-olds are taught **single-storey infant letterforms** (`ɑ` and `ɡ`). Encountering a two-storey `a` or `g` in Set 1 and Set 3 will confuse a beginner. Ensure the app uses a font with single-story infant variants (e.g., Andika, Lexend, or OpenDyslexic/School variants).
* **[P1] Bedtime Touch Guarding & Edge Rejection:**
  * Holding a phone with two sets of hands in bed leads to accidental screen touches. The reading surface requires touch isolation: generous hit-boxes on decodable words, paired with edge-padding that ignores resting thumbs.
* **[P2] Calm Role Cues (Adult vs. Child Turn-Taking):**
  * The interface needs a clear, quiet visual signal to indicate when the adult stops and the child reads. Avoid bright, flashing karaoke indicators at bedtime; use a soft contrast shift or an unobtrusive underline beneath child-decodable targets.
* **[P2] Low-Friction Parent Word-Bypass:**
  * At bedtime, children tire quickly. If a child stalls or gets frustrated on a decodable word, the adult needs a discreet one-tap mechanism to pronounce/blend the word and keep the story moving without triggering error states or breaking the bedtime mood.

---

### 5. What is in the Plan That is NOT Worth Doing?

* **[P1] "One drawing per page if they earn it":**
  * **Not worth doing.** In early phonics instruction, placing an illustration on every page encourages children to glance at the picture and guess the word rather than sounding out the letters. One cover/header illustration per story sets the scene; the reading pages themselves should remain calm and text-focused.
* **[P2] Writing "one more set-2" book right now:**
  * **Not worth doing yet.** Set 2 already has content and access to Set 1 stories. Set 3 has **zero** content. Spending time writing and recording a second Set-2 book before bridging the Set-3 gap diverts focus from the actual bottleneck.
* **[P2] Over-engineering Sound Pack Licensing Guards:**
  * The sound swap script is marked done, but continued focus on managing hypothetical third-party licensing distributions is overhead. This is an offline PWA for one household; keep the working recordings in place and shift focus entirely to the reader experience.
