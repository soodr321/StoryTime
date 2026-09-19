# state — 2026-09-19

**Live:** https://storytime-coral.vercel.app · https://soodr321.github.io/StoryTime/ · repo soodr321/StoryTime

## This session
**Pictures.** Ten drawn banners, one per book: sky band, ground band, one prop, no figures, and never
the word the child must decode that night. Four Milo Winter plates from the 1919 Aesop for Children
(public domain) survive as bookshelf covers, square-cropped; the shepherd-boy plate was dropped (a
wolf mid-attack on a lamb). Reviewed by Grok four times: the first drafts had figures I could not
draw, the second still pictured five nights' words, the third gave the lion the same pit as Sam.
APPROVED on the fourth.
**Four set-3 books**, where the shelf had none: The Pot on the Fire, The Cat in the Tin, Dad and the
Pig, The Map in the Tin. A child at 12 sounds could previously only re-read books below their level.
**Letterforms.** Everything a child decodes is now Andika (single-storey a and g). The tiles were
Baloo 2, whose a is double-storey; the story text was Literata, whose g has a looped tail.
**Bedtime.** "First try" and "Needs help" had a contrast ratio of 1.0 - invisible - because their
backgrounds were hardcoded while their text colour came from a token the night palette flips. Now
7.9 and 8.3, gated by scripts/bedtime-palette.test.ts.
**One quiet tap past a word**: "you say it, and carry on", silent, no error state, word returns tomorrow.
**A word missed after midnight** came back a day late; nextMorning now counts from the reading day.
**Sound packs**: `npm run sounds:build <commons|family|soundcity>` swaps the whole set through the
same gates; a pack marked non-redistributable is refused by both deploy scripts.

## Reviews
Grok APPROVED the pictures (docs/reviews/grok-art-1..4.md). Gemini 3.8 Flash gave GO on the build
(docs/reviews/gemini-plan-v6.md, gemini-build-v6.md).

## Waiting on the owner
- Permission from Kathryn J. Davis (Sound City Reading) for her alphabet sounds, requested by email
  2026-09-18. If it comes: drop the files in assets/packs/soundcity, `npm run sounds:build soundcity`,
  flip redistributable, deploy. If not: nothing changes.
- Record the family's own sounds: `npm run dev`, open the printed address on the phone, Settings →
  Record the sounds. Each take lands in assets/voice-pack/; then `npm run voice:import`.
- Two minutes on the real phone in the dark bedroom (Gemini's ask): check the iOS bars do not cover
  the bottom controls and that the 18px edge rejection feels right in the hand.

## Not done
Calm role cues (Gemini [P2]). Real illustrations beyond the four plates. Real-hardware testing.

## What changed per loop (K–1 phonics teacher lens)
**Loop 1** — blending is continuous, not chopped; the picture is hidden while the child reads the word card; a "look again" cue; read-back routine (whole line → help one word → ✓ on that word → reread smoothly); tricky words show the regular part with the odd bit underlined; "independent", never "sight"; onboarding starts low with tap-to-hear sounds; spaced warm-up of yesterday's helped/skipped words is mandatory when due; CVC-only targets at phase 2 (no consonant clusters until taught); set-1 and set-2 original stories so honest onboarding has a book; a shaky story repeats tomorrow; the adult and the device never say the whole word before the child blends; grey words are never tap-to-hear in read mode; the bookshelf lets a favourite be reread in either mode.
**Loop 2** — Web Audio overlapped blend with explicit hold times and a sweep under the graphemes; "start here and slide through the word" language with a persistent adult note; adult-judged verdicts (first try / after a nudge / after the model / skipped) independent of tile taps; only first-try blends count as known, everything else returns tomorrow; one-word dictation after the read-back (fingers first, then boxes, model = stretch then slow count, distractor vowel); teach-a-sound routine (hear, mouth cue, action, words, trace, tricky words at set boundaries, blend from earlier sounds) gated on readiness with an explicit override; untaught exception words are never sounded out; true beginner level with a teach-first path; results keyed by token index; punctuation outside highlights; 30-night champion card; originals rewritten with clear causality.
**Loop 3** — readiness from a per-child attempt history tied to the taught count, scored on a rolling pool of ~10 word attempts (no deadlock at set 1, no freeze after one nudge); review words due the next morning; today's story is the one that practises the newest sound; a second set-1 story; progressive disclosure on the word card; build word only from a first-try result and a failed build comes back; one new sound per calendar day; listener gets an oral prompt per page; settings chips only play; the app never talks over the grown-up in read mode; trace direction modelled by the adult; lowercase magic words with punctuation outside.

## Try first on the phone
1. Open the stable URL, Add to Home Screen, run Welcome as the reader at the level you believe is true (start low: the app recommends the next sound from evidence).
2. "Nani reads" one story end to end: magic word → wait 5 s → ✓ or Needs help → read-back → build a word.
3. Add a family story with one page recorded in your voice, then read it back in "Nani reads".

## Reviewer items deliberately not applied
- GPT v7 #5 pronunciation lexicon: validator fails closed on contractions, silent-e, untaught digraphs, clusters and exception words instead.
- GPT v7 #6 forced alignment for parent recordings: recordings play on the reread only; the first pass uses speech so the magic word is never leaked.
- Gemini loop 2 #9 "A trick is sad.": rejected — "tr" is a phase-4 cluster; the line stays "It is sad."
- GPT loop 3 #3 oral-only activity: a second set-1 story was added instead; an oral activity is queued.
- Real Nani voice, a Panchatantra set beyond two tales, and a placement screen remain queued.

**Resume rule:** on a 5-hour usage limit or an explicit "pause", resume from this file, up to 3 consecutive sessions.
