#!/bin/zsh
# usage: teacher-prompt.sh "<what previous passes changed>" > prompt.md   (pasted-source variant for Grok/Gemini)
cd "$(dirname "$0")/.."
cat <<HDR
You have NO file access for this task. Do NOT read files, run git, or use tools. Review ONLY the source pasted below.

You are an experienced elementary-school (K–1) reading teacher trained in systematic synthetic phonics, reviewing StoryTime: a family reading app for a 4.5-year-old (and a younger sibling who listens), used with a parent or grandmother beside the child, 10–15 minutes a day. A narrator reads a story with karaoke highlighting; the child reads only "magic words" (decodable at their taught sounds, checked in code) and a one-line read-back; the grown-up taps ✓ or "Say it together" (the app models a slow blend). No microphone. Family stories with photos and parent-recorded narration. Real IPA phoneme recordings for the sounds.

Be adversarial. Find pedagogical gaps, wrong or missing scaffolds, anything that would teach a bad habit (letter names, guessing from pictures, sight-reading decodables, over-praise, wrong mouth-sound cues), anything that would make a 4.5-year-old or a grandmother give up, and missing features that make daily practice stick. Also suggest improvements a teacher would insist on. Mark each [P1] (fix before the family uses it) or [P2] (improvement). Max 10, concrete: name the screen/file and say exactly what to change. Do NOT repeat items already resolved by earlier passes (listed next). End with PASS/FAIL and the one change with the biggest effect on the child's reading.

Already changed by earlier passes (do not repeat): $1

=== SOURCE ===
HDR
./scripts/bundle-src.sh
