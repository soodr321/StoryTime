/**
 * Teach a new sound in 60–90 seconds, grown-up led:
 * hear the pure sound → mouth cue → action → hear it at the start of three words → see the grapheme,
 * trace it in the air → blend one familiar word → "Taught today ✓" (only then is it marked known).
 */
import { useState } from "react";
import { useFamily } from "../lib/family";
import { TEACH } from "../lib/phonics/teach";
import { GRAPHEME_SOUND, LS_PHASE2_ORDER } from "../lib/phonics/learner";
import { playClip } from "../lib/audio/player";
import { soundAsset } from "../lib/library";
import { speakText } from "../lib/audio/speech";
import { playBlend } from "../lib/blend";
import { ALL_GPCS } from "../lib/store";

export function TeachSoundScreen({ onDone }: { onDone: () => void }) {
  const { activeKid: kid, updateKid, settings } = useFamily();
  const reader = settings.tonight ?? settings.readers[0] ?? "Grown-up";
  const g = kid ? LS_PHASE2_ORDER[kid.gpcs.length] : undefined;
  const t = g ? TEACH[g] : undefined;
  const [step, setStep] = useState(0);
  if (!kid || !g || !t) return <main className="home-screen"><p className="note">All phase-2 sounds are taught. 🎉</p><button className="yes" onClick={onDone}>Back</button></main>;
  const hear = () => void playClip(soundAsset(GRAPHEME_SOUND[g].clip)).done.catch(() => {});
  const steps = [
    { title: "Hear the sound", body: <><button className="bigsound" onClick={hear}>{g}<small>tap to hear</small></button><p className="script">Play it three times. {reader} says it back. Never the letter name.</p></> },
    { title: "Mouth and action", body: <><p className="script"><b>Mouth:</b> {t.mouth}</p><p className="script"><b>Action:</b> {t.action}</p><p className="legend">Do the action together while saying the sound.</p></> },
    { title: "Hear it in words", body: <><div className="chips">{t.words.map((w) => <button key={w} className="wordchip" onClick={() => speakText(w, {})}>{w}</button>)}</div><p className="script">Ask: “What sound does it start with?” {kid.name} says the sound and does the action.</p></> },
    { title: "See it and trace it", body: <><div className="tracebox">{g}</div><p className="script">Trace it in the air with a finger, big and slow, saying the sound as you go.</p></> },
    { title: "Blend one word", body: t.blend.length ? <><div className="tiles">{t.blend.map((x, i) => <button key={i} className="tile" onClick={() => void playClip(soundAsset(GRAPHEME_SOUND[x].clip)).done.catch(() => {})}>{x}</button>)}</div><div className="row center"><button className="small" onClick={() => void playBlend(t.blend)}>▶ slide through it</button></div><p className="script">{kid.name} slides through it and says the word.</p></> : <p className="script">No blend yet — with only a few sounds, just find the sound in the words above.</p> },
  ];
  const last = step === steps.length - 1;
  return (
    <main className="settings teach">
      <div className="row"><button className="linkbtn" onClick={onDone}>← Back</button><div className="kicker">New sound · {step + 1} of {steps.length}</div></div>
      <section className="pc"><h3>{steps[step].title}</h3>{steps[step].body}</section>
      <div className="btns">
        {step > 0 && <button className="no" onClick={() => setStep(step - 1)}>← back</button>}
        {!last ? <button className="yes" onClick={() => setStep(step + 1)}>Next →</button> : <button className="yes" onClick={() => { updateKid({ ...kid, gpcs: ALL_GPCS.slice(0, kid.gpcs.length + 1) }); onDone(); }}>Taught today ✓</button>}
      </div>
      <p className="legend">“Taught today” adds {g} to {kid.name}'s sounds. It will show up in magic words and the warm-up from tomorrow.</p>
    </main>
  );
}
