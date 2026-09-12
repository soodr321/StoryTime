import { beforeEach, describe, expect, it, vi } from "vitest";

// one in-memory IndexedDB: these are the writes every night depends on and they had no test
const db = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (k: string) => db.get(k),
  set: async (k: string, v: unknown) => { db.set(k, JSON.parse(JSON.stringify(v))); },
  del: async (k: string) => { db.delete(k); },
  keys: async () => [...db.keys()],
}));

const { recordEncoding, recordFinish, loadProgress, scheduleReview, loadReview, dueReview, readyToAdvance, recordAttempt, loadAttempts } = await import("./store");

beforeEach(() => db.clear());

describe("the build's evidence", () => {
  it("survives the first read of a story (no progress row yet)", async () => {
    await recordEncoding("k1", "fox-and-crow", "sat", true);
    const p = await loadProgress("k1");
    expect(p["fox-and-crow"].encoding).toHaveLength(1);
    expect(p["fox-and-crow"].timesFinished).toBe(0);
  });
  it("is still there after the story finishes", async () => {
    await recordEncoding("k1", "fox-and-crow", "sat", true);
    await recordFinish("k1", "fox-and-crow", [{ word: "sat", ok: true, mode: "first_try" }]);
    const p = await loadProgress("k1");
    expect(p["fox-and-crow"].encoding).toHaveLength(1);
    expect(p["fox-and-crow"].timesFinished).toBe(1);
  });
  it("unblocks the next sound: a first-read build counts towards readiness", async () => {
    await recordEncoding("k1", "fox-and-crow", "sat", true);
    for (let i = 0; i < 2; i++) await recordAttempt("k1", { at: Date.now(), slug: "fox-and-crow", gpcCount: 16, firstTryRate: 1, words: 3, firstTry: 3 });
    expect(readyToAdvance(await loadAttempts("k1"), 16, await loadProgress("k1"), 0)).toBe(true);
  });
});

describe("a listen-along night", () => {
  it("counts for the ritual but does not use up the first reading of the book", async () => {
    await recordFinish("k1", "pat-and-the-tap", [], { listenOnly: true });
    const p = await loadProgress("k1");
    expect(p["pat-and-the-tap"].timesFinished).toBe(0);
    expect(p["pat-and-the-tap"].history).toHaveLength(1);
    expect(p["pat-and-the-tap"].results).toEqual([]);
  });
  it("does not overwrite a real reading's results", async () => {
    await recordFinish("k1", "pat-and-the-tap", [{ word: "tap", ok: true, mode: "first_try" }]);
    await recordFinish("k1", "pat-and-the-tap", [], { listenOnly: true });
    const p = await loadProgress("k1");
    expect(p["pat-and-the-tap"].results).toHaveLength(1);
    expect(p["pat-and-the-tap"].timesFinished).toBe(1);
    expect(p["pat-and-the-tap"].history).toHaveLength(2);
  });
});

describe("review scheduling", () => {
  it("a missed word comes back, a first-try word waits", async () => {
    await scheduleReview("k1", [{ word: "duck", ok: false, mode: "skipped" }, { word: "sat", ok: true, mode: "first_try" }]);
    const due = dueReview(await loadReview("k1"), Date.now() + 24 * 3600e3);
    expect(due.map((r) => r.word)).toContain("duck");
    expect(due.map((r) => r.word)).not.toContain("sat");
  });
});
