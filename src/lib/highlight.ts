/**
 * Which word the karaoke highlight should be on.
 *
 * Natural speech runs some words together: 18% of the library's words are spoken less than 200 ms
 * apart, and a 4-year-old's eye takes about that long to move. Highlighting each of them makes the
 * line flicker and the child loses their place, so the highlight holds for a minimum dwell and then
 * jumps straight to wherever the voice has got to — fewer, longer highlights rather than a blur.
 */
export const MIN_DWELL_MS = 190;

export function nextHighlight(tokenMs: number[], atMs: number, current: number, heldMs: number): number {
  let i = -1;
  for (let k = 0; k < tokenMs.length; k++) if (tokenMs[k] <= atMs) i = k;
  if (i === current) return current;
  if (i < current) return i;                       // a replay or a seek backwards: follow it at once
  return heldMs >= MIN_DWELL_MS ? i : current;     // otherwise wait out the dwell, then catch up
}
