/**
 * "I'll try": one extra child word per page, chosen before the grown-up reaches it.
 * Candidates come from a reviewed lexicon of CVC words whose spelling says their sound
 * one-to-one (no /z/-final "his", no "was"), intersected with the child's taught sounds
 * through the same fail-closed validator as the designed magic words.
 */
import { checkMagicWord, normalise, type LearnerModel } from "./validator";
import { magicTokens } from "./target";
import type { Page } from "../content/types";

export const ILL_TRY_WORDS = new Set([
  "sat", "sap", "tap", "tip", "pat", "pit", "pip", "sip", "at", "it", "tin", "pin", "nip", "nap", "pan", "tan", "man", "mat", "map", "mad",
  "dad", "did", "dip", "dim", "din", "dig", "dog", "got", "tot", "pot", "top", "tog", "not", "nod", "dot", "cat", "cot", "cap", "cod", "can",
  "kid", "kit", "kip", "sock", "sick", "pick", "tick", "dock", "duck", "pack", "peck", "neck", "deck", "kick", "mock", "lick", "lock",
  "pen", "pet", "peg", "ten", "net", "men", "met", "get", "set", "den", "hen", "red", "bed", "leg", "let", "wet",
  "cup", "cut", "up", "us", "mud", "mug", "sun", "run", "rug", "rat", "ran", "rip", "rod", "rot", "hat", "hot", "hop", "hit", "him", "hip", "hug", "hum", "hen",
  "bat", "bag", "bad", "bin", "bit", "big", "bug", "bun", "bus", "but", "bob", "bud", "fan", "fat", "fit", "fin", "fig", "fog", "fun", "fed",
  "lap", "lip", "lit", "log", "lot", "lid", "leg", "puff", "off", "huff", "cuff", "bell", "doll", "hill", "fill", "tell", "well", "hiss", "kiss", "mess", "less", "fuss",
]);

/** The one extra word offered on this page, or -1. Never any copy of a designed magic word, never a name. */
export function pickIllTry(page: Page, learner: LearnerModel, taken: Set<number>, graded: (i: number) => boolean): number {
  const designed = magicTokens(page);
  for (let i = 0; i < page.tokens.length; i++) {
    if (taken.has(i) || designed.has(i) || graded(i)) continue;
    const t = page.tokens[i].t;
    if (/^[A-Z]/.test(t.trim())) continue;                     // a capitalised token is a name, at any position
    const w = normalise(t);
    if (!ILL_TRY_WORDS.has(w)) continue;
    if (!checkMagicWord(w, learner).ok) continue;
    return i;
  }
  return -1;
}
