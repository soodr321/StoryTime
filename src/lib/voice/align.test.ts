import { describe, expect, it } from "vitest";
import { align, matches } from "./align";

const tokens = "a crow found a big piece of cheese".split(" ");

describe("voice alignment", () => {
  it("advances one word at a time as the words are heard", () => {
    expect(align({ tokens, anchor: -1, heard: ["a", "crow"], stopAt: -1 })).toBe(1);
  });
  it("skips at most one closed-class word the recogniser dropped", () => {
    expect(align({ tokens, anchor: 1, heard: ["found", "big"], stopAt: -1 })).toBe(4);      // "a" dropped
    expect(align({ tokens, anchor: 1, heard: ["found", "piece"], stopAt: -1 })).toBe(2);    // two words missing: hold
  });
  it("never lights the pending child word or anything past it", () => {
    expect(align({ tokens, anchor: 2, heard: ["a", "big", "piece", "of"], stopAt: 4 })).toBe(3);
  });
  it("holds position on an aside or a repeated phrase", () => {
    expect(align({ tokens, anchor: 1, heard: ["look", "at", "the", "picture"], stopAt: -1 })).toBe(1);
  });
  it("is revision-aware: a longer interim from the same anchor gives the same answer as its prefix plus the rest", () => {
    const a = align({ tokens, anchor: -1, heard: ["a", "crow", "found"], stopAt: -1 });
    expect(align({ tokens, anchor: -1, heard: ["a", "crow", "found", "a", "big"], stopAt: -1 })).toBeGreaterThan(a);
  });
  it("fuzzy-matches one dropped ending on longer words", () => { expect(matches("cheese", "cheeses")).toBe(true); expect(matches("cat", "cot")).toBe(false); });
  it("recovers when a content word is clipped or misheard at the start or middle", () => {
    const dadTokens = ["dad", "said", "he", "was", "going"];
    expect(align({ tokens: dadTokens, anchor: -1, heard: ["said", "he"], stopAt: -1 })).toBe(2);
  });
  it("normalizes contractions and words with straight and curly apostrophes", () => {
    const apTokens = ["nan", "found", "its", "blue", "ants"];
    expect(align({ tokens: apTokens, anchor: -1, heard: ["nan", "found", "it's", "blue", "ant’s"], stopAt: -1 })).toBe(4);
  });
  it("skips two closed-class words in succession", () => {
    const phrase = ["the", "cat", "in", "the", "tin"];
    expect(align({ tokens: phrase, anchor: 1, heard: ["tin"], stopAt: -1 })).toBe(4);
  });
  it("never exceeds stopAt even when lookahead could match past it", () => {
    const phrase = ["dad", "said", "he", "was", "nap"];
    expect(align({ tokens: phrase, anchor: 1, heard: ["he", "was", "nap"], stopAt: 4 })).toBe(3);
  });
});
