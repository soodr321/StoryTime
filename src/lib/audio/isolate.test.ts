import { describe, expect, it, vi } from "vitest";
import { getIsolateContext, playTokenSlice, sliceRange } from "./isolate";

describe("sliceRange (the clamp arithmetic)", () => {
  // the three measured cases from plan-voice.md C1
  it("an 80 ms gap (\"a\" -> \"nap\"): pad is capped at 60 ms, leaving a 20 ms margin before the magic word", () => {
    const tokens = [{ ms: 1000, endMs: 1200 }, { ms: 1280, endMs: 1500 }];   // "a" ends 1200, "nap" starts 1280
    const r = sliceRange(tokens, 0, 5000);
    expect(r).toEqual({ startMs: 1000, endMs: 1260 });   // 1200 + min(60, 80) = 1260, 20 ms before 1280
  });

  it("a 100 ms gap (\"the\"): pad is still capped at 60 ms, not the full 100 ms room", () => {
    const tokens = [{ ms: 4019, endMs: 4180 }, { ms: 4280, endMs: 4400 }];
    const r = sliceRange(tokens, 0, 5000);
    expect(r).toEqual({ startMs: 4019, endMs: 4240 });   // 4180 + 60, well short of 4280
  });

  it("a sentence-final 1,640 ms gap (\"where.\"): the pad is still only 60 ms, never the whole gap", () => {
    const tokens = [{ ms: 2000, endMs: 2300 }, { ms: 3940, endMs: 4100 }];   // huge room to the next token
    const r = sliceRange(tokens, 0, 6000);
    expect(r).toEqual({ startMs: 2000, endMs: 2360 });   // 2300 + 60 — not 3940, the old nextStart bug
  });

  it("the last token on a page clamps against audioMs, not a next token", () => {
    const tokens = [{ ms: 0, endMs: 200 }, { ms: 400, endMs: 900 }];
    const r = sliceRange(tokens, 1, 1000);
    expect(r).toEqual({ startMs: 400, endMs: 960 });   // 900 + min(60, 1000-900=100) = 960
  });

  it("the zero floor: a Whisper end past the next token's start must not invert the interval", () => {
    // base.en sometimes predicts asrEnd > nextStart; without max(0, ...) this goes negative
    const tokens = [{ ms: 1000, endMs: 1500 }, { ms: 1400, endMs: 1600 }];   // asrEnd (1500) > nextStart (1400)
    const r = sliceRange(tokens, 0, 5000);
    expect(r).not.toBeNull();
    expect(r!.endMs).toBeGreaterThanOrEqual(r!.startMs);
    expect(r!.endMs).toBe(1400);   // room clamps to 0, pad clamps to 0, sliceEnd = min(1500, 1400) = 1400
  });

  it("refuses an untimed page (a parent recording with no measured timings) rather than guessing", () => {
    const tokens = [{ ms: 0, endMs: undefined }, { ms: 0, endMs: undefined }];
    expect(sliceRange(tokens, 0, 5000)).toBeNull();
  });

  it("refuses a token with no ASR-measured end, rather than falling back to nextStart", () => {
    const tokens = [{ ms: 100, endMs: undefined }, { ms: 900, endMs: 1000 }];
    expect(sliceRange(tokens, 0, 5000)).toBeNull();
  });

  it("refuses an out-of-range index", () => {
    const tokens = [{ ms: 0, endMs: 100 }];
    expect(sliceRange(tokens, -1, 1000)).toBeNull();
    expect(sliceRange(tokens, 5, 1000)).toBeNull();
  });

  it("never depends on magic-word state — only this token's own end and the next token's start", () => {
    // same shape as a magic-word-adjacent pair, but sliceRange has no magic/pending concept at all
    const tokens = [{ ms: 0, endMs: 100 }, { ms: 180, endMs: 400 }];   // 80 ms room, like "a" -> "nap"
    const r = sliceRange(tokens, 0, 1000);
    expect(r!.endMs).toBeLessThan(tokens[1].ms);   // margin survives regardless of what token 1 "is"
  });
});

// A minimal stand-in for AudioContext/AudioBufferSourceNode/GainNode — jsdom has no Web Audio API,
// so playTokenSlice takes its ctx as a parameter (dependency injection) precisely so this is testable.
function fakeCtx() {
  const gainCalls: Array<{ fn: string; args: number[] }> = [];
  const gainNode = {
    gain: {
      setValueAtTime: vi.fn((v: number, t: number) => gainCalls.push({ fn: "set", args: [v, t] })),
      linearRampToValueAtTime: vi.fn((v: number, t: number) => gainCalls.push({ fn: "ramp", args: [v, t] })),
    },
    connect: vi.fn(),
  };
  const src = { buffer: null as unknown, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null };
  const ctx = {
    currentTime: 10,
    destination: {},
    resume: vi.fn(async () => {}),
    createGain: vi.fn(() => gainNode),
    createBufferSource: vi.fn(() => src),
  };
  return { ctx: ctx as unknown as AudioContext, gainNode, src, gainCalls };
}
const fakeBuffer = (durationS: number) => ({ duration: durationS } as unknown as AudioBuffer);

describe("playTokenSlice", () => {
  it("awaits ctx.resume() before scheduling anything (iOS suspends a shared context during idle listening)", async () => {
    const { ctx, src } = fakeCtx();
    const order: string[] = [];
    (ctx.resume as ReturnType<typeof vi.fn>).mockImplementation(async () => { order.push("resume"); });
    src.start.mockImplementation(() => order.push("start"));
    await playTokenSlice(ctx, fakeBuffer(5), [{ ms: 0, endMs: 200 }, { ms: 400, endMs: 600 }], 0, 5000);
    expect(order).toEqual(["resume", "start"]);
  });

  it("schedules the source at exactly the clamped slice (seconds, not ms)", async () => {
    const { ctx, src } = fakeCtx();
    await playTokenSlice(ctx, fakeBuffer(5), [{ ms: 1000, endMs: 1200 }, { ms: 1280, endMs: 1500 }], 0, 5000);
    expect(src.start).toHaveBeenCalledTimes(1);
    const [when, offset, dur] = src.start.mock.calls[0] as number[];
    expect(when).toBe(10);            // ctx.currentTime
    expect(offset).toBeCloseTo(1.0);  // 1000ms start
    expect(dur).toBeCloseTo(0.26);    // 1260ms end - 1000ms start
  });

  it("ramps gain up then down at both edges (5-10ms band), never a hard cut", async () => {
    const { ctx, gainCalls } = fakeCtx();
    await playTokenSlice(ctx, fakeBuffer(5), [{ ms: 0, endMs: 500 }, { ms: 900, endMs: 1000 }], 0, 5000);
    expect(gainCalls[0]).toEqual({ fn: "set", args: [0, 10] });              // starts silent
    expect(gainCalls[1].fn).toBe("ramp"); expect(gainCalls[1].args[0]).toBe(1);   // ramps up to full
    expect(gainCalls.at(-1)!.fn).toBe("ramp"); expect(gainCalls.at(-1)!.args[0]).toBe(0);   // ramps back to silent
    const rampUpAt = gainCalls[1].args[1] - 10, rampDownStart = gainCalls.at(-1)!.args[1] - gainCalls[2].args[1];
    expect(rampUpAt).toBeGreaterThanOrEqual(0.005); expect(rampUpAt).toBeLessThanOrEqual(0.01);
    expect(rampDownStart).toBeGreaterThanOrEqual(0.005); expect(rampDownStart).toBeLessThanOrEqual(0.01);
  });

  it("silence, never a scheduled source, when the buffer is null (decode failed)", async () => {
    const { ctx, src } = fakeCtx();
    const p = await playTokenSlice(ctx, null, [{ ms: 0, endMs: 200 }, { ms: 400, endMs: 600 }], 0, 1000);
    expect(src.start).not.toHaveBeenCalled();
    await expect(p.done).resolves.toBeUndefined();
  });

  it("silence when the page is untimed — never falls through to playClip/playOn", async () => {
    const { ctx, src } = fakeCtx();
    await playTokenSlice(ctx, fakeBuffer(5), [{ ms: 0, endMs: undefined }, { ms: 0, endMs: undefined }], 0, 1000);
    expect(src.start).not.toHaveBeenCalled();
  });

  it("silence when ctx is null (no Web Audio support)", async () => {
    const p = await playTokenSlice(null, fakeBuffer(5), [{ ms: 0, endMs: 200 }], 0, 1000);
    await expect(p.done).resolves.toBeUndefined();
    expect(p.stop).not.toThrow();
  });

  it("stop() is idempotent and never throws even after the source already ended", async () => {
    const { ctx, src } = fakeCtx();
    const p = await playTokenSlice(ctx, fakeBuffer(5), [{ ms: 0, endMs: 200 }, { ms: 400, endMs: 600 }], 0, 1000);
    src.onended?.();
    expect(() => p.stop()).not.toThrow();
    expect(() => p.stop()).not.toThrow();
  });
});

describe("getIsolateContext", () => {
  it("never throws even without a global AudioContext", () => {
    expect(() => getIsolateContext()).not.toThrow();
  });
});
