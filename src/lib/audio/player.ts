/**
 * One global <audio> element for narration (unlocked on the first user tap and
 * reused by swapping src — iOS blocks new elements created off-gesture) and one
 * singleton element for short clips (phonemes, prompts) so rapid taps never stack.
 *
 * Each play() returns a Playing whose listeners are its own: a superseded track's
 * late `play()` rejection ("interrupted by a new load request") must never touch
 * the listeners of the track that replaced it.
 */
let narration: HTMLAudioElement | null = null;
let clip: HTMLAudioElement | null = null;
let unlocked = false;

function make(): HTMLAudioElement {
  const a = document.createElement("audio");
  a.setAttribute("playsinline", "");
  a.preload = "auto";
  a.style.display = "none";
  document.body.appendChild(a); // detached media elements can be collected mid-play
  return a;
}
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

/** Call from a user gesture (the Start tap). Safe to call repeatedly. */
export async function unlock(): Promise<void> {
  narration ??= make();
  clip ??= make();
  if (unlocked) return;
  const silent = "data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAAAAE00QSBpc29tbXA0MgAAAAhmcmVlAAAAAG1kYXQ=";
  for (const a of [narration, clip]) {
    try { a.src = silent; await withTimeout(a.play(), 400); a.pause(); } catch { /* element still counts as gestured on most engines */ }
  }
  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance("")); } catch { /* no speech engine */ }   // iOS: unlock Web Speech in the same gesture
  unlocked = true;
}

export interface Playing {
  /** Resolves when playback ends or is stopped. Rejects only on a load error. */
  done: Promise<void>;
  stop: () => void;
  el: HTMLAudioElement;
}

const cleanups = new WeakMap<HTMLAudioElement, () => void>();
function playOn(el: HTMLAudioElement, src: string): Playing {
  cleanups.get(el)?.();               // a superseded track must not keep listeners on the shared element
  el.pause();
  el.src = src;
  el.currentTime = 0;
  let settled = false;
  let resolve!: () => void, reject!: (e: unknown) => void;
  const done = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  const off = () => { el.removeEventListener("ended", onEnded); el.removeEventListener("error", onError); el.removeEventListener("timeupdate", onTime); };
  const finish = () => { if (settled) return; settled = true; off(); resolve(); };
  const onEnded = () => finish();
  const onError = () => { if (!settled) { settled = true; off(); reject(new Error(`audio failed: ${src}`)); } };
  // safety net: some engines drop `ended` after a stall; treat reaching the end as ended
  const onTime = () => { if (el.duration && el.currentTime >= el.duration - 0.05) { el.pause(); finish(); } };
  el.addEventListener("ended", onEnded);
  el.addEventListener("error", onError);
  el.addEventListener("timeupdate", onTime);
  cleanups.set(el, () => { if (!settled) { settled = true; off(); resolve(); } });
  void el.play().catch((e) => { if (!settled) { settled = true; off(); reject(e); } });
  return { done, stop: () => { if (settled) return; el.pause(); finish(); }, el };
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
