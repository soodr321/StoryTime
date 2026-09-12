/**
 * A word the child volunteered for ("I'll try") is practice, never evidence: it must not move the
 * advancement gate, schedule tomorrow's warm-up, decide the dictation word, or count in any total.
 * Every aggregator filters through here.
 */
export const designed = <T extends { extra?: boolean }>(results: T[]): T[] => results.filter((r) => !r.extra);
export const volunteered = <T extends { extra?: boolean }>(results: T[]): T[] => results.filter((r) => r.extra);
