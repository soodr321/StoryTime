/**
 * Family story builder — a tired parent finishes it in three minutes:
 *   1. Title + who it's for.  2. Paste or type the story (one sentence per line = one page).
 *   3. The app finds every word the child can decode and suggests one magic word per page.
 *   4. Pick an emoji or a camera-roll photo for each page (photos are shrunk to ≤640px JPEG and stored locally, never uploaded).  5. Moral + read-back line, checked live.
 * Narration uses on-device speech; no server, works offline.
 */
import { useMemo, useRef, useState } from "react";
import { canRecord, startRecording, type Recorder } from "../lib/audio/record";
import { useFamily } from "../lib/family";
import { learnerOf, uid } from "../lib/store";
import { checkLine, checkMagicWord, normalise } from "../lib/phonics/validator";
import type { Story } from "../lib/content/types";

/** Camera-roll photo → small JPEG data URL (≤ 640px) so it fits IndexedDB and loads instantly. */
async function shrink(file: File): Promise<string | null> {
  try {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
  } catch { return null; }
}

const EMOJI = ["👵", "👴", "👩", "👨", "👧", "👦", "🐶", "🐱", "🐦", "🐘", "🥭", "🌳", "🏠", "🚗", "🚌", "⚽", "🎂", "🌙", "☀️", "🌧️", "🐐", "🐄", "🐒", "🦜", "🍎", "🎈", "🏖️", "🛏️"];

export function AddStoryScreen({ onDone }: { onDone: () => void }) {
  const { kids, addCustom } = useFamily();
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [kidId, setKidId] = useState(kids.find((k) => k.role === "reader")?.id ?? kids[0]?.id);
  const kid = kids.find((k) => k.id === kidId) ?? kids[0];
  const learner = useMemo(() => learnerOf(kid), [kid]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [moral, setMoral] = useState("");
  const [line, setLine] = useState("");
  const [arts, setArts] = useState<Record<number, string>>({});
  const [magic, setMagic] = useState<Record<number, string | null>>({});
  const [rec, setRec] = useState<Record<number, { dataUrl: string; ms: number }>>({});
  const [recording, setRecording] = useState<number | null>(null);
  const recRef = useRef<Recorder | null>(null);
  const toggleRec = async (i: number) => {
    if (recording === i) { const r = await recRef.current?.stop(); recRef.current = null; setRecording(null); if (r) setRec({ ...rec, [i]: r }); return; }
    if (recording !== null) return;
    try { recRef.current = await startRecording(); setRecording(i); } catch { setPhotoErr("Microphone not allowed. You can still save the story; it will use the phone's voice."); }
  };

  // one line per page; a pasted paragraph is split at sentence ends so a tired parent never sees a silent disabled Save
  const pages = useMemo(() => text.split(/\n+/).flatMap((l) => l.split(/(?<!\b[A-Z][a-z]{0,2})(?<=[.!?”"])\s+(?=[A-Z“"])/)).map((s) => s.trim()).filter(Boolean), [text]);
  // names (capitalised mid-sentence) are never magic words; possessives are stripped; nothing is auto-picked
  const candidates = useMemo(() => pages.map((p) => { const toks = p.split(/\s+/); return [...new Set(toks.filter((t, i) => !(i > 0 && /^[A-Z]/.test(t))).map((t) => normalise(t.replace(/[’']s$/, ""))).filter((w) => w.length >= 2 && checkMagicWord(w, learner).ok))]; }), [pages, learner]);
  const lineCheck = useMemo(() => (line.trim() ? checkLine(line, learner) : null), [line, learner]);
  const chosen = (i: number) => magic[i] ?? null;
  const ready = title.trim() && pages.length >= 2 && moral.trim() && lineCheck?.ok && pages.every((_, i) => arts[i] || true);

  const save = async () => {
    const story: Story = {
      slug: "family-" + uid(), title: title.trim(), tradition: "family",
      source: { work: "Family story", rights: "owner" },
      retelling: { level: `${kid.gpcs.length} sounds`, checklist: { setup: true, want: true, action: true, consequence: true, feeling: true } },
      level: "custom",
      pages: pages.map((p, i) => ({ art: arts[i] ?? "📖", tokens: p.split(/\s+/).map((t) => ({ t, ms: 0 })), ...(chosen(i) ? { magic: [chosen(i)!] } : {}), ...(rec[i] ? { audio: rec[i].dataUrl, audioMs: rec[i].ms } : {}) })),
      moral: { spoken: moral.trim(), line: line.trim() },
    };
    if (await addCustom(story)) onDone();
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
        <p className="legend">Tip: a first-time reader manages 5–8 pages. Write the rich version — the app only asks {kid.name} to read the magic words. Record each page in your own voice and it becomes Nani reading, offline.</p>
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
                <label className="emo photo" title="photo from your camera roll">📷<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const d = await shrink(f); if (d) { setArts({ ...arts, [i]: d }); setPhotoErr(null); } else setPhotoErr("Couldn't use that photo. Try a JPEG or PNG."); }} /></label>
                {arts[i]?.startsWith("data:") && <img className="thumb" src={arts[i]} alt="" />}
                {photoErr && <span className="legend bad">{photoErr}</span>}
              </div>
              {canRecord() && (
                <div className="row wrap">
                  <span className="legend">Voice:</span>
                  <button className={"tog rec" + (recording === i ? " live" : rec[i] ? " on" : "")} onClick={() => toggleRec(i)}>{recording === i ? "■ stop" : rec[i] ? "🎤 re-record" : "🎤 record this page"}</button>
                  {rec[i] && recording !== i && <span className="legend">✓ {Math.round(rec[i].ms / 1000)}s in your voice</span>}
                  {!rec[i] && recording !== i && <span className="legend">or leave it: the phone reads it</span>}
                </div>
              )}
              <div className="row wrap">
                <span className="legend">Magic word:</span>
                {candidates[i].length === 0 && <span className="legend">none decodable on this page — fine, {kid.name} listens.</span>}
                {candidates[i].map((w) => <button key={w} className={"tog" + (chosen(i) === w ? " on" : "")} onClick={() => setMagic({ ...magic, [i]: chosen(i) === w ? null : w })}>{w}</button>)}
                {candidates[i].length > 0 && <span className="legend">{chosen(i) ? "" : "tap one, or none"}</span>}
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
