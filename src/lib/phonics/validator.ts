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
  /** true once adjacent-consonant blends (Phase 4) have been taught */
  clusters?: boolean;
}

export type CheckResult =
  | { ok: true; kind: "decodable"; word: string; graphemes: string[] }
  | { ok: true; kind: "tricky"; word: string; graphemes: [string] }
  | { ok: false; word: string; graphemes: string[]; reasons: string[] };

/** Lowercase, strip everything that is not a–z. Case is display-only. */
export function normalise(word: string): string {
  return (word ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Multi-letter graphemes English children are taught later (Letters & Sounds phases 3–5).
 * A word containing one of these that the child has NOT been taught is not decodable letter by
 * letter — "mango" is not m-a-n-g-o, "tree" is not t-r-e-e — so it is rejected even when every
 * single letter is known. This is the cheap stand-in for a pronunciation lexicon.
 */
export const LATER_GRAPHEMES = ["ng", "sh", "ch", "th", "qu", "wh", "ph", "ai", "ee", "igh", "oa", "oo", "ar", "or", "ur", "ow", "oi", "ear", "air", "ure", "er", "ay", "ou", "ie", "ea", "oy", "ir", "ue", "aw", "ew", "oe", "au", "ey", "tch", "dge", "wr", "kn", "ck", "ff", "ll", "ss", "zz"];

/** Exception words (Letters & Sounds phases 2–3). These are never sounded out; they are taught as wholes or not at all. */
export const EXCEPTIONS = new Set(["the", "a", "i", "is", "to", "no", "go", "into", "put", "of", "do", "he", "she", "we", "me", "be", "was", "you", "they", "all", "are", "my", "her", "said", "have", "like", "so", "some", "come", "were", "there", "little", "one", "when", "out", "what"]);

export function checkWord(word: string, learner: LearnerModel): CheckResult {
  const w = normalise(word);
  if (!w) return { ok: false, word: w, graphemes: [], reasons: ["empty word"] };
  if (/['’]/.test((word ?? "").replace(/^['’]+|['’]+$/g, ""))) return { ok: false, word: w, graphemes: [], reasons: [`"${word}" has an apostrophe; contractions are not decodable`] };

  const tricky = new Set(learner.tricky.map(normalise));
  if (tricky.has(w)) return { ok: true, kind: "tricky", word: w, graphemes: [w] };
  if (EXCEPTIONS.has(w)) return { ok: false, word: w, graphemes: [], reasons: [`"${w}" is a tricky word that has not been taught yet; it is never sounded out`] };

  const taught = new Set(learner.gpcs.map(normalise));
  if (/[^aeiou]e$/.test(w) && w.length > 2 && !taught.has("a-e")) return { ok: false, word: w, graphemes: [], reasons: [`"${w}" ends in a silent e (split digraph), which has not been taught yet`] };
  const later = LATER_GRAPHEMES.filter((g) => !taught.has(g)).sort((a, b) => b.length - a.length).find((g) => w.includes(g));
  if (later) return { ok: false, word: w, graphemes: [], reasons: [`"${later}" in "${w}" is one sound that has not been taught yet`] };

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

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
/** Phase 2 blends CVC only. Adjacent consonants (must, trick, and) are Phase 4. */
export function isCvcShaped(graphemes: string[]): boolean {
  if (graphemes.length > 3) return false;
  for (let i = 1; i < graphemes.length; i++) if (!VOWELS.has(graphemes[i]) && !VOWELS.has(graphemes[i - 1])) return false;
  return true;
}

/** A magic word must be decodable, not tricky, and blendable at this stage: the child sounds it out. */
export function checkMagicWord(word: string, learner: LearnerModel): CheckResult {
  const r = checkWord(word, learner);
  if (r.ok && r.kind === "decodable" && !learner.clusters && !isCvcShaped(r.graphemes)) {
    return { ok: false, word: r.word, graphemes: r.graphemes, reasons: [`"${r.word}" has adjacent consonants (${r.graphemes.join("-")}); stick to three sounds like sat, got, sad until blends are taught`] };
  }
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
    .map((t) => { const r = checkWord(t, learner); return r.ok && r.kind === "decodable" && !learner.clusters && !isCvcShaped(r.graphemes) ? { ok: false as const, word: r.word, graphemes: r.graphemes, reasons: [`"${r.word}" has adjacent consonants; not yet`] } : r; });
  return { ok: results.length > 0 && results.every((r) => r.ok), results };
}
