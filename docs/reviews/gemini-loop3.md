Here is the pedagogical and UX review of StoryTime, looking through the strict lens of K–1 systematic synthetic phonics and a 4.5-year-old’s capabilities. 

### [P1] Untaught Capital Letters & Punctuation Inside Highlights
Children in early phonics have not yet learned capital letters (except 'I'), and punctuation is not part of a word's sound profile. Currently, magic words at the start of a sentence retain their capital letters, forcing a 4.5yo to decode an unrecognizable symbol. Furthermore, leading/trailing punctuation (like quotes or full stops) is swept into the `<button>` highlight, teaching them that punctuation makes a sound. 
* **File:** `src/screens/Story.tsx`
* **Change:** In `StoryView`, split the token to isolate the core word, downcase it if it's a magic word, and render punctuation outside the button:
  ```tsx
  const m = t.t.match(/^([^a-zA-Z]*)([a-zA-Z]+(?:['’][a-zA-Z]+)?)([^a-zA-Z]*)$/);
  const lead = m ? m[1] : ""; const core = m ? m[2] : t.t; const punct = m ? m[3] : "";
  const displayCore = magic ? core.toLowerCase() : core;
  // Render: <span className="tokwrap">{lead}<button className={cls + " tap"}>{displayCore}</button>{punct} </span>
  ```
  In `Moral`, apply the exact same extraction to move punctuation outside the `<button className="lw">`. Also, map `words` so tricky words conform to their exact taught casing (e.g., "The" becomes "the"):
  ```tsx
  const words = story.moral.line.split(/\s+/).map((w, i) => {
    const r = line.results[i]; if (!r?.ok) return w;
    const taught = r.kind === "tricky" ? (r.word === "i" ? "I" : r.word) : r.word;
    const m = w.match(/^([^a-zA-Z]*)[a-zA-Z]+(?:['’][a-zA-Z]+)?([^a-zA-Z]*)$/);
    return m ? m[1] + taught + m[2] : taught;
  });
  ```

### [P1] App Speaks Over the Parent in "Read" Mode
"I read" mode explicitly promises a "Sound off" experience where the grown-up reads. However, if the child needs help and the parent taps "Show me", the script tells the parent to "slide through the sounds", but the app simultaneously blasts `playBlend(gs)` audio over the parent's voice, creating a jarring UX failure.
* **File:** `src/screens/Story.tsx`
* **Change:** In the `together` function, only play the audio blend if in `listen` mode. Otherwise, mock the sweep animation time so the parent can model it uninterrupted:
  ```tsx
  if (listen) { 
    await playBlend(gs, { alive, rate, onProgress: setSweep }); 
  } else { 
    for (let i = 1; i <= gs.length * 10; i++) { await new Promise(r => setTimeout(r, 80)); if (alive()) setSweep(i / (gs.length * 10)); }
  }
  ```

### [P1] Tracing Bare Letters Ruins Handwriting
Asking a child to "trace it in the air with a finger" while looking at a bare letter guarantees they will form it incorrectly (e.g., drawing an 'o' clockwise or an 's' from the bottom up). A teacher would never do this without demonstrating the starting point and direction.
* **File:** `src/screens/TeachSound.tsx`
* **Change:** Update the script text in step 4 to instruct the adult to model it first:
  `<p className="script">Grown-up: trace it on the screen first to show the starting point and direction. Then {kid.name} traces it in the air, big and slow, saying the sound.</p>`

### [P2] Hidden Scaffold for Forgotten Sounds
If a child forgets a single sound while blending in the `MagicPanel`, they are stuck. The app actually allows them to tap a tile to hear the sound, but neither the child nor the parent is told this during the reading flow! A parent will likely jump in and say the letter's name to "help" them, breaking the phonics rule.
* **File:** `src/components/MagicPanel.tsx`
* **Change:** Add a reminder to the first-try hint text:
  `<div className="hint"><span className="tag">{reader}</span> wait 5 seconds. Did {kid} say it as <b>one word</b>? (If stuck on a sound, tap the letter).</div>`

### [P2] Skipped Words Remain a Mystery in Read Mode
If a child skips a word in `listen` mode, the app moves to the `reread` state where the narrator fluently rereads the sentence, naturally revealing the word in context. But in `readMode` (!listen), `reread` is entirely skipped. The child abandons the word and never finds out what it was.
* **File:** `src/screens/Story.tsx`
* **Change:** In `MagicPanel`'s `onSkip`, modify the caption to prompt the adult to close the loop:
  `setCaption("We'll practise it tomorrow." + (listen ? "" : ` ${reader}, read the word for them.`));`

***

**FAIL** (Requires [P1] fixes to prevent actively teaching bad reading/writing habits before release).

**The single sentence to tell the parent before the first session:**
*"Wait quietly for 5 full seconds when they hit a pink word, and only tap the checkmark if they slide the sounds together into one complete word without you saying it first."*
