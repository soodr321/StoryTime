# StoryTime (Veer Reads) — Build Plan

**Date:** 2026-09-10 · **Status:** review round 3 of 3 (Grok ✓ → Gemini ✓ → GPT-5.6) · **Repo:** new public repo `soodr321/StoryTime` (this folder keeps the decision trail only)
**Inputs:** [research + 6 concepts](veer-reading-game.md) · [X evidence](veer-reading-game-x-bookmarks.md) · [prototype](veer-reads-prototype.html) · reviews in `veer-reads-reviews/` (Grok ×3, Gemini ×3, GPT-5.6 ×1)

## What we are building

A **PWA on Vercel**, installable on iPhone and Android from the browser, with two tracks in one daily story:
Nani's voice reads a rich story with karaoke highlighting; Veer reads only **magic words** and a **one-line read-back**, both restricted to the letter-sounds and tricky words the parent has marked as taught, validated in code. Parent grades with ✓ / ✗. No microphone in v1.

Library at launch: **English classics** (Aesop, Beatrix Potter, Just So Stories, nursery tales — all public domain) and **Panchatantra** (public-domain Ryder 1925 translation as source, retold for age 4–5), plus parent-made family stories.

## Decisions carried from the reviews (GPT-5.6 FAIL → what changes)

| GPT finding | Decision |
|---|---|
| Story attribution wrong, causal chain missing, moral dishonest | Content contract requires `source`, `tradition`, `rights`, and a retelling checklist (setup → want → trick → consequence → feeling). Prototype already re-written this way. |
| Validator checks letters, not graphemes; passes `is`, `a`; no tricky words | Validator = greedy grapheme tokeniser over the child's **ordered GPC list** + explicit **tricky-word set**; fails closed on empty/unknown; returns reasons. Already in the prototype; becomes a tested package. |
| No real audio; karaoke timing guessed | Narration is **pre-generated per page** with word timestamps (edge-tts word boundaries now; recorded Nani later). Phoneme clips are **recorded once** per GPC, never synthesized. |
| Globals + sleeps, no persistence | Explicit XState-style machine (`narrating → magicWord → verdict → reread → moral → done`), local-first persistence (IndexedDB) at every transition. |
| Not phone-ready, not a PWA, a11y/contrast | Mobile-first layout from day one; manifest + service worker + safe areas; buttons not divs; ≥48px targets; AA contrast tokens. |
| Parent-authored text via `innerHTML` | All story text rendered as text nodes; only the demo caption bar used HTML and it does not ship. |

## Stack (free tier throughout — Tenet 3)

- **App:** Vite + React 18 + TypeScript, `vite-plugin-pwa` (Workbox). No SSR. Deployed on **Vercel** (static, free). Custom domain optional.
- **State:** XState for the story machine, with explicit **interrupt states** (double-tap, tap during narration, tap a word while a clip plays): inputs are ignored while audio plays except Home and the parent buttons; Zustand + IndexedDB (idb-keyval) for learner model, progress, library. No login in v1: one device, one child. Optional later: Supabase sync (same pattern as OpenFinn).
- **Audio:** pre-generated audio per page (M4A/AAC preferred on iOS, MP3 fallback) + `tokens[]` with start-ms per token (tokens carry their punctuation; never re-split text at runtime). Karaoke highlights from `audio.currentTime`, never from timers. **One global `<audio playsinline>` element**, unlocked on the Start tap and reused by changing `src` (a new element per page is blocked on iOS). Phoneme clips play through a **singleton** player (pause + reset before the next clip, so rapid taps never stack). Library audio is **cache-on-play** with a Workbox LRU (`maxEntries: 20`), never precached, so the audio cache can never push the origin over iOS quota and wipe IndexedDB.
- **Voices:** v1 = edge-tts `en-IN-NeerjaNeural` for Nani + word boundaries ($0). Audio is generated at family-deploy time, not committed to the public tree (edge-tts is an unofficial API; Piper is the public-tree fallback). v2 = Nani's recorded voice against frozen page text, same timing file format, forced alignment (ReadAlongs Studio, MIT).
- **Phoneme clips:** recorded once by the parent in Phase 0 (16 clips: s a t p i n m d g o c k ck e u r), shipped under `/sounds/`. Never synthesized.
- **Story generation (family stories):** LLM via `modelRouter`-style wrapper, output must pass the validator + a safety check before it enters the approval queue. Never displayed unapproved. Free path: Ollama/local; paid path noted inline.
- **Library content:** Markdown/JSON in-repo, `scripts/validate-library.ts` runs in CI and fails the build on any story that breaks the contract, **including a 1:1 alignment check between `tokens[]` and the TTS word boundaries** (contractions, hyphens and attached punctuation are where engines split differently).
- **Tests:** Vitest for validator, tokeniser, machine, content contract; Playwright smoke on iPhone-SE and Pixel viewports.

## Decisions (delegated to Grok, 2026-09-10)

1. **Sentence case** for the read-back line ("It is a trick."): matches real decodable books; the validator lowercases before checking.
2. **Letters & Sounds phase 2 order** stays, stored as a data file so a school sequence can replace it later.
3. **Neural Indian-English TTS for v1**; record Nani only after library text is frozen (v2).
4. **Neutral public repo**: app name StoryTime, default profile "Reader", the child's name is local data set by the parent on first launch. No child name in README, code, or defaults.
5. **Tricky words are a locked set** (`the, a, I, is, to, no, go, into` …). The parent can delay *teaching* one, but cannot reclassify it as GPC-decodable; the validator never tokenises a word in the tricky set.

## Content contract (`library/<slug>/story.json`)

```
{ slug, title, tradition: "aesop|panchatantra|classic|family", source: {work, author, year, rights:"public-domain|owner"},
  retelling: {level, checklist:{setup,want,action,consequence,feeling}},
  pages: [{ tokens: [{t:"“Dear",ms:0},{t:"crow,",ms:410}…], art, magic: ["did"], audio: "p1.m4a" }],
  moral: { spoken: "…", line: "It is a trick.", lineWords: [{w:"It",kind:"decodable"},{w:"is",kind:"tricky"}…] },
  level: { gpcs:[...], tricky:[...] }   // minimum learner state this story needs
}
```

## Phases (each ends with a deploy you can open on a phone)

**Phase 0 · One story on a phone (3–4 days) — stateless on purpose**
Vite PWA on Vercel. **Portrait-first layout designed fresh, not a CSS port of the landscape demo**: 1-column home, sentence card with the magic panel below it, ≥48px targets, `viewport-fit=cover` + safe-area insets. Validator as a tested package (the learner model is a constant for now). Karaoke driven by `audio.currentTime` against `tokens[]` through the single global audio element. Recorded phoneme clips. **No persistence, no settings, no shelf** — Phase 0 exists to prove installability and audio sync on real hardware.
*Done when:* installed from the home screen on **a real iPhone (Safari: apple-touch-icon 180, standalone, Add-to-Home-Screen coach mark) and a real Android (Chrome install prompt)**, and Veer finishes The Fox and the Crow on both with audio. Playwright viewports are not acceptance.

**Phase 1 · Real reading loop (1 week)**
Learner model + IndexedDB persistence (save at every transition; resume after Safari backgrounds the tab), state machine hardening with interrupt states, "Not yet" modelled blend, sight-read ✓, skip, bookshelf, My Sounds, parent settings (taught GPCs; tricky words shown but locked). Attempt log per word; if three magic words in a row are ✓ with zero sound taps, hint the parent toward blend-once (never block). Playwright on two phone sizes as regression, not acceptance.

**Phase 2 · Library (1–2 weeks)**
Pipeline: source text → retelling (LLM-assisted, human-edited) → validator → freeze text → batch audio + timings → approval. **Launch set: 5 Aesop + 2 Panchatantra at Veer's current level.** Potter and Kipling deferred (length, later-printing rights). Library screen with tradition filters. CI validation. Do not start until Phase 0 acceptance is met on both phones.

**Phase 3 · Family stories (3–4 days)**
Parent picks 2–4 magic words from the live decodable bank **first**, then the model writes around them (never free-generate and hope). Generation script runs a **retry loop**: validator rejections ("you used: jumped, happy") are fed back to the model up to 3 times before the story enters the approval queue. Validator + safety → approval queue → shelf. Same audio pipeline.

**Phase 4 · Placement + grading loop (later)**
5-minute playful placement instead of hard-coding the level; per-word attempt log; weekly parent summary (Tenet 8). Speech recognition stays out until then.

## Working agreement for the build sessions (owner instruction, 2026-09-10)

Sessions run long. If a session hits the 5-hour usage limit, or the owner says "pause", the agent must **automatically resume** where it left off, for up to **3 consecutive sessions**, using a scheduled wake-up (`/loop` or a scheduled task) that re-reads `state.md` and continues the current phase. Every phase writes its next step to `state.md` before stopping so a resume is deterministic.

## Open decisions for the owner

1. Repo name and whether the app shows Veer's name in public builds (suggest: profile name is local data, repo ships "Reader").
2. Lower-case vs sentence-case for Veer's read-back line ("It is a trick." vs "it is a trick.").
3. Which phonics order: Letters & Sounds phase 2 (used now) vs Jolly Phonics vs the order Veer's school uses.
4. Nani's voice: keep neural Indian-English for v1, or record Nani before Phase 2.

**Smallest next step:** create `soodr321/StoryTime`, port the validator with its tests, deploy the empty PWA to Vercel and install it on both phones.
