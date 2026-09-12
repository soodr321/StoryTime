# StoryTime — audit findings (2026-09-11/12)

The audit in `docs/audit-plan.md`, run as a family would use the app: every screen walked step by
step and photographed, every sound the app makes captured and transcribed, every clip measured.
Reviewed first by GPT-6 Astra and Gemini 3.1 Pro (through Antigravity CLI — the `/gemini` skill's
path; the older gemini-cli OAuth route is retired for individual accounts).

Each finding says how it was found, because that is the point of the exercise: **a defect the family
reports has to leave a number behind.**

## What the family heard (found by transcribing the app's own audio)

| # | Finding | How | State |
|---|---|---|---|
| H1 | **The blend model was not a word at all.** Concatenated phoneme clips transcribe as "Ssssssss" (sat), "hehehe" (pin) and nothing at all (dog). Isolated segments have no coarticulation, and the vowel loop pulsed. | ASR over the rendered blend | fixed: the narration voice says the word slowly (143 pre-rendered words); the phone's voice and the clip chain remain as fallbacks |
| H2 | **/b/ /d/ /g/ had no voicing**, so the app said /p/ /t/ /k/. Cut to their bursts alone. | voice onset time + voiced tail | fixed: 45–60 ms of voicing, VOT 5 ms |
| H3 | **Every vowel wandered** — the hand-picked windows slid in timbre, and the steadiest parts of those recordings are the speaker's falsetto tail. | spectral steadiness, under a pitch constraint | fixed: steadiness 0.94–0.98, all 122–144 Hz |
| H4 | **The clip set was four voices** (112–394 Hz), with /o/ an octave above the rest. | pitch per clip | fixed earlier the same night: 117–158 Hz |
| H5 | **Loudness jumped 8.6 dB between sounds** (bursts peak-normalised against nasals). | RMS per clip | fixed: 3.6 dB |
| H6 | **The narration ran at 166 words per minute**, and 194 while actually speaking. | words ÷ duration, and ASR word timings | fixed: 109 overall, 170 speaking, plus a Reading pace control |
| H7 | **39 of 63 pages ran their sentences together** — no pause at a full stop. This is most of why it felt rushed. | gaps between ASR word timings | fixed: sentences synthesised separately and joined with a 420 ms pause; 58 of 63 now stop |
| H8 | **The karaoke highlight sat up to 1.9 s from the spoken word.** Sentence-by-sentence synthesis and mp3 padding shift the synthesiser's own offsets. | ASR timings vs shipped timings | fixed: timings measured from the shipped file, aligned by edit distance; average offset 9 ms |
| H9 | **18% of words are spoken less than 200 ms apart**, faster than a 4-year-old's eye can move. | gap distribution | fixed: the highlight holds a minimum dwell, then jumps to where the voice is |
| H10 | **The spoken prompt said "Can you read it?"** while the screen said "start at the first sound and slide through the word" — the audio invited the picture-guessing the adult script forbids. | prompt audio transcribed | fixed: every prompt now matches the screen |
| H11 | **The reading pace reached the narration but not the models** — the read-back, the dictation and the teach blend ignored it. | code path audit | fixed |
| H12 | "I read" is genuinely silent. The complaint about speed was about the recorded narration and the model. | audio probe per mode | confirmed, not a defect |
| H13 | **"Sam" is heard as "Some"** at the start of a sentence in two places; "Pat laughed" as "But Logan". | ASR transcript vs page text | open: ASR is unreliable on isolated short words, so this needs the owner's ear |

## What the family saw (found by walking the app and looking at the screens)

| # | Finding | State |
|---|---|---|
| V1 | Every read word was painted in a green box, so a page became a wall of boxes rather than a sentence | fixed: read words are quietly greyed, only the spoken word is boxed |
| V2 | Each word was a block with its own padding, so punctuation floated away from it ("came .") and spacing was uneven | fixed: words are inline again and "came." never splits |
| V3 | The adult script ran to five lines in the story's own serif, on every page, every night | fixed: one short line in the interface font |
| V4 | "Next page" sat disabled with no explanation while the child still owed a word | fixed: it says whose word it is and which one |
| V5 | The volunteered word was outlined in dashed orange — it read as an error | fixed: a soft invitation |
| V6 | The caption from the previous page lingered into the next | fixed |
| V7 | The word card buried the sentence the word came from | fixed: the veil shrinks so the line stays visible |
| V8 | The Settings child row overflowed its card (the role selector was cut off) | fixed |
| V9 | Settings pointed at a teach routine "on Home" that is not always there | fixed: it points at the one in Settings |
| V10 | Three grown-up controls were under 44 px | fixed |
| V11 | Contrast: no failures on any screen at any size | pass |

## What only the owner can judge

- Whether the blended word and the letter sounds are right **to a human ear**, at both paces, on the
  phone's own speaker (audit plan §1.6). Every automated check now passes; ASR cannot settle it.
- H13's two suspected mispronunciations.
- Everything in §6 (real devices) and §12 (three nights with the family).

## Still open, stated rather than half-done

- No test runs on real hardware, so audio/visual desync on a slow phone, a child spamming the letter
  tiles, and a screen at 2% brightness with Night Shift are uncovered (Gemini's list).
- One `dayStamp()` across the six places with their own midnight.
- "Again" on the end screen; set-3 books; real illustrations.
