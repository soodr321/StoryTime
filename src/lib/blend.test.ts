import { describe, expect, it } from "vitest";
import { timeline } from "./blend";

// decoded clip lengths in seconds, like the cut Commons set
const dur = (g: string) => ({ s: 0.177, a: 0.3, t: 0.037, m: 0.2, p: 0.041, i: 0.3, n: 0.19, d: 0.025, o: 0.3, g: 0.025 } as Record<string, number>)[g] ?? 0.2;

describe("blend timeline", () => {
  it("holds a continuant to its target by looping, never longer than a vowel's clip", () => {
    const t = timeline(["s", "a", "t"], dur);
    expect(t[0].hold).toBeCloseTo(0.45, 2);
    expect(t[1].hold).toBeLessThanOrEqual(dur("a"));
  });
  it("a stop is its burst only and the next sound starts right after it", () => {
    const t = timeline(["t", "a", "p"], dur);
    expect(t[0].hold).toBeCloseTo(dur("t"), 3);
    expect(t[1].start).toBeCloseTo(t[0].start + t[0].hold, 3);
  });
  it("never schedules past a clip at bedtime rate (no digital silence inside a vowel)", () => {
    const t = timeline(["d", "o", "g"], dur, 0.88);
    expect(t[1].hold).toBeLessThanOrEqual(dur("o") + 1e-9);
  });
  it("the next sound starts inside the previous continuant's fade (real overlap)", () => {
    const t = timeline(["m", "a", "n"], dur);
    expect(t[1].start).toBeLessThan(t[0].start + t[0].hold);
    expect(t[1].start).toBeGreaterThan(t[0].start);
  });
});
