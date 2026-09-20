/**
 * Teach a new sound in 60–90 seconds, grown-up led:
 * hear the pure sound → mouth cue → action → hear it at the start of three words → see the grapheme,
 * trace it in the air → blend one familiar word → "Taught today ✓" (only then is it marked known).
 */
import { useState } from "react";
import { useFamily } from "../lib/family";
import { sameDay } from "../lib/day";
import { TEACH } from "../lib/phonics/teach";
import { playSound } from "../lib/sounds";
import { GRAPHEME_SOUND, LS_PHASE2_ORDER } from "../lib/phonics/learner";
import { speakText } from "../lib/audio/speech";
import { playWord } from "../lib/blend";
import { ALL_GPCS } from "../lib/store";
import { LEVELS, TRICKY_PARTS } from "../lib/phonics/learner";

/** replay = go over the sound taught today; it must never target (or mark taught) the NEXT sound. */
export function TeachSoundScreen({ onDone, replay = false }: { onDone: () => void; replay?: boolean }) {
  const { activeKid: kid, updateKid, settings, advanceReady: ready } = useFamily();
  const taughtToday = (kid?.teachDays ?? []).some((d) => sameDay(new Date(d)));
  const advanceReady = (ready || (kid?.gpcs.length ?? 0) < 4) && !taughtToday;   // the first four sounds need no story evidence, but one new sound per day
  const [override, setOverride] = useState(false);
  const reader = settings.tonight ?? settings.readers[0] ?? "Grown-up";
  const g = kid ? (replay ? kid.gpcs[kid.gpcs.length - 1] : LS_PHASE2_ORDER[kid.gpcs.length]) : undefined;
  const t = g ? TEACH[g] : undefined;
  const [step, setStep] = useState(0);
  const nextCount = kid ? kid.gpcs.length + 1 : 0;
  const levelAt: Record<number, string> = { 8: "ls-phase2-set2", 12: "ls-phase2-set3", 16: "ls-phase2-set4", 23: "ls-phase2-set5" };
  const newTricky = !replay && kid && levelAt[nextCount] ? LEVELS[levelAt[nextCount]].tricky.filter((w) => !kid.tricky.includes(w)) : [];
  if (!kid || !g || !t) return <main className="home-screen"><p className="note">All phase-2 sounds are taught. 🎉</p><button className="yes" onClick={onDone}>Back</button></main>;
  const hear = () => void playSound(GRAPHEME_SOUND[g].clip);
  const steps = [
    { title: "Hear the sound", body: <><button className="bigsound" onClick={hear}>{g}<small>tap to hear</small></button><p className="script">Play it three times. {reader} says it back. In this activity use the sound, not the letter name.</p></> },
    { title: "Mouth and action", body: <><p className="script"><b>Mouth:</b> {t.mouth}</p><p className="script"><b>Action:</b> {t.action}</p><p className="legend">Do the action together while saying the sound.</p></> },
    { title: t.position === "end" ? "Hear it at the END of words" : "Hear it in words", body: <><div className="chips">{t.words.map((w) => <button key={w} className="wordchip" onClick={async () => { speakText(w, {}); if (t.position === "end") { await new Promise((r) => setTimeout(r, 900)); hear(); } }}>{w}</button>)}</div><p className="script">{t.position === "end" ? <>Play a word, then the sound. Do the action when you hear the sound at the <b>end</b>. Never ask for the first sound here.</> : <>Ask: “What sound does it start with?” {kid.name} says the sound and does the action.</>}</p></> },
    { title: "See it and trace it", body: <><div className="tracebox">{g}</div><p className="script">{reader}: trace it on the screen first to show where it starts and which way it goes. Then {kid.name} traces it in the air, big and slow, saying the sound.</p></> },
    ...(newTricky.length ? [{ title: `A tricky word: ${newTricky.join(", ")}`, body: <><div className="chips">{newTricky.map((w) => { const [reg, odd] = (TRICKY_PARTS[w.toLowerCase()] ?? `|${w}`).split("|"); return <button key={w} className="wordchip" onClick={() => speakText(w, {})}><span>{reg}</span><u className="odd">{odd}</u></button>; })}</div><p className="script">Say it as a whole word. The underlined bit is the odd part; we never sound this one out. Find it on a page together.</p></> }] : []),
    // plan-voice.md A4: no playback-rate multiplier on this button any more — playWord's own default (1) applies.
    { title: "Blend one word", body: t.blend.length ? <><div className="tiles">{t.blend.map((x, i) => <button key={i} className="tile" onClick={() => void playSound(GRAPHEME_SOUND[x].clip)}>{x}</button>)}</div><div className="row center"><button className="small" onClick={() => void playWord(t.blend.join(""), t.blend)}>▶ slide through it</button></div><p className="script">{kid.name} slides through it and says the word.</p></> : <p className="script">No blend yet — with only a few sounds, just find the sound in the words above.</p> },
  ];
  const last = step === steps.length - 1;
  return (
    <main className="settings teach">
      <div className="row"><button className="linkbtn" onClick={onDone}>← Back</button><div className="kicker">{replay ? `Again: ${g}` : t.sameAs ? `New spelling of a known sound (${t.sameAs})` : "New sound"} · {step + 1} of {steps.length}</div></div>
      <section className="pc"><h3>{steps[step].title}</h3>{steps[step].body}</section>
      <div className="btns">
        {step > 0 && <button className="no" onClick={() => setStep(step - 1)}>← back</button>}
        {!last ? <button className="yes" onClick={() => setStep(step + 1)}>Next →</button> : replay ? <button className="yes" onClick={onDone}>Done ✓</button> : <button className="yes" disabled={!advanceReady && !override} onClick={() => { updateKid({ ...kid, gpcs: ALL_GPCS.slice(0, nextCount), tricky: [...new Set([...kid.tricky, ...newTricky])], teachDays: [...(kid.teachDays ?? []), new Date().toISOString()] }); onDone(); }}>Taught today ✓</button>}
      </div>
      {last && !replay && !advanceReady && !override && <p className="legend">{taughtToday ? `One new sound a day: ${kid.name} learned one today already. Replay it now; come back tomorrow for the next.` : `${kid.name} has not blended the current sounds first-try in two sessions yet, so this stays practice for today.`} <button className="linkbtn" onClick={() => setOverride(true)}>mark it taught anyway</button></p>}
      {!replay && last && <p className="legend">“Taught today” adds {g}{newTricky.length ? ` and the tricky word${newTricky.length > 1 ? "s" : ""} ${newTricky.join(", ")}` : ""} to {kid.name}'s sounds. They show up in magic words and the warm-up from tomorrow.</p>}
    </main>
  );
}
