import { describe, expect, it } from "vitest";
import { checkLine, checkMagicWord, checkWord, normalise } from "./validator";
import { LEVELS } from "./learner";

const L = LEVELS["ls-phase2-set4"]; // s a t p i n m d g o c k ck e u r + tricky

describe("normalise", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalise("“Dear,")).toBe("dear");
    expect(normalise("It")).toBe("it");
    expect(normalise("")).toBe("");
  });
});

describe("checkWord", () => {
  it("tokenises CVC words", () => {
    const r = checkWord("sat", L);
    expect(r.ok && r.kind === "decodable" && r.graphemes).toEqual(["s", "a", "t"]);
  });
  it("prefers the longest grapheme (ck as one sound)", () => {
    const r = checkWord("trick", L);
    expect(r.ok && r.graphemes).toEqual(["t", "r", "i", "ck"]);
  });
  it("rejects untaught letters with an actionable reason", () => {
    const r = checkWord("crow", L);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toMatch(/"ow".*not been taught/);
  });
  it("fails closed on empty input", () => {
    expect(checkWord("", L).ok).toBe(false);
    expect(checkWord("!!", L).ok).toBe(false);
  });
  it("never sounds out an untaught exception word (is, to, put)", () => {
    const none = { gpcs: [...L.gpcs], tricky: [] };
    for (const w of ["is", "to", "put", "a", "I", "no"]) expect(checkWord(w, none).ok, w).toBe(false);
    expect(checkMagicWord("is", L).ok).toBe(false);
  });
  it("accepts tricky words only when taught, and never tokenises them", () => {
    const r = checkWord("the", L);
    expect(r.ok && r.kind === "tricky").toBe(true);
    const none = checkWord("the", { gpcs: ["t", "h", "e"], tricky: [] });
    expect(none.ok).toBe(false); // never t-h-e: "th" is one sound, and "the" is an exception word
  });
  it("rejects words that hide an untaught digraph even when every letter is known", () => {
    for (const w of ["mango", "tree", "under", "ship", "book", "car"]) expect(checkWord(w, L).ok, w).toBe(false);
    const r = checkWord("mango", L); if (!r.ok) expect(r.reasons[0]).toMatch(/"ng"/);
  });
  it("still accepts ck words when ck is taught, and rejects them when it is not", () => {
    expect(checkWord("trick", L).ok).toBe(true);
    expect(checkWord("sock", { gpcs: ["s", "o", "c", "k"], tricky: [] }).ok).toBe(false);
  });
  it("rejects split-digraph words (silent e) at phase 2", () => {
    for (const w of ["race", "came", "one", "cake"]) expect(checkWord(w, L).ok, w).toBe(false);
    expect(checkWord("the", L).ok).toBe(true); // tricky word, taught
  });
  it("fails closed on contractions and possessives", () => {
    expect(checkWord("can't", L).ok).toBe(false);
    expect(checkWord("Nani's", L).ok).toBe(false);
  });
  it("is case-insensitive (sentence case is display-only)", () => {
    expect(checkWord("It", L).ok).toBe(true);
  });
});

describe("checkMagicWord", () => {
  it("rejects adjacent-consonant words at phase 2 (must, trick, and, stop)", () => {
    for (const w of ["must", "trick", "and", "stop", "tricks"]) expect(checkMagicWord(w, L).ok, w).toBe(false);
    for (const w of ["sat", "got", "sad", "it", "sock"]) expect(checkMagicWord(w, L).ok, w).toBe(true);
    expect(checkMagicWord("trick", { ...L, clusters: true }).ok).toBe(true);
  });
  it("refuses tricky words as magic words", () => {
    const r = checkMagicWord("is", L);
    expect(r.ok).toBe(false);
  });
  it("accepts decodable words", () => {
    expect(checkMagicWord("did", L).ok).toBe(true);
  });
});

describe("checkLine", () => {
  it("passes the Fox and Crow read-back line", () => {
    const r = checkLine("It is sad.", L);
    expect(r.ok).toBe(true);
    expect(r.results.map((x) => (x.ok ? x.kind : "bad"))).toEqual(["decodable", "tricky", "decodable"]);
    expect(checkLine("It is a trick.", L).ok).toBe(false);
  });
  it("fails a line with an untaught grapheme", () => {
    expect(checkLine("It is a con job.", L).ok).toBe(false);
  });
  it("fails an empty line", () => {
    expect(checkLine("", L).ok).toBe(false);
  });
});
