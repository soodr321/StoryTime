/**
 * 45–60 second retrieval warm-up before today's story: yesterday's helped/skipped words
 * plus one secure word, one card at a time, same grown-up ✓ / "Say it together".
 */
import { useMemo, useState } from "react";
import { useFamily } from "../lib/family";
import { learnerOf } from "../lib/store";
import { MagicPanel } from "../components/MagicPanel";
import { checkWord } from "../lib/phonics/validator";
import { dotted, playBlend } from "../lib/blend";
import { unlock } from "../lib/audio/player";

export function WarmUpScreen({ onDone }: { onDone: () => void }) {
  const { activeKid: kid, review, reviewDone, settings } = useFamily();
  const learner = useMemo(() => learnerOf(kid!), [kid]);
  const reader = settings.tonight ?? settings.readers[0] ?? "Grown-up";
  const [i, setI] = useState(0);
  const [modelling, setModelling] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [caption, setCaption] = useState("Warm-up: a few words from last time.");
  const [results, setResults] = useState<{ word: string; ok: boolean; mode: string }[]>([]);
  const words = review.map((r) => r.word);
  const word = words[i];

  const record = async (ok: boolean, mode: string) => {
    const next = [...results, { word, ok, mode }]; setResults(next); setTapped(false);
    if (i + 1 < words.length) setI(i + 1); else { await reviewDone(next); onDone(); }
  };
  const together = async () => {
    setModelling(true); const gs = checkWord(word, learner).graphemes;
    setCaption(`${dotted(gs)} … ${word}. Now say the sounds, then blend.`);
    await playBlend(gs); setModelling(false);
  };

  if (!kid || !word) return <main className="home-screen"><p className="note">Nothing to warm up today.</p><button className="yes" onClick={onDone}>Start the story</button></main>;
  return (
    <div className="screen-wrap panel-open">
      <main className="story warm">
        <div className="kicker">Warm-up · {i + 1} of {words.length}</div>
        <p className="note">Quick words from last time, then today's story.</p>
        <button className="linkbtn" onClick={() => { void unlock(); onDone(); }}>skip to the story →</button>
      </main>
      <MagicPanel
        word={word} learner={learner} modelling={modelling} kid={kid.name} reader={reader} kicker={`Warm-up word · ${kid.name}'s turn`}
        onSound={() => setTapped(true)}
        onYes={() => record(true, tapped ? "sounded" : "independent")}
        onTogether={together}
        onSkip={() => record(false, "skipped")}
      />
      <div className="cap" aria-live="polite">{caption}</div>
    </div>
  );
}
