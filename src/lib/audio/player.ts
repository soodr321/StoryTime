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
  // every engine must be kicked synchronously inside the tap; awaiting one first can spend the user activation
  const kicks: Promise<unknown>[] = [];
  for (const a of [narration, clip]) { try { a.src = silent; kicks.push(a.play().then(() => a.pause())); } catch { /* still counts as gestured on most engines */ } }
  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance("")); } catch { /* no speech engine */ }
  unlocked = true;
  await withTimeout(Promise.allSettled(kicks), 400);
}

export interface Playing {
  /** Resolves when playback ends or is stopped. Rejects only on a load error. */
  done: Promise<void>;
  stop: () => void;
  el: HTMLAudioElement;
}

const cleanups = new WeakMap<HTMLAudioElement, () => void>();
const blobUrls = new Map<string, string>();
/** iOS plays data: URLs badly (rate changes go silent, `ended` is unreliable); hand it an object URL instead. */
function resolveSrc(src: string): string {
  if (!src.startsWith("data:")) return src;
  const hit = blobUrls.get(src); if (hit) return hit;
  if (blobUrls.size >= 6) { const [k, v] = blobUrls.entries().next().value as [string, string]; URL.revokeObjectURL(v); blobUrls.delete(k); }
  try {
    const [head, b64] = src.split(",", 2); const mime = head.slice(5, head.indexOf(";")) || "audio/mp4";
    const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime })); blobUrls.set(src, url); return url;
  } catch { return src; }
}
function playOn(el: HTMLAudioElement, src: string, rate = 1): Playing {
  cleanups.get(el)?.();               // a superseded track must not keep listeners on the shared element
  el.pause();
  el.src = resolveSrc(src);            // assigning src resets the clock; writing currentTime before load throws on WebKit
  const onMeta = () => { try { el.playbackRate = rate; } catch { /* not supported for this source */ } };
  el.addEventListener("loadedmetadata", onMeta, { once: true });
  let settled = false;
  let resolve!: () => void, reject!: (e: unknown) => void;
  const done = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  const off = () => { el.removeEventListener("ended", onEnded); el.removeEventListener("error", onError); el.removeEventListener("timeupdate", onTime); el.removeEventListener("loadedmetadata", onMeta); };
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

export function playNarration(src: string, rate = 1): Playing {
  narration ??= make();
  clip?.pause();
  return playOn(narration, src, rate);
}

export function playClip(src: string): Playing {
  clip ??= make();
  return playOn(clip, src);
}

export function stopAll(): void {
  narration?.pause();
  clip?.pause();
}
