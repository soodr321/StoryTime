/**
 * On-device speech (Web Speech API) for family stories and single-word taps.
 * $0, offline, no server. Word boundaries fire on Chrome and Safari; when they do
 * not, the caller's highlighting simply stays on the sentence.
 */
export interface SpeakHandle { done: Promise<void>; stop: () => void; spoke: boolean }

let voice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice;
  const vs = window.speechSynthesis?.getVoices?.() ?? [];
  // one accent everywhere (the narrator is US), and a LOCAL voice first: a remote synthesiser would
  // send the family's story text to a server, which the app promises never to do
  const local = vs.filter((v) => v.localService);
  const pick = (list: SpeechSynthesisVoice[]) => list.find((v) => /en-US/i.test(v.lang) && /samantha|ava|allison|aria|jenny/i.test(v.name)) ?? list.find((v) => /en-US/i.test(v.lang)) ?? list.find((v) => /^en/i.test(v.lang));
  voice = pick(local) ?? pick(vs) ?? null;
  return voice;
}
if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voice = undefined; pickVoice(); };

export function speakText(text: string, opts: { rate?: number; onWord?: (index: number) => void }): SpeakHandle {
  if (typeof window === "undefined" || !window.speechSynthesis) return { done: Promise.resolve(), stop: () => {}, spoke: false };
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
  const handle = { done: Promise.resolve(), stop: () => {}, spoke: false } as SpeakHandle;
  u.onstart = () => { handle.spoke = true; };
  u.onend = finish; u.onerror = finish;
  const queued = setTimeout(() => synth.speak(u), 0);       // iOS drops an utterance queued in the same tick as cancel()
  // Safari sometimes never fires onend for cancelled utterances
  const guard = setTimeout(finish, Math.max(2000, text.length * 120));
  handle.done = done.then(() => clearTimeout(guard));
  handle.stop = () => { clearTimeout(queued); synth.cancel(); finish(); };   // a stopped utterance must not start later from the queue
  return handle;
}
