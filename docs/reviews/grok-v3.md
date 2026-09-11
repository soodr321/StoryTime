The pasted source was truncated in this message, so I’ll read the full offloaded prompt first and review only that text.The prompt file continues past Settings — I’ll read the rest of the source before reviewing.**FAIL** for the advertised family (photos, resume, bedtime, two kids). A single bundled **Nani reads** sitting, online, finished in one go, will work tonight. The rest of the product as described will strand, spoil, or invite a second story.

Gemini’s 12 are treated as done. These are new.

---

### 1. [P1] Photo stories dump a data-URL onto Home / shelf / Settings
`src/screens/Home.tsx` (`.art`), `Library.tsx` (`.ico`), `Settings.tsx` (customs row) render `pages[0].art` as text. `StoryView` already special-cases `data:`; the lists do not. One camera-roll page-1 turns the cover into tens of thousands of base64 characters at 96px, and can freeze the home tile.

**Change:** Same helper as `StoryView`: if `art.startsWith("data:")` render `<img>`, else the emoji.

### 2. [P1] Family-story TTS speaks the magic word before the child is asked
`src/screens/Story.tsx` `narratePage` (else branch) + `src/lib/audio/speech.ts`. Karaoke stop depends on `onboundary`. Safari often never fires it. Then `await h.done` runs the **whole** line, and only afterwards `if (!stopped && magicIdx >= 0) reachMagic()`. The child hears the answer, then the panel asks them to read it. `synth.cancel()` immediately before `speak()` also drops the next utterance on iOS; the `text.length * 120` guard then advances as if the line finished.

**Change:** Speak only tokens **before** the magic index as utterance 1; never speak the magic token; then `MAGIC_REACHED`. After `cancel()`, `speak` on `setTimeout(0)` (or skip `cancel` if the queue is empty). Treat the guard as `stop()` + error, not success.

### 3. [P1] Missing audio walks the story to Done and writes a finish
`narratePage`: `try { await pl.done } catch { /* keep going */ }` then `onDone` → `NARRATION_DONE` → next page. Offline, a cold CacheFirst miss, or a bad `m4a` repeats that until `moral` / `done`. `finishedRef` then calls `fam.finish(...)`. A failed load looks like a completed session.

**Change:** On `play()` reject or a ~4s stall with `currentTime === 0`, pause on that page with “Tap to try again” (re-use the Start gesture). Do not `NARRATION_DONE`. Never `finish` from a catch path.

### 4. [P1] Resume / Home during reread re-opens a graded magic word
Session stores `page` + `results`, not “this page’s magic is done.” `narratePage` does `findIndex` on `p.magic` and **does not skip words already in `ctx.results`**. Home during `reread` (or `modelling`) saves that page with the result already recorded. Next open: `START` → narrate same page → `MAGIC_REACHED` again → duplicate `results` (`Done` also `key={r.word}`).

**Change:** `magicIdx` = first magic token whose `normalise(t)` is not in `results`. If none, treat as a normal page (listen: play through; read: enable Next). Persist `state` or a `pageMagicDone` flag on the session for the same reason.

### 5. [P1] Bookshelf start destroys the in-flight story; resume ignores `session.mode`
`Library.tsx` always `onStart(s, "listen")` with `resume` defaulting false. `setSession` is one slot per child (`family.tsx`). Opening any shelf title silently deletes the other story’s page. Home’s two mode buttons both pass `!!resumable` but **whichever you tap wins**, so “Carry on” + **Nani reads** can resume an **I read** sitting with audio.

**Change:** If `session` exists and `session.slug !== s.slug`, confirm “Leave {title} on page N?” If same slug, `onStart(s, session.mode, true)`. On Home, one **Continue** button that uses `session.mode`; don’t offer the other mode until they discard.

### 6. [P1] Bedtime does not end the ritual
Done already says “go find someone” / “one real book, then sleep.” Then `onHome` → Home, where `todayFor` immediately picks the **least recently finished** book and shows **Nani reads** / **I read** again. Settings copy (“One story, then a real book”) is not enforced. There is no 10–15 min stop. A 4.5-year-old will demand the next tile; Nani has no scripted out.

**Change:** After `finish`, if `bedtime` (or always in the evening path), route to a closing card with no mode buttons: the “go find someone” line + “one real book” + **Done**. Home that night: hide modes, show that card until next calendar day (store `lastFinishedAt` on the kid). Optional: after ~12 min in `StoryScreen`, jump to `moral` rather than opening another book.

---

### 7. [P2] Listener never gets a turn
For `role === "listener"`, `magicIdx` is always -1, so `NARRATION_DONE` immediately `nextPage`. The line “When the page is done, tap any word to hear it again” is on screen **during** narration; word taps do not speak until after `narrating`/`reread`, which never pause. The sibling is a podcast.

**Change:** If `listener`, on page end go to a `pageHold` state (Next enabled, word taps call `speakText`). Don’t auto-advance.

### 8. [P2] IndexedDB writes cannot fail in the UI
Every persist is `void save*(...)` (`family.tsx`, `store.ts`). Photo stories put several 640px JPEG data-URLs in **one** `st:custom-stories` key (~33% bigger than binary). `set()` quota throw → memory has the story, reload does not. Same for `saveSession` / `recordFinish`.

**Change:** `await` saves in `addCustom` / `finish` / `setSession`; on failure toast “Not saved on this iPhone — remove a family photo and try again.” Store photos as Blob values under `st:art:{slug}:{i}`, not in the JSON.

### 9. [P2] Progress is empty at first paint and can apply to the wrong child
`ready` flips before `loadProgress`. Home’s first `todayFor` treats everything as unfinished, then the list jumps. `loadProgress(id).then(setProgress)` has no generation guard — switch Reader → Little one quickly and Reader’s map can land on the sibling.

**Change:** Load progress (or all kids’ progress) **before** `setReady(true)`. In the effect, `let n = 0; const my = ++n; ...then(p => { if (my === n) setProgress(p); })`.

### 10. [P2] Magic panel covers the sentence; words are not child-tappable; child can grade themselves
`.panel` is `position: fixed; bottom: 0` (~ tiles 96px + verdict 60px + skip) over `.cap` (56px). `.app` only pads `capH`. On a phone the pink word disappears exactly when it is the child’s turn. `.w` is `padding: 1px 5px`. The green **✓ Yes!** is a 60px target at the child’s thumbs.

**Change:** When the panel is open, pad `.story` by the panel height (or shrink `.art-box` to ~16dvh). Word buttons: `min-height: 44px; padding: 6px 10px`. Move **Yes** / **Say it together** into a clearly labelled “Grown-up” row (or long-press Yes) so the child cannot self-advance.

### 11. [P2] The grandmother script is empty on first launch
`readers[0] ?? "Grown-up"` — default `readers: []`, and only the first name is ever used (`Story.tsx`). Default kids are “Reader” / “Little one”. `KidEditor` “tap the last sound” on an earlier chip **slices away** later GPCs with no undo. Nani has to find Settings, names, sounds, and her own name before the in-story script (`Papa reads the grey words`) is true.

**Change:** First-run: who is reading tonight (chip, stored as `readers[0]` or `settings.tonight`), child’s name, “last sound the school taught” as a **level** picker (set 2–5) not a wipeable chip strip. In-story, pick tonight’s grown-up if `readers.length > 1`.

### 12. [P2] Builder still suggests the wrong magic word and fails closed on photos
`AddStory.tsx`: `chosen(i)` defaults to `candidates[i][0]` (often `sat` / `had`, not the noun). `Nani's` → `nanis`; `Veer` / `Nani` become “decodable” names. Split `(?<=[.!?”"])\s+(?=[A-Z“"])` cuts `Dr. Singh`. `shrink()` has no `try/catch` — HEIC/decode throw leaves the 📷 selected with no art. `ready` includes `arts[i] || true` (always true); that’s fine, but a failed photo looks saved as 📖.

**Change:** Prefer the longest candidate, skip names (capitalised tokens in the source), strip possessives before `normalise`. Don’t split on `^[A-Z][a-z]{0,2}\.`. `shrink` in try/catch + “Couldn’t use that photo.” Don’t auto-select; require a tap (default **none** is safer than a wrong word).

---

### PASS/FAIL — family tomorrow
**FAIL.** Coach Nani onto one bundled **Nani reads** story, stay online, don’t leave during the pink word, don’t open the shelf, don’t attach photos: that path is usable. Photos, resume, bedtime “one story,” and the younger sibling are not.

### Highest-leverage for v4
1. **Close the evening:** one story, then a lock screen with “go find someone