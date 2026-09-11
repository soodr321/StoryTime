import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import { storyMachine, type WordResult } from "../machine/story.machine";
import type { Page, Story } from "../lib/content/types";
import { GRAPHEME_SOUND } from "../lib/phonics/learner";
import { checkLine, checkWord, normalise, type LearnerModel } from "../lib/phonics/validator";
import { playClip, playNarration, stopAll, unlock, type Playing } from "../lib/audio/player";
import { promptAsset, soundAsset, storyAsset } from "../lib/library";
import { speakText, type SpeakHandle } from "../lib/audio/speech";
import { useFamily } from "../lib/family";
import { learnerOf } from "../lib/store";
import type { Mode } from "./Home";

type Prompts = Record<string, { audio: string; ms: number }>;
let promptsCache: Prompts | null = null;
async function prompts(): Promise<Prompts> {
  if (promptsCache) return promptsCache;
  try { const r = await fetch(promptAsset("manifest.json")); promptsCache = r.ok ? ((await r.json()) as Prompts) : {}; } catch { promptsCache = {}; }
  return promptsCache;
}

export function StoryScreen({ story, mode, resume, onHome }: { story: Story; mode: Mode; resume: boolean; onHome: () => void }) {
  const fam = useFamily();
  const kid = fam.activeKid!;
  const learner = useMemo(() => learnerOf(kid), [kid]);
  const listener = kid.role === "listener";
  const listen = mode === "listen";
  const bedtime = fam.settings.bedtime;
  const reader = fam.settings.readers[0] ?? "Grown-up";

  const init = resume && fam.session?.slug === story.slug ? { page: fam.session.page, results: fam.session.results as WordResult[] } : {};
  const [snap, send] = useMachine(storyMachine, { input: { story, ...init } });
  const ctx = snap.context;
  const state = snap.value as string;
  const page: Page | undefined = story.pages[ctx.page];
  const playing = useRef<Playing | SpeakHandle | null>(null);
  const [caption, setCaption] = useState("");
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  // ---- persistence: save the session at every page/result change; clear on finish ----
  useEffect(() => {
    if (state === "idle" || state === "done") return;
    fam.setSession({ kidId: kid.id, slug: story.slug, mode, page: ctx.page, results: ctx.results, updatedAt: Date.now() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.page, ctx.results.length, state]);

  const rate = bedtime ? 0.88 : 1;
  const speak = useCallback(async (src: string | null, text?: string) => {
    if (text) setCaption(text);
    playing.current?.stop();
    if (src) { const p = playNarration(src); p.el.playbackRate = rate; playing.current = p; try { await p.done; } catch { /* asset missing: keep going */ } }
    else if (text) { const h = speakText(text, { rate }); playing.current = h; await h.done; }
  }, [rate]);

  const speakPrompt = useCallback(async (key: string, text: string) => {
    const m = await prompts();
    const s = story.prompts?.[key] ? storyAsset(story, story.prompts[key].audio) : m[key] ? promptAsset(m[key].audio) : null;
    await speak(s, text);
  }, [speak, story]);

  // ---- narration with karaoke driven by the audio clock (or Web Speech boundaries for family stories) ----
  const narratePage = useCallback(async (p: Page, opts: { stopAtMagic: boolean; onDone: () => void }) => {
    const magicIdx = opts.stopAtMagic && !listener ? p.tokens.findIndex((t) => (p.magic ?? []).includes(normalise(t.t))) : -1;
    playing.current?.stop();
    let stopped = false;
    const reachMagic = () => { stopped = true; send({ type: "TOKEN", index: magicIdx }); send({ type: "MAGIC_REACHED", word: normalise(p.tokens[magicIdx].t) }); };

    if (p.audio) {
      const stopMs = magicIdx >= 0 ? p.tokens[magicIdx].ms : Infinity;
      const pl = playNarration(storyAsset(story, p.audio)); pl.el.playbackRate = rate; playing.current = pl;
      let raf = 0, last = -1;
      const tick = () => {
        const ms = pl.el.currentTime * 1000;
        if (ms >= stopMs) { pl.stop(); reachMagic(); return; }
        let i = -1; for (let k = 0; k < p.tokens.length; k++) if (p.tokens[k].ms <= ms) i = k;
        if (i !== last) { last = i; send({ type: "TOKEN", index: i }); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      try { await pl.done; } catch { /* asset missing */ }
      cancelAnimationFrame(raf);
    } else {
      // family story: on-device speech with word boundaries
      const text = p.tokens.map((t) => t.t).join(" ");
      const h = speakText(text, { rate, onWord: (i) => { if (magicIdx >= 0 && i >= magicIdx) { h.stop(); reachMagic(); return; } send({ type: "TOKEN", index: i }); } });
      playing.current = h; await h.done;
    }
    // a magic word that ends the page can be missed by the clock check when the audio ends first
    if (!stopped && magicIdx >= 0) { reachMagic(); return; }
    if (!stopped) { send({ type: "TOKEN", index: p.tokens.length }); opts.onDone(); }
  }, [send, story, listener, rate]);

  useEffect(() => {
    if (state === "narrating" && page) {
      if (!listen) return;
      let live = true;
      void narratePage(page, { stopAtMagic: true, onDone: () => { if (live) send({ type: "NARRATION_DONE" }); } });
      return () => { live = false; };
    }
    if (state === "reread" && page) {
      if (!listen) { send({ type: "RESUME" }); return; }
      let live = true;
      void narratePage(page, { stopAtMagic: false, onDone: () => live && send({ type: "REREAD_DONE" }) });
      return () => { live = false; };
    }
    if (state === "magicWord" && ctx.mode === "sight" && listen) void speakPrompt("yours", "… this one is yours. Can you read it?");
    if (state === "moral") {
      if (!listen) { setCaption("Read the line together, then tap ✓."); return; }
      void (async () => { await speak(story.moral.audio ? storyAsset(story, story.moral.audio) : null, story.moral.spoken); if (!listener) await speakPrompt("line", "Now you. Read your line."); })();
    }
    if (state === "done") {
      if (!finishedRef.current) { finishedRef.current = true; void fam.finish(kid.id, story.slug, ctx.results); }
      if (listen) void speakPrompt("done", "Beautiful reading. This story goes on your shelf."); else setCaption("Beautiful reading.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ctx.page]);

  // start once mounted (the Home tap was the gesture that unlocked audio)
  useEffect(() => { if (!startedRef.current) { startedRef.current = true; void unlock().then(() => send({ type: "START" })); } return () => { stopAll(); playing.current?.stop(); }; }, [send]);

  const home = () => { playing.current?.stop(); stopAll(); onHome(); };
  const inStory = state === "narrating" || state === "reread" || state === "magicWord" || state === "modelling";

  return (
    <div className={"screen-wrap" + (bedtime ? " bedtime" : "")}>
      <header className="top">
        <button className="home" onClick={home} aria-label="Home">⌂</button>
        <div className="title">{story.title}</div>
        <div className="lvl">{listen ? (bedtime ? "🌙 bedtime" : "🔊 listen") : "📖 read"}</div>
      </header>

      {inStory && page && (
        <StoryView
          page={page} pageNo={ctx.page} total={story.pages.length} token={listen ? ctx.token : -1} results={ctx.results}
          readMode={!listen} listener={listener} reader={reader} kid={kid.name}
          onMagicTap={(w) => state === "narrating" && send({ type: "MAGIC_REACHED", word: w })}
          onWordTap={(tok) => { if ((listener || !listen) && state !== "narrating" && state !== "reread") { setCaption(tok); const h = speakText(tok, { rate }); playing.current = h; } else if (listener && listen) setCaption(tok); }}
          onNext={() => state === "narrating" && send({ type: "PAGE_NEXT" })}
        />
      )}

      {(state === "magicWord" || state === "modelling") && ctx.magic && (
        <MagicPanel
          word={ctx.magic} learner={learner} modelling={state === "modelling"} kid={kid.name}
          onSound={() => send({ type: "SOUND_TAPPED" })}
          onYes={async () => { const w = ctx.magic!; if (listen) await speakPrompt(`yes:${w}`, `Yes! ${w}.`); else setCaption(`Yes! ${w}.`); send({ type: "YES" }); }}
          onTogether={async () => {
            send({ type: "NOT_YET" });
            if (listen) await speakPrompt("notyet", "That's okay. Listen to me blend it, then you try."); else setCaption("Blend it together slowly, then try again.");
            for (const g of checkWord(ctx.magic!, learner).graphemes) { try { const c = playClip(soundAsset(GRAPHEME_SOUND[g].clip)); await c.done; } catch { /* clip missing */ } }
            if (listen) { await speakPrompt(`word:${ctx.magic}`, ctx.magic!); await speakPrompt("yourturn", "Your turn."); }
            send({ type: "MODEL_DONE" });
          }}
          onSkip={async () => { const w = ctx.magic!; if (listen) await speakPrompt("practise", `${w}. We'll practise it tomorrow.`); else setCaption(`${w}. We'll practise it tomorrow.`); send({ type: "SKIP" }); }}
        />
      )}

      {state === "moral" && <Moral story={story} learner={learner} listener={listener} onYes={() => send({ type: "LINE_YES" })} />}
      {state === "done" && <Done story={story} results={ctx.results} bedtime={bedtime} kid={kid.name} onHome={home} />}

      <div className="cap" aria-live="polite">{caption}</div>
    </div>
  );
}

function StoryView({ page, pageNo, total, token, results, readMode, listener, reader, kid, onMagicTap, onWordTap, onNext }: {
  page: Page; pageNo: number; total: number; token: number; results: { word: string; ok: boolean }[];
  readMode: boolean; listener: boolean; reader: string; kid: string;
  onMagicTap: (w: string) => void; onWordTap: (tok: string) => void; onNext: () => void;
}) {
  const pending = listener ? [] : (page.magic ?? []).filter((m) => !results.some((r) => r.word === m));
  return (
    <main className="story">
      <div className="art-box">{page.art.startsWith("data:") ? <img src={page.art} alt="" /> : <span>{page.art}</span>}</div>
      <div className="text-card">
        <div className="pg">Page {pageNo + 1} of {total}</div>
        <p className="sentence">
          {page.tokens.map((t, i) => {
            const n = normalise(t.t);
            const magic = !listener && (page.magic ?? []).includes(n);
            const res = results.find((r) => r.word === n);
            const cls = ["w", i === token ? "now" : "", i < token ? "read" : "", magic ? "magic" : "", magic && res ? (res.ok ? "done" : "skipped") : ""].join(" ");
            if (readMode && magic && !res) return <button key={i} className={cls + " tap"} onClick={() => onMagicTap(n)}>{t.t} </button>;
            if (listener || readMode) return <button key={i} className={cls + " tap"} onClick={() => onWordTap(t.t)}>{t.t} </button>;
            return <span key={i} className={cls}>{t.t} </span>;
          })}
        </p>
        {readMode && (
          <div className="readbar">
            <span className="script">{pending.length ? <><b>{reader}</b> reads the story. <b>{kid}</b> reads the <em className="pinkword">pink word</em>: tap it when it's time.</> : <><b>{reader}</b> reads the page. Then go on.</>}</span>
            <button className="next" disabled={pending.length > 0} onClick={onNext}>{pageNo + 1 < total ? "Next page →" : "The end →"}</button>
          </div>
        )}
        {listener && !readMode && <div className="readbar"><span className="script">When the page is done, tap any word to hear it again.</span></div>}
      </div>
    </main>
  );
}

function MagicPanel({ word, learner, modelling, kid, onSound, onYes, onTogether, onSkip }: { word: string; learner: LearnerModel; modelling: boolean; kid: string; onSound: () => void; onYes: () => void; onTogether: () => void; onSkip: () => void }) {
  const gs = useMemo(() => checkWord(word, learner).graphemes, [word, learner]);
  const [said, setSaid] = useState(0);
  useEffect(() => { setSaid(0); }, [word, modelling]);
  const tap = (i: number) => {
    if (modelling) return;
    const g = gs[i];
    void playClip(soundAsset(GRAPHEME_SOUND[g].clip)).done.catch(() => {});
    if (i === said) { setSaid(i + 1); onSound(); if (i + 1 === gs.length) void prompts().then((m) => m.fast && playClip(promptAsset(m.fast.audio))); }
  };
  return (
    <section className="panel" role="dialog" aria-label="Magic word">
      <div className="kicker">Magic word · {kid}'s turn</div>
      <div className="tiles">
        {gs.map((g, i) => (
          <button key={i} className={["tile", i < said || modelling ? "said" : "", i === said && !modelling ? "next" : ""].join(" ")} onClick={() => tap(i)} aria-label={`${g}, says ${GRAPHEME_SOUND[g].label}`}>
            <small>{GRAPHEME_SOUND[g].label}</small>{g}
          </button>
        ))}
      </div>
      <div className="verdict">
        <div className="hint">Grown-up: did {kid} say <b>{word}</b>?</div>
        <div className="btns">
          <button className="no" disabled={modelling} onClick={onTogether}>Say it together</button>
          <button className="yes" disabled={modelling} onClick={onYes}>✓ Yes!</button>
        </div>
        <button className="skip" disabled={modelling} onClick={onSkip}>skip for today →</button>
      </div>
    </section>
  );
}

function Moral({ story, learner, listener, onYes }: { story: Story; learner: LearnerModel; listener: boolean; onYes: () => void }) {
  const line = checkLine(story.moral.line, learner);
  const words = story.moral.line.split(/\s+/);
  return (
    <main className="moral">
      <div className="kicker">The end</div>
      <p className="spoken">“{story.moral.spoken}”</p>
      {!listener && (
        <>
          <div className="kicker">Now you read your line</div>
          <p className="line">
            {line.results.map((r, i) => (
              <button key={i} className={"lw " + (r.ok && r.kind === "tricky" ? "tricky" : "magic")} onClick={() => { if (r.ok && r.kind === "decodable") for (const g of r.graphemes) void playClip(soundAsset(GRAPHEME_SOUND[g].clip)); else speakText(words[i], {}); }}>
                {words[i]}
              </button>
            ))}
          </p>
          <div className="legend"><i className="sw magic" /> sound it out <i className="sw tricky" /> tricky word you know · tap a word for help</div>
        </>
      )}
      <div className="btns"><button className="yes" onClick={onYes}>{listener ? "The end ✓" : "✓ They read it!"}</button></div>
    </main>
  );
}

function Done({ story, results, bedtime, kid, onHome }: { story: Story; results: { word: string; ok: boolean; mode: string }[]; bedtime: boolean; kid: string; onHome: () => void }) {
  const ok = results.filter((r) => r.ok).length;
  return (
    <main className="done">
      {!bedtime && <Confetti />}
      <div className="art-box big"><span>{bedtime ? "🌙" : "🏆"}</span></div>
      <h2>{story.title}</h2>
      {results.length > 0 && <p>{ok} of {results.length} magic words read</p>}
      {results.length > 0 && <ul className="results">{results.map((r) => <li key={r.word} className={r.ok ? "ok" : "no"}>{r.word}{r.ok ? "" : " · tomorrow"}</li>)}</ul>}
      <p className="show">{bedtime ? `Lights low. One real book, then sleep.` : results.length ? `Now go find someone and read them your ${results.length === 1 ? "magic word" : "magic words"}, ${kid}!` : `Great listening, ${kid}!`}</p>
      <div className="btns"><button className="yes" onClick={onHome}>Done</button></div>
    </main>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ l: (i * 37) % 100, d: (i % 6) * 0.15, c: ["#f3c7e6", "#d8ecd2", "#ffe9a8", "#dbe7f7"][i % 4] })), []);
  return <div className="confetti" aria-hidden>{bits.map((b, i) => <i key={i} style={{ left: `${b.l}%`, animationDelay: `${b.d}s`, background: b.c }} />)}</div>;
}
