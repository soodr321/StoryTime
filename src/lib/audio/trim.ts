/**
 * Find the sound inside a family recording: leading/trailing silence is dropped but 40 ms of
 * head and tail are kept so a weak consonant onset or a stop closure survives. Pure, testable.
 */
export interface Trim { startMs: number; endMs: number; ok: boolean; reason?: string }

export function trimSilence(samples: Float32Array, sampleRate: number, opts: { keepMs?: number; maxMs?: number; minMs?: number } = {}): Trim {
  const keep = opts.keepMs ?? 40, maxMs = opts.maxMs ?? 1200, minMs = opts.minMs ?? 60;
  const hop = Math.max(1, Math.floor(sampleRate / 100));   // 10 ms frames
  const n = Math.floor(samples.length / hop);
  if (n === 0) return { startMs: 0, endMs: 0, ok: false, reason: "empty" };
  const rms = new Float32Array(n); let peak = 0;
  for (let k = 0; k < n; k++) { let s = 0; for (let j = k * hop; j < (k + 1) * hop; j++) s += samples[j] * samples[j]; rms[k] = Math.sqrt(s / hop); if (rms[k] > peak) peak = rms[k]; }
  if (peak < 0.01) return { startMs: 0, endMs: (n * hop * 1000) / sampleRate, ok: false, reason: "too quiet" };
  const thr = Math.max(0.006, peak * 0.08);
  let a = 0; while (a < n && rms[a] < thr) a++;
  let b = n - 1; while (b > a && rms[b] < thr) b--;
  const startMs = Math.max(0, (a * hop * 1000) / sampleRate - keep);
  const endMs = Math.min((samples.length * 1000) / sampleRate, ((b + 1) * hop * 1000) / sampleRate + keep);
  const core = ((b + 1 - a) * hop * 1000) / sampleRate;   // the sound itself, without the kept head/tail
  if (core < minMs) return { startMs, endMs, ok: false, reason: "too short" };
  if (endMs - startMs > maxMs) return { startMs, endMs, ok: false, reason: "too long" };   // a word or a letter name, not a sound
  return { startMs, endMs, ok: true };
}
