import { describe, expect, it } from "vitest";
import { pickIllTry, ILL_TRY_WORDS } from "./illtry";
import { checkMagicWord, EXCEPTIONS } from "./validator";
import type { Page } from "../content/types";
import type { LearnerModel } from "./validator";

const learner: LearnerModel = { gpcs: ["s", "a", "t", "p", "i", "n", "m", "d"], tricky: ["the", "is"] } as unknown as LearnerModel;
const page = (s: string, magic: string[] = []): Page => ({ art: "x", tokens: s.split(" ").map((t) => ({ t, ms: 0 })), magic });

describe("I'll try", () => {
  it("offers one decodable word that is not the designed magic word", () => {
    const p = page("The man sat on a mat.", ["sat"]);
    expect(pickIllTry(p, learner, new Set([2]), () => false)).toBe(1);   // "man", not "sat"
  });
  it("skips names, tricky words and words outside the taught sounds", () => {
    const p = page("Tim did not dig.", []);
    expect(pickIllTry(p, learner, new Set(), () => false)).toBe(1);   // "did": Tim is a name, not/dig need o/g
  });
  it("never offers a /z/-final spelling like his or has", () => {
    expect(ILL_TRY_WORDS.has("his")).toBe(false); expect(EXCEPTIONS.has("his")).toBe(true); expect(checkMagicWord("has", learner).ok).toBe(false);
  });
  it("returns -1 when nothing fits", () => { expect(pickIllTry(page("The dog is his."), learner, new Set(), () => false)).toBe(-1); });
});

describe("I'll try — quarantine (v5)", () => {
  const p = (s: string, magic: string[] = []): Page => ({ art: "x", tokens: s.split(" ").map((t) => ({ t, ms: 0 })), magic });
  it("never offers a second copy of the page's own magic word", () => {
    expect(pickIllTry(p("he went tap, tap, tap.", ["tap"]), learner, new Set([2]), () => false)).toBe(-1);
  });
  it("never offers a capitalised name, including at the start of a sentence", () => {
    expect(pickIllTry(p("Pat sat on a mat.", []), learner, new Set(), () => false)).toBe(1);   // sat, not Pat
  });
});
