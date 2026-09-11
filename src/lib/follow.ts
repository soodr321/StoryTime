/**
 * Finger-follow for "I read": the grown-up slides a finger UNDER the line as they read and the
 * word above the finger lights up now. Pure helpers, no DOM here, so the hit-testing is testable.
 *
 * Three states stay separate (see docs/plan-v2.md B5): `pointer` = the word under the finger,
 * `cursor` = the adult's reading position (advances one word at a time, never across an
 * unresolved child word), and the child's verdicts, which live in the machine.
 */
export interface WordRect { index: number; left: number; right: number; top: number; bottom: number }

const ROW_TOL = 8;        // rects within this many px of each other's top are one row
const BELOW = 44;         // the finger travels under the print: accept this far below the row
const SIDE = 40;          // and this far to the side of a row's first/last word

/** Group word rects into rows, top to bottom. */
export function rows(rects: WordRect[]): WordRect[][] {
  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left);
  const out: WordRect[][] = [];
  for (const r of sorted) { const row = out[out.length - 1]; if (row && Math.abs(row[0].top - r.top) <= ROW_TOL) row.push(r); else out.push([r]); }
  return out;
}

/** The word under (or just above) a finger at x,y; -1 when the finger is off the text. */
export function hitWord(rects: WordRect[], x: number, y: number): number {
  const rs = rows(rects);
  // a finger just under line 1 sits on the top of line 2: it means line 1 unless it is well inside line 2
  let row: WordRect[] | null = null;
  for (const r of rs) {
    const top = Math.min(...r.map((w) => w.top)); const bottom = Math.max(...r.map((w) => w.bottom));
    if (y < top - ROW_TOL || y > bottom + BELOW) continue;
    if (!row || (y - top) / Math.max(1, bottom - top) > 0.55) row = r;
  }
  if (!row) return -1;
  const left = Math.min(...row.map((w) => w.left)); const right = Math.max(...row.map((w) => w.right));
  if (x < left - SIDE || x > right + SIDE) return -1;
  let best = -1, dist = Infinity;
  for (const w of row) { const d = x < w.left ? w.left - x : x > w.right ? x - w.right : 0; if (d < dist) { dist = d; best = w.index; } }   // whitespace resolves to the nearer word
  return best;
}

/**
 * Where the adult's reading position moves when the finger lands on `hit`. Only the next word in
 * order counts, and an unresolved child word (`blocked`) is never crossed: the highlight is a
 * shared-reading cue, not evidence that anything was read.
 */
export function advanceCursor(cursor: number, hit: number, blocked: (i: number) => boolean): number {
  if (hit === cursor + 1 && !blocked(hit)) return hit;
  return cursor;
}
