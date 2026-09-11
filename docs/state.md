# state

**Version:** v7. Stable URL: https://soodr321.github.io/StoryTime/ (GitHub Pages). Vercel: temporary deployments until the owner claims one or runs `vercel login`.
**Reviews folded in:** Gemini v2 (12), Grok v3 (12), Gemini v5 (8), Grok v6 (8). Next: GPT-5.6 via Codex (limit resets 2026-09-11 01:04 PDT; cron 01:13) → fold → v8.
**What works:** welcome flow; family profiles (reader + listener); per-child resume with mode; 7-story library (5 Aesop, 2 Panchatantra) with neural narration + word timestamps; listen + read modes; 'Say it together' modelled blend; skip; moral + read-back line; bedtime mode with nightly closing card; family story builder (emoji or photo per page, parent-recorded narration or on-device speech, magic words suggested from the child's decodable bank, validator rejects untaught digraphs); shelf with in-flight confirm; week strip; parent summary; offline precache; IPA phoneme clips (CC BY-SA).
**Next step:** GPT-5.6 review → fold → v6. Then owner tests on iPhone + Android; record real phoneme clips optional (IPA set is fine).
**Resume rule:** on a 5-hour usage limit or an explicit "pause", resume from this file, up to 3 consecutive sessions.

## Reviewer items not applied (with reasons)
- GPT v7 #5 "curated pronunciation lexicon": not in one night; instead the validator fails closed on contractions, silent-e (split digraph) and untaught digraphs, which covers the phase-2 word bank.
- GPT v7 #6 "forced alignment for parent recordings": mitigated by stopping ~350 ms before the estimated magic-word boundary; real alignment is a later phase.
- GPT teacher L1 #9 dictation/segmenting task: "Next sound to teach" card added; a dictation activity is queued for a later loop.
