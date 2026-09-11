import { describe, expect, it } from "vitest";
import { advanceCursor, hitWord, rows, type WordRect } from "./follow";

const r = (index: number, left: number, right: number, top: number): WordRect => ({ index, left, right, top, bottom: top + 40 });
const line1 = [r(0, 10, 40, 0), r(1, 50, 120, 0), r(2, 130, 200, 0)];
const line2 = [r(3, 10, 60, 60), r(4, 70, 150, 60)];
const all = [...line1, ...line2];

describe("finger-follow hit testing", () => {
  it("groups words into rows", () => { expect(rows(all).map((row) => row.map((w) => w.index))).toEqual([[0, 1, 2], [3, 4]]); });
  it("finds the word above a finger travelling under the line", () => { expect(hitWord(all, 80, 70)).toBe(1); expect(hitWord(all, 80, 50)).toBe(1); expect(hitWord(all, 80, 90)).toBe(4); expect(hitWord(all, 80, 120)).toBe(4); });
  it("a finger just under line 1 is not on line 2", () => { expect(hitWord(all, 80, 48)).toBe(1); });
  it("whitespace resolves to the nearer word", () => { expect(hitWord(all, 44, 20)).toBe(0); expect(hitWord(all, 47, 20)).toBe(1); });
  it("off the text is -1", () => { expect(hitWord(all, 300, 20)).toBe(-1); expect(hitWord(all, 80, 200)).toBe(-1); });
});

describe("adult cursor", () => {
  const blocked = (i: number) => i === 2;
  it("advances only to the next word", () => { expect(advanceCursor(-1, 0, blocked)).toBe(0); expect(advanceCursor(0, 1, blocked)).toBe(1); expect(advanceCursor(0, 3, blocked)).toBe(0); });
  it("never crosses an unresolved child word", () => { expect(advanceCursor(1, 2, blocked)).toBe(1); expect(advanceCursor(1, 3, blocked)).toBe(1); });
  it("moving backwards keeps the trail", () => { expect(advanceCursor(1, 0, blocked)).toBe(1); });
  it("crosses the child word once it is resolved", () => { expect(advanceCursor(1, 2, () => false)).toBe(2); });
});
