Here is an adversarial, concrete critique of the audit plan, focusing on the physical realities of mobile devices and the acoustic realities of phonics.

### 1. What will this audit still MISS? (Specific failure modes)
None of the twelve areas or four instruments run on the actual hardware under real-world conditions. They will miss:

*   **[P1] Audio/Visual Desync on Low-End Hardware:** I1 (Playwright) runs in a desktop browser. I3 measures raw audio gaps. Neither catches UI thread starvation on an older iPad or a thermally-throttled Android. If garbage collection causes the karaoke word highlight to lag the audio by 300ms, the reading model is destroyed. The child hears "sat" but sees "pat" highlighted. 
*   **[P1] Child-Rage Multi-Tapping (Input Debouncing):** A 4-year-old will intentionally tap the "p" tile six times in one second. 1.11 checks if two sounds overlap *accidentally* in the code's intended flow, but does not check what happens to the audio queue or UI state when the screen is spammed. The app could lock up for 5 seconds while it sequentially plays six "p"s, or it could glitch and stutter.
*   **[P2] The "Night Shift" Legibility Failure:** Section 7 checks for a 3:1 contrast ratio for word tiles. However, this app is used during a "nightly ritual." At 2% screen brightness with aggressive blue-light filtering (Night Shift) turned on, OLED black-smear and color-shifting will render a mathematically passing 3:1 contrast completely invisible in a dark room. 
*   **[P2] Acoustic Interference (Voice Follow):** Section 6 notes the microphone is used for "voice follow," but tests it in a vacuum. It misses the failure mode where a sibling crying, a white noise machine, or the app's *own* audio bouncing off the walls causes the ASR to hallucinate inputs or fail completely.

### 2. Which pass criteria are wrong, unmeasurable, or at the wrong threshold?
*   **[P1] 1.5 Duration by kind (vowel ≥ 150 ms, stop ≤ 60 ms):** Fatally flawed. English voiceless stops (/p/, /t/, /k/) require a burst *and* aspiration (Voice Onset Time). 60ms is often too short to capture the aspiration, making a /p/ sound like a click or a /b/. Furthermore, this binary ignores fricatives (/s/, /f/, /th/) and nasals (/m/, /n/)—are they vowels or stops? Finally, 150ms is too short for a modeled vowel; 4-year-olds need stretched vowels (300ms+) to process them.
*   **[P1] 1.8 Karaoke is followable (no more than 10% under 150 ms):** 150ms is faster than a 4-year-old's visual saccade latency (~200–250ms). If a word is highlighted for only 140ms, their eyes physically cannot track the movement before it jumps again, causing them to lose their place. The threshold must be 0% under 200ms.
*   **[P1] 1.2 The set is one voice (pitch within ±20% of median F0):** Wrong threshold. Human speech has intrinsic pitch. High vowels (/i/ like "ee") naturally have a higher F0 than low vowels (/a/ like "ah"). An engaging, expressive speaker can easily span a 30-40% pitch variance naturally. You will reject perfectly valid recordings of the *same* person. (Speaker identity should be verified by timbre/formants, not strict F0 bands).
*   **[P2] 1.12 Audio stops within 200 ms:** If audio is cut instantly (e.g., when the app is hidden) without a crossfade to a zero-crossing, the device DAC will produce an audible, sharp hardware "pop." The criterion should require a 20-50ms fade-out.

### 3. Judging PHONICS QUALITY beyond ASR and pitch
ASR expects whole words, and F0/RMS are just volume and pitch. To predict if a 4-year-old can blend "c-a-t", the agent must measure phonetic identity using these acoustic metrics:

*   **Schwa-Tail Energy Ratio (The "tuh" test):** To ensure a stop consonant isn't a "tuh", measure the RMS of the non-periodic burst versus the RMS of the trailing periodic (voiced) segment. If F0 (vocal fold vibration) is present for >15ms *after* the burst of a voiceless stop (/t/, /p/, /k/), it is a "tuh" and fails.
*   **Formant Trajectory Flatness (F1/F2) for Vowels:** A pure short vowel must not drift. If the F1/F2 frequency tracks change by >5% across the central 80% of the clip, it's a diphthong (e.g., saying /æ/ as "ee-yah"). A child cannot blend a shifting vowel.
*   **Voice Onset Time (VOT) for Stops:** The only acoustic difference between /p/ and /b/ is the delay between the burst and the voicing. A /p/ clip must be measured to have >40ms VOT; a /b/ must have <20ms VOT.
*   **Spectral Center of Gravity (CoG) for Fricatives:** Cheap phone speakers destroy high frequencies. To ensure a child can tell /f/ from /s/, measure the CoG. /s/ must have peak energy above 4000 Hz; /sh/ around 2500 Hz. If compression shifts these profiles, they become indistinguishable mud.

### 4. What is the single highest-value check, and order of audit?
*   **The single highest-value check is 1.6 & 12 (The human perception of the blend).** The intro admits that concatenating phonemes failed, so they shifted to a slowed narration voice. If that workaround *still* doesn't sound right to a human (1.6), or if the child cannot blend from it (12), the app is completely useless. All automated checks are merely proxies for this perceptual reality.
*   **The Order:** The current plan automates first, then tests on humans and devices. This is inverted; you will waste hours automating a broken premise. **Fail fast on human perception and physical reality.**
    1.  **Human Core (§1.6 & §12):** Does the audio model actually work for the child? 
    2.  **Physical Device (§6):** Do the UI and Audio desync on an old tablet? 
    3.  **Audio Assets (§1, §2):** Lock in the audio measurements so the fix isn't regressed.
    4.  **State & Flow Automation (§3, §4):** Verify the app logic only after the core mechanics are proven to work.
