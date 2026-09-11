import { useEffect, useMemo, useState } from "react";
import { GRAPHEME_SOUND } from "../lib/phonics/learner";
import { checkWord, type LearnerModel } from "../lib/phonics/validator";
import { playClip } from "../lib/audio/player";
import { soundAsset } from "../lib/library";

export type Verdict = "first_try" | "prompted";

/**
 * The child's word card. Plain letters, no picture: "Start here and slide through the word."
 * Progressive disclosure for the grown-up: first only "First try" / "Needs help"; after "Needs help"
 * one precise nudge, then "After a nudge" / "Show me" / skip. Tile taps only play sounds and never
 * decide the label. A sweep under the graphemes shows the voice sliding through during a model.
 */
export function MagicPanel({ word, learner, modelling, modelledOnce, sweep, kid, reader, kicker, onSound, onYes, onTogether, onSkip }: {
  word: string; learner: LearnerModel; modelling: boolean; modelledOnce?: boolean; sweep?: number; kid: string; reader: string; kicker?: string;
  onSound: () => void; onYes: (v: Verdict) => void; onTogether: () => void; onSkip?: () => void;
}) {
  const gs = useMemo(() => checkWord(word, learner).graphemes, [word, learner]);
  const [said, setSaid] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => { setSaid(0); setHelp(false); }, [word]);
  useEffect(() => { if (modelledOnce) setHelp(true); }, [modelledOnce]);
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
        {!help ? (
          <>
            <div className="hint"><span className="tag">{reader}</span> wait 5 seconds. Did {kid} say it as <b>one word</b>?</div>
            <div className="btns">
              <button className="no" disabled={modelling} onClick={() => setHelp(true)}>Needs help</button>
              <button className="yes" disabled={modelling} onClick={() => onYes("first_try")}>✓ First try</button>
            </div>
          </>
        ) : modelledOnce ? (
          <>
            <div className="hint"><span className="tag">{reader}</span> now {kid} slides through it alone.</div>
            <div className="btns">
              <button className="no" disabled={modelling} onClick={onTogether}>Show me again</button>
              <button className="yes soft" disabled={modelling} onClick={() => onYes("prompted")}>✓ Slid through it after the model</button>
            </div>
          </>
        ) : (
          <>
            <div className="hint"><span className="tag">{reader}</span> one nudge, then wait: point to the first letter and say <em>“Start here… slide.”</em> Nothing more.</div>
            <div className="btns">
              <button className="no" disabled={modelling} onClick={onTogether}>Show me: slide through it</button>
              <button className="yes soft" disabled={modelling} onClick={() => onYes("prompted")}>✓ After a nudge</button>
            </div>
          </>
        )}
        <div className="row center">
          <button className="skip" disabled={modelling} onClick={() => setSaid(0)}>look again — start here ↺</button>
          {help && onSkip && <button className="skip" disabled={modelling} onClick={onSkip}>skip for today →</button>}
        </div>
        {help && <p className="adultnote">Sounds, not letter names · don't give the first sound · no guessing from the picture · any accent is fine · ✓ only after the whole word.</p>}
      </div>
    </section>
  );
}
