/** Built-in library: every library/<slug>/story.json, bundled at build time. */
import type { Story } from "./content/types";
import type { LearnerModel } from "./phonics/validator";
import { checkLine, checkMagicWord } from "./phonics/validator";

const mods = import.meta.glob("../../library/*/story.json", { eager: true, import: "default" }) as Record<string, Story>;
export const LIBRARY: Story[] = Object.values(mods).sort((a, b) => a.title.localeCompare(b.title));

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const AUDIO_V = "6";   // bump with any change to narration/timings or public/sounds so a cached install never pairs new timings with old audio
/** The Workbox runtime-cache name for library/prompts/sounds/blends audio (vite.config.ts). Kept
 * here, not just there, so a page-level helper (src/lib/audioCache.ts) can open the exact same
 * cache Workbox's CacheFirst route reads from; a vitest checks the two stay in sync. */
export const AUDIO_CACHE_NAME = `storytime-audio-v${AUDIO_V}`;
export const storyAsset = (story: Story, file: string) => (story.tradition === "family" ? file : `${BASE}/library/${story.slug}/${file}?v=${AUDIO_V}`);
export const promptAsset = (file: string) => `${BASE}/prompts/${file}?v=${AUDIO_V}`;
/** the "slide through the word" model: the narration voice saying that word slowly (scripts/gen-blends.py) */
export const blendAsset = (word: string) => `${BASE}/blends/${word.toLowerCase()}.m4a?v=${AUDIO_V}`;

/** Can this child do every magic word and the read-back line of this story? */
export function fits(story: Story, learner: LearnerModel): boolean {
  const magicOk = story.pages.every((p) => (p.magic ?? []).every((m) => checkMagicWord(m, learner).ok));
  return magicOk && checkLine(story.moral.line, learner).ok;
}

/**
 * Below four sounds a child cannot decode anything, so the first nights are a listen-along:
 * the grown-up reads a real book end to end and the child listens, points and taps words.
 * It is always the same set-1 book, so the first decoding night still meets it as a new story.
 */
export const listenAlongStory = (): Story | undefined => LIBRARY.find((s) => s.level === "ls-phase2-set1");

export const TRADITION_LABEL: Record<Story["tradition"], string> = { aesop: "Aesop", panchatantra: "Panchatantra", classic: "Classic", family: "Family story" };
