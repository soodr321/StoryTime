/**
 * Family story builder — a tired parent finishes it in three minutes:
 *   1. Title + who it's for.  2. Paste or type the story (one sentence per line = one page).
 *   3. The app finds every word the child can decode and suggests one magic word per page.
 *   4. Pick an emoji (or a photo from the camera roll) for each page.  5. Moral + read-back line, checked live.
 * Narration uses on-device speech; no server, works offline.
 */
import { useMemo, useState } from "react";
import { useFamily } from "../lib/family";
import { learnerOf, uid } from "../lib/store";
import { checkLine, checkMagicWord, normalise } from "../lib/phonics/validator";
import type { Story } from "../lib/content/types";

const EMOJI = ["👵", "👴", "👩", "👨", "👧", "👦", "🐶", "🐱", "🐦", "🐘", "🥭", "🌳", "🏠", "🚗", "🚌", "⚽", "🎂", "🌙", "☀️", "🌧️", "🐐", "🐄", "🐒", "🦜", "🍎", "🎈", "🏖️", "🛏️"];

export function AddStoryScreen({ onDone }: { onDone: () => void }) {
  const { kids, addCustom } = useFamily();
  const [kidId, setKidId] = useState(kids.find((k) => k.role === "reader")?.id ?? kids[0]?.id);
  const kid = kids.find((k) => k.id === kidId) ?? kids[0];
  const learner = useMemo(() => learnerOf(kid), [kid]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [moral, setMoral] = useState("");
  const [line, setLine] = useState("");
  const [arts, setArts] = useState<Record<number, string>>({});
  const [magic, setMagic] = useState<Record<number, string | null>>({});

  const pages = useMemo(() => text.split(/\n+/).map((s) => s.trim()).filter(Boolean), [text]);
  const candidates = useMemo(() => pages.map((p) => [...new Set(p.split(/\s+/).map(normalise).filter((w) => w.length >= 2 && checkMagicWord(w, learner).ok))]), [pages, learner]);
  const lineCheck = useMemo(() => (line.trim() ? checkLine(line, learner) : null), [line, learner]);
  const chosen = (i: number) => (magic[i] === undefined ? candidates[i]?.[0] ?? null : magic[i]);
  const ready = title.trim() && pages.length >= 2 && moral.trim() && lineCheck?.ok && pages.every((_, i) => arts[i] || true);

  const save = () => {
    const story: Story = {
      slug: "family-" + uid(), title: title.trim(), tradition: "family",
      source: { work: "Family story", rights: "owner" },
      retelling: { level: `${kid.gpcs.length} sounds`, checklist: { setup: true, want: true, action: true, consequence: true, feeling: true } },
      level: "custom",
      pages: pages.map((p, i) => ({ art: arts[i] ?? "📖", tokens: p.split(/\s+/).map((t) => ({ t, ms: 0 })), ...(chosen(i) ? { magic: [chosen(i)!] } : {}) })),
      moral: { spoken: moral.trim(), line: line.trim() },
    };
    addCustom(story); onDone();
  };

  return (
    <main className="settings addstory">
      <div className="row"><button className="linkbtn" onClick={onDone}>← Back</button><div className="kicker">Add a family story</div></div>

      <section className="pc">
        <label className="lbl">Title <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nani and the Mango Tree" /></label>
        <label className="lbl">For <select value={kidId} onChange={(e) => setKidId(e.target.value)}>{kids.map((k) => <option key={k.id} value={k.id}>{k.avatar} {k.name} · {k.gpcs.length} sounds</option>)}</select></label>
        <label className="lbl">The story — one sentence per line, one line per page
          <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Nani had a big mango tree.\nVeer sat under it with his cat.\nA mango fell. Plop!\n…"} />
        </label>
        <p className="legend">Tip: a first-time reader manages 5–8 pages. Write the rich version — the app only asks {kid.name} to read the magic words.</p>
      </section>

      {pages.length > 0 && (
        <section className="pc">
          <h3>Pages, pictures and magic words</h3>
          {pages.map((p, i) => (
            <div key={i} className="pagerow">
              <div className="row">
                <span className="pn">{i + 1}</span>
                <span className="ptext">{p}</span>
              </div>
              <div className="row wrap">
                <span className="legend">Picture:</span>
                {EMOJI.map((e) => <button key={e} className={"emo" + (arts[i] === e ? " on" : "")} onClick={() => setArts({ ...arts, [i]: e })}>{e}</button>)}
              </div>
              <div className="row wrap">
                <span className="legend">Magic word:</span>
                {candidates[i].length === 0 && <span className="legend">none decodable on this page — fine, {kid.name} listens.</span>}
                {candidates[i].map((w) => <button key={w} className={"tog" + (chosen(i) === w ? " on" : "")} onClick={() => setMagic({ ...magic, [i]: w })}>{w}</button>)}
                {candidates[i].length > 0 && <button className={"tog" + (chosen(i) === null ? " on" : "")} onClick={() => setMagic({ ...magic, [i]: null })}>none</button>}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="pc">
        <label className="lbl">Moral, said by the grown-up <input value={moral} onChange={(e) => setMoral(e.target.value)} placeholder="Wait for the mango to fall by itself." /></label>
        <label className="lbl">{kid.name}'s line to read back <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="It is a mango." /></label>
        {lineCheck && (
          <p className={"legend " + (lineCheck.ok ? "ok" : "bad")}>
            {lineCheck.ok ? "✓ every word is readable at this level" : lineCheck.results.filter((r) => !r.ok).map((r) => !r.ok && r.reasons.join("; ")).join(" · ")}
          </p>
        )}
        <p className="legend">Allowed: words made only of {kid.gpcs.join(" ")}{kid.tricky.length ? ` plus the tricky words ${kid.tricky.join(", ")}` : ""}.</p>
      </section>

      <button className="next" disabled={!ready} onClick={save}>Save to the bookshelf</button>
    </main>
  );
}
