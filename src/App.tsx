import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import { storyMachine } from "./machine/story.machine";
import type { Page, Story } from "./lib/content/types";
import { DEFAULT_LEVEL, GRAPHEME_SOUND, LEVELS } from "./lib/phonics/learner";
import { checkLine, checkWord, normalise } from "./lib/phonics/validator";
import { playClip, playNarration, stopAll, unlock, type Playing } from "./lib/audio/player";
import storyJson from "../library/fox-and-crow/story.json";

const STORY = storyJson as unknown as Story;
const BASE = `/library/${STORY.slug}/`;
const learner = LEVELS[STORY.level] ?? LEVELS[DEFAULT_LEVEL];

type Prompts = Record<string, { audio: string; ms: number }>;
let promptsCache: Prompts | null = null;
async function prompts(): Promise<Prompts> {
  if (promptsCache) return promptsCache;
  const r = await fetch("/prompts/manifest.json");
  promptsCache = r.ok ? ((await r.json()) as Prompts) : {};
  return promptsCache;
}

export default function App() {
  const [snap, send] = useMachine(storyMachine, { input: { story: STORY } });
  /** "listen": Nani reads with karaoke. "read": audio off — the child (or grown-up) reads; sounds still play on tile taps. */
  const [mode, setMode] = useState<"listen" | "read">("listen");
  const modeRef = useRef(mode); modeRef.current = mode;
  const ctx = snap.context;
  const state = snap.value as string;
  const page: Page | undefined = STORY.pages[ctx.page];
  const playing = useRef<Playing | null>(null);
  const [caption, setCaption] = useState("");

  const speak = useCallback(async (src: string, text?: string) => {
    if (text) setCaption(text);
    playing.current?.stop();
    const p = playNarration(src);
    playing.current = p;
    try { await p.done; } catch { /* missing audio (e.g. dev without generated assets): keep going */ }
  }, []);

  const speakPrompt = useCallback(async (key: string, text: string) => {
    const m = await prompts();
    const s = STORY.prompts?.[key] ? BASE + STORY.prompts[key].audio : m[key] ? `/prompts/${m[key].audio}` : null;
    if (s) await speak(s, text); else setCaption(text);
  }, [speak]);

  // ---- narration with karaoke driven by audio.currentTime ----
  const narratePage = useCallback(async (p: Page, opts: { stopAtMagic: boolean; onDone: () => void }) => {
    if (!p.audio) { opts.onDone(); return; }
    const magicIdx = opts.stopAtMagic ? p.tokens.findIndex((t) => (p.magic ?? []).includes(normalise(t.t))) : -1;
    const stopMs = magicIdx >= 0 ? p.tokens[magicIdx].ms : Infinity;
    playing.current?.stop();
    const pl = playNarration(BASE + p.audio);
    playing.current = pl;
    let raf = 0, last = -1, stopped = false;
    const tick = () => {
      const ms = pl.el.currentTime * 1000;
      if (ms >= stopMs) { pl.stop(); stopped = true; send({ type: "TOKEN", index: magicIdx }); send({ type: "MAGIC_REACHED", word: normalise(p.tokens[magicIdx].t) }); return; }
      let i = -1; for (let k = 0; k < p.tokens.length; k++) if (p.tokens[k].ms <= ms) i = k;
      if (i !== last) { last = i; send({ type: "TOKEN", index: i }); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    try { await pl.done; } catch { /* asset missing */ }
    cancelAnimationFrame(raf);
    if (!stopped) { send({ type: "TOKEN", index: p.tokens.length }); opts.onDone(); }
  }, [send]);

  // drive the machine's audio-bound states
  useEffect(() => {
    const listen = modeRef.current === "listen";
    if (state === "narrating" && page) {
      if (!listen) return;                      // read mode: the page waits for Next
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
    if (state === "magicWord" && ctx.mode === "sight" && listen) {
      void speakPrompt("yours", "… this one is yours.");
    }
    if (state === "moral") {
      if (!listen) { setCaption("Read the line together, then tap ✓."); return; }
      void (async () => { if (STORY.moral.audio) await speak(BASE + STORY.moral.audio, STORY.moral.spoken); await speakPrompt("line", "Now you. Read your line."); })();
    }
    if (state === "done") { if (listen) void speakPrompt("done", "Beautiful reading. This story goes on your shelf."); else setCaption("Beautiful reading."); }
    if (state === "idle") { stopAll(); setCaption(""); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ctx.page]);

  const start = async (m: "listen" | "read") => { setMode(m); modeRef.current = m; await unlock(); send({ type: "START" }); };
  const listen = mode === "listen";

  return (
    <div className="app">
      <header className="top">
        <button className="home" onClick={() => send({ type: "HOME" })} aria-label="Home">⌂</button>
        <div className="title">{state === "idle" ? "StoryTime" : STORY.title}</div>
        <div className="lvl" title="mode">{state === "idle" ? `${learner.gpcs.length} sounds` : listen ? "🔊 Nani reads" : "📖 I read"}</div>
      </header>

      {state === "idle" && <Home onStart={start} />}

      {(state === "narrating" || state === "reread" || state === "magicWord" || state === "modelling") && page && (
        <StoryView
          page={page} pageNo={ctx.page} total={STORY.pages.length} token={listen ? ctx.token : -1} results={ctx.results}
          readMode={!listen}
          onMagicTap={(w) => state === "narrating" && send({ type: "MAGIC_REACHED", word: w })}
          onNext={() => state === "narrating" && send({ type: "PAGE_NEXT" })}
        />
      )}

      {(state === "magicWord" || state === "modelling") && ctx.magic && (
        <MagicPanel
          word={ctx.magic}
          modelling={state === "modelling"}
          onSound={() => send({ type: "SOUND_TAPPED" })}
          onYes={async () => { const w = ctx.magic!; if (listen) await speakPrompt(`yes:${w}`, `Yes! ${w}.`); else setCaption(`Yes! ${w}.`); send({ type: "YES" }); }}
          onNotYet={async () => {
            send({ type: "NOT_YET" });
            if (listen) await speakPrompt("notyet", "That's okay. Listen to me blend it, then you try."); else setCaption("Blend it together slowly, then try again.");
            for (const g of checkWord(ctx.magic!, learner).graphemes) { const s = GRAPHEME_SOUND[g]; try { await playClip(`/sounds/${s.clip}.m4a`).done; } catch { /* placeholder missing */ } }
            if (listen) { await speakPrompt(`word:${ctx.magic}`, ctx.magic!); await speakPrompt("yourturn", "Your turn."); }
            send({ type: "MODEL_DONE" });
          }}
          onSkip={async () => { const w = ctx.magic!; if (listen) await speakPrompt("practise", `${w}. We'll practise it tomorrow.`); else setCaption(`${w}. We'll practise it tomorrow.`); send({ type: "SKIP" }); }}
        />
      )}

      {state === "moral" && <Moral onYes={() => send({ type: "LINE_YES" })} />}
      {state === "done" && <Done results={ctx.results} onHome={() => send({ type: "HOME" })} />}

      <div className="cap" aria-live="polite">{caption}</div>
    </div>
  );
}

function Home({ onStart }: { onStart: (m: "listen" | "read") => void }) {
  const n = STORY.pages.filter((p) => p.magic?.length).length;
  return (
    <main className="home-screen">
      <div className="kicker">Today's story</div>
      <div className="big-tile" role="group" aria-label={STORY.title}>
        <span className="art">🦊</span>
        <span className="t">{STORY.title}</span>
        <span className="s">{n} magic words</span>
      </div>
      <div className="modes">
        <button className="mode" onClick={() => onStart("listen")}><span className="mi">🔊</span><b>Nani reads</b><small>Karaoke story. You read the magic words.</small></button>
        <button className="mode" onClick={() => onStart("read")}><span className="mi">📖</span><b>I read</b><small>Sound off. Read it yourself or with a grown-up.</small></button>
      </div>
      <p className="note">A grown-up sits beside you and taps ✓ or ✗.</p>
    </main>
  );
}

function StoryView({ page, pageNo, total, token, results, readMode, onMagicTap, onNext }: { page: Page; pageNo: number; total: number; token: number; results: { word: string; ok: boolean }[]; readMode: boolean; onMagicTap: (w: string) => void; onNext: () => void }) {
  const pending = (page.magic ?? []).filter((m) => !results.some((r) => r.word === m));
  return (
    <main className="story">
      <div className="art-box"><span>{page.art}</span></div>
      <div className="text-card">
        <div className="pg">Page {pageNo + 1} of {total}</div>
        <p className="sentence">
          {page.tokens.map((t, i) => {
            const n = normalise(t.t);
            const magic = (page.magic ?? []).includes(n);
            const res = results.find((r) => r.word === n);
            const cls = ["w", i === token ? "now" : "", i < token ? "read" : "", magic ? "magic" : "", magic && res ? (res.ok ? "done" : "skipped") : ""].join(" ");
            if (readMode && magic && !res) return <button key={i} className={cls + " tap"} onClick={() => onMagicTap(n)}>{t.t} </button>;
            return <span key={i} className={cls}>{t.t} </span>;
          })}
        </p>
        {readMode && (
          <div className="readbar">
            <span className="hintline">{pending.length ? "Tap the pink word when it's time to read it." : "Read the page, then go on."}</span>
            <button className="next" disabled={pending.length > 0} onClick={onNext}>{pageNo + 1 < total ? "Next page →" : "The end →"}</button>
          </div>
        )}
      </div>
    </main>
  );
}

function MagicPanel({ word, modelling, onSound, onYes, onNotYet, onSkip }: { word: string; modelling: boolean; onSound: () => void; onYes: () => void; onNotYet: () => void; onSkip: () => void }) {
  const gs = useMemo(() => checkWord(word, learner).graphemes, [word]);
  const [said, setSaid] = useState(0);
  useEffect(() => { setSaid(0); }, [word, modelling]);
  const tap = (i: number) => {
    if (modelling) return;
    const g = gs[i]; const s = GRAPHEME_SOUND[g];
    void playClip(`/sounds/${s.clip}.m4a`).done.catch(() => {});
    if (i === said) { setSaid(i + 1); onSound(); if (i + 1 === gs.length) void prompts().then((m) => m.fast && playClip(`/prompts/${m.fast.audio}`)); }
  };
  return (
    <section className="panel" role="dialog" aria-label="Magic word">
      <div className="kicker">Magic word · your turn</div>
      <div className="tiles">
        {gs.map((g, i) => (
          <button key={i} className={["tile", i < said ? "said" : "", i === said && !modelling ? "next" : "", modelling ? "said" : ""].join(" ")} onClick={() => tap(i)} aria-label={`${g}, says ${GRAPHEME_SOUND[g].label}`}>
            <small>{GRAPHEME_SOUND[g].label}</small>{g}
          </button>
        ))}
      </div>
      <div className="verdict">
        <div className="hint">Grown-up: did they say <b>{word}</b>?</div>
        <div className="btns">
          <button className="no" disabled={modelling} onClick={onNotYet}>✗ Not yet</button>
          <button className="yes" disabled={modelling} onClick={onYes}>✓ Yes!</button>
        </div>
        <button className="skip" disabled={modelling} onClick={onSkip}>skip for today →</button>
      </div>
    </section>
  );
}

function Moral({ onYes }: { onYes: () => void }) {
  const line = checkLine(STORY.moral.line, learner);
  return (
    <main className="moral">
      <div className="kicker">The end</div>
      <p className="spoken">“{STORY.moral.spoken}”</p>
      <div className="kicker">Now you read your line</div>
      <p className="line">
        {line.results.map((r, i) => (
          <button key={i} className={"lw " + (r.ok && r.kind === "tricky" ? "tricky" : "magic")} onClick={() => { if (r.ok && r.kind === "decodable") for (const g of r.graphemes) void playClip(`/sounds/${GRAPHEME_SOUND[g].clip}.m4a`); }}>
            {STORY.moral.line.split(/\s+/)[i]}
          </button>
        ))}
      </p>
      <div className="legend"><i className="sw magic" /> sound it out <i className="sw tricky" /> tricky word you know</div>
      <div className="btns"><button className="yes" onClick={onYes}>✓ They read it!</button></div>
    </main>
  );
}

function Done({ results, onHome }: { results: { word: string; ok: boolean; mode: string }[]; onHome: () => void }) {
  const ok = results.filter((r) => r.ok).length;
  return (
    <main className="done">
      <div className="art-box big"><span>🏆</span></div>
      <h2>{STORY.title}</h2>
      <p>{ok} of {results.length} magic words read</p>
      <ul className="results">{results.map((r) => <li key={r.word} className={r.ok ? "ok" : "no"}>{r.word} · {r.ok ? r.mode : "skipped"}</li>)}</ul>
      <div className="btns"><button className="yes" onClick={onHome}>Home</button></div>
    </main>
  );
}
