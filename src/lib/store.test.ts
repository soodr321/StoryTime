import { describe, expect, it } from "vitest";
import { defaultKids, learnerOf } from "./store";
import { fits, LIBRARY } from "./library";
import { LEVELS } from "./phonics/learner";

describe("family defaults", () => {
  it("ships two neutral profiles: a reader and a listener", () => {
    const kids = defaultKids();
    expect(kids.map((k) => k.role)).toEqual(["reader", "listener"]);
    expect(kids.some((k) => /veer|veda/i.test(k.name))).toBe(false);
  });
});

describe("library", () => {
  it("bundles every story", () => { expect(LIBRARY.length).toBeGreaterThanOrEqual(7); });
  it("every story fits its own declared level", () => {
    for (const s of LIBRARY) expect(fits(s, LEVELS[s.level]), s.slug).toBe(true);
  });
  it("the reader default profile can do the set-4 stories", () => {
    const L = learnerOf(defaultKids()[0]);
    expect(LIBRARY.filter((s) => fits(s, L)).length).toBeGreaterThanOrEqual(7);
  });
});
