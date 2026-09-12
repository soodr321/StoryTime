import { useMemo, useState } from "react";
import { playSound } from "../lib/sounds";
import { GRAPHEME_SOUND } from "../lib/phonics/learner";
import { checkWord, type LearnerModel } from "../lib/phonics/validator";
import { speakText } from "../lib/audio/speech";
import { playBlend } from "../lib/blend";
import { SpeakerIcon, CheckIcon } from "./Icons";

/**
 * One-word dictation (30–45 s) after the read-back: the word is hidden; the grown-up says it;
 * the child counts the sounds, then drags-by-tapping taught grapheme tiles into the sound boxes,
 * sweeps and reads it back. Adult records "spelled it" or "try together"; on ✗ the app models
 * oral segmentation once and the child rebuilds. Encoding evidence is stored separately.
 */
export type BuildOutcome = "spelled" | "together" | "not_tonight";

/** Three outcomes, because "not tonight" is not a failure: only the first two are evidence. */
export function SegmentPanel({ word, learner, kid, reader, listen, bedtime, onDone }: { word: string; learner: LearnerModel; kid: string; reader: string; listen: boolean; bedtime?: boolean; onDone: (outcome: BuildOutcome) => void }) {
  const target = useMemo(() => checkWord(word, learner).graphemes, [word, learner]);
  const bank = useMemo(() => {
    const vowels = ["a", "e", "i", "o", "u"].filter((v) => learner.gpcs.includes(v) && !target.includes(v));
    const set = new Set([...target, ...vowels.slice(0, 1), ...learner.gpcs.slice(-6)]);   // a distractor vowel when one is taught; otherwise consonant foils only
    return [...set].slice(0, 8).sort(() => 0.5 - Math.random());
  }, [target, learner]);
  const [boxes, setBoxes] = useState<string[]>([]);
  const [modelled, setModelled] = useState(false);
  const [counted, setCounted] = useState(false);   // boxes appear only after the child has counted on fingers
  const [busy, setBusy] = useState(false);
  const full = boxes.length === target.length;
  const correct = full && boxes.every((g, i) => g === target[i]);

  const sayWord = () => { if (listen) speakText(word, {}); };
  const model = async () => {
    setBusy(true); setModelled(true);
    await playBlend(target);                                           // the stretch first, as one word
    for (const g of target) { try { await playSound(GRAPHEME_SOUND[g].clip); } catch { /* clip missing */ } await new Promise((r) => setTimeout(r, 400)); }   // then one slow count
    setBoxes([]); setCounted(true); setBusy(false);
  };
  const readBack = async () => { setBusy(true); await playBlend(boxes); setBusy(false); };

  return (
    <section className="panel" role="dialog" aria-label="Build the word">
      <div className="kicker">Build it · {kid}'s turn</div>
      <h2 className="panel-h">{bedtime ? `One more, only if ${kid} is up for it: ${reader} says a word and ${kid} builds it.` : `${reader} says the word. ${kid} counts the sounds on fingers, then builds it${learner.gpcs.filter((g) => "aeiou".includes(g)).length > 1 ? " — listen for the middle sound" : ""}.`}</h2>
      <div className="row center"><button className="small row" onClick={sayWord}><SpeakerIcon size={18} /> say the word</button><span className="legend">(the word stays hidden)</span></div>
      {!counted ? (
        <div className="row center"><span className="legend">How many sounds? Fingers up.</span><button className="small" onClick={() => setCounted(true)}>they held up {target.length} ✓</button></div>
      ) : (<>
      <div className="boxes">{target.map((_, i) => <button key={i} className={"box" + (boxes[i] ? " filled" : "")} onClick={() => setBoxes(boxes.slice(0, i))}>{boxes[i] ?? ""}</button>)}</div>
      <div className="tiles bank">{bank.map((g) => <button key={g} className="tile small" disabled={full || busy} onClick={() => { void playSound(GRAPHEME_SOUND[g].clip); setBoxes([...boxes, g]); }}>{g}</button>)}</div>
      {full && <div className="row center"><button className="small" disabled={busy} onClick={readBack}>▶ sweep and read it back</button></div>}
      </>)}
      <div className="verdict grownup">
        <div className="hint"><span className="tag">{reader}</span> {full ? (correct ? `That spells ${word}. Did ${kid} read it back?` : `Not ${word} yet — try together?`) : "Let them pick the tiles."}</div>
        <div className="btns">
          <button className="no" disabled={busy} onClick={model}>Try together</button>
          <button className="yes" disabled={!correct || busy} onClick={() => onDone(modelled ? "together" : "spelled")}><CheckIcon /> Spelled it</button>
        </div>
        {/* not a miss: a tired child at 7:48pm is not evidence of anything, so this writes nothing */}
        <button className={bedtime ? "small" : "skip"} onClick={() => onDone("not_tonight")}>Not tonight →</button>
      </div>
    </section>
  );
}
