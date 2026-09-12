/**
 * Library contract check. Runs in CI via `npm test`. Fails the build when any
 * story breaks the contract: rights, retelling checklist, magic words not
 * decodable at the story's level, read-back line not decodable, or tokens
 * without timings once audio exists.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Story } from "../src/lib/content/types";
import { LEVELS } from "../src/lib/phonics/learner";
import { resolveMagic } from "../src/lib/phonics/target";
import { checkLine, checkMagicWord, normalise } from "../src/lib/phonics/validator";

const LIB = join(__dirname, "..", "library");
const PUB = join(__dirname, "..", "public", "library");
const slugs = readdirSync(LIB).filter((s) => existsSync(join(LIB, s, "story.json")));

describe("library as a whole", () => {
  it("has unique slugs and titles", () => {
    const stories = slugs.map((s) => JSON.parse(readFileSync(join(LIB, s, "story.json"), "utf8")) as Story);
    expect(new Set(stories.map((s) => s.slug)).size).toBe(stories.length);
    expect(new Set(stories.map((s) => s.title)).size).toBe(stories.length);
    for (const s of stories) expect(s.slug, "slug matches folder").toBe(slugs[stories.indexOf(s)]);
  });
});

describe.each(slugs)("library/%s", (slug) => {
  const story = JSON.parse(readFileSync(join(LIB, slug, "story.json"), "utf8")) as Story & { pages: Array<{ text?: string }> };
  const level = LEVELS[story.level];

  it("names a source and its rights", () => {
    expect(story.source.work).toBeTruthy();
    expect(["public-domain", "owner"]).toContain(story.source.rights);
  });
  it("passes the retelling checklist", () => {
    expect(Object.values(story.retelling.checklist).every(Boolean)).toBe(true);
  });
  it("uses a known level", () => { expect(level).toBeDefined(); });
  it("has a title and at least two pages, each with text", () => {
    expect(story.title.trim()).not.toBe("");
    expect(story.pages.length).toBeGreaterThanOrEqual(2);
    for (const p of story.pages) expect((p.tokens ?? []).length, "page has words").toBeGreaterThan(0);
  });
  // a magic word may recur across pages: results are keyed by page + token index, so each occurrence is its own turn
  it("ships the narration it references (when audio has been generated)", () => {
    if (!existsSync(PUB)) return; // fresh checkout: gen-audio.py has not run; deploy-pages.sh refuses to publish in that state
    for (const p of story.pages) { if (p.audio) { expect(existsSync(join(PUB, slug, p.audio)), `${slug}/${p.audio}`).toBe(true); expect(p.audioMs ?? 0).toBeGreaterThan(500); } }
    if (story.moral.audio) expect(existsSync(join(PUB, slug, story.moral.audio))).toBe(true);
  });
  it("has 0–1 magic word per page, each decodable and present in the page text", () => {
    for (const p of story.pages as Story["pages"]) {
      const words = p.magic ?? [];
      expect(words.length).toBeLessThanOrEqual(1);
      const text = (p.tokens ?? []).map((t) => normalise(t.t));
      for (const w of words) {
        const r = checkMagicWord(w, level);
        expect(r.ok, `${w}: ${!r.ok ? r.reasons.join("; ") : ""}`).toBe(true);
        expect(text).toContain(normalise(w));
        // the resolver skips capitalised copies; if every copy is capitalised the page would ask the child to
        // decode a proper name, and at token 0 the narration stop time is ~110 ms (the page blips)
        const idx = resolveMagic(p, w);
        const tok = (p.tokens ?? [])[idx]?.t ?? "";
        expect(/^[A-Z]/.test(tok.trim()), `${slug}: magic "${w}" resolves to ${JSON.stringify(tok)} — a capitalised token`).toBe(false);
      }
    }
  });
  it("has a read-back line the child can decode at this level", () => {
    const r = checkLine(story.moral.line, level);
    expect(r.ok, r.results.filter((x) => !x.ok).map((x) => !x.ok && x.reasons.join("; ")).join(" | ")).toBe(true);
  });
  it("has tokens with monotonic timings on every page that has audio", () => {
    for (const p of story.pages as Story["pages"]) {
      expect(p.tokens?.length, "page has tokens (run scripts/gen-audio.py)").toBeGreaterThan(0);
      if (!p.audio) continue;
      const ms = p.tokens.map((t) => t.ms);
      expect(ms[0]).toBeGreaterThanOrEqual(0);
      for (let i = 1; i < ms.length; i++) expect(ms[i]).toBeGreaterThanOrEqual(ms[i - 1]);
      expect(ms[ms.length - 1]).toBeLessThan(p.audioMs ?? Infinity);
    }
  });
});
