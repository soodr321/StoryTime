/**
 * Runtime precache for "tonight's book" (plan-voice.md G3).
 *
 * Workbox's CacheFirst route (vite.config.ts) already caches library/prompts/sounds/blends audio
 * on first play, but Workbox's build-time globs cannot know which book tonight's reader will pick
 * — that choice happens at runtime. This fills exactly that gap: given a page's own list of audio
 * URLs, ask the Cache Storage API to fetch and hold them in the *same* cache Workbox's route reads
 * from, so the story can already be offline before the first tap plays anything.
 *
 * Not wired into story-start yet — this is the mechanism only (plan-voice.md phase 1 scope). It is
 * best-effort by construction: no Cache API, no network, or one file 404ing must never throw or
 * block starting a story, so each URL is cached independently rather than as one all-or-nothing
 * `cache.addAll()` (which aborts the whole batch on a single failure).
 */
import { AUDIO_CACHE_NAME } from "./library";

/** True when this runtime can even attempt a precache (no Cache Storage API — e.g. some old
 * browsers, or a page loaded over plain http — is a normal, silent no-op everywhere below). */
export function canPrecache(): boolean {
  return typeof caches !== "undefined";
}

/**
 * Fetch and store `urls` in the audio runtime cache, skipping any already cached. Resolves once
 * every URL has been attempted; a failure on any one URL (network, 404, opaque response) is
 * swallowed — this is an offline-readiness enhancement, never a gate on starting the story.
 */
export async function precacheBook(urls: readonly string[]): Promise<void> {
  if (!canPrecache() || urls.length === 0) return;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await Promise.all(urls.map(async (url) => {
      try {
        if (await cache.match(url)) return;   // already offline: don't re-fetch it
        await cache.add(url);
      } catch { /* one clip failing to precache must never block the rest, or starting the story */ }
    }));
  } catch { /* Cache Storage unavailable or blocked (private mode, quota): silently skip */ }
}
