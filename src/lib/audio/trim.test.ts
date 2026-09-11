import { describe, expect, it } from "vitest";
import { trimSilence } from "./trim";

const sr = 22050;
const make = (silenceMs: number, soundMs: number, tailMs: number, amp = 0.5) => {
  const out = new Float32Array(Math.round(((silenceMs + soundMs + tailMs) / 1000) * sr));
  const s0 = Math.round((silenceMs / 1000) * sr), s1 = s0 + Math.round((soundMs / 1000) * sr);
  for (let i = s0; i < s1; i++) out[i] = amp * Math.sin(i / 7);
  return out;
};

describe("trimSilence", () => {
  it("keeps the sound plus 40 ms of head and tail", () => {
    const t = trimSilence(make(300, 200, 300), sr);
    expect(t.ok).toBe(true); expect(Math.abs(t.startMs - 260)).toBeLessThan(15); expect(Math.abs(t.endMs - 540)).toBeLessThan(15);
  });
  it("rejects a recording that is really a word or a letter name", () => { expect(trimSilence(make(100, 1500, 100), sr).ok).toBe(false); });
  it("rejects silence and a blip", () => { expect(trimSilence(make(300, 0, 300), sr).reason).toBe("too quiet"); expect(trimSilence(make(300, 20, 300), sr).reason).toBe("too short"); });
});
