/**
 * One global <audio> element for narration (unlocked on the first user tap and
 * reused by swapping src — iOS blocks new elements created off-gesture) and one
 * singleton element for short clips (phonemes, prompts) so rapid taps never stack.
 */
let narration: HTMLAudioElement | null = null;
let clip: HTMLAudioElement | null = null;
let unlocked = false;

function make(): HTMLAudioElement {
  const a = document.createElement("audio");
  a.setAttribute("playsinline", "");
  a.preload = "auto";
  return a;
}

/** Call from a user gesture (the Start tap). Safe to call repeatedly. */
export async function unlock(): Promise<void> {
  narration ??= make();
  clip ??= make();
  if (unlocked) return;
  const silent = "data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAAAAE00QSBpc29tbXA0MgAAAAhmcmVlAAAAAG1kYXQ=";
  for (const a of [narration, clip]) {
    try { a.src = silent; await a.play(); a.pause(); } catch { /* element still counts as gestured on most engines */ }
  }
  unlocked = true;
}

export interface Playing {
  /** Resolves when playback ends or is stopped. Rejects only on a load error. */
  done: Promise<void>;
  stop: () => void;
  el: HTMLAudioElement;
}

function playOn(el: HTMLAudioElement, src: string): Playing {
  el.pause();
  el.src = src;
  el.currentTime = 0;
  let resolve!: () => void, reject!: (e: unknown) => void;
  const done = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  const cleanup = () => { el.onended = null; el.onerror = null; };
  el.onended = () => { cleanup(); resolve(); };
  el.onerror = () => { cleanup(); reject(new Error(`audio failed: ${src}`)); };
  void el.play().catch((e) => { cleanup(); reject(e); });
  return { done, stop: () => { el.pause(); cleanup(); resolve(); }, el };
}

export function playNarration(src: string): Playing {
  narration ??= make();
  clip?.pause();
  return playOn(narration, src);
}

export function playClip(src: string): Playing {
  clip ??= make();
  return playOn(clip, src);
}

export function stopAll(): void {
  narration?.pause();
  clip?.pause();
}
