/** Built-in library: every library/<slug>/story.json, bundled at build time. */
import type { Story } from "./content/types";
import type { LearnerModel } from "./phonics/validator";
import { checkLine, checkMagicWord } from "./phonics/validator";

const mods = import.meta.glob("../../library/*/story.json", { eager: true, import: "default" }) as Record<string, Story>;
export const LIBRARY: Story[] = Object.values(mods).sort((a, b) => a.title.localeCompare(b.title));

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const AUDIO_V = "3";   // bump with any change to narration/timings or public/sounds so a cached install never pairs new timings with old audio
export const storyAsset = (story: Story, file: string) => (story.tradition === "family" ? file : `${BASE}/library/${story.slug}/${file}?v=${AUDIO_V}`);
export const promptAsset = (file: string) => `${BASE}/prompts/${file}?v=${AUDIO_V}`;

/** Can this child do every magic word and the read-back line of this story? */
export function fits(story: Story, learner: LearnerModel): boolean {
  const magicOk = story.pages.every((p) => (p.magic ?? []).every((m) => checkMagicWord(m, learner).ok));
  return magicOk && checkLine(story.moral.line, learner).ok;
}

export const TRADITION_LABEL: Record<Story["tradition"], string> = { aesop: "Aesop", panchatantra: "Panchatantra", classic: "Classic", family: "Family story" };
