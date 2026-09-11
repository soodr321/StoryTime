Here is the final polish review for StoryTime v5, evaluated against your lenses. 

### [P1] First 5 Minutes: The Phantom Sibling
**File:** `src/screens/Welcome.tsx`
**Issue:** `defaultKids()` creates a listener sibling by default. If the parent leaves the "younger brother or sister" input blank, the `if (sibling.trim())` block is skipped. The default "Little one" is never removed, and the parent will arrive at the Family screen confused by a phantom child.
**Change:** Add an `else if` to remove the default sibling if the input is blank.
```typescript
if (sibling.trim()) { 
  if (little) updateKid({ ...little, name: sibling.trim() }); 
  else addKid({ ... }); 
} else if (little) {
  removeKid(little.id);
}
```

### [P1] Code Correctness: Chrome Karaoke `Infinity` Bug
**File:** `src/screens/Story.tsx` (in `narratePage`)
**Issue:** `MediaRecorder` on Chrome creates `audio/webm` blobs that lack duration metadata, so `pl.el.duration` evaluates to `Infinity`. Consequently, `tokMs` evaluates to `Infinity`, meaning the audio never stops at the magic word and the karaoke words are never highlighted. You are correctly saving `rec[i].ms` into `audioMs` during creation, but you forgot to use it!
**Change:** Fallback to the saved `p.audioMs` if `pl.el.duration` is `Infinity`.
```typescript
const durationMs = (isFinite(pl.el.duration) && pl.el.duration > 0) ? pl.el.duration * 1000 : (p.audioMs ?? Infinity);
const tokMs = (i: number) => (timed ? p.tokens[i].ms : (durationMs !== Infinity ? (durationMs * i) / p.tokens.length : Infinity));
```

### [P1] Child's Experience: Cancelled Sounds in Moral Screen
**File:** `src/screens/Story.tsx` (in `Moral` component)
**Issue:** When the child taps a decodable word for help, the loop `for (const g of r.graphemes) void playClip(...)` fires all the sound clips synchronously without `await`. Since `playClip` reuses a single audio element and pauses the previous sound, the child will only hear the very last sound of the word, completely breaking the sounding-out feature.
**Change:** Make the `onClick` handler async and `await` the clip's `.done` promise.
```typescript
onClick={async () => { 
  if (r.ok && r.kind === "decodable") {
    for (const g of r.graphemes) {
      try { await playClip(soundAsset(GRAPHEME_SOUND[g].clip)).done; } catch {}
    }
  } else speakText(words[i], {}); 
}}
```

### [P1] Data Safety: `AddStoryScreen` Media Shift
**File:** `src/screens/AddStory.tsx`
**Issue:** State for `arts`, `magic`, and `rec` are keyed by the absolute line index `i`. If a parent records audio/photos for page 1 and 2, but then notices a typo and adds a sentence at the beginning of the story, `pages` shifts down by 1. Page 1's photo/audio will suddenly be applied to the newly typed sentence, and the parent will lose their matching work.
**Change:** Warn parents that editing the text will misalign their photos/recordings, or generate stable IDs for the `pages` array (e.g. hashing the string) to key the media state.

### [P1] Child's Experience: WeekStrip Punishes Re-reading
**File:** `src/screens/Home.tsx` (in `WeekStrip` via `store.ts` progress)
**Issue:** The 7-day strip uses `p.lastFinished`. If a child earns a star on Monday for reading a story, and then re-reads that same favorite story on Wednesday, Monday's timestamp is overwritten. Their Monday star will disappear before their eyes. 
**Change:** Store an array of completion dates in `StoryProgress` (`history: number[]`), or at minimum, don't update `lastFinished` if it overwrites an earlier day in the current week.

### [P2] Child's Experience: Mocking a Failure State
**File:** `src/screens/Story.tsx` (in `Done` component)
**Issue:** The "show" paragraph uses `results.length ? ...` to display the closing message. If the child skips *every single* magic word because it was too hard (`ok === 0`), the app still excitedly tells them: "Now go find someone and read them your magic words!".
**Change:** Base the success message on `results.some(r => r.ok)`.
```typescript
<p className="show">{bedtime ? ... : results.some(r => r.ok) ? `Now go find someone...` : `Great listening, ${kid}!`}</p>
```

### [P2] Child's Experience: Instant Page Turn (No Magic Word)
**File:** `src/screens/Story.tsx` (in `narratePage` effect)
**Issue:** If a parent creates a family story page with zero magic words, `magicIdx` is `-1`. The narration plays to the end and `opts.onDone()` is immediately called. Because `!listener`, it fires `NARRATION_DONE` which instantly turns the page, giving the child 0 seconds to process the text or look at the picture.
**Change:** For readers, if there are no pending magic words on the page, set `pageHeld(true)` just like you do for listeners, forcing a manual "Next page" tap.

### [P2] Data Safety: IDB Side-Effects in Strict Mode
**File:** `src/lib/family.tsx` 
**Issue:** `mutateKids` and `updateSettings` call `saveKids()`/`saveSettings()` directly inside the functional state updater (`setKids(prev => { ... saveKids(); ...})`). In React 18, updaters can be invoked multiple times before committing (especially in Strict Mode), which can queue redundant/stale IndexedDB transactions. 
**Change:** Move the `saveKids()` call into a `useEffect` that watches `kids`, or fire the async save outside of the `setKids` updater function.

***

**VERDICT: FAIL for tomorrow morning.**
While the untaught digraph validator is brilliant and the offline PWA architecture is incredibly solid, the Chrome `Infinity` bug entirely breaks the new v5 karaoke, the Moral screen audio overlap ruins the phonics core, and the disappearing WeekStrip stars will cause tears. Fix the [P1]s and they'll have a magical morning!
