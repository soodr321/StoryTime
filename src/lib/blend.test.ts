import { describe, expect, it } from "vitest";
import { timeline } from "./blend";

// decoded clip lengths in seconds, like the cut Commons set
const dur = (g: string) => ({ s: 0.177, a: 0.3, t: 0.037, m: 0.2, p: 0.041, i: 0.3, n: 0.19, d: 0.025, o: 0.3, g: 0.025 } as Record<string, number>)[g] ?? 0.2;

describe("blend timeline", () => {
  it("holds a continuant to its target by looping, and never loops a vowel (it pulses audibly)", () => {
    const t = timeline(["s", "a", "t"], dur);
    expect(t[0].hold).toBeCloseTo(0.52, 2);                 // sss, looped from a 177 ms clip
    expect(t[1].hold).toBeLessThanOrEqual(dur("a") + 1e-9); // the vowel plays once, however long the target is
  });
  it("a stop is its burst only and the next sound starts right after it", () => {
    const t = timeline(["t", "a", "p"], dur);
    expect(t[0].hold).toBeCloseTo(dur("t"), 3);
    expect(t[1].start).toBeCloseTo(t[0].start + t[0].hold, 3);
  });
  it("stretches a continuant further at a slower rate, and never stretches a stop", () => {
    const slow = timeline(["s", "o", "s"], dur, 0.85);
    const normal = timeline(["s", "o", "s"], dur, 1);
    expect(slow[0].hold).toBeGreaterThan(normal[0].hold);
    const stops = timeline(["d", "o", "g"], dur, 0.85);
    expect(stops[0].hold).toBeCloseTo(dur("d"), 3);
    expect(stops[2].hold).toBeCloseTo(dur("g"), 3);
  });
  it("the next sound starts inside the previous continuant's fade (real overlap)", () => {
    const t = timeline(["m", "a", "n"], dur);
    expect(t[1].start).toBeLessThan(t[0].start + t[0].hold);
    expect(t[1].start).toBeGreaterThan(t[0].start);
  });
});
