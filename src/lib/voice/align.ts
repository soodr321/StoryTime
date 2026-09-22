/**
 * Align what a speech recogniser heard to the page's words. Conservative on purpose (K-1 print
 * referencing): accept the NEXT word, or skip at most one closed-class word to reach the one
 * after it. Never jump further, never light the pending child word or anything past it.
 * Interim strings can be revised, so alignment always restarts from the utterance's anchor.
 */
export const CLOSED = new Set([
  "a", "an", "the", "to", "of", "and", "in", "on", "at", "it", "is", "was",
  "he", "she", "we", "i", "you", "they", "his", "her", "its", "up", "so",
  "as", "but", "or", "for", "with", "had", "has", "not", "out", "by",
  "from", "into", "that", "this", "my", "your", "them", "him", "me",
  "did", "do", "will", "all", "no"
]);

export const norm = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z]/g, "");

/** Levenshtein-ish fuzzy: identical, or one edit for words of 4+ letters (recognisers drop endings). */
export function matches(heard: string, expected: string): boolean {
  if (heard === expected) return true;
  if (expected.length < 4 || Math.abs(heard.length - expected.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < heard.length && j < expected.length) {
    if (heard[i] === expected[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (heard.length > expected.length) i++; else if (heard.length < expected.length) j++; else { i++; j++; }
  }
  return edits + (heard.length - i) + (expected.length - j) <= 1;
}

export interface AlignInput { tokens: string[]; anchor: number; heard: string[]; stopAt: number }

/** New cursor after consuming `heard` (the whole current utterance) from `anchor`; never reaches `stopAt`. */
export function align({ tokens, anchor, heard, stopAt }: AlignInput): number {
  let cursor = anchor;
  const limit = stopAt >= 0 ? stopAt : tokens.length;
  for (const h of heard.map(norm).filter(Boolean)) {
    const n1 = cursor + 1, n2 = cursor + 2, n3 = cursor + 3;
    if (n1 >= limit) break;
    if (matches(h, tokens[n1])) { cursor = n1; continue; }
    if (n2 < limit && matches(h, tokens[n2])) { cursor = n2; continue; }
    if (n3 < limit && CLOSED.has(tokens[n1]) && CLOSED.has(tokens[n2]) && matches(h, tokens[n3])) { cursor = n3; continue; }
    // no match: a repeated phrase, an aside, or the child's voice; hold position
  }
  return cursor;
}
