/**
 * Decodability validator.
 *
 * Tokenises a word into graphemes using ONLY the learner's taught
 * grapheme–phoneme correspondences (GPCs), longest-grapheme-first.
 * Tricky (exception) words are accepted only when explicitly taught and are
 * never tokenised: their pronunciation is not the sum of their letters.
 * Empty input fails closed. Every failure carries a reason a parent can act on.
 */

export interface LearnerModel {
  /** Ordered as taught. Multi-letter graphemes allowed (ck, sh, ai …). */
  gpcs: string[];
  /** Exception words taught as wholes. Locked set; parent may delay, never reclassify. */
  tricky: string[];
}

export type CheckResult =
  | { ok: true; kind: "decodable"; word: string; graphemes: string[] }
  | { ok: true; kind: "tricky"; word: string; graphemes: [string] }
  | { ok: false; word: string; graphemes: string[]; reasons: string[] };

/** Lowercase, strip everything that is not a–z. Case is display-only. */
export function normalise(word: string): string {
  return (word ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

export function checkWord(word: string, learner: LearnerModel): CheckResult {
  const w = normalise(word);
  if (!w) return { ok: false, word: w, graphemes: [], reasons: ["empty word"] };

  const tricky = new Set(learner.tricky.map(normalise));
  if (tricky.has(w)) return { ok: true, kind: "tricky", word: w, graphemes: [w] };

  const gpcs = [...new Set(learner.gpcs.map(normalise).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  const out: string[] = [];
  let i = 0;
  while (i < w.length) {
    const g = gpcs.find((g) => w.startsWith(g, i));
    if (!g) {
      return {
        ok: false,
        word: w,
        graphemes: out,
        reasons: [`"${w[i]}" (letter ${i + 1} of "${w}") is not a taught sound`],
      };
    }
    out.push(g);
    i += g.length;
  }
  return { ok: true, kind: "decodable", word: w, graphemes: out };
}

/** A magic word must be decodable, not tricky: the child sounds it out. */
export function checkMagicWord(word: string, learner: LearnerModel): CheckResult {
  const r = checkWord(word, learner);
  if (r.ok && r.kind === "tricky") {
    return {
      ok: false,
      word: r.word,
      graphemes: r.graphemes,
      reasons: [`"${r.word}" is a tricky word; magic words must be sounded out`],
    };
  }
  return r;
}

/** Every word of the child's read-back line must be decodable or a taught tricky word. */
export function checkLine(line: string, learner: LearnerModel): { ok: boolean; results: CheckResult[] } {
  const results = line
    .split(/\s+/)
    .filter((t) => normalise(t))
    .map((t) => checkWord(t, learner));
  return { ok: results.length > 0 && results.every((r) => r.ok), results };
}
