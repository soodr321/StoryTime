/**
 * Continuous blending model ("slide through the word").
 *
 * Real recordings (family voice first, then the cut Commons clips), scheduled on one Web Audio
 * timeline built from each clip's decoded length: continuants are looped inside their steady
 * part to the target hold, vowels hold no longer than the clip, stops are their burst only and
 * the next sound starts right after it (closure is speech; an artificial gap is not). The sweep
 * follows that timeline per grapheme. Cancellable: Home/hide stops every scheduled source.
 * Falls back to back-to-back clips (a segmented aid, not a continuous model) without Web Audio.
 */
import { playClip } from "./audio/player";
import { GRAPHEME_SOUND } from "./phonics/learner";
import { soundSource, soundVersion } from "./sounds";
import { blendAsset } from "./library";
import { speakText } from "./audio/speech";

export const CONTINUANTS = new Set(["s", "ss", "f", "ff", "m", "n", "l", "ll", "r", "h"]);
export const VOWELS = new Set(["a", "e", "i", "o", "u"]);
// a model is a stretch, not a reading: a teacher holds each sound about half a second
const TARGET_MS = (g: string) => (CONTINUANTS.has(g) ? 520 : VOWELS.has(g) ? 420 : 0);
const LOOP_EDGE = 0.03;   // seconds kept out of the loop region at each end of a continuant

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
let live: AudioBufferSourceNode[] = [];

/** Create/resume the graph inside a user gesture (called from unlock()). */
export function unlockBlendAudio(): void {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
  } catch { ctx = null; }
}

/** Stop anything still scheduled (Home, hide, a new model starting). */
export function stopBlend(): void {
  for (const s of live) { try { s.stop(); } catch { /* already ended */ } }
  live = [];
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.hidden) stopBlend(); });

async function buffer(clip: string): Promise<AudioBuffer> {
  const src = await soundSource(clip);
  const key = `${src.url}#${soundVersion(clip)}`;
  let p = buffers.get(key);
  if (!p) {
    p = fetch(src.url).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)).then((buf) => {
      if (!src.startMs && !src.endMs) return buf;
      // a family recording carries trim offsets: cut the decoded buffer to the sound itself
      const s = Math.floor(((src.startMs ?? 0) / 1000) * buf.sampleRate), e = Math.min(buf.length, Math.ceil(((src.endMs ?? buf.duration * 1000) / 1000) * buf.sampleRate));
      const out = ctx!.createBuffer(1, Math.max(1, e - s), buf.sampleRate); out.copyToChannel(buf.getChannelData(0).subarray(s, e), 0); return out;
    });
    buffers.set(key, p);
  }
  return p;
}

export interface BlendOpts { rate?: number; alive?: () => boolean; onProgress?: (fraction: number) => void }

/** One scheduled sound: when it starts, how long it is heard, and its share of the sweep. */
export interface Slot { g: string; start: number; hold: number }

/** Build the timeline (seconds from 0) from decoded clip lengths. Exported for tests. */
export function timeline(graphemes: string[], dur: (g: string) => number, rate = 1): Slot[] {
  const slots: Slot[] = []; let t = 0;
  graphemes.forEach((g, i) => {
    const clip = dur(g);
    const kind = CONTINUANTS.has(g) ? "continuant" : VOWELS.has(g) ? "vowel" : "stop";
    // vowels are cut from a steady window, so they can be looped to the target like a continuant
    const hold = kind === "stop" ? clip : kind === "vowel" ? Math.min(clip, TARGET_MS(g) / rate / 1000) : TARGET_MS(g) / rate / 1000;
    const fade = kind === "stop" ? 0 : Math.min(0.07, hold / 3, i + 1 < graphemes.length ? Math.max(0.01, dur(graphemes[i + 1]) / 3) : 0.07);
    slots.push({ g, start: t, hold });
    t += kind === "stop" ? hold : hold - fade;   // the next sound starts inside this one's fade; after a burst it starts right away
  });
  return slots;
}

/** Play the graphemes as one continuous, overlapping stretch. Resolves when the last sound fades. */
export async function playBlend(graphemes: string[], opts: BlendOpts = {}): Promise<void> {
  const alive = opts.alive ?? (() => true);
  const rate = opts.rate ?? 1;
  unlockBlendAudio();
  if (ctx && ctx.state !== "closed") {
    try {
      const bufs = await Promise.all(graphemes.map((g) => buffer(GRAPHEME_SOUND[g].clip)));
      if (!alive()) return;
      stopBlend();
      const dur = (g: string) => bufs[graphemes.indexOf(g)].duration;
      const slots = timeline(graphemes, dur, rate);
      const t0 = ctx.currentTime + 0.05;
      const total = slots[slots.length - 1].start + slots[slots.length - 1].hold;
      slots.forEach((s, i) => {
        const src = ctx!.createBufferSource(); src.buffer = bufs[i];
        const gain = ctx!.createGain(); src.connect(gain); gain.connect(ctx!.destination);
        const at = t0 + s.start; const stop = CONTINUANTS.has(s.g) || VOWELS.has(s.g);
        const fade = stop ? Math.min(0.07, s.hold / 3) : 0;
        if (CONTINUANTS.has(s.g) && bufs[i].duration > LOOP_EDGE * 3 && s.hold > bufs[i].duration) { src.loop = true; src.loopStart = LOOP_EDGE; src.loopEnd = bufs[i].duration - LOOP_EDGE; }   // a 180 ms "sss" or a 190 ms "a" held to the target
        gain.gain.setValueAtTime(i === 0 || !stop ? 1 : 0.0001, at);
        if (i > 0 && stop) gain.gain.exponentialRampToValueAtTime(1, at + fade);
        if (stop) { gain.gain.setValueAtTime(1, at + s.hold - fade); gain.gain.exponentialRampToValueAtTime(0.0001, at + s.hold); }
        src.start(at, 0, stop ? s.hold : undefined);
        live.push(src); src.onended = () => { live = live.filter((x) => x !== src); };
      });
      await new Promise<void>((res) => {
        let lastT = ctx!.currentTime, stuck = 0;
        const id = setInterval(() => {
          const now = ctx!.currentTime; const el = now - t0;
          if (now === lastT) stuck++; else stuck = 0; lastT = now;                                  // a suspended context never advances: bounded wait
          const i = Math.max(0, slots.findIndex((s, k) => el < s.start + s.hold && (k + 1 >= slots.length || el < slots[k + 1].start)));
          const s = slots[i]; const within = Math.min(1, Math.max(0, (el - s.start) / s.hold));
          opts.onProgress?.(Math.min(1, (i + within) / slots.length));                              // the sweep follows the timeline per grapheme
          if (el >= total || !alive() || stuck > 50) { clearInterval(id); if (!alive() || stuck > 50) stopBlend(); opts.onProgress?.(1); res(); }
        }, 30);
      });
      return;
    } catch { /* fall through to the simple player */ }
  }
  // fallback: back-to-back clips through the singleton player (segmented, not continuous)
  for (let i = 0; i < graphemes.length; i++) {
    if (!alive()) return;
    let p; try { const s = await soundSource(GRAPHEME_SOUND[graphemes[i]].clip); p = playClip(s.url, s.family ? { startMs: s.startMs, endMs: s.endMs } : undefined); } catch { continue; }
    opts.onProgress?.(i / graphemes.length);
    await new Promise<void>((res) => { const t0 = Date.now(); const id = setInterval(() => { const el = p.el; if (el.ended || Date.now() - t0 > 700) { clearInterval(id); res(); } }, 30); });
  }
  opts.onProgress?.(1);
}

/** How long the word model will take, so a caller can pace its sweep. */
const blendCache = new Map<string, number | null>();

/**
 * Model the whole word: "slide through it and let the sounds run together."
 *
 * First choice is a recording of THIS word in the narrator's voice, said slowly — concatenating
 * isolated phoneme clips does not make a word (a listener hears "sat" as "ssssss"), because there
 * is no coarticulation between the pieces. Individual letter sounds stay real recordings; this is
 * only the model, and it plays after the child has had a go.
 * Falls back to the phone's voice, then to the concatenated clips, so an unknown word still models.
 */
export async function playWord(word: string, graphemes: string[], opts: BlendOpts = {}): Promise<void> {
  const alive = opts.alive ?? (() => true);
  const rate = opts.rate ?? 1;
  const w = word.toLowerCase().replace(/[^a-z']/g, "");
  if (w && blendCache.get(w) !== null) {
    try {
      const src = blendAsset(w);
      const p = playClip(src);
      const t0 = Date.now();
      const tick = setInterval(() => { const d = (p.el.duration || 1.4) * 1000; opts.onProgress?.(Math.min(1, (Date.now() - t0) / d)); }, 40);
      try { await p.done; blendCache.set(w, 1); } finally { clearInterval(tick); }
      opts.onProgress?.(1);
      if (!alive()) return;
      return;
    } catch { blendCache.set(w, null); }   // not one of the generated words: fall through, and do not try again
  }
  if (typeof window !== "undefined" && window.speechSynthesis && w) {
    const h = speakText(w, { rate: 0.55 * rate });   // the phone's own voice, slowly
    const t0 = Date.now();
    const tick = setInterval(() => opts.onProgress?.(Math.min(1, (Date.now() - t0) / 1400)), 40);
    try { await h.done; } finally { clearInterval(tick); }
    opts.onProgress?.(1);
    if (h.spoke) return;
  }
  await playBlend(graphemes, opts);
}

/** Caption for a blend: no dots, no gaps — the whole word as one stretched shape. */
export const stretched = (graphemes: string[]) => graphemes.map((g) => (CONTINUANTS.has(g) || VOWELS.has(g) ? GRAPHEME_SOUND[g].label.replace(/(.)\1+/g, "$1$1$1") : GRAPHEME_SOUND[g].label)).join("");
/** Kept for the parent summary. */
export const dotted = (graphemes: string[]) => graphemes.map((g) => GRAPHEME_SOUND[g]?.label ?? g).join("·");
