/**
 * Continuous blending model ("slide through the word").
 *
 * Real IPA recordings, scheduled on a Web Audio graph so each sound genuinely overlaps the
 * next (crossfade), with explicit targets: continuants ~450 ms, vowels ~320 ms, stops as short
 * as their release allows. Never a whole-word recording, never a gap, never a letter name.
 * Falls back to back-to-back clips when Web Audio is unavailable.
 */
import { playClip } from "./audio/player";
import { GRAPHEME_SOUND } from "./phonics/learner";
import { soundAsset } from "./library";

export const CONTINUANTS = new Set(["s", "ss", "f", "ff", "m", "n", "l", "ll", "r", "h"]);
export const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const HOLD_MS = (g: string) => (CONTINUANTS.has(g) ? 450 : VOWELS.has(g) ? 320 : 230);
const XFADE_MS = 70;

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();

/** Create/resume the graph inside a user gesture (called from unlock()). */
export function unlockBlendAudio(): void {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
  } catch { ctx = null; }
}

async function buffer(clip: string): Promise<AudioBuffer> {
  const url = soundAsset(clip);
  let p = buffers.get(url);
  if (!p) { p = fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)); buffers.set(url, p); }
  return p;
}

export interface BlendOpts { rate?: number; alive?: () => boolean; onProgress?: (fraction: number) => void }

/** Play the graphemes as one continuous, overlapping stretch. Resolves when the last sound fades. */
export async function playBlend(graphemes: string[], opts: BlendOpts = {}): Promise<void> {
  const alive = opts.alive ?? (() => true);
  const rate = opts.rate ?? 1;
  unlockBlendAudio();
  if (ctx && ctx.state !== "closed") {
    try {
      const bufs = await Promise.all(graphemes.map((g) => buffer(GRAPHEME_SOUND[g].clip)));
      if (!alive()) return;
      const t0 = ctx.currentTime + 0.05; let t = t0; const total = graphemes.reduce((n, g) => n + HOLD_MS(g) / rate, 0) / 1000;
      graphemes.forEach((g, i) => {
        const src = ctx!.createBufferSource(); src.buffer = bufs[i];
        const gain = ctx!.createGain(); src.connect(gain); gain.connect(ctx!.destination);
        const hold = HOLD_MS(g) / rate / 1000; const fade = XFADE_MS / 1000;
        gain.gain.setValueAtTime(i === 0 ? 1 : 0.0001, t);
        if (i > 0) gain.gain.exponentialRampToValueAtTime(1, t + fade);
        gain.gain.setValueAtTime(1, t + hold);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + hold + fade);
        src.start(t, 0, hold + fade); // the next sound starts before this one has faded: no gap, real overlap
        t += hold - fade * 0.5;
      });
      const end = t + XFADE_MS / 1000;
      await new Promise<void>((res) => { const id = setInterval(() => { const f = Math.min(1, (ctx!.currentTime - t0) / total); opts.onProgress?.(f); if (ctx!.currentTime >= end || !alive()) { clearInterval(id); opts.onProgress?.(1); res(); } }, 30); });
      return;
    } catch { /* fall through to the simple player */ }
  }
  // fallback: back-to-back clips through the singleton player
  for (let i = 0; i < graphemes.length; i++) {
    if (!alive()) return;
    let p; try { p = playClip(soundAsset(GRAPHEME_SOUND[graphemes[i]].clip)); } catch { continue; }
    opts.onProgress?.(i / graphemes.length);
    await new Promise<void>((res) => { const t0 = Date.now(); const id = setInterval(() => { const el = p.el; if (el.currentTime * 1000 >= HOLD_MS(graphemes[i]) || el.ended || Date.now() - t0 > 1500) { clearInterval(id); res(); } }, 30); });
  }
  opts.onProgress?.(1);
}

/** Caption for a blend: no dots, no gaps — the whole word as one stretched shape. */
export const stretched = (graphemes: string[]) => graphemes.map((g) => (CONTINUANTS.has(g) || VOWELS.has(g) ? GRAPHEME_SOUND[g].label.replace(/(.)\1+/g, "$1$1$1") : GRAPHEME_SOUND[g].label)).join("");
/** Kept for the parent summary. */
export const dotted = (graphemes: string[]) => graphemes.map((g) => GRAPHEME_SOUND[g]?.label ?? g).join("·");
