/** First launch: 60 seconds, three questions, then a story. Everything is editable later in Settings. */
import { useState } from "react";
import { useFamily } from "../lib/family";
import { ALL_GPCS, ALL_TRICKY, uid } from "../lib/store";
import { playSound } from "../lib/sounds";
import { GRAPHEME_SOUND } from "../lib/phonics/learner";
import { Mascots } from "../components/Icons";

const LEVELS_UI = [
  { n: 0, label: "none yet", hint: "starting from scratch: we teach s first" },
  { n: 4, label: "s a t p", hint: "knows these four sounds" },
  { n: 8, label: "+ i n m d", hint: "can blend sat, pin, mat" },
  { n: 12, label: "+ g o c k", hint: "reads dog, top, kid" },
  { n: 16, label: "+ ck e u r", hint: "reads duck, run, red" },
  { n: 23, label: "+ h b f l ss", hint: "all phase-2 sounds" },
];
const AVATARS = ["🦁", "🐯", "🦊", "🐼", "🐸", "🦄", "🐬", "🚀"];

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { kids, updateKid, addKid, removeKid, updateSettings } = useFamily();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🦁");
  const [level, setLevel] = useState(0);   // start low; the grown-up chooses upward
  const [sibling, setSibling] = useState("");
  const [grownup, setGrownup] = useState("");

  const finish = () => {
    const reader = kids.find((k) => k.role === "reader") ?? kids[0];
    const n = LEVELS_UI[level].n;
    const tricky = n >= 23 ? ALL_TRICKY : n >= 16 ? ALL_TRICKY.slice(0, 5) : n >= 12 ? ALL_TRICKY.slice(0, 4) : n >= 8 ? ALL_TRICKY.slice(0, 3) : [];   // mirrors LEVELS exactly
    updateKid({ ...reader, name: name.trim() || reader.name, avatar, gpcs: ALL_GPCS.slice(0, n), tricky });
    const little = kids.find((k) => k.role === "listener");
    if (sibling.trim()) { if (little) updateKid({ ...little, name: sibling.trim() }); else addKid({ id: uid(), name: sibling.trim(), avatar: "🐣", gpcs: ALL_GPCS.slice(0, 4), tricky: [], role: "listener", createdAt: Date.now() }); }
    else if (little) removeKid(little.id);   // no phantom "Little one"
    updateSettings({ readers: grownup.trim() ? [grownup.trim()] : [], tonight: grownup.trim() || undefined, onboarded: true, activeKid: reader.id });
    onDone();
  };

  return (
    <main className="settings welcome">
      <div className="hero rise"><Mascots /><h1>StoryTime</h1><h2>We tell the story.<br />Your child reads the magic words.</h2></div>
      <section className="pc rise2">
        <label className="lbl">Who is learning to read? <input value={name} onChange={(e) => setName(e.target.value)} placeholder="first name" /></label>
        <div className="chips">{AVATARS.map((a) => <button key={a} className={"emo" + (avatar === a ? " on" : "")} onClick={() => setAvatar(a)}>{a}</button>)}</div>
        <p className="legend">How far along are they? Tap the last row that is true (you'll hear its newest sound — these are sounds, never letter names).</p>
        <div className="levels">
          {LEVELS_UI.map((l, i) => <button key={l.n} className={"lvlrow" + (i === level ? " on" : "")} onClick={() => { setLevel(i); if (l.n > 0) { const g = ALL_GPCS[l.n - 1]; void playSound(GRAPHEME_SOUND[g].clip); } }}><b>{l.label}</b><small>{l.hint}{l.n > 0 ? " · 🔊" : ""}</small></button>)}
        </div>
      </section>
      <section className="pc rise3">
        <label className="lbl">A younger brother or sister who listens along? <input value={sibling} onChange={(e) => setSibling(e.target.value)} placeholder="name, or leave blank" /></label>
        <label className="lbl">Who reads with them tonight? <input value={grownup} onChange={(e) => setGrownup(e.target.value)} placeholder="Nani, Papa, Mama…" /></label>
      </section>
      <button className="next rise3" onClick={finish}>Start reading →</button>
      <p className="legend">Nothing leaves this device. You can change all of this later in Settings.</p>
    </main>
  );
}
