/**
 * Where a page's magic word actually is. One resolver, used by the narration stop, the pink
 * highlight and the extra-word picker — they must agree, and they used to be three copies of
 * `findIndex`. A capitalised token is never the target: it is a proper name (the child would be
 * asked to decode "Pat"), and when it is token 0 the narration's stop time is ~110 ms, so the
 * page blips and the card opens before the child has heard a word of it.
 */
import { normalise } from "./validator";
import type { Page } from "../content/types";

export function resolveMagic(page: Page, word: string): number {
  const w = normalise(word);
  const hits = page.tokens.map((t, i) => [i, t.t] as const).filter(([, t]) => normalise(t) === w);
  const lower = hits.find(([, t]) => !/^[A-Z]/.test(t.trim()));
  return (lower ?? hits[0] ?? [-1])[0] as number;
}

/** Every token on the page that is (a copy of) a designed magic word. */
export function magicTokens(page: Page): Set<number> {
  const words = new Set((page.magic ?? []).map(normalise));
  const out = new Set<number>();
  page.tokens.forEach((t, i) => { if (words.has(normalise(t.t))) out.add(i); });
  return out;
}
