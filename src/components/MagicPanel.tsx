import { useEffect, useMemo, useState } from "react";
import { GRAPHEME_SOUND } from "../lib/phonics/learner";
import { checkWord, type LearnerModel } from "../lib/phonics/validator";
import { playClip } from "../lib/audio/player";
import { soundAsset } from "../lib/library";

export type Verdict = "first_try" | "prompted";

/**
 * The child's word card. Plain letters, no picture: "Start here and slide through the word."
 * The grown-up records their own judgement (first try / after a prompt / needs a model / skip);
 * tile taps only play sounds and never decide the label. A sweep under the graphemes shows
 * the voice sliding through during a model.
 */
export function MagicPanel({ word, learner, modelling, sweep, kid, reader, kicker, onSound, onYes, onTogether, onSkip }: {
  word: string; learner: LearnerModel; modelling: boolean; sweep?: number; kid: string; reader: string; kicker?: string;
  onSound: () => void; onYes: (v: Verdict) => void; onTogether: () => void; onSkip?: () => void;
}) {
  const gs = useMemo(() => checkWord(word, learner).graphemes, [word, learner]);
  const [said, setSaid] = useState(0);
  const [lookAgain, setLookAgain] = useState(0);
  useEffect(() => { setSaid(0); }, [word, modelling, lookAgain]);
  const tap = (i: number) => {
    if (modelling) return;
    void playClip(soundAsset(GRAPHEME_SOUND[gs[i]].clip)).done.catch(() => {});
    if (i === said) { setSaid(i + 1); onSound(); }
  };
  return (
    <section className="panel" role="dialog" aria-label="Magic word">
      <div className="kicker">{kicker ?? `Magic word · ${kid}'s turn`}</div>
      <h2 className="panel-h">Start here and slide through the word. Keep your voice going.</h2>
      <div className="tiles-wrap">
        <div className="tiles">
          {gs.map((g, i) => (
            <button key={i} className={["tile", i < said || modelling ? "said" : "", i === said && !modelling ? "next" : ""].join(" ")} onClick={() => tap(i)} aria-label={`${g}, says ${GRAPHEME_SOUND[g].label}`}>
              <small>{GRAPHEME_SOUND[g].label}</small>{g}
            </button>
          ))}
        </div>
        <div className="sweep" aria-hidden><i style={{ width: `${Math.round((sweep ?? 0) * 100)}%`, opacity: modelling ? 1 : 0 }} /></div>
      </div>
      <div className="verdict grownup">
        <div className="hint"><span className="tag">{reader}</span> wait 5 seconds. Did {kid} say <b>{word}</b> as one word?</div>
        <div className="btns">
          <button className="yes" disabled={modelling} onClick={() => onYes("first_try")}>✓ First try</button>
          <button className="yes soft" disabled={modelling} onClick={() => onYes("prompted")}>✓ After a nudge</button>
        </div>
        <div className="btns">
          <button className="no" disabled={modelling} onClick={onTogether}>Show me: slide through it</button>
        </div>
        <div className="row center">
          <button className="skip" disabled={modelling} onClick={() => setLookAgain((n) => n + 1)}>look again — start here ↺</button>
          {onSkip && <button className="skip" disabled={modelling} onClick={onSkip}>skip for today →</button>}
        </div>
        <p className="adultnote">Sounds, not letter names · don't give the first sound · no guessing from the picture · any accent is fine · ✓ only after the whole word.</p>
      </div>
    </section>
  );
}
