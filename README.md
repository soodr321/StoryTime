# StoryTime

A free, installable web app that helps a 4–5 year old learn to read.

**Two tracks, one story.** A narrator reads a rich story (Aesop, Panchatantra, family
tales) with karaoke word highlighting. The child reads only the **magic words** and a
one-line read-back, both restricted in code to the letter-sounds and tricky words the
grown-up has marked as taught. The grown-up sits beside the child and grades with a
✓ / ✗ tap. No microphone. No ads. No account.

## Run

```bash
npm install
pip install edge-tts            # narration voice ($0). ffmpeg on PATH or `pip install imageio-ffmpeg`
python3 scripts/fetch-phonemes.py   # once: real phoneme recordings → public/sounds/ (committed)
npm run audio                   # narration + prompts → public/library/**, public/prompts/** (deploy-time)
npm run dev
```

`npm test` runs the validator, state-machine and **library contract** checks (every story's
magic words and read-back line must be decodable at its level; timings must be monotonic).

## Layout

- `src/lib/phonics/` — validator (grapheme tokeniser + locked tricky-word set) and the phonics order as data
- `src/lib/content/` — story contract
- `src/machine/` — XState story session machine
- `src/lib/audio/` — one global narration element, one clip singleton (iOS-safe)
- `library/<slug>/story.json` — stories; `scripts/gen-audio.py` fills tokens + timings and writes audio
- `public/sounds/` — phoneme clips: the Wikimedia Commons IPA recordings (real human voice, **CC BY-SA 3.0**, attribution per clip in `manifest.json`), fetched by `scripts/fetch-phonemes.py`. A neural voice cannot say a bare consonant, so TTS is never used for sounds.

## Deploy

Vercel, static. Audio is generated at deploy time (`npm run audio` before `npm run build`).

## Status

Phase 0: one story on a phone. See `docs/plan.md`.
