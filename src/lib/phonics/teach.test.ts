import { describe, expect, it } from "vitest";
import { TEACH } from "./teach";
import { LS_PHASE2_ORDER } from "./learner";

describe("teach data", () => {
  it("covers every phase-2 grapheme in order", () => { for (const g of LS_PHASE2_ORDER) expect(TEACH[g], g).toBeDefined(); });
  it("never blends a word using a sound taught later than the one being introduced", () => {
    LS_PHASE2_ORDER.forEach((g, i) => { const allowed = new Set<string>(LS_PHASE2_ORDER.slice(0, i + 1)); for (const x of TEACH[g].blend) expect(allowed.has(x), `${g}: ${TEACH[g].blend.join("-")}`).toBe(true); });
  });
  it("marks end-position digraphs so the routine never asks for the first sound", () => {
    for (const g of ["ck", "ff", "ll", "ss"] as const) expect(TEACH[g].position).toBe("end");
  });
});
