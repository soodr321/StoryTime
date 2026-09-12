import { describe, expect, it } from "vitest";
import { magicTokens, resolveMagic } from "./target";
import type { Page } from "../content/types";

const page = (s: string, magic: string[] = []): Page => ({ art: "x", tokens: s.split(" ").map((t) => ({ t, ms: 0 })), magic });

describe("resolveMagic", () => {
  it("skips a capitalised copy and takes the lowercase one", () => {
    expect(resolveMagic(page("Pat turned the tap off and gave it a pat."), "pat")).toBe(9);
  });
  it("never targets a proper name even when it is the only match", () => {
    expect(resolveMagic(page("Dad put down his spade."), "dad")).toBe(0);   // falls back, but the library test forbids shipping this
  });
  it("takes a lowercase word at the start of a sentence", () => {
    expect(resolveMagic(page("tap went the woodpecker"), "tap")).toBe(0);
  });
  it("is -1 when the word is not on the page", () => { expect(resolveMagic(page("the cat sat"), "dog")).toBe(-1); });
});

describe("magicTokens", () => {
  it("collects every copy of the designed word, not just the first", () => {
    expect([...magicTokens(page("he went tap, tap, tap.", ["tap"]))]).toEqual([2, 3, 4]);
  });
});
