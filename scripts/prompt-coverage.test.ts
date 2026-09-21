/**
 * plan-voice.md E3 (prompt half) — "Missing clip fails the build."
 *
 * Every prompt the app can ask for must exist before a deploy, because a miss is not silence: it
 * falls through to `speakText`, which is the phone's own voice arriving mid-story in the middle of
 * a library session (principle 2). The three sets that must be covered:
 *
 *   - the scripted prompts `Story.tsx` names as string literals (`yours`, `line`, …);
 *   - `word:{w}` for the 66 TEACH.*.words chips and the 8 TRICKY_PHASE2 words (A6/C3) — these
 *     appear on no page, so they cannot be a narration slice, and they are not blend targets;
 *   - `yes:{w}` and `word:{w}` for every magic word of every story, which live in that story's own
 *     `prompts` map rather than the shared manifest. `yes:{w}` is consumed live at Story.tsx:211.
 *
 * public/prompts/ and public/library/ are gitignored, so on a fresh checkout there is nothing to
 * check and these skip — the same shape as sounds-provenance.test.ts. deploy-pages.sh is what
 * refuses to publish a tree that was never generated.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Story } from "../src/lib/content/types";
import { TEACH } from "../src/lib/phonics/teach";
import { TRICKY_PHASE2 } from "../src/lib/phonics/learner";

const ROOT = join(__dirname, "..");
const PROMPTS = join(ROOT, "public", "prompts");
const MANIFEST = join(PROMPTS, "manifest.json");
const PUB_LIB = join(ROOT, "public", "library");
const LIB = join(ROOT, "library");

/** The words `word:{w}` has to be able to say, deduplicated — `sock` is both s and ck, `off` both o and ff. */
export const promptWords = (): string[] => {
  const all = [...Object.values(TEACH).flatMap((t) => t.words), ...TRICKY_PHASE2];
  const seen = new Set<string>();
  return all.filter((w) => (seen.has(w.toLowerCase()) ? false : (seen.add(w.toLowerCase()), true)));
};

/** The scripted prompt keys Story.tsx asks for by name, read from the source so a new one cannot be forgotten. */
const scriptedKeys = (): string[] => {
  const src = readFileSync(join(ROOT, "src", "screens", "Story.tsx"), "utf8");
  return [...src.matchAll(/speakPrompt\("([a-z]+)"/g)].map((m) => m[1]);
};

describe("prompt coverage", () => {
  if (!existsSync(MANIFEST)) { it.skip("prompts not generated on this checkout", () => {}); return; }
  const man = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, { audio: string; ms: number }>;

  it("ships every scripted prompt Story.tsx names", () => {
    for (const k of scriptedKeys()) {
      expect(man[k], `public/prompts/manifest.json has no "${k}"`).toBeTruthy();
      expect(existsSync(join(PROMPTS, man[k].audio)), `${man[k].audio} missing`).toBe(true);
    }
  });

  it("ships word:{w} for all 66 Teach chip words and all 8 tricky words (A6/C3)", () => {
    const words = promptWords();
    expect(words.length, "66 Teach chip words + 8 tricky").toBe(74);
    const missing = words.filter((w) => !man[`word:${w}`]);
    expect(missing, `no word:{w} clip for: ${missing.join(", ")}`).toEqual([]);
    for (const w of words) {
      expect(existsSync(join(PROMPTS, man[`word:${w}`].audio)), `word:${w} file missing`).toBe(true);
      expect(man[`word:${w}`].ms, `word:${w} duration`).toBeGreaterThan(300);
    }
  });

  it("ships yes:{w} and word:{w} for every magic word of every story", () => {
    if (!existsSync(PUB_LIB)) return;   // narration not generated on this checkout
    for (const slug of readdirSync(LIB).filter((s) => existsSync(join(LIB, s, "story.json")))) {
      const story = JSON.parse(readFileSync(join(LIB, slug, "story.json"), "utf8")) as Story;
      if (!story.pages.some((p) => p.audio)) continue;   // this story's audio has not been generated
      for (const w of story.pages.flatMap((p) => p.magic ?? [])) {
        for (const key of [`yes:${w}`, `word:${w}`]) {
          const clip = story.prompts?.[key];
          expect(clip, `${slug} has no ${key}`).toBeTruthy();
          expect(existsSync(join(PUB_LIB, slug, clip!.audio)), `${slug}/${clip?.audio} missing`).toBe(true);
        }
      }
    }
  });
});
