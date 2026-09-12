/**
 * "Sounds in your voice": the grown-up records each pure sound once (hold, say it, release).
 * The family recording wins over the fallback clip everywhere. Coaching is on the screen because
 * an uncoached recording says a letter name ("tee") or a word, which is the bug this replaces.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFamily } from "../lib/family";
import { GRAPHEME_SOUND } from "../lib/phonics/learner";
import { TEACH } from "../lib/phonics/teach";
import { CONTINUANTS, VOWELS, playBlend } from "../lib/blend";
import { canRecord, prepareMic, startRecording, type Recorder } from "../lib/audio/record";
import { trimSilence } from "../lib/audio/trim";
import { familySoundClips, playSound, removeFamilySound, saveFamilySound } from "../lib/sounds";
import { playClip } from "../lib/audio/player";
import { CheckIcon, SpeakerIcon } from "../components/Icons";

/** Unique sounds in teaching order: c/k/ck, f/ff, l/ll, s/ss share one clip each. */
const CLIPS = [...new Set(Object.values(GRAPHEME_SOUND).map((s) => s.clip))];
const graphemesFor = (clip: string) => Object.entries(GRAPHEME_SOUND).filter(([, s]) => s.clip === clip).map(([g]) => g);
const kindOf = (clip: string) => (CONTINUANTS.has(clip) ? "stretchy" : VOWELS.has(clip) ? "vowel" : "bouncy");
const COACH: Record<string, string> = {
  stretchy: "Stretch it for a second: sss, mmm, fff. Never the letter name.",
  vowel: "Short and clear, as in the word. Never the letter name.",
  bouncy: "Short and bouncy, with almost no “uh” after it. Never the letter name.",
};
type Draft = { blob: Blob; ms: number; startMs: number; endMs: number; trimmed: boolean; note?: string };

export function RecordSoundsScreen({ onDone }: { onDone: () => void }) {
  const { settings } = useFamily();
  const who = settings.tonight ?? settings.readers[0] ?? "your";
  const [have, setHave] = useState<Set<string>>(new Set());
  const [micReady, setMicReady] = useState(false);
  const [i, setI] = useState(0);
  const [holding, setHolding] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rec = useRef<Recorder | null>(null);
  const t0 = useRef(0);
  const clip = CLIPS[i];
  const t = TEACH[clip] ?? TEACH[graphemesFor(clip)[0]];
  const kind = kindOf(clip);
  const blendWord = useMemo(() => t?.blend?.length ? t.blend : null, [t]);
  useEffect(() => { void familySoundClips().then((c) => setHave(new Set(c))); }, []);
  const preview = useRef<string | null>(null);   // one object URL at a time: a recording blob is not small
  const previewUrl = (b: Blob) => { if (preview.current) URL.revokeObjectURL(preview.current); preview.current = URL.createObjectURL(b); return preview.current; };
  useEffect(() => () => { void rec.current?.stop(); if (preview.current) URL.revokeObjectURL(preview.current); }, []);   // leaving mid-hold must not leave the mic open

  const begin = async () => {
    if (holding || busy) return;
    setMsg(null); setDraft(null);
    try { rec.current = await startRecording(); t0.current = Date.now(); setHolding(true); } catch { setMsg("The microphone is not available. Check the phone's settings for this app."); }
  };
  const end = async () => {
    if (!rec.current) return;
    const r = rec.current; rec.current = null; setHolding(false);
    const held = Date.now() - t0.current;
    setBusy(true);
    const out = await r.stop();
    if (!out || held < 500) { setBusy(false); setMsg(held < 500 ? "Hold the button while you say the sound, then let go." : "That recording was empty. Try again."); return; }
    // decode → trim; if this phone cannot decode its own recording, keep it untrimmed and say so
    let d: Draft = { blob: out.blob, ms: out.ms, startMs: 0, endMs: out.ms, trimmed: false };
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC(); const buf = await ac.decodeAudioData(await out.blob.arrayBuffer()); void ac.close();
      const tr = trimSilence(buf.getChannelData(0), buf.sampleRate);
      if (!tr.ok) { setBusy(false); setMsg(tr.reason === "too long" ? "That was longer than a sound: was it a word or the letter's name? Just the sound." : tr.reason === "too quiet" ? "Too quiet. Hold the phone a little closer." : "Too short. Hold, say the sound, then let go."); return; }
      d = { ...d, startMs: tr.startMs, endMs: tr.endMs, trimmed: true };
    } catch { d.note = "Saved without trimming: this phone could not decode its own recording."; }
    setDraft(d);
    try { await playClip(previewUrl(d.blob), { startMs: d.startMs, endMs: d.endMs }).done; } catch { /* preview failed */ }
    setBusy(false);
  };
  const keep = async () => {
    if (!draft) return; setBusy(true);
    await saveFamilySound(clip, { blob: draft.blob, startMs: draft.startMs, endMs: draft.endMs, ms: draft.ms, at: Date.now() });
    setHave(new Set([...have, clip])); setDraft(null); setBusy(false);
    if (blendWord) { setMsg(`Saved. Listen: ${blendWord.join("-")} …`); await playBlend(blendWord); }
    setMsg(null);
    if (i + 1 < CLIPS.length) setI(i + 1);
  };
  const useFallback = async () => { await removeFamilySound(clip); const h = new Set(have); h.delete(clip); setHave(h); setDraft(null); };

  if (!canRecord()) return <main className="settings"><div className="row"><button className="linkbtn" onClick={onDone}>← Back</button></div><p className="note">This browser cannot record. On iPhone open StoryTime in Safari or from the home screen.</p></main>;
  return (
    <main className="settings sounds">
      <div className="row between"><button className="linkbtn" onClick={onDone}>← Back</button><div className="kicker">Sounds in {who === "your" ? "your" : `${who}'s`} voice · {have.size} of {CLIPS.length}</div></div>
      <div className="chips">{CLIPS.map((c, k) => <button key={c} className={"tog" + (have.has(c) ? " on" : "") + (k === i ? " now" : "")} onClick={() => { setI(k); setDraft(null); setMsg(null); }}>{c}</button>)}</div>
      {!micReady && <button className="next" onClick={async () => { const ok = await prepareMic(); setMicReady(ok); if (!ok) setMsg("The microphone was not allowed."); }}>Get the microphone ready</button>}
      <section className="pc">
        <div className="row between"><h3>{graphemesFor(clip).join(" · ")} <span className="legend">{kind}</span></h3><button className="small row" onClick={() => void playSound(clip)}><SpeakerIcon size={18} /> hear it now{have.has(clip) ? " (yours)" : ""}</button></div>
        <p className="script">{t?.mouth}</p>
        <p className="legend">{COACH[kind]} Sounds, not names: “sss”, not “ess”.</p>
        <button className={"holdbtn" + (holding ? " live" : "")} disabled={!micReady || busy} onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onPointerLeave={holding ? end : undefined}>
          {holding ? "say it… let go when done" : busy ? "…" : "Hold and say the sound"}
        </button>
        {msg && <p className="legend">{msg}</p>}
        {draft && (
          <div className="verdict grownup">
            <div className="hint">Did that sound like <b>{GRAPHEME_SOUND[graphemesFor(clip)[0]].label}</b> and nothing else?{draft.note ? <small className="legend"> {draft.note}</small> : null}</div>
            <div className="btns">
              <button className="no" disabled={busy} onClick={() => { setDraft(null); setMsg(null); }}>Redo</button>
              <button className="yes" disabled={busy} onClick={keep}><CheckIcon /> Keep it</button>
            </div>
            <div className="row center"><button className="skip" onClick={() => void playClip(previewUrl(draft.blob), { startMs: draft.startMs, endMs: draft.endMs })}>play it again</button>{blendWord && <button className="skip" onClick={async () => { await saveFamilySound(clip, { blob: draft.blob, startMs: draft.startMs, endMs: draft.endMs, ms: draft.ms, at: Date.now() }); setHave(new Set([...have, clip])); await playBlend(blendWord); }}>hear it in {blendWord.join("")}</button>}</div>
          </div>
        )}
        {have.has(clip) && !draft && <button className="linkbtn" onClick={useFallback}>use the built-in recording instead</button>}
      </section>
      <p className="legend">Each sound plays in the word cards, the slide-through model and the teach routine. The built-in clips are real recordings too (Wikimedia Commons, CC BY-SA), cut to the bare sound.</p>
      <button className="linkbtn" onClick={onDone}>Done for now →</button>
    </main>
  );
}
