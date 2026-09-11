/**
 * Family story builder — a tired parent finishes it in three minutes:
 *   1. Title + who it's for.  2. Paste or type the story (one sentence per line = one page).
 *   3. The app finds every word the child can decode and suggests one magic word per page.
 *   4. Pick an emoji or a camera-roll photo for each page (photos are shrunk to ≤640px JPEG and stored locally, never uploaded).  5. Moral + read-back line, checked live.
 * Narration uses on-device speech; no server, works offline.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { canRecord, startRecording, type Recorder } from "../lib/audio/record";
import { playClip } from "../lib/audio/player";
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
  // media and magic-word choices are keyed by the page TEXT, so inserting a sentence above does not shift them
  const [arts, setArts] = useState<Record<string, string>>({});
  const [magic, setMagic] = useState<Record<string, string | null>>({});
  const [rec, setRec] = useState<Record<string, { dataUrl: string; ms: number }>>({});
  const [recording, setRecording] = useState<number | null>(null);
  const [times, setTimes] = useState<Record<string, number[]>>({});   // tap-as-you-listen word timings, keyed like recordings
  const [timing, setTiming] = useState<number | null>(null);
  const timingEl = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<Recorder | null>(null);
  useEffect(() => () => { void recRef.current?.stop(); }, []);   // leaving the screen releases the microphone
  const toggleRec = async (i: number) => {
    const key = keys[i];
    if (recording === i) { let r: { dataUrl: string; ms: number } | null = null; try { r = (await recRef.current?.stop()) ?? null; } finally { recRef.current = null; setRecording(null); } if (r) { setRec((prev) => ({ ...prev, [key]: r })); setTimes((prev) => { const n = { ...prev }; delete n[key]; return n; }); } else setPhotoErr("That recording was empty. Try again and speak a little longer."); return; }
    if (recording !== null) return;
    try { recRef.current = await startRecording(); setRecording(i); } catch { setPhotoErr("Microphone not allowed. You can still save the story; it will use the phone's voice."); }
  };

  // one line per page; a pasted paragraph is split at sentence ends so a tired parent never sees a silent disabled Save
  const pages = useMemo(() => text.split(/\n+/).flatMap((l) => l.split(/(?<!\b[A-Z][a-z]{0,2})(?<=[.!?”"])\s+(?=[A-Z“"])/)).map((s) => s.trim()).filter(Boolean), [text]);
  // media key: page text plus its occurrence number, so two identical lines ("Run!") stay separate
  const keys = useMemo(() => { const seen: Record<string, number> = {}; return pages.map((p) => { seen[p] = (seen[p] ?? 0) + 1; return seen[p] > 1 ? `${p}#${seen[p]}` : p; }); }, [pages]);
  // names (capitalised mid-sentence) are never magic words; possessives are stripped; nothing is auto-picked
  const candidates = useMemo(() => pages.map((p) => { const toks = p.split(/\s+/); return [...new Set(toks.filter((t, i) => !(i > 0 && /^[A-Z]/.test(t))).map((t) => normalise(t)).filter((w) => w.length >= 2 && checkMagicWord(w, learner).ok))]; }), [pages, learner]);
  const examples = useMemo(() => ["sat", "tap", "pat", "sip", "pin", "tin", "map", "nap", "dad", "dig", "dog", "pot", "cot", "kid", "sock", "duck", "pen", "red", "cup", "run", "hat", "bed", "fan", "leg"].filter((w) => checkMagicWord(w, learner).ok).slice(0, 4), [learner]);
  const lineCheck = useMemo(() => (line.trim() ? checkLine(line, learner) : null), [line, learner]);
  const chosen = (i: number) => magic[keys[i]] ?? null;
  const artOf = (i: number) => arts[keys[i]];
  const recOf = (i: number) => rec[keys[i]];
  const wordsOf = (i: number) => pages[i].split(/\s+/);
  /** timings count only when every word has a strictly increasing stamp inside the recording */
  const timedOk = (i: number) => { const t = times[keys[i]]; const r = recOf(i); return !!t && !!r && t.length === wordsOf(i).length && t.every((v, k) => v > 0 && (k === 0 || v > t[k - 1])) && t[t.length - 1] < r.ms; };
  const startTiming = (i: number) => { const r = recOf(i); if (!r) return; setTimes((prev) => ({ ...prev, [keys[i]]: [] })); const p = playClip(r.dataUrl); timingEl.current = p.el; setTiming(i); void p.done.finally(() => setTiming((cur) => (cur === i ? null : cur))); };
  const tapWord = (i: number, k: number) => { const el = timingEl.current; const cur = times[keys[i]] ?? []; if (timing !== i || !el || cur.length !== k) return; setTimes((prev) => ({ ...prev, [keys[i]]: [...cur, Math.round(el.currentTime * 1000)] })); };
  const ready = title.trim() && pages.length >= 2 && moral.trim() && lineCheck?.ok && pages.every((_, i) => arts[i] || true);

  const save = async () => {
    const story: Story = {
      slug: "family-" + uid(), title: title.trim(), tradition: "family",
      source: { work: "Family story", rights: "owner" },
      retelling: { level: `${kid.gpcs.length} sounds`, checklist: { setup: true, want: true, action: true, consequence: true, feeling: true } },
      level: "custom",
      pages: pages.map((p, i) => ({ art: artOf(i) ?? "📖", tokens: p.split(/\s+/).map((t, k) => ({ t, ms: timedOk(i) ? times[keys[i]][k] : 0 })), ...(chosen(i) ? { magic: [chosen(i)!] } : {}), ...(recOf(i) ? { audio: recOf(i).dataUrl, audioMs: recOf(i).ms } : {}) })),
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
                {EMOJI.map((e) => <button key={e} className={"emo" + (artOf(i) === e ? " on" : "")} onClick={() => setArts((prev) => ({ ...prev, [keys[i]]: e }))}>{e}</button>)}
                <label className="emo photo" title="photo from your camera roll">📷<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const d = await shrink(f); if (d) { setArts((prev) => ({ ...prev, [keys[i]]: d })); setPhotoErr(null); } else setPhotoErr("Couldn't use that photo. Try a JPEG or PNG."); }} /></label>
                {artOf(i)?.startsWith("data:") && <img className="thumb" src={artOf(i)} alt="" />}
                {photoErr && <span className="legend bad">{photoErr}</span>}
              </div>
              {canRecord() && (
                <div className="row wrap">
                  <span className="legend">Voice:</span>
                  <button className={"tog rec" + (recording === i ? " live" : recOf(i) ? " on" : "")} onClick={() => toggleRec(i)}>{recording === i ? "■ stop" : recOf(i) ? "🎤 re-record" : "🎤 record this page"}</button>
                  {recOf(i) && recording !== i && <span className="legend">✓ {Math.round(recOf(i).ms / 1000)}s in your voice</span>}
                  {recOf(i) && recording !== i && (timedOk(i) ? <span className="legend ok">✓ words timed: the story can stop right before the magic word</span> : <button className="linkbtn" onClick={() => startTiming(i)}>{timing === i ? "▶ playing… tap each word as you hear it" : "time the words: play and tap along"}</button>)}
                  {timing === i && <div className="chips">{wordsOf(i).map((w, k) => <button key={k} className={"tog" + ((times[keys[i]]?.length ?? 0) > k ? " on" : "")} onClick={() => tapWord(i, k)}>{w}</button>)}</div>}
                  {!recOf(i) && recording !== i && <span className="legend">or leave it: the phone reads it</span>}
                </div>
              )}
              <div className="row wrap">
                <span className="legend">Magic word:</span>
                {candidates[i].length === 0 && <span className="legend">none here yet — try adding one of: <b>{examples.join(", ")}</b> so {kid.name} gets a turn on this page.</span>}
                {candidates[i].map((w) => <button key={w} className={"tog" + (chosen(i) === w ? " on" : "")} onClick={() => setMagic((prev) => ({ ...prev, [keys[i]]: chosen(i) === w ? null : w }))}>{w}</button>)}
                {candidates[i].length > 0 && <span className="legend">{chosen(i) ? "" : "tap one, or none"}</span>}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="pc">
        <label className="lbl">Moral, said by the grown-up <input value={moral} onChange={(e) => setMoral(e.target.value)} placeholder="Wait for the mango to fall by itself." /></label>
        <label className="lbl">{kid.name}'s line to read back <input value={line} onChange={(e) => setLine(e.target.value)} placeholder={kid.tricky.includes("is") ? "It is sad." : kid.gpcs.length >= 8 ? "Sam sat in a pit." : "Pat sat."} /></label>
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
