import { describe, expect, it } from "vitest";
import { MIN_DWELL_MS, nextHighlight } from "./highlight";

const ms = [0, 120, 240, 900, 1400];   // "and a big  …  dog  …  ran"

describe("karaoke highlight", () => {
  it("follows the voice when the words are far enough apart", () => {
    expect(nextHighlight(ms, 900, 2, 660)).toBe(3);
  });
  it("does not flicker through words spoken 120 ms apart", () => {
    expect(nextHighlight(ms, 120, 0, 120)).toBe(0);
    expect(nextHighlight(ms, 240, 0, 240)).toBe(2);   // holds, then jumps straight to where the voice is
  });
  it("never holds longer than the dwell", () => {
    expect(nextHighlight(ms, 240, 0, MIN_DWELL_MS)).toBe(2);
  });
  it("follows a jump backwards immediately (a replayed page)", () => {
    expect(nextHighlight(ms, 0, 4, 10)).toBe(0);
  });
});
