import { useEffect, useMemo, useState } from "react";
import { GRAPHEME_SOUND } from "../lib/phonics/learner";
import { checkWord, type LearnerModel } from "../lib/phonics/validator";
import { playClip } from "../lib/audio/player";
import { soundAsset } from "../lib/library";

/**
 * The child's word card. Plain letters, no picture, no sentence: "Look at the letters.
 * Say the sounds and blend." The grown-up grades; "Look again" restarts the card without
 * recording anything; "Say it together" hands over to a continuous-blend model.
 */
export function MagicPanel({ word, learner, modelling, kid, reader, kicker, onSound, onYes, onTogether, onSkip }: {
  word: string; learner: LearnerModel; modelling: boolean; kid: string; reader: string; kicker?: string;
  onSound: () => void; onYes: () => void; onTogether: () => void; onSkip?: () => void;
}) {
  const gs = useMemo(() => checkWord(word, learner).graphemes, [word, learner]);
  const [said, setSaid] = useState(0);
  const [lookAgain, setLookAgain] = useState(0);
  useEffect(() => { setSaid(0); }, [word, modelling, lookAgain]);
  const tap = (i: number) => {
    if (modelling) return;
    const g = gs[i];
    void playClip(soundAsset(GRAPHEME_SOUND[g].clip)).done.catch(() => {});
    if (i === said) { setSaid(i + 1); onSound(); }
  };
  return (
    <section className="panel" role="dialog" aria-label="Magic word">
      <div className="kicker">{kicker ?? `Magic word · ${kid}'s turn`}</div>
      <h2 className="panel-h">Look at the letters. Say the sounds and blend.</h2>
      <div className="tiles">
        {gs.map((g, i) => (
          <button key={i} className={["tile", i < said || modelling ? "said" : "", i === said && !modelling ? "next" : ""].join(" ")} onClick={() => tap(i)} aria-label={`${g}, says ${GRAPHEME_SOUND[g].label}`}>
            <small>{GRAPHEME_SOUND[g].label}</small>{g}
          </button>
        ))}
      </div>
      <div className="verdict grownup">
        <div className="hint"><span className="tag">{reader}</span> did {kid} blend it into <b>{word}</b>? {said === gs.length && <em className="ok-note">all sounds said · now blend</em>}</div>
        <div className="btns">
          <button className="no" disabled={modelling} onClick={onTogether}>Say it together</button>
          <button className="yes" disabled={modelling} onClick={onYes}>✓ Yes!</button>
        </div>
        <div className="row center">
          <button className="skip" disabled={modelling} onClick={() => setLookAgain((n) => n + 1)}>look again — start here ↺</button>
          {onSkip && <button className="skip" disabled={modelling} onClick={onSkip}>skip for today →</button>}
        </div>
      </div>
    </section>
  );
}
