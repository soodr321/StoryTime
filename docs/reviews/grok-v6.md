The pasted source was truncated; I’ll read only the offloaded prompt so I can review the complete pasted code, not the project files.The rest of the pasted source is still in that prompt file; I’ll keep reading from the cut.**Verdict: PASS** for tomorrow morning if they use a **built-in story** and **Nani reads**. **Do not** depend on parent-recorded pages or unrecorded family stories on iPhone until the P1s below are patched.

v3/v5 fixes are in place (no phantom sibling, `audioMs` fallback, sequential clips, media keyed by page text, history, honest ending, 1.4s beat, saves outside updaters). What is left is iOS media, not the daily picker.

---

### [P1] `src/lib/audio/player.ts` — `playOn` can throw before listeners attach (iOS)

```287:306:src/lib/audio/player.ts
function playOn(el: HTMLAudioElement, src: string): Playing {
  cleanups.get(el)?.();
  el.pause();
  el.src = src;
  el.currentTime = 0;
  // ...
  void el.play().catch((e) => { if (!settled) { settled = true; off(); reject(e); } });
```

Assigning `src` already resets time. Setting `currentTime = 0` in `HAVE_NOTHING` throws `InvalidStateError` on WebKit. `playNarration` then throws **outside** `narratePage`’s try/catch (`void narratePage(...)`), so there is no stall UI, no ▶, no Next — the page sits on “narrating” forever.

**Change:** delete `el.currentTime = 0`. If you need a rewind, do it in `loadedmetadata` inside try/catch.

---

### [P1] `src/screens/Story.tsx` — iOS parent recordings never `ended` → page hung

After 5s, a stall only fires if `currentTime === 0`. If MediaRecorder `data:audio/mp4` starts but WebKit never emits `ended` (common with data-URL mp4, worse with `playbackRate ≠ 1`), this waits on `pl.done` forever:

```632:637:src/screens/Story.tsx
const stall = new Promise<"stall">((res) => setTimeout(() => res("stall"), 5000));
let ok = true;
try { const r = await Promise.race([pl.done.then(() => "done" as const), stall.then(() => (pl.el.currentTime === 0 ? "stall" : pl.done.then(() => "done" as const)))]); if (r === "stall") ok = false; } catch { ok = false; }
```

`playOn`’s `timeupdate` net uses `el.duration`, which is `NaN`/`Infinity` on these clips, so it does not save you. `audioMs` is stored and then unused as a deadline.

**Change:** race `pl.done` against `(p.audioMs ?? 8000) / rate + 1500`. On timeout, `finish()` the page (or stall with ▶ if `currentTime === 0`).

---

### [P1] `src/screens/Story.tsx` — `data:` narration is passed through `storyAsset`

Saved pages set `audio: recOf(i).dataUrl`. Playback always does `playNarration(storyAsset(story, p.audio))`. If `storyAsset` prefixes a library path, every recorded page fails load → 5s later the child sees “The story couldn't load. Check the connection”.

**Change:** `const src = p.audio.startsWith("data:") || p.audio.startsWith("blob:") ? p.audio : storyAsset(story, p.audio)`. Same guard in `speak()` / moral.

---

### [P1] `src/lib/audio/player.ts` + `Story.tsx` — `playbackRate` on data-URL mp4 (iOS + bedtime)

`p.el.playbackRate = rate` runs immediately after setting `src` (`rate` is `0.88` in bedtime). On iOS that often yields **silent** playback with `currentTime` stuck at 0 → stall copy, or a hang if time moves and `ended` never fires.

**Change:** play data URLs via `URL.createObjectURL(blob)` (fetch the data URL → blob) and set `playbackRate` only in `loadedmetadata`. Revoke the object URL in the existing `cleanups` path.

---

### [P2] `src/lib/audio/speech.ts` — `cancel()` then `speak()` is dropped on iOS Safari

```345:361:src/lib/audio/speech.ts
synth.cancel();
const u = new SpeechSynthesisUtterance(text);
// ...
synth.speak(u);
const guard = setTimeout(finish, Math.max(2000, text.length * 120));
```

Family pages with no recording, word taps, and TTS fallbacks stay silent until the guard; karaoke never moves, then the machine jumps to the magic word. `unlock()`’s empty utterance is the right gesture, but it does not fix this.

**Change:** `const kick = () => synth.speak(u); synth.cancel(); setTimeout(kick, 0);` and don’t resolve `done` until `onend` **or** the guard, while `stop()` still `cancel()`s.

---

### [P2] `src/screens/Story.tsx` — child-facing failure copy; superseded narration counts as success

Stall caption: *“The story couldn't load. Check the connection, then tap ▶ to try again.”* That also fires on an iOS autoplay miss (retry is the real fix). Separately, `playOn` cleanup **resolves** `done` (not abort). `narratePage` then hits `if (!stopped && magicIdx >= 0) reachMagic()` after retry / Home / reread.

**Change:** caption → “Tap ▶ to hear this page.” Thread an `aborted` flag (the `live` boolean you already have) and return after `await` if it is false. Have cleanup reject or no-op, not “playback finished”.

---

### [P2] `src/lib/audio/record.ts` + `src/screens/AddStory.tsx` — iOS recorder + lost takes

`rec.start(250)` with a timeslice is a known empty/invalid mp4 path on iOS; `stop()` then returns `null` with no message. Back while recording never `stop()`s the stream (status-bar mic stays on). `setRec({ ...rec, [key]: r })` / `setArts({ ...arts, [p]: e })` are stale closures if two pages are updated in one tick.

**Change:** `rec.start()` with no timeslice on iOS; `useEffect` cleanup `recRef.current?.stop()`; `setRec(prev => ({ ...prev, [key]: r }))` (same for `arts` / `magic`).

---

### [P2] `src/App.tsx` + `src/screens/Welcome.tsx` — grandmother first-run / save failures she never sees

Welcome `autoFocus` opens the iPhone keyboard over **Start reading →**. Toasts are not mounted on Welcome or Story (`toast` only in the non-story shell), so “Couldn't save your place” never appears while reading. Post-onboarding every cold start is the family picker (`useState({ name: "family" })`) — fine for two kids, easy for Nani to tap the listener by mistake and get a story with no magic words.

**Change:** drop Welcome autofocus (or `scrollIntoView` the CTA). Render the toast above Story/Welcome. After `onboarded`, default route to `home` (keep the switcher).

---

**PASS** for a library “Nani reads” session on the phone that will be used tomorrow. **FAIL** that same morning if the story is a family recording on iPhone Safari.

Tell the parent: open the home-screen icon tonight, pick the 4.5-year-old, run **today’s built-in story** through the first pink word with sound on, and do not record new pages on the iPhone until a page actually plays back.
