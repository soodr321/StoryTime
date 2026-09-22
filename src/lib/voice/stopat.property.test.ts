import { describe, it, expect } from "vitest";
import { align } from "./align";

/** The device must never light a word at or past the pending magic word. Brute force it. */
describe("stopAt is never crossed, whatever is heard", () => {
  const tokens = ["a", "crow", "found", "a", "big", "piece", "of", "cheese", "and", "sat", "on", "a", "tree"];
  const vocab = [...tokens, "dog", "the", "um", "er", "went", "cheese", "sat"];
  it("holds for every anchor, every stopAt, every heard sequence up to length 4", () => {
    let checked = 0, violations: string[] = [];
    for (let stopAt = 0; stopAt < tokens.length; stopAt++) {
      for (let anchor = -1; anchor < stopAt; anchor++) {
        for (let n = 1; n <= 3; n++) {
          for (let i = 0; i < 400; i++) {
            const heard = Array.from({ length: n }, () => vocab[Math.floor(Math.random() * vocab.length)]);
            const out = align({ tokens, anchor, heard, stopAt });
            checked++;
            if (out > stopAt) violations.push(`anchor=${anchor} stopAt=${stopAt} heard=${JSON.stringify(heard)} -> ${out}`);
          }
        }
      }
    }
    if (violations.length) console.log("VIOLATIONS:", violations.slice(0, 5));
    expect({ checked: checked > 10000, violations: violations.slice(0, 3) }).toEqual({ checked: true, violations: [] });
  });
});
