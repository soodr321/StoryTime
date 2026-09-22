import { describe, it, expect } from "vitest";
import { hitWord, type WordRect } from "./follow";

/** A realistic wrapped paragraph: 3 rows, last one short, like the end of a sentence. */
function paragraph(): WordRect[] {
  const rows = [
    { top: 100, words: [[30, 80], [90, 190], [200, 330], [340, 410]] },
    { top: 152, words: [[30, 95], [105, 175], [185, 300], [310, 360]] },
    { top: 204, words: [[30, 110], [120, 170]] },                       // short last line
  ];
  const out: WordRect[] = []; let i = 0;
  for (const r of rows) for (const [l, rt] of r.words) out.push({ index: i++, left: l, right: rt, top: r.top, bottom: r.top + 38 });
  return out;
}

describe("a finger never has to lift, sweeping a wrapped paragraph", () => {
  const rects = paragraph();
  /** Walk the path a real finger takes: under each row left→right, then diagonally to the next row. */
  function sweep(step: number) {
    const pts: Array<[number, number]> = [];
    const rowTops = [...new Set(rects.map((r) => r.top))];
    for (let ri = 0; ri < rowTops.length; ri++) {
      const row = rects.filter((r) => r.top === rowTops[ri]);
      const y = rowTops[ri] + 38 + 12;                       // 12px UNDER the print, as a finger travels
      for (let x = row[0].left; x <= row[row.length - 1].right; x += step) pts.push([x, y]);
      if (ri + 1 < rowTops.length) {                          // the diagonal back to the next line's start
        const next = rects.filter((r) => r.top === rowTops[ri + 1]);
        const x0 = row[row.length - 1].right, y0 = y, x1 = next[0].left, y1 = rowTops[ri + 1] + 38 + 12;
        for (let t = 1; t <= 8; t++) pts.push([x0 + (x1 - x0) * (t / 8), y0 + (y1 - y0) * (t / 8)]);
      }
    }
    return pts;
  }
  it("returns a word at every point of the sweep — no dead spots", () => {
    const misses: string[] = [];
    for (const step of [4, 9, 17, 30]) {
      for (const [x, y] of sweep(step)) {
        if (hitWord(rects, x, y) < 0) misses.push(`step=${step} (${Math.round(x)},${Math.round(y)})`);
      }
    }
    expect(misses.slice(0, 6)).toEqual([]);
  });
  it("never goes backwards while sweeping forwards", () => {
    const seen = sweep(6).map(([x, y]) => hitWord(rects, x, y)).filter((i) => i >= 0);
    const drops = seen.filter((v, k) => k > 0 && v < seen[k - 1] - 1);
    expect(drops.length).toBe(0);
  });
});
