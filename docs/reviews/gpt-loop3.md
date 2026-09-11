At “s a t p,” week one breaks at progression: the child gets only *Pat and the Tap*, then cannot legitimately unlock /i/. I would not release this as the family’s phonics programme tomorrow.

1. **[P1] Progression deadlocks, then can cascade incorrectly.** In `src/lib/store.ts`, `readyToAdvance()` examines the latest result from two different `StoryProgress` records, not two sessions. Set 1 has only one eligible story, so repeated successful nights never satisfy `recent.length >= 2`. Conversely, once readiness is achieved through custom/additional stories, the evidence is not tied to the current GPC set and can authorize several new sounds consecutively. Store an attempt history with the learner’s GPC count/timestamp; require two qualifying attempts since the most recently taught GPC, including repeats of one story. Reset readiness after teaching in `src/screens/TeachSound.tsx`.

2. **[P1] “Tomorrow” means 24 hours later, not tomorrow morning.** `scheduleReview()` in `src/lib/store.ts` sets weak words to `now + DAY`. A word missed at 7 p.m. will not appear at 8 a.m. the next day. Schedule weak words for the next local calendar day instead.

3. **[P2] Week-one variety is too thin.** `src/screens/Home.tsx` offers the same six-page story throughout the set-1 period. With the progression defect, nights 2–7 become *Pat and the Tap* repeatedly, which is likely to bore a 4½-year-old. Add another short set-1 story or rotate a 30-second oral blending/sound-recognition activity while the current GPC set is being consolidated.

4. **[P2] Repeated target words are handled inconsistently.** In `src/screens/Story.tsx`, `magic` is matched by word value, so both occurrences of “tap” become targets. Read mode can grade both, but listen mode stops at the first, rereads the page, and advances with the second still visibly ungraded. Represent targets by token index, or designate only one occurrence per page.

5. **[P2] The listener experience supports attention, but is mostly passive.** `src/screens/Story.tsx` provides highlighted narration and tap-to-hear vocabulary—useful print awareness, not merely babysitting—but no retrieval, prediction, rhyme, sound noticing, or comprehension turn. At `pageHeld`, add one optional oral prompt such as “Show me the tap” or “What happened next?” with no score.

6. **[P2] The grandmother’s decision panel is over-engineered.** `src/components/MagicPanel.tsx` simultaneously offers two positive verdicts, modelling, restart, skip, a timed wait, and six prohibitions. Use progressive disclosure: initially show “First try” and “Needs help”; after “Needs help,” reveal a precisely worded nudge, then model/skip. Record the verdict from that route.

7. **[P2] The encoding task overstates its vowel contrast.** At “s a t p,” `src/components/SegmentPanel.tsx` cannot supply a distractor vowel because /a/ is the only taught vowel and is already in every target. Do not claim a vowel choice at this level; use a clearly described consonant foil until /i/ is taught. Also select `buildWord` from a first-try result in `src/screens/Story.tsx`, rather than asking the child to spell a word they only managed after help or a model.

8. **[P2] Schools may object to calling every item a “new sound.”** `src/screens/TeachSound.tsx` and `src/screens/Home.tsx` later describe `c`, `k`, `ck`, `ff`, `ll`, and `ss` as separate new sounds, although several are alternative spellings of the same phoneme. Change the umbrella term to “sound-spelling” or “grapheme,” and qualify “never letter names” as “use the sound—not the letter name—during this activity.”

**FAIL — family uses it tomorrow morning.**

Tell the parent: **Use it as a shared-reading game only; stay with “s a t p” and do not use the override to advance sounds until progression is fixed.**