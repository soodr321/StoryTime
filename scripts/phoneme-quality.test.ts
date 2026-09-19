import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The fallback phoneme clips must sound like ONE person saying one sound, at one volume.
 * They are cut from Wikimedia IPA recordings, and it is easy to ship a set that is technically
 * "the right sound" and musically a chorus of four different voices — which is what "sss-a-t"
 * sounded like when a vowel came from a speaker an octave higher. These numbers are produced by
 * scripts/cut-phonemes.py; this test is the gate.
 */
const MANIFEST = join(process.cwd(), "public", "sounds", "manifest.json");

describe("phoneme clip quality", () => {
  if (!existsSync(MANIFEST)) { it.skip("clips not generated", () => {}); return; }
  const all = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, { kind: string; ms: number; f0: number; f0_drift: number; rms_db: number }>;
  // keys beginning with "_" are metadata about the pack these clips came from, not clips
  const man = Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith("_")));
  const voiced = Object.entries(man).filter(([g, c]) => c.kind !== "stop" && c.f0 > 0 && g !== "h");   // /h/ is breath: its pitch estimate is noise

  it("has every taught sound", () => {
    for (const g of ["s", "a", "t", "p", "i", "n", "m", "d", "g", "o", "k", "e", "u", "r", "h", "b", "f", "l"]) expect(man[g], g).toBeTruthy();
  });
  it("is one voice: every voiced clip within a fifth of the median pitch", () => {
    const f = voiced.map(([, c]) => c.f0).sort((a, b) => a - b);
    const median = f[Math.floor(f.length / 2)];
    for (const [g, c] of voiced) expect(Math.abs(c.f0 - median) / median, `${g} at ${c.f0} Hz vs median ${median} Hz`).toBeLessThan(0.5);
  });
  it("holds its pitch inside each clip (no drift into a second voice)", () => {
    for (const [g, c] of Object.entries(man)) if (g !== "h") expect(c.f0_drift, `${g} drifts ${c.f0_drift} Hz`).toBeLessThan(40);
  });
  it("is level-matched, so a blend does not jump in volume", () => {
    const db = Object.values(man).map((c) => c.rms_db);
    expect(Math.max(...db) - Math.min(...db), "loudness spread").toBeLessThan(6);
  });
  it("keeps a vowel long enough to stretch, and a stop short enough not to become a syllable", () => {
    // A voiceless stop is burst + aspiration; it cannot be heard as "tuh" however long the aspiration
    // runs, because there is no voice in it - the schwa-tail check in scripts/audit/phonetics.py is
    // what guards that, so the cap here is only a sanity bound against a whole syllable. A VOICED
    // stop must carry its voicing, which is what makes /b/ a /b/ and not a /p/, but 200 ms of voicing
    // IS "buh", so it is capped tighter.
    const voicedStops = new Set(["b", "d", "g"]);
    for (const [g, c] of Object.entries(man)) {
      if (c.kind === "vowel") expect(c.ms, g).toBeGreaterThanOrEqual(150);
      if (c.kind === "stop") expect(c.ms, g).toBeLessThanOrEqual(voicedStops.has(g) ? 130 : 170);
    }
  });
});

describe("phonetic gate", () => {
  it("every sound would let a child blend: voice onset, no schwa tail, steady vowels", async () => {
    const { execFileSync } = await import("node:child_process");
    let out = "";
    try { out = execFileSync("python3", ["scripts/audit/phonetics.py", "--strict"], { encoding: "utf8" }); }
    catch (e) { out = String((e as { stdout?: string }).stdout ?? e); expect(out).toContain("every clip passes"); return; }
    expect(out, out.split("\n").filter((l) => l.includes("✗")).join(" | ")).toContain("every clip passes");
  }, 120_000);
});
