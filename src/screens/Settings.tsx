import { useEffect, useState } from "react";
import { useFamily } from "../lib/family";
import { ALL_GPCS, ALL_TRICKY, uid, type Kid } from "../lib/store";
import { Art } from "../components/Art";
import { designed } from "../lib/results";
import { playSound, soundPack, type SoundPack } from "../lib/sounds";
import { GRAPHEME_SOUND } from "../lib/phonics/learner";

/** the tricky words that come with each level, exactly as Welcome grants them: sounds without them lock every book */
const trickyFor = (n: number) => (n >= 23 ? ALL_TRICKY : n >= 16 ? ALL_TRICKY.slice(0, 5) : n >= 12 ? ALL_TRICKY.slice(0, 4) : n >= 8 ? ALL_TRICKY.slice(0, 3) : []);

const AVATARS = ["🦁", "🐣", "🐯", "🦊", "🐼", "🐸", "🦄", "🐬", "🐢", "🐝", "🌟", "🚀"];

export function SettingsScreen({ onBack, onAddStory, onSounds, onTeach }: { onBack: () => void; onAddStory: () => void; onSounds: () => void; onTeach: (replay?: boolean) => void }) {
  const { kids, updateKid, addKid, removeKid, settings, updateSettings, customs, removeCustom, activeKid, progress } = useFamily();
  const words = designed(Object.values(progress).flatMap((p) => p.results));   // volunteered words are practice, not a score
  const count = (m: string) => words.filter((r) => r.ok && r.mode === m).length;
  const [readerDraft, setReaderDraft] = useState("");
  const [pack, setPack] = useState<SoundPack | null>(null);
  useEffect(() => { void soundPack().then(setPack); }, []);
  return (
    <main className="settings">
      <div className="row"><button className="linkbtn" onClick={onBack}>← Back</button><div className="kicker">Grown-up settings</div></div>

      {activeKid && words.length > 0 && (
        <section className="pc">
          <h3>{activeKid.name} so far</h3>
          <p className="legend">{Object.values(progress).filter((p) => p.timesFinished > 0).length} stories · in the latest reading of each, {words.filter((r) => r.ok).length} magic words blended: {count("first_try")} first try, {count("prompted")} after a nudge, {count("modelled")} after a model · {words.filter((r) => !r.ok).length} for tomorrow · {Object.values(progress).flatMap((p) => p.encoding ?? []).filter((e) => e.ok).length} words built</p>
        </section>
      )}
      <section className="pc">
        <h3>Children</h3>
        {kids.map((k) => <KidEditor key={k.id} kid={k} onChange={updateKid} onRemove={kids.length > 1 ? () => removeKid(k.id) : undefined} />)}
        <button className="linkbtn" onClick={() => addKid({ id: uid(), name: "New reader", avatar: "🐸", gpcs: ALL_GPCS.slice(0, 4), tricky: [], role: "reader", createdAt: Date.now() })}>+ add a child</button>
      </section>

      <section className="pc">
        <h3>Grown-ups who read</h3>
        <p className="legend">Names show in the reading script (“Papa reads the grey words”).</p>
        <div className="chips">{settings.readers.map((r) => <button key={r} className={"chip" + (settings.tonight === r ? " on" : "")} onClick={() => updateSettings({ tonight: r })}>{settings.tonight === r ? "★ " : ""}{r}</button>)}</div>
        {settings.readers.length > 0 && <p className="legend">★ = reading tonight. Tap a name to switch. <button className="linkbtn" onClick={() => updateSettings({ readers: [], tonight: undefined })}>clear all</button></p>}
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (readerDraft.trim()) { updateSettings({ readers: [...settings.readers, readerDraft.trim()] }); setReaderDraft(""); } }}>
          <input value={readerDraft} onChange={(e) => setReaderDraft(e.target.value)} placeholder="e.g. Nani, Papa, Mama" aria-label="grown-up name" />
          <button className="small">Add</button>
        </form>
      </section>

      <section className="pc">
        <h3>Teach a sound</h3>
        <p className="legend">The 90-second routine: hear it, mouth cue, action, find it in words, trace it, blend it. Home suggests the next sound when there is evidence for it; you can always come here.</p>
        <div className="row"><button className="small" onClick={() => onTeach(true)}>Go over today's sound</button><button className="next" onClick={() => onTeach(false)}>Teach the next sound</button></div>
      </section>

      <section className="pc">
        <h3>Sounds in your voice</h3>
        <p className="legend">Record the 18 pure sounds once (two minutes). Your voice then plays on every letter tile and in the slide-through model instead of the built-in clips.</p>
        <button className="next" onClick={onSounds}>Record the sounds</button>
        <p className="legend credit">{pack?.credit}</p>
      </section>

      <section className="pc">
        <h3>Reading pace</h3>
        <p className="legend">How fast the recorded voice reads, and how long each sound is stretched when the app slides through a word. Slower is easier for a child following the words with a finger.</p>
        <div className="row">
          <button className={"tog rec" + (settings.pace !== "normal" ? " on" : "")} onClick={() => updateSettings({ pace: "slower" })}>Slower</button>
          <button className={"tog rec" + (settings.pace === "normal" ? " on" : "")} onClick={() => updateSettings({ pace: "normal" })}>Normal</button>
        </div>
      </section>

      <section className="pc">
        <h3>Bedtime mode</h3>
        <label className="switch"><input type="checkbox" checked={settings.bedtime} onChange={(e) => updateSettings({ bedtime: e.target.checked })} /> Dim colours, slower voice, no confetti. One story, then a real book.</label>
      </section>

      <section className="pc">
        <h3>Experimental: follow my voice</h3>
        <label className="switch"><input type="checkbox" checked={!!settings.voiceFollow} onChange={(e) => updateSettings({ voiceFollow: e.target.checked })} /> In “I read”, a “Follow my voice” button lights the words as you read them. While it is listening, your audio is sent to Apple or Google for recognition; nothing else ever leaves the phone. Sliding a finger under the words always works, offline.</label>
      </section>

      <section className="pc">
        <h3>Family stories</h3>
        {customs.length === 0 && <p className="legend">None yet. Add one about Nani, the dog, or the blue cup — the app keeps the magic words to sounds your child knows.</p>}
        {customs.map((s) => <div key={s.slug} className="row between"><span className="row"><span className="ico-sm"><Art art={s.pages[0].art} /></span> {s.title}</span><button className="linkbtn" onClick={() => removeCustom(s.slug)}>remove</button></div>)}
        <button className="next" onClick={onAddStory}>+ Add a family story</button>
      </section>
    </main>
  );
}

function KidEditor({ kid, onChange, onRemove }: { kid: Kid; onChange: (k: Kid) => void; onRemove?: () => void }) {
  const known = kid.gpcs.length; // taught sounds are always a prefix of the order
  return (
    <div className="kidedit">
      <div className="row wrap">
        <select value={kid.avatar} onChange={(e) => onChange({ ...kid, avatar: e.target.value })} aria-label="avatar">{AVATARS.map((a) => <option key={a}>{a}</option>)}</select>
        <input value={kid.name} onChange={(e) => onChange({ ...kid, name: e.target.value })} aria-label="name" />
        <select value={kid.role} onChange={(e) => onChange({ ...kid, role: e.target.value as Kid["role"] })} aria-label="role">
          <option value="reader">reads magic words</option>
          <option value="listener">listens & taps (younger)</option>
        </select>
        {onRemove && <button className="linkbtn" onClick={onRemove}>remove</button>}
      </div>
      <p className="legend">Sounds taught so far: <select value={known} onChange={(e) => { const n = +e.target.value; onChange({ ...kid, gpcs: ALL_GPCS.slice(0, n), tricky: [...new Set([...kid.tricky, ...trickyFor(n)])] }); }} aria-label="level">{[0, 1, 2, 3, 4, 8, 12, 16, 23].map((n) => <option key={n} value={n}>{n === 0 ? "none yet" : ALL_GPCS.slice(0, n).join(" ")}</option>)}</select></p>
      <p className="legend">Tap any sound to hear it (the sound, never the letter name). Taught sounds are green; change them with the list above, or teach one properly with the 90-second routine above.</p>
      <div className="chips">
        {ALL_GPCS.map((g, i) => <button key={g} className={"tog" + (i < known ? " on" : "")} title="tap: hear the sound" onClick={() => void playSound(GRAPHEME_SOUND[g].clip)}>{g}</button>)}
      </div>
      <p className="legend">Tricky words taught. Most of each word is regular; the app shows the regular part and marks only the odd bit (the → th + e). Only tick ones you have taught.</p>
      <div className="chips">
        {ALL_TRICKY.map((t) => { const on = kid.tricky.includes(t); return <button key={t} className={"tog tk" + (on ? " on" : "")} onClick={() => onChange({ ...kid, tricky: on ? kid.tricky.filter((x) => x !== t) : [...kid.tricky, t] })}>{t}</button>; })}
      </div>
    </div>
  );
}
