/**
 * One speech-recognition session for "follow my voice" (opt-in, experimental).
 * Contract (docs/plan-v2.md F9): a tap starts it; a singleton recogniser; continuous=false on
 * iOS; results carry a generation so a late callback from a stopped session is ignored; at most
 * three silence restarts per page; stopped on the word card, Next page, Home and hide; no
 * automatic resume after the word card. Audio goes to Apple/Google: the settings toggle says so.
 */
export type VoiceState = "off" | "starting" | "listening" | "stopped" | "unavailable" | "denied";
type Rec = { start: () => void; stop: () => void; abort: () => void; lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null; onstart: (() => void) | null };
type RecCtor = new () => Rec;

export const voiceSupported = () => typeof window !== "undefined" && !!((window as unknown as { SpeechRecognition?: RecCtor }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: RecCtor }).webkitSpeechRecognition);
const isIOS = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

let rec: Rec | null = null;
let gen = 0;

export interface VoiceHandlers { onState: (s: VoiceState) => void; onHeard: (words: string[], final: boolean) => void }

export interface VoiceSession { stop: () => void }

/** Start listening. Returns a handle; every callback is dropped once stop() runs. */
export function startVoice(h: VoiceHandlers, opts: { maxRestarts?: number } = {}): VoiceSession | null {
  const Ctor = (window as unknown as { SpeechRecognition?: RecCtor }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: RecCtor }).webkitSpeechRecognition;
  if (!Ctor) { h.onState("unavailable"); return null; }
  const my = ++gen; const alive = () => my === gen;
  let restarts = 0; const maxRestarts = opts.maxRestarts ?? 3;
  let progress = false; let watchdog: ReturnType<typeof setTimeout> | null = null;
  try { rec ??= new Ctor(); } catch { h.onState("unavailable"); return null; }
  const r = rec;
  r.lang = "en-US"; r.continuous = !isIOS(); r.interimResults = true; r.maxAlternatives = 1;
  const armWatchdog = () => { if (watchdog) clearTimeout(watchdog); watchdog = setTimeout(() => { if (alive() && !progress) { h.onState("stopped"); try { r.abort(); } catch { /* idle */ } } }, 12000); };   // no result in 12 s: say so instead of a spinning mic
  r.onstart = () => { if (alive()) { h.onState("listening"); armWatchdog(); } };
  r.onresult = (e) => {
    if (!alive()) return;
    progress = true; armWatchdog();
    let text = ""; let final = false;
    for (let i = e.resultIndex; i < e.results.length; i++) { text += " " + e.results[i][0].transcript; if (e.results[i].isFinal) final = true; }
    h.onHeard(text.trim().split(/\s+/).filter(Boolean), final);
  };
  r.onerror = (e) => {
    if (!alive()) return;
    const code = e.error ?? "";
    if (code === "not-allowed" || code === "service-not-allowed") { gen++; h.onState("denied"); return; }
    if (code === "network" || code === "audio-capture") { gen++; h.onState("unavailable"); return; }
    // "no-speech" / "aborted": onend decides
  };
  r.onend = () => {
    if (!alive()) return;
    if (restarts < maxRestarts) { restarts++; setTimeout(() => { if (!alive()) return; try { r.start(); } catch { h.onState("stopped"); } }, 200); }   // WebKit ends on silence; a short restart keeps a page alive, bounded
    else { gen++; h.onState("stopped"); }
  };
  h.onState("starting");
  try { r.start(); } catch { gen++; h.onState("stopped"); return null; }
  const stop = () => { if (!alive()) return; gen++; if (watchdog) clearTimeout(watchdog); try { r.abort(); } catch { /* idle */ } h.onState("off"); };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); }, { once: true });
  return { stop };
}
