# state — morning summary (2026-09-11)

**Design:** direction A "warm storybook" applied 2026-09-11 (commit a925b31): Baloo 2 + Literata self-hosted, paper ground, glow hero card, SVG icons and fox/crow mascots, stars, tonight strip, done badge. Canvas: https://claude.ai/code/artifact/d29dd5ae-7522-48b2-b17e-993f2af20b54 · working files in design/.
**Version:** v18 · 26 commits · 111 tests green · https://github.com/soodr321/StoryTime
**Stable URL:** https://soodr321.github.io/StoryTime/
**Latest Vercel (temporary, expires ~1 h unless claimed):** https://temporary-speedy-banjo-bia3yp0.vercel.app — claim: https://vercel.com/claim-deployment?code=eeb8ff5e-e6d3-46c2-9090-34e5311f8b8c
**Reviews folded in (14):** engineering — Gemini v2, Grok v3, Gemini v5, Grok v6, GPT-5.6 v7; teacher loops — loop 1 GPT/Grok/Gemini, loop 2 GPT/Grok/Gemini, loop 3 GPT/Grok/Gemini. Transcripts in docs/reviews/.

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
