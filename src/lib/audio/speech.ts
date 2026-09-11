/**
 * On-device speech (Web Speech API) for family stories and single-word taps.
 * $0, offline, no server. Word boundaries fire on Chrome and Safari; when they do
 * not, the caller's highlighting simply stays on the sentence.
 */
export interface SpeakHandle { done: Promise<void>; stop: () => void }

let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice;
  const vs = window.speechSynthesis?.getVoices?.() ?? [];
  voice = vs.find((v) => /en-US/i.test(v.lang) && /samantha|ava|allison|aria|jenny|google us/i.test(v.name)) ?? vs.find((v) => /en-US/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? null;   // one accent everywhere: the narrator is US
  return voice;
}
if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voice = undefined; pickVoice(); };

export function speakText(text: string, opts: { rate?: number; onWord?: (index: number) => void }): SpeakHandle {
  if (typeof window === "undefined" || !window.speechSynthesis) return { done: Promise.resolve(), stop: () => {} };
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(); if (v) u.voice = v;
  u.rate = 0.9 * (opts.rate ?? 1);
  u.pitch = 1.05;
  // map character offsets to token indexes
  const starts: number[] = []; let pos = 0;
  for (const tok of text.split(" ")) { starts.push(pos); pos += tok.length + 1; }
  let settled = false, resolve!: () => void;
  const done = new Promise<void>((r) => { resolve = r; });
  const finish = () => { if (!settled) { settled = true; resolve(); } };
  u.onboundary = (e) => { if (e.name === "word" && opts.onWord) { let i = 0; for (let k = 0; k < starts.length; k++) if (starts[k] <= e.charIndex) i = k; opts.onWord(i); } };
  u.onend = finish; u.onerror = finish;
  const queued = setTimeout(() => synth.speak(u), 0);       // iOS drops an utterance queued in the same tick as cancel()
  // Safari sometimes never fires onend for cancelled utterances
  const guard = setTimeout(finish, Math.max(2000, text.length * 120));
  return { done: done.then(() => clearTimeout(guard)), stop: () => { clearTimeout(queued); synth.cancel(); finish(); } };   // a stopped utterance must not start later from the queue
}
