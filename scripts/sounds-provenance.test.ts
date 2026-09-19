import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * plan-voice.md B2/E4: the shipped manifest names one pack in `_pack` (which built the wavs) and
 * must not have per-clip records that disagree with it — that was the actual bug (`_pack` said
 * "soundcity" while every clip said "family", a leftover from before the pack swap). No audio
 * check here: this is metadata-only, same as the fix that produced it.
 */
const MANIFEST = join(process.cwd(), "public", "sounds", "manifest.json");
const REGISTRY = join(process.cwd(), "scripts", "sound-packs.json");

describe("sounds manifest provenance", () => {
  if (!existsSync(MANIFEST)) { it.skip("clips not generated", () => {}); return; }
  const man = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, unknown>;
  const pack = man._pack as { name: string; attribution: string; license: string; title: string } | undefined;
  const clips = Object.entries(man).filter(([k]) => !k.startsWith("_")) as [string, { artist: string; license: string; source: string; edit: string }][];

  it("has a _pack stamp naming who actually built these wavs", () => {
    expect(pack?.name, "public/sounds/manifest.json _pack").toBeTruthy();
  });

  it("every clip's artist and license agree with _pack — never a leftover from a previous pack", () => {
    for (const [g, clip] of clips) {
      expect(clip.artist, `${g}.artist vs _pack.attribution`).toBe(pack!.attribution);
      expect(clip.license, `${g}.license vs _pack.license`).toBe(pack!.license);
    }
  });

  it("every clip's raw-take path points at the pack registry's source directory, not a stale one", () => {
    const reg = JSON.parse(readFileSync(REGISTRY, "utf8")) as { packs: Record<string, { source: string }> };
    const src = reg.packs[pack!.name]?.source;
    expect(src, `sound-packs.json has an entry for ${pack!.name}`).toBeTruthy();
    for (const [g, clip] of clips) {
      expect(clip.edit, `${g}.edit should cite ${src}`).toContain(`raw take ${src}/`);
    }
  });

  it("no clip is still stamped for a different pack than _pack names (e.g. \"family\" under a non-family _pack)", () => {
    if (pack!.name === "family") return;
    for (const [g, clip] of clips) {
      expect(clip.license, `${g} looks like it never got restamped`).not.toBe("family");
      expect(clip.artist, `${g} looks like it never got restamped`).not.toBe("family");
    }
  });
});
