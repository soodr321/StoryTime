import { afterEach, describe, expect, it, vi } from "vitest";
import { canPrecache, precacheBook } from "./audioCache";
import { AUDIO_CACHE_NAME } from "./library";

function fakeCaches(opts: { hasMatch?: (url: string) => boolean; failOn?: Set<string> } = {}) {
  const added: string[] = [];
  const cache = {
    match: vi.fn(async (url: string) => (opts.hasMatch?.(url) ? { ok: true } : undefined)),
    add: vi.fn(async (url: string) => {
      if (opts.failOn?.has(url)) throw new Error(`network error for ${url}`);
      added.push(url);
    }),
  };
  const open = vi.fn(async () => cache);
  return { open, cache, added };
}

describe("precacheBook", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("is a no-op when the Cache Storage API is unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    expect(canPrecache()).toBe(false);
    await expect(precacheBook(["/a.m4a"])).resolves.toBeUndefined();   // never throws
  });

  it("is a no-op for an empty list, without opening the cache", async () => {
    const { open } = fakeCaches();
    vi.stubGlobal("caches", { open });
    await precacheBook([]);
    expect(open).not.toHaveBeenCalled();
  });

  it("opens the SAME cache Workbox's CacheFirst route reads from", async () => {
    const { open } = fakeCaches();
    vi.stubGlobal("caches", { open });
    await precacheBook(["/library/dad-did-nap/p1.m4a"]);
    expect(open).toHaveBeenCalledWith(AUDIO_CACHE_NAME);
  });

  it("fetches every URL not already cached", async () => {
    const { open, cache, added } = fakeCaches();
    vi.stubGlobal("caches", { open });
    await precacheBook(["/a.m4a", "/b.m4a", "/c.m4a"]);
    expect(added.sort()).toEqual(["/a.m4a", "/b.m4a", "/c.m4a"]);
    expect(cache.add).toHaveBeenCalledTimes(3);
  });

  it("skips a URL that is already offline instead of re-fetching it", async () => {
    const { open, cache } = fakeCaches({ hasMatch: (u) => u === "/a.m4a" });
    vi.stubGlobal("caches", { open });
    await precacheBook(["/a.m4a", "/b.m4a"]);
    expect(cache.add).toHaveBeenCalledTimes(1);
    expect(cache.add).toHaveBeenCalledWith("/b.m4a");
  });

  it("one clip failing to fetch never blocks the rest, and never throws (best-effort only)", async () => {
    const { open, added } = fakeCaches({ failOn: new Set(["/bad.m4a"]) });
    vi.stubGlobal("caches", { open });
    await expect(precacheBook(["/good1.m4a", "/bad.m4a", "/good2.m4a"])).resolves.toBeUndefined();
    expect(added.sort()).toEqual(["/good1.m4a", "/good2.m4a"]);
  });

  it("a broken caches.open() (private mode, quota) never throws, never blocks story start", async () => {
    vi.stubGlobal("caches", { open: vi.fn(async () => { throw new Error("quota exceeded"); }) });
    await expect(precacheBook(["/a.m4a"])).resolves.toBeUndefined();
  });
});
