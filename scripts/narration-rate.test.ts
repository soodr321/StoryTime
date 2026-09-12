import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Story } from "../src/lib/content/types";

/**
 * How fast the recorded voice reads. An adult reads aloud at about 150 words per minute; shared
 * reading with a 4-year-old who is following the words is 100–120. The library shipped at 166,
 * which is the complaint that produced this test. The Reading pace control takes it lower again.
 */
const LIB = join(process.cwd(), "library");
const stories = readdirSync(LIB).map((slug) => JSON.parse(readFileSync(join(LIB, slug, "story.json"), "utf8")) as Story);

describe("narration pace", () => {
  const timed = stories.flatMap((s) => s.pages).filter((p) => (p.audioMs ?? 0) > 0);
  it("reads at a pace a child can follow", () => {
    const words = timed.reduce((n, p) => n + p.tokens.length, 0);
    const ms = timed.reduce((n, p) => n + (p.audioMs ?? 0), 0);
    const wpm = words / (ms / 60000);
    expect(wpm, `${wpm.toFixed(0)} words per minute`).toBeGreaterThan(95);
    expect(wpm, `${wpm.toFixed(0)} words per minute`).toBeLessThan(145);
  });
  it("leaves long enough on each word for a finger to follow it", () => {
    const gaps = timed.flatMap((p) => p.tokens.map((t, i) => (i ? t.ms - p.tokens[i - 1].ms : 0)).slice(1)).sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    expect(median, `median ${median} ms between word starts`).toBeGreaterThanOrEqual(280);
    // some words are genuinely spoken close together; the highlight's minimum dwell (src/lib/highlight.ts)
    // is what stops those from flickering, so the criterion here is that it is not the common case
    const quick = gaps.filter((g) => g < 200).length / gaps.length;
    expect(quick, `${(quick * 100).toFixed(0)}% of words spoken less than 200 ms apart`).toBeLessThan(0.25);
  });
  it("gives every page word timings, in order, inside the recording", () => {
    for (const p of timed) {
      const t = p.tokens.map((x) => x.ms);
      expect(t.every((v, i) => i === 0 || v > t[i - 1]), "increasing").toBe(true);
      expect(t[t.length - 1]).toBeLessThan(p.audioMs ?? 0);
    }
  });
});
