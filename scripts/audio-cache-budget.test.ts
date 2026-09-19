import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AUDIO_CACHE_NAME } from "../src/lib/library";

/**
 * plan-voice.md G3: Workbox's runtime cache had maxEntries: 120 against 392 shipped audio files —
 * the LRU was already thrashing, so most audio was not reliably offline. Two things must hold:
 * the page-level helper (src/lib/audioCache.ts) opens the exact cache Workbox's CacheFirst route
 * reads from, and the cap stays above the shipped inventory (with headroom for what this plan
 * still adds — 66 Teach chip words, 8 tricky-word clips — not just today's smaller count).
 */
const config = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");
const cacheNameMatch = config.match(/cacheName:\s*"([^"]+)"/);
const maxEntriesMatch = config.match(/maxEntries:\s*(\d+)/);

describe("vite.config.ts audio runtime-cache budget", () => {
  it("Workbox's cacheName matches AUDIO_CACHE_NAME, so the runtime precache helper reads/writes the same cache", () => {
    expect(cacheNameMatch?.[1]).toBe(AUDIO_CACHE_NAME);
  });

  it("maxEntries stays above the post-plan shipped inventory (392 today + 66 Teach chip words + 8 tricky clips), with headroom", () => {
    const maxEntries = Number(maxEntriesMatch?.[1]);
    expect(maxEntries).toBeGreaterThan(392 + 66 + 8);
  });
});
