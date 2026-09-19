import { useEffect, useMemo, useState } from "react";
import { playSound } from "../lib/sounds";
import { GRAPHEME_SOUND } from "../lib/phonics/learner";
import { checkWord, type LearnerModel } from "../lib/phonics/validator";
import { CheckIcon } from "./Icons";

export type Verdict = "first_try" | "prompted";

/**
 * The child's word card. Plain letters, no picture: "Start here and slide through the word."
 * Progressive disclosure for the grown-up: first only "First try" / "Needs help"; after "Needs help"
 * one precise nudge, then "After a nudge" / "Show me" / skip. Tile taps only play sounds and never
 * decide the label. A sweep under the graphemes shows the voice sliding through during a model.
 */
export function MagicPanel({ word, learner, modelling, modelledOnce, sweep, kid, reader, kicker, extra, modelScript, onSound, onYes, onTogether, onSkip, onDismiss }: {
  word: string; learner: LearnerModel; modelling: boolean; modelledOnce?: boolean; sweep?: number; kid: string; reader: string; kicker?: string;
  /** the child volunteered for this one: softer language, and leaving it records nothing */
  extra?: boolean;
  /** read mode is silent, so the modelling instruction must live on the sheet, not in the caption bar behind it */
  modelScript?: string;
  onSound: () => void; onYes: (v: Verdict) => void; onTogether: () => void; onSkip?: () => void; onDismiss?: () => void;
}) {
  const gs = useMemo(() => checkWord(word, learner).graphemes, [word, learner]);
  const [said, setSaid] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => { setSaid(0); setHelp(false); }, [word]);
  useEffect(() => { if (modelledOnce) setHelp(true); }, [modelledOnce]);
  const tap = (i: number) => {
    if (modelling) return;
    void playSound(GRAPHEME_SOUND[gs[i]].clip);
    if (i === said) { setSaid(i + 1); onSound(); }
  };
  return (
    <section className="panel" role="dialog" aria-label="Magic word">
      <div className="kicker">{kicker ?? `Magic word · ${kid}'s turn`}</div>
      <h2 className="panel-h">{modelling && modelScript ? modelScript : "Start here. Slide through the word and keep your voice going."}</h2>
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
            <div className="hint"><span className="tag">{reader}</span> wait 5 seconds. Did {kid} say it as <b>one word</b>? <small className="legend">(stuck on a sound? tap that letter — never say its name)</small></div>
            <p className="adultnote">Don't give the first sound · no guessing from the picture.</p>
            <div className="btns">
              <button className="no" disabled={modelling} onClick={() => (extra ? onDismiss?.() : setHelp(true))}>{extra ? "Leave it" : "Needs help"}</button>
              <button className="yes" disabled={modelling} onClick={() => onYes("first_try")}><CheckIcon /> {extra ? "They read it" : "First try"}</button>
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
            <div className="hint"><span className="tag">{reader}</span> one nudge, then wait: point to the first letter and say <em>“Start here… slide.”</em> Still stuck? “Show me” models the sounds running into the word; {kid} then tries alone.</div>
            <div className="btns">
              <button className="no" disabled={modelling} onClick={onTogether}>Show me: slide through it</button>
              <button className="yes soft" disabled={modelling} onClick={() => onYes("prompted")}><CheckIcon /> After a nudge</button>
            </div>
          </>
        )}
        <div className="row center">
          <button className="skip" disabled={modelling} onClick={() => setSaid(0)}>look again — start here ↺</button>
          {onDismiss && <button className="skip" disabled={modelling} onClick={onDismiss}>↓ not yet</button>}
        </div>
        {/* One tap, silent, from the first moment: a tired child at 7:40 does not need a routine, and
            the grown-up should not have to work through "Needs help" and a nudge to end it kindly.
            The word is recorded as told, so it comes back in tomorrow's warm-up. */}
        {onSkip && <button className="skip bypass" disabled={modelling} onClick={onSkip}>you say it, and carry on →</button>}
        {help && <p className="adultnote">Sounds, not letter names · any accent is fine · ✓ only after the whole word.</p>}
      </div>
    </section>
  );
}
