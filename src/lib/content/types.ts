/** Content contract. Validated by scripts/validate-library.ts in CI. */

export type Tradition = "aesop" | "panchatantra" | "classic" | "family";

export interface Token {
  /** Display token including its punctuation, e.g. `“Dear` or `crow,` */
  t: string;
  /** Start time in ms within the page audio. Filled by scripts/gen-audio.py. */
  ms: number;
}

export interface Page {
  tokens: Token[];
  /** Emoji or asset key for the illustration. */
  art: string;
  /** Normalised magic words on this page (0–1 per page). */
  magic?: string[];
  /** Relative to /library/<slug>/, e.g. `p1.m4a`. */
  audio?: string;
  /** Total audio length in ms. */
  audioMs?: number;
}

export interface Story {
  slug: string;
  title: string;
  tradition: Tradition;
  source: { work: string; author?: string; year?: number; rights: "public-domain" | "owner" };
  retelling: {
    level: string;
    checklist: { setup: boolean; want: boolean; action: boolean; consequence: boolean; feeling: boolean };
  };
  pages: Page[];
  moral: {
    /** Said by the narrator, in full. */
    spoken: string;
    /** Read by the child. Every word must pass checkLine at `level`. */
    line: string;
    audio?: string;
  };
  /** Minimum learner state this story needs. */
  level: string;
  /** Extra narrator prompts, generated once. */
  prompts?: Record<string, { audio: string; ms: number }>;
}

export function pageText(p: Page): string {
  return p.tokens.map((t) => t.t).join(" ");
}
