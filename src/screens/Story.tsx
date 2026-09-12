import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import { storyMachine, type WordResult } from "../machine/story.machine";
import type { Page, Story } from "../lib/content/types";
import { TRICKY_PARTS } from "../lib/phonics/learner";
import { checkLine, checkWord, normalise, type LearnerModel } from "../lib/phonics/validator";
import { playNarration, stopAll, unlock, type Playing } from "../lib/audio/player";
import { promptAsset, storyAsset } from "../lib/library";
import { speakText, type SpeakHandle } from "../lib/audio/speech";
import { useFamily } from "../lib/family";
import { learnerOf } from "../lib/store";
import { Art } from "../components/Art";
import { MagicPanel } from "../components/MagicPanel";
import { stretched, playBlend, stopBlend } from "../lib/blend";
import { SegmentPanel } from "../components/SegmentPanel";
import type { Verdict } from "../components/MagicPanel";
import type { Mode } from "./Home";
import { advanceCursor, hitWord, type WordRect } from "../lib/follow";
import { pickIllTry } from "../lib/phonics/illtry";
import { magicTokens, resolveMagic } from "../lib/phonics/target";
import { designed, volunteered } from "../lib/results";
import { align } from "../lib/voice/align";
import { startVoice, voiceSupported, type VoiceSession, type VoiceState } from "../lib/voice/session";
import { BookIcon, HomeIcon, LockIcon, MoonIcon, SpeakerIcon, CheckIcon } from "../components/Icons";

type Prompts = Record<string, { audio: string; ms: number }>;
let promptsCache: Prompts | null = null;
async function prompts(): Promise<Prompts> {
  if (promptsCache) return promptsCache;
  try { const r = await fetch(promptAsset("manifest.json")); promptsCache = r.ok ? ((await r.json()) as Prompts) : {}; } catch { promptsCache = {}; }
  return promptsCache;
}
const isUrl = (a: string) => /^(data|blob):/.test(a);

export function StoryScreen({ story, mode, resume, onHome }: { story: Story; mode: Mode; resume: boolean; onHome: () => void }) {
  const fam = useFamily();
  const kid = fam.activeKid!;
  const learner = useMemo(() => learnerOf(kid), [kid]);
  const listenAlong = fam.listensAlong(kid);   // a reader with fewer than four sounds: a real book, read to them, nothing to decode yet
  const listener = kid.role === "listener" || listenAlong;
  const listen = mode === "listen";
  const bedtime = fam.settings.bedtime;
  const reader = fam.settings.tonight ?? fam.settings.readers[0] ?? "Grown-up";

  const init = resume && fam.session?.slug === story.slug ? { page: fam.session.page, results: fam.session.results as WordResult[] } : {};
  const [snap, send] = useMachine(storyMachine, { input: { story, ...init } });
  const ctx = snap.context;
  const state = snap.value as string;
  const page: Page | undefined = story.pages[ctx.page];
  const playing = useRef<Playing | SpeakHandle | null>(null);
  const [caption, setCaption] = useState("");
  const [stalled, setStalled] = useState(false);
  const [pageHeld, setPageHeld] = useState(false);
  const [retry, setRetry] = useState(0);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const runRef = useRef(0);
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    if (state === "idle" || state === "done") return;
    void fam.setSession({ kidId: kid.id, slug: story.slug, mode, page: ctx.page, results: ctx.results, updatedAt: Date.now() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.page, ctx.results.length, state]);

  const rate = bedtime ? 0.88 : 1;
  const speak = useCallback(async (src: string | null, text?: string) => {
    if (text) setCaption(text);
    playing.current?.stop();
    if (src) { const p = playNarration(src, rate); playing.current = p; try { await p.done; } catch { /* caption is enough */ } }
    else if (text) { const h = speakText(text, { rate }); playing.current = h; await h.done; }
  }, [rate]);
  const speakPrompt = useCallback(async (key: string, text: string) => {
    const m = await prompts();
    const s = story.prompts?.[key] ? storyAsset(story, story.prompts[key].audio) : m[key] ? promptAsset(m[key].audio) : null;
    await speak(s, text);
  }, [speak, story]);

  /** first magic token on this page whose occurrence (page:word) has not been graded */
  const doneIds = useMemo(() => new Set(ctx.results.map((r) => r.id ?? "")), [ctx.results]);
  const pendingMagicIdx = useCallback((p: Page, pageNo: number) => { if (listener) return -1; for (const w of p.magic ?? []) { const i = resolveMagic(p, w); if (i >= 0 && !doneIds.has(`${pageNo}:${i}`)) return i; } return -1; }, [listener, doneIds]);

  const narratePage = useCallback(async (p: Page, pageNo: number, opts: { stopAtMagic: boolean; onDone: () => void }): Promise<void> => {
    const magicIdx = opts.stopAtMagic ? pendingMagicIdx(p, pageNo) : -1;
    const run = ++runRef.current; const alive = () => run === runRef.current;
    playing.current?.stop();
    let stopped = false;
    const reachMagic = () => { stopped = true; send({ type: "TOKEN", index: magicIdx }); send({ type: "MAGIC_REACHED", word: normalise(p.tokens[magicIdx].t), index: magicIdx }); };

    const untimed = !p.tokens.some((t) => t.ms > 0);
    if (p.audio && !(untimed && magicIdx >= 0)) {   // a parent recording has no word timings: it cannot stop cleanly before the magic word, so the first pass uses speech and the recording plays on the reread
      const src = isUrl(p.audio) ? p.audio : storyAsset(story, p.audio);
      const pl = playNarration(src, rate); playing.current = pl;
      const timed = p.tokens.some((t) => t.ms > 0);
      const durMs = () => (isFinite(pl.el.duration) && pl.el.duration > 0 ? pl.el.duration * 1000 : p.audioMs ?? Infinity);
      const tokMs = (i: number) => (timed ? p.tokens[i].ms : durMs() !== Infinity ? (durMs() * i) / p.tokens.length : Infinity);
      const stopMsAt = () => (magicIdx >= 0 ? (timed ? tokMs(magicIdx) : tokMs(magicIdx) - 350) : Infinity);
      let last = -1;
      // interval, not rAF: the magic-word stop must fire even when the phone screen dims or the tab is backgrounded
      const raf = setInterval(() => {
        const ms = pl.el.currentTime * 1000; const stopMs = stopMsAt();
        if (ms >= stopMs) { clearInterval(raf); pl.stop(); reachMagic(); return; }
        let i = -1; for (let k = 0; k < p.tokens.length; k++) if (tokMs(k) <= ms) i = k;
        if (i !== last) { last = i; send({ type: "TOKEN", index: i }); }
      }, 40);
      const stall = new Promise<"stall">((res) => setTimeout(() => res("stall"), 5000));
      const deadline = new Promise<"deadline">((res) => setTimeout(() => res("deadline"), ((p.audioMs ?? 20000) / rate) + 1500));
      let ok = true;
      try { const r = await Promise.race([pl.done.then(() => "done" as const), stall.then(() => (pl.el.currentTime === 0 ? "stall" : pl.done.then(() => "done" as const))), deadline]); if (r === "stall") ok = false; if (r === "deadline") pl.stop(); } catch { ok = false; }
      clearInterval(raf);
      if (!alive()) return;
      if (!ok) { pl.stop(); setStalled(true); setCaption("Tap ▶ to hear this page."); return; }
    } else {
      const upto = magicIdx >= 0 ? magicIdx : p.tokens.length;
      const text = p.tokens.slice(0, upto).map((t) => t.t).join(" ");
      if (text) { const h = speakText(text, { rate, onWord: (i) => alive() && send({ type: "TOKEN", index: i }) }); playing.current = h; await h.done; }
      if (!alive()) return;
      if (magicIdx >= 0) { reachMagic(); return; }
    }
    if (!alive()) return;
    if (!stopped && magicIdx >= 0) { reachMagic(); return; }
    if (!stopped) { send({ type: "TOKEN", index: p.tokens.length }); if (magicIdx < 0 && opts.stopAtMagic) await new Promise((r) => setTimeout(r, 1400)); if (alive()) opts.onDone(); }
  }, [send, story, rate, pendingMagicIdx]);

  useEffect(() => {
    setStalled(false); setPageHeld(false);
    if (state === "narrating" && page) {
      if (!listen) return;
      let live = true;
      const onDone = () => { if (!live) return; if (listener) setPageHeld(true); else send({ type: "NARRATION_DONE" }); };
      void narratePage(page, ctx.page, { stopAtMagic: true, onDone });
      return () => { live = false; };
    }
    if (state === "reread" && page) {
      if (!listen) { send({ type: "RESUME" }); return; }
      let live = true;
      void narratePage(page, ctx.page, { stopAtMagic: false, onDone: () => live && send({ type: "REREAD_DONE" }) });
      return () => { live = false; };
    }
    if (state === "magicWord" && ctx.mode !== "modelled" && listen) void speakPrompt("yours", "… this one is yours. Start at the first sound and slide through the word.");
    if (state === "moral") {
      if (!listen) { setCaption(`${reader} reads the moral. Then ${kid.name} tries the whole line.`); return; }
      void (async () => { await speak(story.moral.audio ? (isUrl(story.moral.audio) ? story.moral.audio : storyAsset(story, story.moral.audio)) : null, story.moral.spoken); if (!listener) await speakPrompt("line", "Now you. Read your line."); })();
    }
    if (state === "done") {
      if (!finishedRef.current) { finishedRef.current = true; void fam.finish(kid.id, story.slug, ctx.results, { listenOnly: listenAlong }); }
      const okWords = ctx.results.filter((r) => r.ok).map((r) => r.word);
      const said = okWords.length ? `You blended ${okWords.join(", ")}.` : "Good listening. Those words come back tomorrow.";
      setCaption(said); if (listen) { const h = speakText(said, { rate }); playing.current = h; }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ctx.page, retry]);

  useEffect(() => { if (!startedRef.current) { startedRef.current = true; void unlock().then(() => send({ type: "START" })); } return () => { stopAll(); stopBlend(); playing.current?.stop(); }; }, [send]);

  const home = () => { runRef.current++; playing.current?.stop(); stopAll(); stopBlend(); onHome(); };
  const inStory = state === "narrating" || state === "reread" || state === "magicWord" || state === "modelling";
  const panelOpen = (state === "magicWord" || state === "modelling") && !!ctx.magic;

  /** continuous-blend model, then hand the word back */
  const together = async () => {
    const run = ++runRef.current; const alive = () => run === runRef.current;
    const word = ctx.magic!; const gs = checkWord(word, learner).graphemes;
    send({ type: "NOT_YET" });
    if (listen) await speakPrompt("notyet", "That's okay. Listen: I'll slide through the sounds, then you try."); else setCaption(`${reader}: slide through the sounds and let them run into the word (bouncy sounds like t and p stay short).`);
    if (!alive()) return;
    setCaption(stretched(gs) + " …");
    if (listen) await playBlend(gs, { alive, rate, onProgress: setSweep });
    else { const n = gs.length * 12; for (let i = 1; i <= n; i++) { await new Promise((r) => setTimeout(r, 70)); if (!alive()) return; setSweep(i / n); } }   // sound off: the app must not talk over the grown-up
    setSweep(0);
    if (!alive()) return;
    // the model may end in the whole word (that is what a model is); it is recorded as "modelled", never as known
    if (listen) await speakPrompt("yourturn", "Your turn: start here and slide through the word."); else setCaption(`Now ${kid.name}: start at the first sound and slide through the word.`);
    if (alive()) send({ type: "MODEL_DONE" });
  };

  return (
    <div className={"screen-wrap" + (panelOpen ? " panel-open" : "")}>
      <header className="top">
        <button className="home" onClick={home} aria-label="Home"><HomeIcon /></button>
        <div className="title">{story.title}</div>
        <div className="lvl">{listen ? (bedtime ? <><MoonIcon size={16} /> bedtime</> : <><SpeakerIcon size={16} /> listen</>) : <><BookIcon size={16} /> read</>}</div>
      </header>

      {inStory && page && (
        <StoryView
          page={page} pageNo={ctx.page} total={story.pages.length} token={listen ? ctx.token : -1} results={ctx.results}
          readMode={!listen} listener={listener} reader={reader} kid={kid.name} stalled={stalled} pageHeld={pageHeld} hideArt={panelOpen} learner={learner} bedtime={bedtime} voiceFollow={!!fam.settings.voiceFollow && !bedtime}
          onRetry={() => { void unlock(); setStalled(false); setRetry((n) => n + 1); }}
          onMagicTap={(w, i, extra) => state === "narrating" && send({ type: "MAGIC_REACHED", word: w, index: i, extra })}
          onWordTap={(tok) => { if (listener || !listen) { if (state === "narrating" && listen && !pageHeld) return; setCaption(tok); const h = speakText(tok, { rate }); playing.current = h; } }}
          onNext={() => state === "narrating" && send({ type: "PAGE_NEXT" })}
        />
      )}

      {panelOpen && (
        <MagicPanel
          word={ctx.magic!} learner={learner} modelling={state === "modelling"} modelledOnce={ctx.mode === "modelled"} sweep={sweep} kid={kid.name} reader={reader}
          extra={ctx.extra} kicker={ctx.extra ? `Extra word · ${kid.name} asked for this one` : undefined}
          modelScript={listen ? undefined : `${reader}: slide through the sounds and let them run into the word. Bouncy sounds like t and p stay short. Then ${kid.name} tries alone.`}
          onDismiss={!listen ? () => send({ type: "DISMISS" }) : undefined}
          onSound={() => send({ type: "SOUND_TAPPED" })}
          onYes={async (v: Verdict) => { const w = ctx.magic!; if (listen) await speakPrompt(`yes:${w}`, `Yes! ${w}.`); else setCaption(`Yes! ${w}.`); send({ type: "YES", verdict: v }); }}
          onTogether={together}
          onSkip={async () => { const w = ctx.magic!; setCaption("We'll practise it tomorrow." + (listen ? "" : ` ${reader}, read the word for them once.`)); if (listen) { await playBlend(checkWord(w, learner).graphemes, { rate }); await speakPrompt("practise", "We'll practise it tomorrow."); } send({ type: "SKIP" }); }}
        />
      )}

      {state === "moral" && <Moral story={story} learner={learner} listener={listener} kid={kid.name} reader={reader} listen={listen} bedtime={bedtime} setCaption={setCaption} buildWord={fam.pendingBuild ?? designed(ctx.results).find((r) => r.ok && r.mode === "first_try")?.word ?? null} onBuilt={(w, ok) => fam.encodingDone(story.slug, w, ok)} onYes={() => send({ type: "LINE_YES" })} />}
      {state === "done" && <Done story={story} results={ctx.results} bedtime={bedtime} kid={kid.name} learner={learner} onHome={home} />}

      <div className="cap" aria-live="polite">{caption}</div>
      {fam.toast && <div className="toast" role="status">{fam.toast}</div>}
    </div>
  );
}

function StoryView({ page, pageNo, total, token, results, readMode, listener, reader, kid, stalled, pageHeld, hideArt, learner, bedtime, voiceFollow, onRetry, onMagicTap, onWordTap, onNext }: {
  page: Page; pageNo: number; total: number; token: number; results: WordResult[];
  readMode: boolean; listener: boolean; reader: string; kid: string; stalled: boolean; pageHeld: boolean; hideArt: boolean; learner: LearnerModel; bedtime: boolean; voiceFollow: boolean;
  onRetry: () => void; onMagicTap: (w: string, i: number, extra?: boolean) => void; onWordTap: (tok: string) => void; onNext: () => void;
}) {
  const resAt = (i: number) => results.find((r) => r.id === `${pageNo}:${i}`);
  const firstIdx = new Set((page.magic ?? []).map((w) => resolveMagic(page, w)).filter((i) => i >= 0));   // the same resolver the narration stop uses
  const pending = listener ? [] : [...firstIdx].filter((i) => i >= 0 && !resAt(i));
  // trailing punctuation sits outside the highlight: the child decodes letters, not full stops
  const split = (tok: string) => { const m = tok.match(/^([^A-Za-z]*)([A-Za-z]+(?:['’][A-Za-z]+)?)([^A-Za-z]*)$/); return m ? [m[1], m[2], m[3]] : ["", tok, ""]; };
  const last = pageNo + 1 >= total;

  // finger-follow (read mode): pointer = word under the finger, cursor = the adult's reading position
  const sentenceRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);   // the finger travels under the print, so the whole card listens
  const [pointer, setPointer] = useState(-1);
  const [cursor, setCursor] = useState(-1);
  const drag = useRef<{ x: number; y: number; on: boolean; rects: WordRect[]; id: number } | null>(null);
  useEffect(() => { setPointer(-1); setCursor(-1); drag.current = null; }, [pageNo]);
  const blocked = (i: number) => firstIdx.has(i) && !resAt(i);
  const land = (i: number) => { if (i < 0) return; setPointer(i); setCursor((c) => advanceCursor(c, i, blocked)); };
  const measure = (): WordRect[] => Array.from(sentenceRef.current?.querySelectorAll<HTMLElement>("[data-i]") ?? []).map((el) => { const b = el.getBoundingClientRect(); return { index: Number(el.dataset.i), left: b.left, right: b.right, top: b.top, bottom: b.bottom }; });
  const onDown = (e: React.PointerEvent) => { if (!readMode) return; drag.current = { x: e.clientX, y: e.clientY, on: false, rects: [], id: e.pointerId }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !readMode) return;
    if (!d.on) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return; d.on = true; d.rects = measure(); try { cardRef.current?.setPointerCapture(d.id); } catch { /* not supported */ } }   // a tap stays a tap: the pink button still clicks
    land(hitWord(d.rects, e.clientX, e.clientY));
  };
  const onUp = () => { drag.current = null; };
  const wordCls = (i: number, base: string) => (readMode ? base + (i === pointer ? " now" : i <= cursor ? " read" : "") : base);

  // "I'll try": one extra decodable word per page, chosen on page open, offered only until the grown-up has read past it
  const extra = useMemo(() => (readMode && !listener && !bedtime ? pickIllTry(page, learner, magicTokens(page), (i) => !!resAt(i)) : -1),   // never a copy of the designed word, never at bedtime
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [page, pageNo, readMode, listener, learner, bedtime]);

  // follow my voice (opt-in): the recogniser only ever moves the cursor forward, never onto the pending child word
  const [voice, setVoice] = useState<VoiceState>("off");
  const session = useRef<VoiceSession | null>(null);
  const anchor = useRef(-1);
  const cursorRef = useRef(-1); cursorRef.current = cursor;
  const tokensNorm = useMemo(() => page.tokens.map((t) => normalise(t.t)), [page]);
  const stopVoice = () => { session.current?.stop(); session.current = null; };
  useEffect(() => { anchor.current = cursorRef.current; }, [pointer]);   // a finger or tap correction invalidates the running alignment
  useEffect(() => { if (hideArt) { stopVoice(); setVoice((v) => (v === "listening" || v === "starting" ? "stopped" : v)); } }, [hideArt]);   // the word card: never listen to the child
  useEffect(() => () => stopVoice(), [pageNo]);
  const startFollow = () => {
    stopVoice(); anchor.current = cursorRef.current;
    session.current = startVoice({
      onState: setVoice,
      onHeard: (words, final) => {
        const stopAt = pending.length ? pending[0] : -1;
        const next = align({ tokens: tokensNorm, anchor: anchor.current, heard: words, stopAt });
        if (next > cursorRef.current) { setCursor(next); setPointer(next); }
        if (final) anchor.current = Math.max(anchor.current, next);
      },
    });
  };
  return (
    <main className="story">
      {/* the picture is hidden while a magic word is open: the child reads the letters, not the picture */}
      <div className={"art-box" + (hideArt ? " veiled" : "")}>{hideArt ? <span className="veil"><LockIcon size={28} />read the letters</span> : <Art art={page.art} />}</div>
      <div className={"text-card" + (readMode ? " follow" : "")} ref={cardRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}>
        <div className="pg">Page {pageNo + 1} of {total}</div>
        <p className={"sentence" + (readMode ? " follow" : "")} ref={sentenceRef}>
          {page.tokens.map((t, i) => {
            const n = normalise(t.t);
            const magic = !listener && firstIdx.has(i);
            const res = magic ? resAt(i) : undefined;
            const cls = wordCls(i, ["w", i === token ? "now" : "", i < token ? "read" : "", magic ? "magic" : "", magic && res ? (res.ok ? "done" : "skipped") : ""].join(" "));
            const [lead, core0, punct] = split(t.t);
            const core = magic ? core0.toLowerCase() : core0;   // a magic word is shown in the letterforms the child was taught
            if (readMode && magic && !res) return <span key={i} className="tokwrap">{lead}<button className={cls + " tap"} data-i={i} onClick={() => onMagicTap(n, i)}>{core}</button>{punct} </span>;
            if (readMode && i === extra) {
              const r = resAt(i);
              if (r) return <span key={i} className="tokwrap">{lead}<span className={wordCls(i, "w magic " + (r.ok ? "done" : "skipped"))} data-i={i}>{core.toLowerCase()}</span>{punct} </span>;
              if (i > cursor) return <span key={i} className="tokwrap">{lead}<button className={cls + " try"} data-i={i} onClick={() => onMagicTap(n, i, true)}>{core.toLowerCase()}</button>{punct} </span>;   // offered until the grown-up reads past it
            }
            if (listener) return <span key={i} className="tokwrap">{lead}<button className={cls + " listener-tap"} onClick={() => onWordTap(t.t)}>{core}</button>{punct} </span>;   // read mode: grey words are the grown-up's, never tap-to-hear
            if (readMode) return <span key={i} className="tokwrap">{lead}<span className={cls} data-i={i} onClick={() => land(i)}>{core}</span>{punct} </span>;   // tap-only alternative to the slide: the next word moves the cursor
            return <span key={i} className="tokwrap">{lead}<span className={cls}>{core}</span>{punct} </span>;
          })}
        </p>
        {stalled && <div className="readbar"><button className="next" onClick={onRetry}>▶ Try again</button></div>}
        {readMode && !stalled && (
          <div className="readbar">
            <span className="script">{pending.length ? <><b>{reader}</b> reads, sliding a finger under the words. <b>{kid}</b> reads the <em className="pinkword">pink word</em>: tap it, then say the sounds and blend.</> : <><b>{reader}</b> reads the page, finger under the words. Then go on.</>}{extra >= 0 && extra > cursor && !resAt(extra) && <> <small className="legend">Also decodable: <b>{normalise(page.tokens[extra].t)}</b> — tap it if {kid} wants a go.</small></>}</span>
            {voiceFollow && voiceSupported() && (
              <div className="row center voicebar">
                {voice === "off" || voice === "stopped" ? <button className="small" onClick={startFollow}>{voice === "stopped" ? "Tap to follow again" : "Follow my voice"}</button>
                  : voice === "starting" ? <span className="legend">starting the microphone…</span>
                  : voice === "listening" ? <button className="small live" onClick={() => { stopVoice(); setVoice("off"); }}>Listening · stop</button>
                  : voice === "denied" ? <span className="legend">Microphone not allowed here. Slide a finger under the words instead.</span>
                  : <span className="legend">Voice follow is not available here (offline or unsupported). Slide a finger under the words instead.</span>}
              </div>
            )}
            <button className="next" disabled={pending.length > 0} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
          </div>
        )}
        {listener && !readMode && !stalled && (
          <div className="readbar">
            <span className="script">{pageHeld ? <><b>{reader}</b>: {["“What happened on this page?”", "“Point to the picture. What is it?”", "“Which word did you like? Tap it.”", "“What do you think happens next?”"][pageNo % 4]}</> : "Listen…"}</span>
            <button className="next" disabled={!pageHeld} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * Read-back routine: the child tries the WHOLE line first. If a word needs help, the grown-up taps it:
 * the app shows regular vs tricky parts (tricky word) or stretches the sounds (decodable word),
 * the child re-reads that word, then re-reads the whole line smoothly before ✓.
 */
function Moral({ story, learner, listener, kid, reader, listen, bedtime, setCaption, buildWord, onBuilt, onYes }: { story: Story; learner: LearnerModel; listener: boolean; kid: string; reader: string; listen: boolean; bedtime: boolean; setCaption: (s: string) => void; buildWord: string | null; onBuilt: (w: string, ok: boolean) => Promise<void>; onYes: () => void }) {
  const line = checkLine(story.moral.line, learner);
  const raw = story.moral.line.split(/\s+/);
  const parts = raw.map((w, i) => { const m = w.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/); const r = line.results[i]; const core = m ? m[2] : w; const shown = r?.ok ? (r.kind === "tricky" ? (r.word === "i" ? "I" : r.word) : core.toLowerCase()) : core; return { lead: m ? m[1] : "", core: shown, punct: m ? m[3] : "" }; });   // taught letterforms; punctuation outside
  const words = parts.map((p) => p.core);
  const [stage, setStage] = useState<"try" | "help" | "word" | "reread" | "build">("try");
  // after the read-back: one-word dictation on a word the child just blended (skipped when none)
  const finishLine = () => { if (buildWord) { setStage("build"); setCaption(`${reader}: say "${buildWord}". ${kid} counts the sounds, then builds it.`); } else onYes(); };
  const [helped, setHelped] = useState<number | null>(null);
  const help = async (i: number) => {
    const r = line.results[i]; setHelped(i);
    if (!r.ok) return;
    if (r.kind === "tricky") {
      setCaption(`${words[i]} is a tricky word. The underlined part is the odd bit. Just say the word, then read the line again.`);
      if (listen) speakText(words[i], {});   // a tricky word is taught as a whole, so hearing it is fine
    } else {
      setCaption(`${stretched(r.graphemes)} … ${reader}: slide through the sounds, but let ${kid} say the word.`);
      await playBlend(r.graphemes);   // never the whole word: that would be echoing, not blending
      setStage("word"); return;       // stay on this word until the grown-up confirms the child blended it
    }
    setStage("reread");
  };
  if (stage === "build" && buildWord) return (
    <div className="screen-wrap panel-open">
      <main className="moral"><div className="kicker">One more: build a word</div><p className="spoken">“{story.moral.spoken}”</p></main>
      {/* the encoding write and the finish write both read-modify-write the same progress row: never race them */}
      <SegmentPanel word={buildWord} learner={learner} kid={kid} reader={reader} listen={listen} bedtime={bedtime} onDone={async (outcome) => { if (outcome !== "not_tonight") await onBuilt(buildWord, outcome === "spelled"); onYes(); }} />
    </div>
  );
  return (
    <main className="moral">
      <div className="kicker">The end</div>
      <p className="spoken">“{story.moral.spoken}”</p>
      {!listener && (
        <>
          <div className="kicker">{stage === "try" ? `${kid} reads the whole line` : stage === "help" ? "tap the word that needs help" : stage === "word" ? `${kid} blends that word` : "now the whole line again, smoothly"}</div>
          <p className="line">
            {line.results.map((r, i) => {
              const tp = r.ok && r.kind === "tricky" ? (TRICKY_PARTS[r.word] ?? `|${r.word}`).split("|") : null;
              return (
                <span key={i} className="tokwrap">{parts[i].lead}<button className={"lw " + (r.ok && r.kind === "tricky" ? "tricky" : "magic") + (helped === i ? " helped" : "")} disabled={stage === "try"} onClick={() => help(i)}>
                  {tp ? <><span>{words[i].slice(0, tp[0].length)}</span><u className="odd">{words[i].slice(tp[0].length)}</u></> : words[i]}
                </button>{parts[i].punct}</span>
              );
            })}
          </p>
          <div className="legend"><i className="sw magic" /> sound it out <i className="sw tricky" /> tricky word: <u className="odd">odd bit</u> underlined</div>
          <div className="script"><b>{reader}</b>: {stage === "try" ? "let them read the whole line first." : stage === "help" ? "tap the word they stuck on." : stage === "word" ? "wait for them to slide through it and say it as one word." : "ask for the whole line once more, smoothly."}</div>
        </>
      )}
      <div className="btns">
        {listener ? <button className="yes" onClick={onYes}>The end ✓</button> : stage === "try" ? (
          <><button className="no" onClick={() => setStage("help")}>Needs help on a word</button><button className="yes" onClick={finishLine}><CheckIcon /> Read it smoothly</button></>
        ) : stage === "help" ? (
          <button className="no" onClick={() => setStage("try")}>← back</button>
        ) : stage === "word" ? (
          <><button className="no" onClick={() => helped !== null && help(helped)}>Show me again</button><button className="yes" onClick={() => setStage("reread")}>✓ They blended it</button></>
        ) : (
          <><button className="no" onClick={() => setStage("help")}>Another word</button><button className="yes" onClick={finishLine}>✓ Read it smoothly</button></>
        )}
      </div>
    </main>
  );
}

/** Specific feedback, not a trophy: what the child actually did with each word. */
function Done({ story, results, bedtime, kid, learner, onHome }: { story: Story; results: WordResult[]; bedtime: boolean; kid: string; learner: LearnerModel; onHome: () => void }) {
  const ok = results.filter((r) => r.ok);
  const tried = volunteered(results);
  const later = designed(results).filter((r) => !r.ok);
  const [ledger, setLedger] = useState(false);   // the child's screen shows the wins; the ledger is the grown-up's
  const line = (r: WordResult) => {
    const gs = checkWord(r.word, learner).graphemes.join("-");
    if (!r.ok) return `${r.word} · comes back in tomorrow's warm-up`;
    if (r.mode === "first_try") return `${r.word} · slid through ${gs} first try${r.extra ? " (asked for this one)" : ""}`;
    if (r.mode === "prompted") return `${r.word} · blended it after a nudge`;
    return `${r.word} · heard it slid through, then did it`;
  };
  return (
    <main className="done">
      {!bedtime && ok.length > 0 && <Confetti />}
      <div className="badge rise">{bedtime ? <MoonIcon size={84} /> : <Art art={story.pages[0].art} />}</div>
      <h2 className="rise">{story.title}</h2>
      {ok.length > 0 && <ul className="results">{ok.map((r, i) => <li key={(r.id ?? r.word) + i} className="ok">{line(r)}</li>)}</ul>}
      <p className="show">{bedtime ? "Lights low. One real book, then sleep." : ok.length ? `Now go find someone and read them your ${ok.length === 1 ? "word" : "words"}, ${kid}!` : `Good listening, ${kid}. Those words come back tomorrow for a warm-up.`}</p>
      {!bedtime && ok.length > 0 && <p className="bigwords">{ok.map((r, i) => <span key={(r.id ?? r.word) + i}>{r.word}</span>)}</p>}
      {tried.length > 0 && <p className="note">…and {kid} asked to try <b>{tried.map((r) => r.word).join(", ")}</b> without being asked.</p>}
      <div className="btns"><button className="yes" onClick={onHome}><CheckIcon /> Done</button></div>
      {later.length > 0 && (ledger
        ? <ul className="results grownup-ledger">{later.map((r, i) => <li key={(r.id ?? r.word) + i} className="no">{line(r)}</li>)}</ul>
        : <button className="skip" onClick={() => setLedger(true)}>grown-up: tonight's words →</button>)}
    </main>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ l: (i * 37) % 100, d: (i % 6) * 0.15, c: ["#f3c7e6", "#d8ecd2", "#ffe9a8", "#dbe7f7"][i % 4] })), []);
  return <div className="confetti" aria-hidden>{bits.map((b, i) => <i key={i} style={{ left: `${b.l}%`, animationDelay: `${b.d}s`, background: b.c }} />)}</div>;
}
