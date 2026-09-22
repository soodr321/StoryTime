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
  for (const w of sorted) {
    let found = false;
    for (const row of out) {
      const rTop = Math.min(...row.map((x) => x.top));
      const rBottom = Math.max(...row.map((x) => x.bottom));
      const overlap = Math.min(rBottom, w.bottom) - Math.max(rTop, w.top);
      if (overlap > 0 || Math.abs(rTop - w.top) <= ROW_TOL) {
        row.push(w);
        found = true;
        break;
      }
    }
    if (!found) out.push([w]);
  }
  for (const row of out) row.sort((a, b) => a.left - b.left);
  out.sort((a, b) => a[0].top - b[0].top);
  return out;
}

/** The word under (or just above) a finger at x,y; -1 when the finger is off the text. */
export function hitWord(rects: WordRect[], x: number, y: number): number {
  if (!rects.length) return -1;
  const rs = rows(rects);
  if (!rs.length) return -1;

  const textTop = Math.min(...rects.map((w) => w.top));
  const textBottom = Math.max(...rects.map((w) => w.bottom));
  if (y < textTop - ROW_TOL || y > textBottom + BELOW) return -1;

  // A finger just under line 1 sits on top of line 2: it means line 1 unless it is well inside line 2.
  // Transition between rows is continuous so there are no dead zones across the gap between rows.
  let rowIndex = 0;
  for (let i = 1; i < rs.length; i++) {
    const nextRow = rs[i];
    const top = Math.min(...nextRow.map((w) => w.top));
    const bottom = Math.max(...nextRow.map((w) => w.bottom));
    if ((y - top) / Math.max(1, bottom - top) > 0.55) {
      rowIndex = i;
    }
  }

  const row = rs[rowIndex];
  const rowLeft = Math.min(...row.map((w) => w.left));
  const rowRight = Math.max(...row.map((w) => w.right));

  const prevRow = rowIndex > 0 ? rs[rowIndex - 1] : null;
  const prevRight = prevRow ? Math.max(...prevRow.map((w) => w.right)) : rowRight;
  const prevLeft = prevRow ? Math.min(...prevRow.map((w) => w.left)) : rowLeft;

  const nextRow = rowIndex + 1 < rs.length ? rs[rowIndex + 1] : null;
  const nextRight = nextRow ? Math.max(...nextRow.map((w) => w.right)) : rowRight;
  const nextLeft = nextRow ? Math.min(...nextRow.map((w) => w.left)) : rowLeft;

  const allowedLeft = Math.min(rowLeft, prevLeft, nextLeft) - SIDE;
  const allowedRight = Math.max(rowRight, prevRight, nextRight) + SIDE;

  if (x < allowedLeft || x > allowedRight) return -1;

  let best = -1, dist = Infinity;
  for (const w of row) {
    const d = x < w.left ? w.left - x : x > w.right ? x - w.right : 0;
    if (d < dist) { dist = d; best = w.index; }
  }
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
