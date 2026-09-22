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

  it("handles diagonal transition between wrapped lines without dead zones", () => {
    // Sliding from end of line 1 (x=180, y=48) down to start of line 2 (x=30, y=105)
    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      const x = Math.round(180 + (30 - 180) * t);
      const y = Math.round(48 + (105 - 48) * t);
      const hit = hitWord(all, x, y);
      expect(hit).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles transition from long line to short line without dead zones", () => {
    const longLine1 = [r(0, 10, 80, 0), r(1, 90, 180, 0), r(2, 190, 300, 0)];
    const shortLine2 = [r(3, 10, 90, 60)];
    const testSet = [...longLine1, ...shortLine2];

    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      const x = Math.round(290 + (30 - 290) * t);
      const y = Math.round(48 + (105 - 48) * t);
      expect(hitWord(testSet, x, y)).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles variable line gaps continuously", () => {
    for (const gap of [10, 20, 30, 50, 70]) {
      const l1 = [r(0, 20, 120, 0), r(1, 130, 260, 0)];
      const l2 = [r(2, 20, 120, 40 + gap), r(3, 130, 240, 40 + gap)];
      const setWithGap = [...l1, ...l2];

      for (let step = 0; step <= 15; step++) {
        const t = step / 15;
        const x = Math.round(250 + (30 - 250) * t);
        const y = Math.round(45 + (40 + gap + 45 - 45) * t);
        expect(hitWord(setWithGap, x, y)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("robustly groups rows even with button or padding vertical variances", () => {
    const mixed = [
      { index: 0, left: 10, right: 50, top: 10, bottom: 50 },
      { index: 1, left: 60, right: 130, top: 4, bottom: 56 },   // taller button with top 4
      { index: 2, left: 140, right: 200, top: 15, bottom: 52 }, // slightly lower baseline
      { index: 3, left: 10, right: 70, top: 80, bottom: 120 },
      { index: 4, left: 80, right: 150, top: 78, bottom: 122 },
    ];
    const grouped = rows(mixed);
    expect(grouped.map((row) => row.map((w) => w.index))).toEqual([[0, 1, 2], [3, 4]]);
  });
});

describe("adult cursor", () => {
  const blocked = (i: number) => i === 2;
  it("advances only to the next word", () => { expect(advanceCursor(-1, 0, blocked)).toBe(0); expect(advanceCursor(0, 1, blocked)).toBe(1); expect(advanceCursor(0, 3, blocked)).toBe(0); });
  it("never crosses an unresolved child word", () => { expect(advanceCursor(1, 2, blocked)).toBe(1); expect(advanceCursor(1, 3, blocked)).toBe(1); });
  it("moving backwards keeps the trail", () => { expect(advanceCursor(1, 0, blocked)).toBe(1); });
  it("crosses the child word once it is resolved", () => { expect(advanceCursor(1, 2, () => false)).toBe(2); });

  it("tracks reading continuously across wrapped lines", () => {
    let cursor = -1;
    const noBlock = () => false;

    // Line 1: words 0, 1, 2
    cursor = advanceCursor(cursor, 0, noBlock);
    expect(cursor).toBe(0);
    cursor = advanceCursor(cursor, 1, noBlock);
    expect(cursor).toBe(1);
    cursor = advanceCursor(cursor, 2, noBlock);
    expect(cursor).toBe(2);

    // Line 2 transition: landing on word 3 advances smoothly
    cursor = advanceCursor(cursor, 3, noBlock);
    expect(cursor).toBe(3);
    cursor = advanceCursor(cursor, 4, noBlock);
    expect(cursor).toBe(4);
  });
});
