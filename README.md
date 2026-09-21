# StoryTime

**Nani reads the story. Your child reads the magic words.**

A free, installable web app (PWA) that helps a 4–5 year old learn to read, built for one family and
shared for anyone. Letter sounds recorded by **Kathryn J. Davis** (soundcityreading.net), used with her permission.

No account, no ads, nothing leaves the phone. The microphone is used only if you record your own voice (stored on the phone) or switch on the experimental "follow my voice" option, which sends audio to Apple or Google for recognition while it is listening.

Stable URL: **https://soodr321.github.io/StoryTime/** · install with Share → Add to Home Screen (iPhone) or Install (Android).

## How it works

- **Two tracks, one story.** A narrator reads a rich story (Aesop, Panchatantra, or your own) with karaoke
  word highlighting. The child reads only the **magic words**: words made of letter-sounds the grown-up
  has marked as taught, checked in code (a grapheme tokeniser with a locked tricky-word set and an
  untaught-digraph guard). The story ends with a moral the narrator says and a one-line read-back the child reads.
- **A grown-up sits beside the child** and taps ✓ or "Say it together" (the app blends the word slowly, then hands it back). Never a buzzer, never red.
- **Two modes.** *Nani reads* (audio, karaoke) and *I read* (audio off; the grown-up reads, the child taps the pink word). A big-type script tells the grown-up what to do.
- **Family profiles.** A reader with their own level, and a younger sibling who listens and taps words. Each child resumes exactly where they stopped.
- **Family stories.** Type or paste a story (one sentence per page), pick an emoji or a camera-roll photo per page, record each page in your own voice (or let the phone read it), and the app suggests magic words at the child's level and checks the read-back line live.
- **Bedtime mode.** Dim colours, no confetti, one story then a closing card until tomorrow.
- **The ending.** "Now go find someone and read them your magic words", with the words shown large.

## Run locally

```bash
npm install
pip install aiohttp                  # narration voice for the built-in library: Kokoro `af_sarah` via DeepInfra.
                                      # needs DEEPINFRA_API_KEY in .env.local (gitignored) or the environment;
                                      # ffmpeg on PATH or `pip install imageio-ffmpeg`; faster-whisper measures timings
python3 scripts/fetch-phonemes.py    # once: real phoneme recordings → public/sounds/ (committed)
npm run audio                        # narration + prompts → public/library/**, public/prompts/** (deploy-time)
npm run dev
```

`npm test` runs the validator, state machine and **library contract** checks (every story's magic words and
read-back line must be decodable at its level; timings must be monotonic).

## Deploy

`scripts/deploy-pages.sh` publishes to GitHub Pages. For Vercel: `npm run audio && npm run build && vercel deploy dist`.

## Layout

- `src/lib/phonics/` — validator + Letters & Sounds phase-2 order as data
- `src/lib/content/` — story contract · `library/<slug>/story.json` — stories; `scripts/gen-audio.py` fills tokens + timings
- `src/machine/` — XState story session · `src/lib/audio/` — one global narration element, clip singleton, Web Speech, MediaRecorder
- `src/lib/store.ts` + `family.tsx` — IndexedDB family store (kids, progress, sessions, family stories)
- `src/screens/` — Welcome, Family, Home, Story, Library, Settings, AddStory
- `public/sounds/` — phoneme clips from the Wikimedia Commons IPA set (**CC BY-SA 3.0**, attribution per clip in `manifest.json`)

## Credits

Stories retold from Aesop (public domain) and the Panchatantra (Arthur Ryder's 1925 translation, public domain).
Phoneme recordings: Wikimedia Commons contributors, CC BY-SA 3.0. Reviews during the build: Gemini, Grok, GPT (see `docs/reviews/`).
