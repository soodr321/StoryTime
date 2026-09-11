import type { LearnerModel } from "./validator";

/**
 * Phonics sequence as data (decision: Letters & Sounds phase 2 order; a school
 * sequence can replace this file without a code change).
 */
export const LS_PHASE2_ORDER = [
  "s", "a", "t", "p",           // set 1
  "i", "n", "m", "d",           // set 2
  "g", "o", "c", "k",           // set 3
  "ck", "e", "u", "r",          // set 4
  "h", "b", "f", "ff", "l", "ll", "ss", // set 5
] as const;

/** Locked tricky-word set for phase 2. The parent may delay teaching one; nothing may reclassify one. */
export const TRICKY_PHASE2 = ["the", "a", "I", "is", "to", "no", "go", "into"] as const;

/** Tricky words are mostly regular: show the regular part and mark only the odd bit. `|` separates regular | tricky. */
export const TRICKY_PARTS: Record<string, string> = { the: "th|e", a: "|a", I: "|I", is: "i|s", to: "t|o", no: "n|o", go: "g|o", into: "in|to" };

/** Named levels: how far along the order a child is. */
export const LEVELS: Record<string, LearnerModel> = {
  "ls-phase2-set2": { gpcs: LS_PHASE2_ORDER.slice(0, 8) as unknown as string[], tricky: ["the", "a", "I"] },
  "ls-phase2-set3": { gpcs: LS_PHASE2_ORDER.slice(0, 12) as unknown as string[], tricky: ["the", "a", "I", "is"] },
  "ls-phase2-set4": { gpcs: LS_PHASE2_ORDER.slice(0, 16) as unknown as string[], tricky: ["the", "a", "I", "is", "to"] },
  "ls-phase2-set5": { gpcs: [...LS_PHASE2_ORDER], tricky: [...TRICKY_PHASE2] },
};

/** How each grapheme is spoken in the UI label and which recorded clip plays. */
export const GRAPHEME_SOUND: Record<string, { label: string; clip: string }> = {
  s: { label: "sss", clip: "s" }, a: { label: "a", clip: "a" }, t: { label: "t", clip: "t" }, p: { label: "p", clip: "p" },
  i: { label: "i", clip: "i" }, n: { label: "nnn", clip: "n" }, m: { label: "mmm", clip: "m" }, d: { label: "d", clip: "d" },
  g: { label: "g", clip: "g" }, o: { label: "o", clip: "o" }, c: { label: "k", clip: "k" }, k: { label: "k", clip: "k" },
  ck: { label: "k", clip: "k" }, e: { label: "e", clip: "e" }, u: { label: "u", clip: "u" }, r: { label: "rrr", clip: "r" },
  h: { label: "h", clip: "h" }, b: { label: "b", clip: "b" }, f: { label: "fff", clip: "f" }, ff: { label: "fff", clip: "f" },
  l: { label: "lll", clip: "l" }, ll: { label: "lll", clip: "l" }, ss: { label: "sss", clip: "s" },
};

/** Phase 0 default. Phase 1 makes this per-child and parent-editable. */
export const DEFAULT_LEVEL = "ls-phase2-set4";
