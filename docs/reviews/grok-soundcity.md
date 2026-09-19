**Nothing in the treatment of her recordings is wrong.** Keep the voiceless-stop length relaxation and the named `/i/` exception. Leave the two voices. Do not change audio tonight unless isolated-clip transcripts (which you have and I do not) show a quality swap.

---

### 1. Treatment of the recordings

**Voiceless stops — not wrong.** The old length cap was a proxy for “no *tuh*.” *Tuh* is voicing (a schwa). Aspiration with no voice is just `/t/` or `/k/`. Replacing the proxy with the schwa-tail check is the correct move; relaxing length once that check exists is consistent with it. `p` 70 ms is a normal aspirated `/p/`. `t` 135 ms and `k` 145 ms are long for blending (typical English VOT is closer to 60–90 ms, `/k/` a bit longer because it is velar), but they are still unvoiced releases, not syllables. For letter tiles, identifiability beats a tight blend window, and the primary whole-word path is not concatenation.

**`/i/` exception — not wrong, and the right engineering pattern.** Mixing in a second speaker is the defect this pipeline exists to prevent; a 0.04 miss on steadiness is not in the same class. All four site copies being the same 190 ms take means there is no better Kathryn `/i/`. A named allowlist that still fails anything *not* listed is the correct shape.

Two further reasons the exception is justified, not a dodge:

- Lax `/ɪ/` is inherently less steady than `/æ e ɑ ʌ/`. Your own numbers match that: `a/o/u` sit high, `/e/` is on the 0.93 line, `/i/` is the one that misses. The bar is a bit harsh on this phoneme, not her take being defective.
- Shortening under 140 ms to chase 0.93 would make the one sound a four-year-old must *hold* into the shortest vowel. That is a worse teaching trade than a slightly unsteady `/i/`.

The residual risk is qualitative, not the 0.89: if the unsteadiness is a glide toward “ee,” you would be teaching *sit* with *seat*’s vowel. You already transcribed every clip. If isolated `/i/` came back as “ih” / “i” / “it,” ship it. If it came back as “ee” / “eat,” that is the only recording decision I would reverse (and then the honest options are a shorter window of the same take, or the exception stays and you treat `/i/` words as adult-led tonight).

**Voiced stops and vowels — also not wrong.** Burst-relative cuts, 5 ms VOT, 20–40 ms voiced tail, `b/d/g` at 100 ms is how you get `/g/` rather than `/k/` and not “buh.” Using the gate’s own measure after the `/e/` regression is the lesson that matters. Concatenated *dog* transcribing as “DOG” is the first real evidence the fallback is a word.

[P2] If you ever re-trim: bring `/t/` and `/k/` toward ~90–110 ms for coda blending (*sat*, *cat*, *duck*). Not tonight; the schwa check already owns the real failure mode.

[P2] `/e/` sitting at exactly 0.93 will flap if the measure has any jitter. Pin the comparison (`>=` vs `>`) or record that it is on the line next to the `/i/` exception.

---

### 2. Two voices — leave it

Do not change this before tonight.

The harmful two-voice bug is **two speakers inside one assembled word** (the Wikimedia chorus). What you have now is sequential and role-split: her voice is “how this letter sounds”; his voice is “the word in the story.” That is how a classroom works, and the pitch jump (woman teacher → man narrator) actually marks the move from sounding-out to the word.

The alternatives are worse for Veer tonight:

| Change | What it costs |
|---|---|
| Andrew TTS for letter sounds | You re-import “buh / tuh,” which is the thing you just removed |
| Kathryn concatenation as the whole-word model | You replace a clear slow “dog” with fragments on every word that is not *dog* |
| A third voice or a pitch-shifted hybrid | A new speaker, and you break the story-voice match |

Andrew should keep the stories *and* the post-nudge word so the word in the book and the word after blending are the same person. Kathryn should keep the tiles so the eighteen sounds stay one speaker.

[P2] Later, generate isolated Andrew phonemes, run them through the **same** gates, and A/B against Kathryn. Switch only if he passes. Do not do that tonight and do not lower the bar to make him pass.

---

### 3. Before Veer hears it tonight

No further audio edits. Three checks, one of them must-do:

[P1] Confirm every decodable he will hit tonight has a pre-rendered Andrew whole-word file. Concatenation is still a last-resort that transcribes as fragments (except *dog*). The old “Ssssssss” / silence failure is what he hears if a model is missing, not if Kathryn’s clips are slightly long.

[P1] **Only if the isolated transcripts say so:** `/i/` must not be “ee”; `/b d g/` must not be “buh/duh/guh” or “bee/dee/gee”; `/p t k/` must not be “puh/tuh/kuh.” You already ran this. If those transcripts are clean, there is no [P1] on the sounds.

[P2] Loudness of her tiles vs Andrew’s story/word. You fixed the chorus (112–394 Hz). A tile that jumps out or disappears at bedtime is the remaining mix issue.

[P2] Vowel quality vs his whole words, especially `/o/` in *dog* (and `/a/` if those words appear). ASR saying “DOG” is reassuring; a child can still notice her *o* and his “dog” do not match. Accept that as the cost of the role split; do not retune her vowels toward the TTS.

Credit-from-manifest in Settings, Sounds, and README is the right way to keep the permission condition attached to the audio it credits. Do not hand-edit those strings.

**Tonight:** her sounds, his words, `/i/` exception, long unvoiced `/t/` `/k/`. That is a coherent teaching moment. The chorus is gone; *dog* is a word; the remaining concatenation fragments are on a path he should not touch if the Andrew models are present.
