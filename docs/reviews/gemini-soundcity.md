### 1. Go or no-go for tonight
**GO.** 

Replacing a multi-speaker acoustic patchwork (spanning over an octave and a half of fundamental frequency jumps) with a single, dedicated phonics teacher’s voice is a major pedagogical and psychoacoustic upgrade. All 18 sounds passed automated ASR verification for clean phoneme identification, schwa-tail checks passed, loudness delta is negligible (~1.1 dB difference), and all 146 target words have pre-rendered whole-word models. There is zero regression and substantial improvement.

---

### 2. The two voices (Kathryn for tiles, Andrew for whole-word/narrator)
**Agree with leaving it as-is; do not change it.**

The acoustic disaster in early phonics is formant and pitch instability *inside the blend* (e.g., hearing a 120 Hz /b/, a 310 Hz /a/, and a 200 Hz /t/). That is completely gone.

Sequentially, splitting the acoustic roles between letter tiles and the blended model is actually beneficial:
- **Kathryn’s voice** represents the analytic phonics domain (sounding out isolated phonemes). A clear, female teacher register is often easier for a 4-year-old to map to their own vocal tract.
- **Andrew’s voice** represents the narrative / whole-word synthesis domain (the storybook world and reading partner).
- The pitch and timbre shift acts as a clear perceptual marker that the child has transitioned from *decoding pieces* to *arriving at the word*.

---

### 3. Treatment of the recordings
**Do not undo anything.** Both engineering calls were sound:

- **Relaxed length rule on voiceless stops (/p/, /t/, /k/):** Correct. Unvoiced stop releases consist entirely of burst transient and aspirated friction (turbulent noise, zero periodicity). Human ears perceive "tuh" only when vocal folds vibrate (F0 onset). Because your schwa-tail gate verified zero voicing and ASR confirmed no vowel insertion, retaining the full natural unvoiced decay prevents synthetic-sounding clicks or truncated bursts.
- **Named exception for /i/ (0.89 vs 0.93):** Correct. The English short lax vowel /ɪ/ naturally exhibits subtle formant drift toward central vowels in brief utterances. Forcing an artificial steady-state truncation often warps /ɪ/ into tense /i/ ("ee") or makes it unnaturally abrupt. ASR confirmed it did not trigger "ee", and importing an external voice would re-introduce the exact defect this rework was built to solve.

---

### 4. Anything else that matters for a 4-year-old this week

1. **Short /e/ vs. short /i/ discrimination:** Short /ɛ/ (bed) and short /ɪ/ (bid) are the two most frequently confused vowels for a 4-year-old. Observe tonight whether your child easily distinguishes Kathryn's /e/ and /i/ tiles when sounding out words like *pin* vs. *pen* or *sit* vs. *set*.
2. **Bedtime listening levels on small phone speakers:** Because unvoiced stops (/t/, /k/, /s/) have significant energy above 3–4 kHz and vowels sit lower in the spectrum, verify on the actual phone speaker at low bedtime volume that the stops don't sound overly sharp or "spitty" compared to the softer vowels.
3. **Tile tap latency:** At age 4, children expect immediate tactile-auditory feedback. Ensure audio buffer latency on tile tap remains crisp (<50 ms) so the child directly associates the finger press with the phoneme.

GO
