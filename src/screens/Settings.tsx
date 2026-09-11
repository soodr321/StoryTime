import { useState } from "react";
import { useFamily } from "../lib/family";
import { ALL_GPCS, ALL_TRICKY, uid, type Kid } from "../lib/store";
import { Art } from "../components/Art";

const AVATARS = ["🦁", "🐣", "🐯", "🦊", "🐼", "🐸", "🦄", "🐬", "🐢", "🐝", "🌟", "🚀"];

export function SettingsScreen({ onBack, onAddStory }: { onBack: () => void; onAddStory: () => void }) {
  const { kids, updateKid, addKid, removeKid, settings, updateSettings, customs, removeCustom, activeKid, progress } = useFamily();
  const words = Object.values(progress).flatMap((p) => p.results);
  const count = (m: string) => words.filter((r) => r.ok && r.mode === m).length;
  const [readerDraft, setReaderDraft] = useState("");
  return (
    <main className="settings">
      <div className="row"><button className="linkbtn" onClick={onBack}>← Back</button><div className="kicker">Grown-up settings</div></div>

      {activeKid && words.length > 0 && (
        <section className="pc">
          <h3>{activeKid.name} so far</h3>
          <p className="legend">{Object.keys(progress).length} stories · {words.filter((r) => r.ok).length} magic words read: {count("sight")} on sight, {count("sounded")} sounded out, {count("modelled")} after help · {words.filter((r) => !r.ok).length} skipped</p>
          {count("sight") >= 3 && count("sounded") === 0 && <p className="legend">Tip: lots of sight reads and no sounding out — try “Say it together” once so the sounds stay fresh.</p>}
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
        <h3>Bedtime mode</h3>
        <label className="switch"><input type="checkbox" checked={settings.bedtime} onChange={(e) => updateSettings({ bedtime: e.target.checked })} /> Dim colours, slower voice, no confetti. One story, then a real book.</label>
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
      <div className="row">
        <select value={kid.avatar} onChange={(e) => onChange({ ...kid, avatar: e.target.value })} aria-label="avatar">{AVATARS.map((a) => <option key={a}>{a}</option>)}</select>
        <input value={kid.name} onChange={(e) => onChange({ ...kid, name: e.target.value })} aria-label="name" />
        <select value={kid.role} onChange={(e) => onChange({ ...kid, role: e.target.value as Kid["role"] })} aria-label="role">
          <option value="reader">reads magic words</option>
          <option value="listener">listens & taps (younger)</option>
        </select>
        {onRemove && <button className="linkbtn" onClick={onRemove}>remove</button>}
      </div>
      <p className="legend">Sounds taught so far: <select value={known} onChange={(e) => onChange({ ...kid, gpcs: ALL_GPCS.slice(0, +e.target.value) })} aria-label="level">{[4, 8, 12, 16, 23].map((n) => <option key={n} value={n}>{ALL_GPCS.slice(0, n).join(" ")}</option>)}</select></p>
      <p className="legend">Or tap the last sound you've taught:</p>
      <div className="chips">
        {ALL_GPCS.map((g, i) => <button key={g} className={"tog" + (i < known ? " on" : "")} onClick={() => onChange({ ...kid, gpcs: ALL_GPCS.slice(0, i + 1) })}>{g}</button>)}
      </div>
      <p className="legend">Tricky words taught (read as wholes; the app never sounds these out).</p>
      <div className="chips">
        {ALL_TRICKY.map((t) => { const on = kid.tricky.includes(t); return <button key={t} className={"tog tk" + (on ? " on" : "")} onClick={() => onChange({ ...kid, tricky: on ? kid.tricky.filter((x) => x !== t) : [...kid.tricky, t] })}>{t}</button>; })}
      </div>
    </div>
  );
}
