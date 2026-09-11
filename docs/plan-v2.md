# StoryTime plan v4 — final (2026-09-11)

Reviews folded: Grok (docs/reviews/grok-plan-v2.md) and GPT-6 Astra (docs/reviews/gpt-plan-v3.md). Execution order below is the build order.

## A. Sounds that teach (phoneme clips, blend, narrator)
1. Originals pinned under assets/phonemes-src/ with sha256 + attribution. `scripts/cut-phonemes.py` cuts by `scripts/phoneme-cuts.json` (start/end ms + fade per clip, chosen from per-clip energy/voicing maps and listening). Class rules: `s f h` unvoiced portion only; `m n l r` steady continuant before any vowel transition; vowels 280–350 ms from the steady middle; `t p k` burst + 25–40 ms; `b d g` burst −10 → +25 ms with a 3 ms fade (no blanket 10 ms fade on bursts). Escape hatch: a clip that cannot be cut into an intelligible sound is replaced by another Commons/OGL recording, never TTS. A voicing map is a check, listening is the gate; the owner signs off on sat/pin/dog/puff/pat/bat/ten/den/cap/gap/sat/sad at normal and bedtime rate.
2. blend.ts: one timeline built from decoded clip durations. Continuants hold ≤ clip length; vowels hold ≤ clip length (no scheduling past the buffer at any rate); stops = burst only with the next sound starting right after the burst (closure is allowed, artificial gaps are not); crossfade scaled to the shorter clip. The sweep is driven by that timeline per grapheme, not a uniform percentage. Cancellable: source nodes retained and stopped on Home/hide; bounded wait if the AudioContext stays suspended; `<audio>` fallback labelled as segmented.
3. speech.ts: queued utterance cancelled on stop(). `pickVoice()` prefers en-US. Narrator = `en-US-AndrewMultilingualNeural` (Jenny alternative); `o` clip swapped to the US /ɑ/ recording. Audio URLs versioned (`?v=`) and the runtime cache name bumped so new timings never pair with old narration; library contract tests re-run after re-rendering.
4. MagicPanel/Story copy: after an independent attempt and one nudge, the adult may model the sounds into the whole word ("Show me" = sounds → word); recorded as modelled. "Keep your voice going" gets a stop-consonant exception in the adult note.

## B. Finger-follow in "I read" (default, offline)
5. Three separate states: `pointer` (word under the finger, `.now`), `cursor` (adult reading position; advances only to the next word in order, never across an unresolved pink word), child results. `.read` trail = words before cursor. A drag begins only after 8 px of movement (taps on the pink button still click); pointer capture then; `touch-action: pan-y`; `pointercancel`/lost capture end the drag. Row-aware hit regions: word rects cached at drag start, expanded to the line box and 44 px below it so the finger travels under the print, not on it; whitespace resolves to the nearer word; a line return is a lift and land on the next word. Tap-only alternative: tap a word to move the cursor there (next word only). Adult drives first; the child may drive later. Presented as a shared-reading cue, never as decoding evidence.

## C. Record the sounds (family voice)
6. Settings → "Papa's sounds": unique sounds derived from the resolver inventory (18). Coaching per sound; mic permission prepared on the first tap with a ready cue; hold ≥ 500 ms; on release: decode → trim silence (keeping 40 ms head/tail so weak consonants and closures survive) → reject > 1.2 s or undecodable → autoplay alone and in a blend (sat/pin/…) → Keep / Redo / Use fallback. Stored as blob + trim offsets in IndexedDB. One resolver (`soundSource(clip)`) used by tiles, playBlend, Teach, Warm-up, SegmentPanel; buffer cache invalidated on re-record.

## D. "I'll try" — one extra child word per page
7. Candidate chosen before the adult reaches it (on page open), marked as a child turn; ceiling one per page; reviewed candidate lexicon (`ILL_TRY_WORDS`, CVC, explicit phoneme mapping) intersected with the learner's taught sounds; `his/has/as` and other /z/-final words added to EXCEPTIONS; adult judges independent vs supported; results keyed by token index; never in listener/bedtime flows.

## E. Family-story timings
8. Tap-as-you-listen on playback of an existing page recording: each tap stores `audio.currentTime` into tokens[].ms. Page is timed only when every token has a strictly increasing timestamp within the recording's duration; otherwise the untimed path stays. Preview the pre-magic stop before saving.

## F. Voice follow (opt-in, behind a flag)
9. Session state machine off → starting → listening → stopping/error with a visible Stop; singleton recogniser, en-US, continuous=false on iOS, interim results; page/session generation checks on every callback; restart at most 3× per page; abort on word card, Next page, Home, hide; no auto-resume after the word card ("Tap to follow again"); never beside MediaRecorder; startup/no-progress timeouts. Aligner: revision-aware (interim strings can be replaced), next token or skip one closed-class word, repeated text handled by position, a manual finger/tap correction invalidates the alignment session, hits on the pending pink word ignored and never matched past it. Honest states for offline/unavailable. Privacy copy in-app and README updated before the toggle is visible. Ships hidden behind Settings → "Experimental: follow my voice"; the owner measures wrong-word rate on the phone before it is promoted.

## Not taken
- Dropping voice follow entirely (both reviewers leaned that way): kept behind an experimental flag because the owner asked for it; nothing depends on it.

## Rules that must hold
Never TTS for phoneme clips. No red/buzzer on a miss. Validator fails closed. Don't remove features to satisfy a reviewer. Neutral names in the public repo. Adult keeps every verdict; ASR never judges the child.
