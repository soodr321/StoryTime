/**
 * Tap-to-hear = a slice of the page's own narration (plan-voice.md C1) — a NEW isolator, not
 * today's `playClip`. Median inter-word gap in the shipped narration is 340 ms, 18% under 200 ms,
 * and four places put the word before a magic word within 140 ms of it ("a"→"nap" 80 ms,
 * "a"→"pat." 80 ms, "he"→"got" 120 ms, "a"→"net." 140 ms). `playClip` enforces its end on
 * `timeupdate`, which Safari fires at roughly 250 ms — so tapping "a" can end up speaking "nap",
 * the very word the child was about to read. This module exists to make that impossible:
 *
 *  - Index, never text (duplicate words can't otherwise be told apart).
 *  - The slice end comes from `tokens[i].endMs` — ASR word-end, written by gen-audio.py's
 *    realign() — never `tokens[i+1].ms` on its own, which is 100 ms for "the" and 1,640 ms for a
 *    sentence-final word.
 *  - The clamp does not know or care about magic-word state. It only ever looks at this token's
 *    own measured end and the next token's start.
 *  - Web Audio ONLY: `AudioBufferSourceNode` cut to an exact sample range, gain-ramped at both
 *    edges. No `<audio>` element, no `timeupdate` poll, no seek-and-hope.
 *  - A decode failure, an untimed page, or a token with no measured end all mean SILENCE — never
 *    a fallback to `playClip`/`playOn`, which play from 0 and can run straight into the next word.
 *
 * Not wired into Story.tsx yet (that's separate, out of scope here) — this is the isolator
 * contract the plan requires to exist before that wiring happens.
 */
import type { Token } from "../content/types";

export interface Slice { startMs: number; endMs: number }

/**
 * Exactly which slice of the page's decoded audio plays for token `index`. Pure — no AudioContext
 * needed — so the clamp arithmetic can be unit-tested directly against synthetic token timelines.
 *
 * sliceEnd = min(asrEnd + pad, nextStart), where pad = min(60, room) — a ceiling, never a floor —
 * and room = max(0, nextStart - asrEnd). The zero floor matters: Whisper `base.en` word-ends
 * sometimes land ON or PAST the next word's own start, and without clamping room to zero a
 * negative pad would invert the interval before `min()` is even reached.
 *
 * Refuses (returns null) rather than guessing: an untimed page (nobody's `ms` is > 0 — a parent
 * recording with no measured timings), an out-of-range index, or a token whose `endMs` was never
 * ASR-measured (old library data, or an interpolated hole with no end written — never happens
 * post-regeneration, but a reader here must not invent one from `nextStart` either).
 */
export function sliceRange(tokens: readonly Pick<Token, "ms" | "endMs">[], index: number, audioMs: number): Slice | null {
  if (index < 0 || index >= tokens.length) return null;
  const untimed = !tokens.some((t) => t.ms > 0);
  if (untimed) return null;
  const tok = tokens[index];
  if (tok.endMs == null) return null;   // never measured: refuse rather than guess from nextStart
  const nextStart = index + 1 < tokens.length ? tokens[index + 1].ms : audioMs;
  const room = Math.max(0, nextStart - tok.endMs);
  const pad = Math.min(60, room);
  const sliceEnd = Math.min(tok.endMs + pad, nextStart);
  return { startMs: tok.ms, endMs: Math.max(tok.ms, sliceEnd) };
}

export interface SlicePlaying { done: Promise<void>; stop: () => void }

const EDGE_RAMP_S = 0.008;   // 8 ms linear ramp at each edge — inside the 5-10 ms band, no audible click

let sharedCtx: AudioContext | null = null;
/** Lazily create (or return) the one AudioContext this module schedules on. Never throws. */
export function getIsolateContext(): AudioContext | null {
  try {
    type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
    sharedCtx ??= new (window.AudioContext || (window as WithWebkit).webkitAudioContext)();
    return sharedCtx;
  } catch { return null; }
}

/**
 * Decode a page's narration file once so a later tap plays instantly (no fetch + decode latency
 * on the gesture itself). Never throws: a decode failure just means every tap on this page is
 * silence, per the isolator contract — it must never fall through to the OS voice or `playClip`.
 */
export async function decodePageAudio(ctx: AudioContext | null, url: string): Promise<AudioBuffer | null> {
  if (!ctx) return null;
  try {
    const bytes = await fetch(url).then((r) => r.arrayBuffer());
    return await ctx.decodeAudioData(bytes);
  } catch { return null; }
}

/**
 * Play exactly one word out of a page's already-decoded narration buffer. `ctx.resume()` is
 * awaited before scheduling: `onWordTap` runs inside a user gesture, but iOS Safari suspends a
 * shared AudioContext during idle listening, and a suspended context schedules silently — nothing
 * plays and nothing throws, which looks identical to "it worked" unless this is awaited first.
 *
 * A decode failure, an untimed page, or an unmeasured token all resolve immediately with a no-op
 * `stop` and no sound scheduled — silence, never a fallback to `playClip`/`playOn`.
 */
export async function playTokenSlice(ctx: AudioContext | null, buffer: AudioBuffer | null, tokens: readonly Pick<Token, "ms" | "endMs">[], index: number, audioMs: number): Promise<SlicePlaying> {
  const range = buffer ? sliceRange(tokens, index, audioMs) : null;
  const silence: SlicePlaying = { done: Promise.resolve(), stop: () => {} };
  if (!ctx || !buffer || !range) return silence;

  await ctx.resume();

  const startS = Math.max(0, range.startMs / 1000);
  const endS = Math.min(range.endMs / 1000, buffer.duration);
  const rawDur = endS - startS;
  if (rawDur <= 0) return silence;
  const ramp = Math.min(EDGE_RAMP_S, rawDur / 2);

  const src = ctx.createBufferSource(); src.buffer = buffer;
  const gain = ctx.createGain(); src.connect(gain); gain.connect(ctx.destination);

  const t0 = ctx.currentTime;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(1, t0 + ramp);
  gain.gain.setValueAtTime(1, t0 + Math.max(ramp, rawDur - ramp));
  gain.gain.linearRampToValueAtTime(0, t0 + rawDur);

  let settled = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((res) => { resolveDone = res; });
  const finish = () => { if (settled) return; settled = true; resolveDone(); };
  src.onended = finish;
  src.start(t0, startS, rawDur);

  return { done, stop: () => { if (settled) return; try { src.stop(); } catch { /* already stopped/ended */ } finish(); } };
}
