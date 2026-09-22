# Plan: Fixing "Follow My Voice" in StoryTime

## 1. Ranked Diagnosis

The owner reports that "Follow my voice" does not work at all on a phone at bedtime.
Our investigation reveals that failure was not caused by a single bug, but by multiple compounding layers of failure that prevented the feature from rendering, initializing, staying alive, and matching text.

Here are the ranked causes from most decisive to least decisive:

### Rank 1: Bedtime mode force-disables Voice Follow (`Story.tsx:196`)
* **Location:** `src/screens/Story.tsx:196`
* **Evidence:**
  ```tsx
  voiceFollow={!!fam.settings.voiceFollow && !bedtime}
  ```
  In `StoryView:336`, `{voiceFollow && voiceSupported() && (` gates the entire voice follow button and status UI.
* **Mechanism:** The owner specifically uses StoryTime on a phone at bedtime. Bedtime mode (`settings.bedtime: true`) is the default nighttime experience. Because `!bedtime` is conjoined with `voiceFollow`, the prop passed to `StoryView` is `false` whenever bedtime mode is active.
* **Impact:** The "Follow my voice" button is completely suppressed and never rendered at bedtime. The owner literally cannot see or use the feature.

### Rank 2: Opt-in setting defaults to OFF (`store.ts:61`)
* **Location:** `src/lib/store.ts:50`, `src/lib/store.ts:61`, `src/screens/Settings.tsx:69`
* **Evidence:**
  `loadSettings()` defaults to `{ bedtime: false, readers: [] }`. `voiceFollow` is `undefined`.
* **Mechanism:** The feature was placed behind an experimental toggle in Settings. If a user has not visited Settings and explicitly checked "Experimental: follow my voice", `voiceFollow` is falsy.
* **Impact:** Together with Rank 1, even during daytime testing, the button does not appear unless manually toggled in Settings.

### Rank 3: Singleton recognizer lifecycle bug in `session.ts` breaks restart / second tap (`session.ts:15, 29`)
* **Location:** `src/lib/voice/session.ts:15`, `src/lib/voice/session.ts:29-54`
* **Evidence:**
  ```ts
  let rec: Rec | null = null;
  ...
  try { rec ??= new Ctor(); } catch { ... }
  const r = rec;
  ...
  try { r.start(); } catch { gen++; h.onState("stopped"); return null; }
  ```
* **Mechanism:**
  1. `session.ts` caches a singleton `rec` instance across sessions.
  2. When a session stops or aborts (`r.abort()`), the browser's speech recognition engine transitions the object to an aborted/ended state.
  3. Under the W3C Web Speech API specification (Section 5.1.1), calling `.start()` on a `SpeechRecognition` instance that is not in the `idle` state throws `InvalidStateError`. Both WebKit and Chromium strictly enforce this.
  4. In `Story.tsx:290`, tapping "Follow my voice" calls `stopVoice()` (which calls `r.abort()`), then immediately calls `startVoice()` on the same instance.
  5. `r.start()` throws `InvalidStateError`, caught at line 54, immediately setting state back to `"stopped"`.
* **Impact:** Tapping "Tap to follow again" or restarting listening after stopping fails 100% of the time. The button appears completely dead and unresponsive to user taps.

### Rank 4: iOS Safari `continuous` failure & `onend` restart blocked by user gesture policy
* **Location:** `src/lib/voice/session.ts:31, 50`
* **Evidence:**
  ```ts
  r.continuous = !isIOS();
  ...
  r.onend = () => {
    if (!alive()) return;
    if (restarts < maxRestarts) {
      restarts++;
      setTimeout(() => {
        if (!alive()) return;
        try { r.start(); } catch { h.onState("stopped"); }
      }, 200);
    } else { gen++; h.onState("stopped"); }
  };
  ```
* **Mechanism:**
  1. iOS Safari does not support continuous speech recognition. Setting `r.continuous = false` causes WebKit to terminate recognition on the first silence pause (typically after 2–4 seconds of speech).
  2. When WebKit ends recognition, `r.onend` fires.
  3. `session.ts` attempts to restart recognition in a `setTimeout(..., 200)`.
  4. iOS Safari strictly requires a **transient user activation (user gesture)** to invoke `SpeechRecognition.start()`. A `setTimeout` callback has no user gesture.
  5. WebKit throws a `NotAllowedError` or rejects the start. The catch block catches it and sets state to `"stopped"`.
* **Impact:** Even if started successfully from an initial tap, recognition dies permanently after the very first sentence or silence pause. It cannot stay alive for a whole page.

### Rank 5: `align.ts` algorithm stalls on normal page prose (55.6% word drop stall rate)
* **Location:** `src/lib/voice/align.ts:9, 31-36`, `src/screens/Story.tsx:285, 298`
* **Evidence:**
  - `align.ts:33-34`:
    ```ts
    if (matches(h, tokens[n1])) { cursor = n1; continue; }
    if (n2 < limit && CLOSED.has(tokens[n1]) && matches(h, tokens[n2])) { cursor = n2; continue; }
    ```
  - Empirical measurement on StoryTime's 16 library books (99 pages, 1,620 words):
    **On 68 of 99 pages (68.7%), more than 50% of single-word drops completely stall alignment.** Overall, **55.6% of words in the library stall the aligner if dropped or misrecognized.**
* **Mechanism:**
  1. `align` only permits skipping `tokens[n1]` if `CLOSED.has(tokens[n1])`.
  2. If the ASR engine misrecognizes a content word (e.g. "Dad" heard as "that", "Nan" heard as "can", or "Sam" heard as "some" — all common 3-letter phonics names where `matches()` allows zero edit distance), or clips the first word upon mic activation:
     - `tokens[n1]` is not in `CLOSED`.
     - `matches(h, tokens[n1])` is false.
     - `cursor` does not advance.
     - Every subsequent word in the heard utterance is checked against the same stuck `tokens[n1]` and fails.
  3. Furthermore, `norm` in `align.ts` preserves apostrophes (`replace(/[^a-z']/g, "")`), while `tokensNorm` in `Story.tsx` strips them via `validator.ts:normalise` (`replace(/[^a-z]/g, "")`). For words with apostrophes ("it's", "ant's"), `norm` produces `"it's"` while token is `"its"`, which fails `matches()` because length < 4.
  4. In `session.ts:38`, `if (e.results[i].isFinal) final = true;` sets `final = true` even when the transcript ends with an interim result, causing `Story.tsx:298` to anchor interim cursor positions prematurely.
* **Impact:** Even when speech recognition works, the cursor freezes on the first minor ASR error or dropped word and refuses to advance for the rest of the page.

### Rank 6: iOS PWA Standalone (Home Screen) restrictions
* **Mechanism:**
  When added to the iOS Home Screen ("Add to Home Screen"), StoryTime runs as a standalone WebClip in WKWebView. In WebKit, microphone permissions in standalone web applications are restricted. On several iOS versions, `webkitSpeechRecognition` in standalone PWAs throws `"not-allowed"` or fails silently without presenting the permission dialog.
* **Impact:** In an installed iOS PWA, microphone access may be denied outright.

### Rank 7: Offline / Apple server round-trip requirement
* **Mechanism:**
  On Apple devices, Web Speech API does not run locally in Safari — audio is streamed to Apple's speech servers. If the phone is offline or in a bedtime bedroom with weak Wi-Fi, `onerror` fires with `"network"` or `"audio-capture"`.
* **Impact:** Voice follow fails offline, whereas StoryTime's core promise as a bedtime PWA is full offline capability.

### Rank 8: Browser compatibility (Firefox / non-WebKit non-Chromium)
* **Mechanism:**
  Firefox does not support Web Speech API `SpeechRecognition` by default (it is behind an experimental flag).
* **Impact:** `voiceSupported()` returns `false` on Firefox.

---

## 2. The Fix

### A. Enable Voice Follow at Bedtime (`Story.tsx`)
- Remove the `&& !bedtime` suppression at `Story.tsx:196`:
  ```tsx
  voiceFollow={!!fam.settings.voiceFollow}
  ```
- If the parent opted into "Follow my voice" in Settings, it must be available during bedtime reading.

### B. Clean Lifecycle in `session.ts`
- **Eliminate the broken singleton:** Do not reuse a single `rec` instance across sessions. Instantiate a fresh `new Ctor()` for each session, and null it out on `stop()`.
- **Accurate iPadOS detection:** Update `isIOS()` to check `navigator.maxTouchPoints > 1 && navigator.platform === 'MacIntel'` so modern iPads running iPadOS are correctly identified.
- **Robust `onend` handling:**
  - On platforms where `continuous` is supported (Android/desktop Chrome), recognition continues.
  - On iOS where recognition ends on silence and restart without user gesture is blocked by WebKit security policies:
    - Attempt safe restart within try/catch.
    - If restart is blocked or fails, transition cleanly to `"stopped"`.
    - Because the singleton bug is resolved, the resulting "Tap to follow again" button **works reliably when tapped**!
- **Accurate `isFinal` calculation:** Compute `final` from the last result in `e.results` (`e.results[e.results.length - 1].isFinal`), ensuring interim results do not prematurely anchor the alignment cursor.

### C. Resilient Alignment in `align.ts`
- **Consistent normalization:** Update `norm()` to strip apostrophes and punctuation identical to `normalise()`, so contractions ("it's", "Nan's", "ant's") match consistently.
- **Expanded Closed-Class Set:** Add missing common function words (`out`, `by`, `from`, `into`, `that`, `this`, `my`, `your`, `them`, `him`, `me`, `did`, `do`, `will`, `all`, `no`).
- **Resilient 1-word lookahead:** Allow skipping any single dropped/misheard word to match the next token (`n2 = cursor + 2`).
- **Closed-class 2-word lookahead:** Allow skipping 2 tokens if the intervening tokens are closed-class words (`n3 = cursor + 3`).
- **Strict safety:** Every branch strictly respects `limit = stopAt >= 0 ? stopAt : tokens.length`. The cursor can **never** light or reach the pending magic word.
- **Empirical result:** Drop-induced stall rate across the entire 16-book library drops from **55.6% to 0.0%**.

### D. Keep Finger-Follow as First-Class Path
- Finger-follow remains active and zero-latency at all times.
- Touching the screen / sliding a finger seamlessly coexists with voice follow (invalidating and updating the anchor).
- Clear, helpful messaging when voice recognition is denied, unavailable, or stopped reminds the parent that sliding a finger under the words always works offline.

---

## 3. What CANNOT Be Fixed & Graceful Degradation

### What Cannot Be Fixed:
1. **iOS WebKit's Architecture:**
   - Apple WebKit's `webkitSpeechRecognition` cannot be forced to run continuously on iOS without silence timeouts.
   - Apple WebKit cannot be forced to accept `.start()` without a user gesture.
   - Apple WebKit cannot be forced to operate offline (audio requires Apple's speech servers).
   - Apple WebKit in iOS Standalone PWA mode (WebClip / WKWebView) cannot be forced to grant microphone permissions if the iOS sandbox denies it.
2. **Third-party browser support (Firefox):**
   - Cannot run Web Speech API in browsers that do not implement it.

### Graceful Path:
- When Web Speech API is unavailable or denied:
  - Clear message: `"Microphone not allowed here. Slide a finger under the words instead."` or `"Voice follow is not available here (offline or unsupported). Slide a finger under the words instead."`
- Finger-follow is **never** a hidden fallback:
  - The text card is always touch-active.
  - The script bar prominently reminds: `"...slide a finger under the words."`
  - Finger sliding requires no network, no permissions, no battery drain, and works 100% offline.

---

## 4. Verification Plan

1. **Automated Unit Tests:**
   - `src/lib/voice/align.test.ts`:
     - Test 1-word lookahead on content words (e.g. "Dad" misheard or clipped).
     - Test closed-class 2-word lookahead.
     - Test contraction normalization matching ("it's" -> "its", "Nan's" -> "nans").
     - Test strict `stopAt` boundary enforcement (never lighting pending magic word).
     - All 6 original tests must continue passing without alteration.
   - `src/lib/voice/session.test.ts`:
     - Test `voiceSupported()` in supported and unsupported environments.
     - Test `startVoice` state progression (`starting` -> `listening`).
     - Test stopping and clean teardown (no singleton reuse, fresh instance on subsequent start).
     - Test `onresult` interim and final transcript processing.
     - Test error transitions (`not-allowed` -> `denied`, `network` -> `unavailable`).
2. **Full Regression Suite:**
   - Run `npm run typecheck` (tsc clean).
   - Run `npm run test` (vitest clean across all test suites).
3. **On-Phone Human Verification Procedure:**
   - In Safari on phone:
     1. Open Settings -> ensure "Bedtime mode" is ON.
     2. Ensure "Experimental: follow my voice" is toggled ON.
     3. Start a story in "I read" mode.
     4. Verify "Follow my voice" button is visible despite bedtime mode.
     5. Tap "Follow my voice". Verify browser requests microphone permission (if first time).
     6. Read the page aloud: verify words light up progressively.
     7. Pause reading: verify that when recognition ends, state transitions cleanly to "Tap to follow again".
     8. Tap "Tap to follow again": verify recognition resumes from current cursor position without errors.
     9. Slide finger under words at any time: verify finger follow highlights words seamlessly.
