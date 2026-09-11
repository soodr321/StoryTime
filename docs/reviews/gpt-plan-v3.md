Reading additional input from stdin...
OpenAI Codex v0.154.0
--------
workdir: /Users/rish_ai/StoryTime
model: gpt-6-astra
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 01a0925e-0620-7103-abcc-d935f45c8f0f
--------
user
Do NOT read or execute files under .claude/, .agents/, or ~/.claude/. Review docs/plan-v2.md (plan v3) for a children's phonics PWA, from two lenses: a K-1 phonics teacher and a senior engineer shipping PWAs on iPhone Safari home-screen apps. Read for context src/screens/Story.tsx, src/components/MagicPanel.tsx, src/lib/blend.ts, src/lib/audio/speech.ts, src/lib/audio/record.ts, scripts/fetch-phonemes.py, scripts/gen-audio.py and docs/reviews/grok-plan-v2.md (a previous review already folded in). Be adversarial: what is still wrong, missing, or riskier than the plan admits? Concrete on: hand-cutting phoneme clips and the blend graph; finger-follow interaction on a 390px phone; the iOS SpeechRecognition contract; pedagogy of the 'I'll try' word and highlight-as-adult-reads. Mark findings [P1] must-change / [P2] nice-to-have, end with a prioritised list of plan changes. Do not modify files.
codex
I’ll read the plan and implementation context, then check the browser and phonics assumptions against primary sources. I’ll avoid the excluded directories and won’t modify files.
exec
/bin/zsh -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!**/.claude/**'"' -g '"'!**/.agents/**'"' -g '"'!node_modules/**'"' -g '"'!vendor/**'"' docs src scripts . 2>/dev/null | head -60" in /Users/rish_ai/StoryTime
 succeeded in 214ms:
exec
/bin/zsh -lc 'nl -ba src/lib/audio/speech.ts' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	/**
     2	 * On-device speech (Web Speech API) for family stories and single-word taps.
     3	 * $0, offline, no server. Word boundaries fire on Chrome and Safari; when they do
     4	 * not, the caller's highlighting simply stays on the sentence.
     5	 */
     6	export interface SpeakHandle { done: Promise<void>; stop: () => void }
     7	
     8	let voice: SpeechSynthesisVoice | null | undefined;
     9	function pickVoice(): SpeechSynthesisVoice | null {
    10	  if (voice !== undefined) return voice;
    11	  const vs = window.speechSynthesis?.getVoices?.() ?? [];
    12	  voice = vs.find((v) => /en-IN/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang) && /female|samantha|karen|moira/i.test(v.name)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? null;
    13	  return voice;
    14	}
    15	if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voice = undefined; pickVoice(); };
    16	
    17	export function speakText(text: string, opts: { rate?: number; onWord?: (index: number) => void }): SpeakHandle {
    18	  if (typeof window === "undefined" || !window.speechSynthesis) return { done: Promise.resolve(), stop: () => {} };
    19	  const synth = window.speechSynthesis;
    20	  synth.cancel();
    21	  const u = new SpeechSynthesisUtterance(text);
    22	  const v = pickVoice(); if (v) u.voice = v;
    23	  u.rate = 0.9 * (opts.rate ?? 1);
    24	  u.pitch = 1.05;
    25	  // map character offsets to token indexes
    26	  const starts: number[] = []; let pos = 0;
    27	  for (const tok of text.split(" ")) { starts.push(pos); pos += tok.length + 1; }
    28	  let settled = false, resolve!: () => void;
    29	  const done = new Promise<void>((r) => { resolve = r; });
    30	  const finish = () => { if (!settled) { settled = true; resolve(); } };
    31	  u.onboundary = (e) => { if (e.name === "word" && opts.onWord) { let i = 0; for (let k = 0; k < starts.length; k++) if (starts[k] <= e.charIndex) i = k; opts.onWord(i); } };
    32	  u.onend = finish; u.onerror = finish;
    33	  setTimeout(() => synth.speak(u), 0);       // iOS drops an utterance queued in the same tick as cancel()
    34	  // Safari sometimes never fires onend for cancelled utterances
    35	  const guard = setTimeout(finish, Math.max(2000, text.length * 120));
    36	  return { done: done.then(() => clearTimeout(guard)), stop: () => { synth.cancel(); finish(); } };
    37	}

exec
/bin/zsh -lc 'nl -ba src/screens/Story.tsx' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	import { useCallback, useEffect, useMemo, useRef, useState } from "react";
     2	import { useMachine } from "@xstate/react";
     3	import { storyMachine, type WordResult } from "../machine/story.machine";
     4	import type { Page, Story } from "../lib/content/types";
     5	import { TRICKY_PARTS } from "../lib/phonics/learner";
     6	import { checkLine, checkWord, normalise, type LearnerModel } from "../lib/phonics/validator";
     7	import { playNarration, stopAll, unlock, type Playing } from "../lib/audio/player";
     8	import { promptAsset, storyAsset } from "../lib/library";
     9	import { speakText, type SpeakHandle } from "../lib/audio/speech";
    10	import { useFamily } from "../lib/family";
    11	import { learnerOf } from "../lib/store";
    12	import { Art } from "../components/Art";
    13	import { MagicPanel } from "../components/MagicPanel";
    14	import { stretched, playBlend } from "../lib/blend";
    15	import { SegmentPanel } from "../components/SegmentPanel";
    16	import type { Verdict } from "../components/MagicPanel";
    17	import type { Mode } from "./Home";
    18	import { BookIcon, HomeIcon, LockIcon, MoonIcon, SpeakerIcon, CheckIcon } from "../components/Icons";
    19	
    20	type Prompts = Record<string, { audio: string; ms: number }>;
    21	let promptsCache: Prompts | null = null;
    22	async function prompts(): Promise<Prompts> {
    23	  if (promptsCache) return promptsCache;
    24	  try { const r = await fetch(promptAsset("manifest.json")); promptsCache = r.ok ? ((await r.json()) as Prompts) : {}; } catch { promptsCache = {}; }
    25	  return promptsCache;
    26	}
    27	const isUrl = (a: string) => /^(data|blob):/.test(a);
    28	
    29	export function StoryScreen({ story, mode, resume, onHome }: { story: Story; mode: Mode; resume: boolean; onHome: () => void }) {
    30	  const fam = useFamily();
    31	  const kid = fam.activeKid!;
    32	  const learner = useMemo(() => learnerOf(kid), [kid]);
    33	  const listener = kid.role === "listener";
    34	  const listen = mode === "listen";
    35	  const bedtime = fam.settings.bedtime;
    36	  const reader = fam.settings.tonight ?? fam.settings.readers[0] ?? "Grown-up";
    37	
    38	  const init = resume && fam.session?.slug === story.slug ? { page: fam.session.page, results: fam.session.results as WordResult[] } : {};
    39	  const [snap, send] = useMachine(storyMachine, { input: { story, ...init } });
    40	  const ctx = snap.context;
    41	  const state = snap.value as string;
    42	  const page: Page | undefined = story.pages[ctx.page];
    43	  const playing = useRef<Playing | SpeakHandle | null>(null);
    44	  const [caption, setCaption] = useState("");
    45	  const [stalled, setStalled] = useState(false);
    46	  const [pageHeld, setPageHeld] = useState(false);
    47	  const [retry, setRetry] = useState(0);
    48	  const startedRef = useRef(false);
    49	  const finishedRef = useRef(false);
    50	  const runRef = useRef(0);
    51	  const [sweep, setSweep] = useState(0);
    52	
    53	  useEffect(() => {
    54	    if (state === "idle" || state === "done") return;
    55	    void fam.setSession({ kidId: kid.id, slug: story.slug, mode, page: ctx.page, results: ctx.results, updatedAt: Date.now() });
    56	  // eslint-disable-next-line react-hooks/exhaustive-deps
    57	  }, [ctx.page, ctx.results.length, state]);
    58	
    59	  const rate = bedtime ? 0.88 : 1;
    60	  const speak = useCallback(async (src: string | null, text?: string) => {
    61	    if (text) setCaption(text);
    62	    playing.current?.stop();
    63	    if (src) { const p = playNarration(src, rate); playing.current = p; try { await p.done; } catch { /* caption is enough */ } }
    64	    else if (text) { const h = speakText(text, { rate }); playing.current = h; await h.done; }
    65	  }, [rate]);
    66	  const speakPrompt = useCallback(async (key: string, text: string) => {
    67	    const m = await prompts();
    68	    const s = story.prompts?.[key] ? storyAsset(story, story.prompts[key].audio) : m[key] ? promptAsset(m[key].audio) : null;
    69	    await speak(s, text);
    70	  }, [speak, story]);
    71	
    72	  /** first magic token on this page whose occurrence (page:word) has not been graded */
    73	  const doneIds = useMemo(() => new Set(ctx.results.map((r) => r.id ?? "")), [ctx.results]);
    74	  /** the target is the FIRST occurrence of each magic word on the page; later repeats are read by the narrator */
    75	  const targetIdx = (p: Page, w: string) => p.tokens.findIndex((t) => normalise(t.t) === w);
    76	  const pendingMagicIdx = useCallback((p: Page, pageNo: number) => { if (listener) return -1; for (const w of p.magic ?? []) { const i = targetIdx(p, w); if (i >= 0 && !doneIds.has(`${pageNo}:${i}`)) return i; } return -1; }, [listener, doneIds]);
    77	
    78	  const narratePage = useCallback(async (p: Page, pageNo: number, opts: { stopAtMagic: boolean; onDone: () => void }): Promise<void> => {
    79	    const magicIdx = opts.stopAtMagic ? pendingMagicIdx(p, pageNo) : -1;
    80	    const run = ++runRef.current; const alive = () => run === runRef.current;
    81	    playing.current?.stop();
    82	    let stopped = false;
    83	    const reachMagic = () => { stopped = true; send({ type: "TOKEN", index: magicIdx }); send({ type: "MAGIC_REACHED", word: normalise(p.tokens[magicIdx].t), index: magicIdx }); };
    84	
    85	    const untimed = !p.tokens.some((t) => t.ms > 0);
    86	    if (p.audio && !(untimed && magicIdx >= 0)) {   // a parent recording has no word timings: it cannot stop cleanly before the magic word, so the first pass uses speech and the recording plays on the reread
    87	      const src = isUrl(p.audio) ? p.audio : storyAsset(story, p.audio);
    88	      const pl = playNarration(src, rate); playing.current = pl;
    89	      const timed = p.tokens.some((t) => t.ms > 0);
    90	      const durMs = () => (isFinite(pl.el.duration) && pl.el.duration > 0 ? pl.el.duration * 1000 : p.audioMs ?? Infinity);
    91	      const tokMs = (i: number) => (timed ? p.tokens[i].ms : durMs() !== Infinity ? (durMs() * i) / p.tokens.length : Infinity);
    92	      const stopMsAt = () => (magicIdx >= 0 ? (timed ? tokMs(magicIdx) : tokMs(magicIdx) - 350) : Infinity);
    93	      let last = -1;
    94	      // interval, not rAF: the magic-word stop must fire even when the phone screen dims or the tab is backgrounded
    95	      const raf = setInterval(() => {
    96	        const ms = pl.el.currentTime * 1000; const stopMs = stopMsAt();
    97	        if (ms >= stopMs) { clearInterval(raf); pl.stop(); reachMagic(); return; }
    98	        let i = -1; for (let k = 0; k < p.tokens.length; k++) if (tokMs(k) <= ms) i = k;
    99	        if (i !== last) { last = i; send({ type: "TOKEN", index: i }); }
   100	      }, 40);
   101	      const stall = new Promise<"stall">((res) => setTimeout(() => res("stall"), 5000));
   102	      const deadline = new Promise<"deadline">((res) => setTimeout(() => res("deadline"), ((p.audioMs ?? 20000) / rate) + 1500));
   103	      let ok = true;
   104	      try { const r = await Promise.race([pl.done.then(() => "done" as const), stall.then(() => (pl.el.currentTime === 0 ? "stall" : pl.done.then(() => "done" as const))), deadline]); if (r === "stall") ok = false; if (r === "deadline") pl.stop(); } catch { ok = false; }
   105	      clearInterval(raf);
   106	      if (!alive()) return;
   107	      if (!ok) { pl.stop(); setStalled(true); setCaption("Tap ▶ to hear this page."); return; }
   108	    } else {
   109	      const upto = magicIdx >= 0 ? magicIdx : p.tokens.length;
   110	      const text = p.tokens.slice(0, upto).map((t) => t.t).join(" ");
   111	      if (text) { const h = speakText(text, { rate, onWord: (i) => alive() && send({ type: "TOKEN", index: i }) }); playing.current = h; await h.done; }
   112	      if (!alive()) return;
   113	      if (magicIdx >= 0) { reachMagic(); return; }
   114	    }
   115	    if (!alive()) return;
   116	    if (!stopped && magicIdx >= 0) { reachMagic(); return; }
   117	    if (!stopped) { send({ type: "TOKEN", index: p.tokens.length }); if (magicIdx < 0 && opts.stopAtMagic) await new Promise((r) => setTimeout(r, 1400)); if (alive()) opts.onDone(); }
   118	  }, [send, story, rate, pendingMagicIdx]);
   119	
   120	  useEffect(() => {
   121	    setStalled(false); setPageHeld(false);
   122	    if (state === "narrating" && page) {
   123	      if (!listen) return;
   124	      let live = true;
   125	      const onDone = () => { if (!live) return; if (listener) setPageHeld(true); else send({ type: "NARRATION_DONE" }); };
   126	      void narratePage(page, ctx.page, { stopAtMagic: true, onDone });
   127	      return () => { live = false; };
   128	    }
   129	    if (state === "reread" && page) {
   130	      if (!listen) { send({ type: "RESUME" }); return; }
   131	      let live = true;
   132	      void narratePage(page, ctx.page, { stopAtMagic: false, onDone: () => live && send({ type: "REREAD_DONE" }) });
   133	      return () => { live = false; };
   134	    }
   135	    if (state === "magicWord" && ctx.mode !== "modelled" && listen) void speakPrompt("yours", "… this one is yours. Start at the first sound and slide through the word.");
   136	    if (state === "moral") {
   137	      if (!listen) { setCaption(`${reader} reads the moral. Then ${kid.name} tries the whole line.`); return; }
   138	      void (async () => { await speak(story.moral.audio ? (isUrl(story.moral.audio) ? story.moral.audio : storyAsset(story, story.moral.audio)) : null, story.moral.spoken); if (!listener) await speakPrompt("line", "Now you. Read your line."); })();
   139	    }
   140	    if (state === "done") {
   141	      if (!finishedRef.current) { finishedRef.current = true; void fam.finish(kid.id, story.slug, ctx.results); }
   142	      const okWords = ctx.results.filter((r) => r.ok).map((r) => r.word);
   143	      const said = okWords.length ? `You blended ${okWords.join(", ")}.` : "Good listening. Those words come back tomorrow.";
   144	      setCaption(said); if (listen) { const h = speakText(said, { rate }); playing.current = h; }
   145	    }
   146	  // eslint-disable-next-line react-hooks/exhaustive-deps
   147	  }, [state, ctx.page, retry]);
   148	
   149	  useEffect(() => { if (!startedRef.current) { startedRef.current = true; void unlock().then(() => send({ type: "START" })); } return () => { stopAll(); playing.current?.stop(); }; }, [send]);
   150	
   151	  const home = () => { runRef.current++; playing.current?.stop(); stopAll(); onHome(); };
   152	  const inStory = state === "narrating" || state === "reread" || state === "magicWord" || state === "modelling";
   153	  const panelOpen = (state === "magicWord" || state === "modelling") && !!ctx.magic;
   154	
   155	  /** continuous-blend model, then hand the word back */
   156	  const together = async () => {
   157	    const run = ++runRef.current; const alive = () => run === runRef.current;
   158	    const word = ctx.magic!; const gs = checkWord(word, learner).graphemes;
   159	    send({ type: "NOT_YET" });
   160	    if (listen) await speakPrompt("notyet", "That's okay. Listen: I'll slide through the sounds, then you try."); else setCaption(`${reader}: keep your voice going, slide through the sounds. Do NOT say the whole word.`);
   161	    if (!alive()) return;
   162	    setCaption(stretched(gs) + " …");
   163	    if (listen) await playBlend(gs, { alive, rate, onProgress: setSweep });
   164	    else { const n = gs.length * 12; for (let i = 1; i <= n; i++) { await new Promise((r) => setTimeout(r, 70)); if (!alive()) return; setSweep(i / n); } }   // sound off: the app must not talk over the grown-up
   165	    setSweep(0);
   166	    if (!alive()) return;
   167	    // never say the whole word here: the child must blend it, not echo it
   168	    if (listen) await speakPrompt("yourturn", "Your turn: start here and slide through the word."); else setCaption(`Now ${kid.name}: start at the first sound and slide through the word.`);
   169	    if (alive()) send({ type: "MODEL_DONE" });
   170	  };
   171	
   172	  return (
   173	    <div className={"screen-wrap" + (panelOpen ? " panel-open" : "")}>
   174	      <header className="top">
   175	        <button className="home" onClick={home} aria-label="Home"><HomeIcon /></button>
   176	        <div className="title">{story.title}</div>
   177	        <div className="lvl">{listen ? (bedtime ? <><MoonIcon size={16} /> bedtime</> : <><SpeakerIcon size={16} /> listen</>) : <><BookIcon size={16} /> read</>}</div>
   178	      </header>
   179	
   180	      {inStory && page && (
   181	        <StoryView
   182	          page={page} pageNo={ctx.page} total={story.pages.length} token={listen ? ctx.token : -1} results={ctx.results}
   183	          readMode={!listen} listener={listener} reader={reader} kid={kid.name} stalled={stalled} pageHeld={pageHeld} hideArt={panelOpen}
   184	          onRetry={() => { void unlock(); setStalled(false); setRetry((n) => n + 1); }}
   185	          onMagicTap={(w, i) => state === "narrating" && send({ type: "MAGIC_REACHED", word: w, index: i })}
   186	          onWordTap={(tok) => { if (listener || !listen) { if (state === "narrating" && listen && !pageHeld) return; setCaption(tok); const h = speakText(tok, { rate }); playing.current = h; } }}
   187	          onNext={() => state === "narrating" && send({ type: "PAGE_NEXT" })}
   188	        />
   189	      )}
   190	
   191	      {panelOpen && (
   192	        <MagicPanel
   193	          word={ctx.magic!} learner={learner} modelling={state === "modelling"} modelledOnce={ctx.mode === "modelled"} sweep={sweep} kid={kid.name} reader={reader}
   194	          onSound={() => send({ type: "SOUND_TAPPED" })}
   195	          onYes={async (v: Verdict) => { const w = ctx.magic!; if (listen) await speakPrompt(`yes:${w}`, `Yes! ${w}.`); else setCaption(`Yes! ${w}.`); send({ type: "YES", verdict: v }); }}
   196	          onTogether={together}
   197	          onSkip={async () => { const w = ctx.magic!; setCaption("We'll practise it tomorrow." + (listen ? "" : ` ${reader}, read the word for them once.`)); if (listen) { await playBlend(checkWord(w, learner).graphemes, { rate }); await speakPrompt("practise", "We'll practise it tomorrow."); } send({ type: "SKIP" }); }}
   198	        />
   199	      )}
   200	
   201	      {state === "moral" && <Moral story={story} learner={learner} listener={listener} kid={kid.name} reader={reader} listen={listen} setCaption={setCaption} buildWord={fam.pendingBuild ?? ctx.results.find((r) => r.ok && r.mode === "first_try")?.word ?? null} onBuilt={(w, ok) => void fam.encodingDone(story.slug, w, ok)} onYes={() => send({ type: "LINE_YES" })} />}
   202	      {state === "done" && <Done story={story} results={ctx.results} bedtime={bedtime} kid={kid.name} learner={learner} onHome={home} />}
   203	
   204	      <div className="cap" aria-live="polite">{caption}</div>
   205	      {fam.toast && <div className="toast" role="status">{fam.toast}</div>}
   206	    </div>
   207	  );
   208	}
   209	
   210	function StoryView({ page, pageNo, total, token, results, readMode, listener, reader, kid, stalled, pageHeld, hideArt, onRetry, onMagicTap, onWordTap, onNext }: {
   211	  page: Page; pageNo: number; total: number; token: number; results: WordResult[];
   212	  readMode: boolean; listener: boolean; reader: string; kid: string; stalled: boolean; pageHeld: boolean; hideArt: boolean;
   213	  onRetry: () => void; onMagicTap: (w: string, i: number) => void; onWordTap: (tok: string) => void; onNext: () => void;
   214	}) {
   215	  const resAt = (i: number) => results.find((r) => r.id === `${pageNo}:${i}`);
   216	  const firstIdx = new Set((page.magic ?? []).map((w) => page.tokens.findIndex((t) => normalise(t.t) === w)));
   217	  const pending = listener ? [] : [...firstIdx].filter((i) => i >= 0 && !resAt(i));
   218	  // trailing punctuation sits outside the highlight: the child decodes letters, not full stops
   219	  const split = (tok: string) => { const m = tok.match(/^([^A-Za-z]*)([A-Za-z]+(?:['’][A-Za-z]+)?)([^A-Za-z]*)$/); return m ? [m[1], m[2], m[3]] : ["", tok, ""]; };
   220	  const last = pageNo + 1 >= total;
   221	  return (
   222	    <main className="story">
   223	      {/* the picture is hidden while a magic word is open: the child reads the letters, not the picture */}
   224	      <div className={"art-box" + (hideArt ? " veiled" : "")}>{hideArt ? <span className="veil"><LockIcon size={28} />read the letters</span> : <Art art={page.art} />}</div>
   225	      <div className="text-card">
   226	        <div className="pg">Page {pageNo + 1} of {total}</div>
   227	        <p className="sentence">
   228	          {page.tokens.map((t, i) => {
   229	            const n = normalise(t.t);
   230	            const magic = !listener && firstIdx.has(i);
   231	            const res = magic ? resAt(i) : undefined;
   232	            const cls = ["w", i === token ? "now" : "", i < token ? "read" : "", magic ? "magic" : "", magic && res ? (res.ok ? "done" : "skipped") : ""].join(" ");
   233	            const [lead, core0, punct] = split(t.t);
   234	            const core = magic ? core0.toLowerCase() : core0;   // a magic word is shown in the letterforms the child was taught
   235	            if (readMode && magic && !res) return <span key={i} className="tokwrap">{lead}<button className={cls + " tap"} onClick={() => onMagicTap(n, i)}>{core}</button>{punct} </span>;
   236	            if (listener) return <span key={i} className="tokwrap">{lead}<button className={cls + " listener-tap"} onClick={() => onWordTap(t.t)}>{core}</button>{punct} </span>;   // read mode: grey words are the grown-up's, never tap-to-hear
   237	            return <span key={i} className="tokwrap">{lead}<span className={cls}>{core}</span>{punct} </span>;
   238	          })}
   239	        </p>
   240	        {stalled && <div className="readbar"><button className="next" onClick={onRetry}>▶ Try again</button></div>}
   241	        {readMode && !stalled && (
   242	          <div className="readbar">
   243	            <span className="script">{pending.length ? <><b>{reader}</b> reads the story. <b>{kid}</b> reads the <em className="pinkword">pink word</em>: tap it, then say the sounds and blend.</> : <><b>{reader}</b> reads the page. Then go on.</>}</span>
   244	            <button className="next" disabled={pending.length > 0} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
   245	          </div>
   246	        )}
   247	        {listener && !readMode && !stalled && (
   248	          <div className="readbar">
   249	            <span className="script">{pageHeld ? <><b>{reader}</b>: {["“What happened on this page?”", "“Point to the picture. What is it?”", "“Which word did you like? Tap it.”", "“What do you think happens next?”"][pageNo % 4]}</> : "Listen…"}</span>
   250	            <button className="next" disabled={!pageHeld} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
   251	          </div>
   252	        )}
   253	      </div>
   254	    </main>
   255	  );
   256	}
   257	
   258	/**
   259	 * Read-back routine: the child tries the WHOLE line first. If a word needs help, the grown-up taps it:
   260	 * the app shows regular vs tricky parts (tricky word) or stretches the sounds (decodable word),
   261	 * the child re-reads that word, then re-reads the whole line smoothly before ✓.
   262	 */
   263	function Moral({ story, learner, listener, kid, reader, listen, setCaption, buildWord, onBuilt, onYes }: { story: Story; learner: LearnerModel; listener: boolean; kid: string; reader: string; listen: boolean; setCaption: (s: string) => void; buildWord: string | null; onBuilt: (w: string, ok: boolean) => void; onYes: () => void }) {
   264	  const line = checkLine(story.moral.line, learner);
   265	  const raw = story.moral.line.split(/\s+/);
   266	  const parts = raw.map((w, i) => { const m = w.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/); const r = line.results[i]; const core = m ? m[2] : w; const shown = r?.ok ? (r.kind === "tricky" ? (r.word === "i" ? "I" : r.word) : core.toLowerCase()) : core; return { lead: m ? m[1] : "", core: shown, punct: m ? m[3] : "" }; });   // taught letterforms; punctuation outside
   267	  const words = parts.map((p) => p.core);
   268	  const [stage, setStage] = useState<"try" | "help" | "word" | "reread" | "build">("try");
   269	  // after the read-back: one-word dictation on a word the child just blended (skipped when none)
   270	  const finishLine = () => { if (buildWord) { setStage("build"); setCaption(`${reader}: say "${buildWord}". ${kid} counts the sounds, then builds it.`); } else onYes(); };
   271	  const [helped, setHelped] = useState<number | null>(null);
   272	  const help = async (i: number) => {
   273	    const r = line.results[i]; setHelped(i);
   274	    if (!r.ok) return;
   275	    if (r.kind === "tricky") {
   276	      setCaption(`${words[i]} is a tricky word. The underlined part is the odd bit. Just say the word, then read the line again.`);
   277	      if (listen) speakText(words[i], {});   // a tricky word is taught as a whole, so hearing it is fine
   278	    } else {
   279	      setCaption(`${stretched(r.graphemes)} … ${reader}: slide through the sounds, but let ${kid} say the word.`);
   280	      await playBlend(r.graphemes);   // never the whole word: that would be echoing, not blending
   281	      setStage("word"); return;       // stay on this word until the grown-up confirms the child blended it
   282	    }
   283	    setStage("reread");
   284	  };
   285	  if (stage === "build" && buildWord) return (
   286	    <div className="screen-wrap panel-open">
   287	      <main className="moral"><div className="kicker">One more: build a word</div><p className="spoken">“{story.moral.spoken}”</p></main>
   288	      <SegmentPanel word={buildWord} learner={learner} kid={kid} reader={reader} listen={listen} onDone={(ok) => { onBuilt(buildWord, ok); onYes(); }} />
   289	    </div>
   290	  );
   291	  return (
   292	    <main className="moral">
   293	      <div className="kicker">The end</div>
   294	      <p className="spoken">“{story.moral.spoken}”</p>
   295	      {!listener && (
   296	        <>
   297	          <div className="kicker">{stage === "try" ? `${kid} reads the whole line` : stage === "help" ? "tap the word that needs help" : stage === "word" ? `${kid} blends that word` : "now the whole line again, smoothly"}</div>
   298	          <p className="line">
   299	            {line.results.map((r, i) => {
   300	              const tp = r.ok && r.kind === "tricky" ? (TRICKY_PARTS[r.word] ?? `|${r.word}`).split("|") : null;
   301	              return (
   302	                <span key={i} className="tokwrap">{parts[i].lead}<button className={"lw " + (r.ok && r.kind === "tricky" ? "tricky" : "magic") + (helped === i ? " helped" : "")} disabled={stage === "try"} onClick={() => help(i)}>
   303	                  {tp ? <><span>{words[i].slice(0, tp[0].length)}</span><u className="odd">{words[i].slice(tp[0].length)}</u></> : words[i]}
   304	                </button>{parts[i].punct}</span>
   305	              );
   306	            })}
   307	          </p>
   308	          <div className="legend"><i className="sw magic" /> sound it out <i className="sw tricky" /> tricky word: <u className="odd">odd bit</u> underlined</div>
   309	          <div className="script"><b>{reader}</b>: {stage === "try" ? "let them read the whole line first." : stage === "help" ? "tap the word they stuck on." : stage === "word" ? "wait for them to slide through it and say it as one word." : "ask for the whole line once more, smoothly."}</div>
   310	        </>
   311	      )}
   312	      <div className="btns">
   313	        {listener ? <button className="yes" onClick={onYes}>The end ✓</button> : stage === "try" ? (
   314	          <><button className="no" onClick={() => setStage("help")}>Needs help on a word</button><button className="yes" onClick={finishLine}><CheckIcon /> Read it smoothly</button></>
   315	        ) : stage === "help" ? (
   316	          <button className="no" onClick={() => setStage("try")}>← back</button>
   317	        ) : stage === "word" ? (
   318	          <><button className="no" onClick={() => helped !== null && help(helped)}>Show me again</button><button className="yes" onClick={() => setStage("reread")}>✓ They blended it</button></>
   319	        ) : (
   320	          <><button className="no" onClick={() => setStage("help")}>Another word</button><button className="yes" onClick={finishLine}>✓ Read it smoothly</button></>
   321	        )}
   322	      </div>
   323	    </main>
   324	  );
   325	}
   326	
   327	/** Specific feedback, not a trophy: what the child actually did with each word. */
   328	function Done({ story, results, bedtime, kid, learner, onHome }: { story: Story; results: WordResult[]; bedtime: boolean; kid: string; learner: LearnerModel; onHome: () => void }) {
   329	  const ok = results.filter((r) => r.ok);
   330	  const line = (r: WordResult) => {
   331	    const gs = checkWord(r.word, learner).graphemes.join("-");
   332	    if (!r.ok) return `${r.word} · tomorrow`;
   333	    if (r.mode === "first_try") return `${r.word} · slid through ${gs} first try`;
   334	    if (r.mode === "prompted") return `${r.word} · blended it after a nudge`;
   335	    return `${r.word} · heard it slid through, then did it`;
   336	  };
   337	  return (
   338	    <main className="done">
   339	      {!bedtime && ok.length > 0 && <Confetti />}
   340	      <div className="badge rise">{bedtime ? <MoonIcon size={84} /> : <Art art={story.pages[0].art} />}</div>
   341	      <h2 className="rise">{story.title}</h2>
   342	      {results.length > 0 && <ul className="results">{results.map((r, i) => <li key={(r.id ?? r.word) + i} className={r.ok ? "ok" : "no"}>{line(r)}</li>)}</ul>}
   343	      <p className="show">{bedtime ? `Lights low. One real book, then sleep.` : ok.length ? `Now go find someone and read them your ${ok.length === 1 ? "word" : "words"}, ${kid}!` : `Good listening, ${kid}. Those words come back tomorrow for a warm-up.`}</p>
   344	      {!bedtime && ok.length > 0 && <p className="bigwords">{ok.map((r, i) => <span key={(r.id ?? r.word) + i}>{r.word}</span>)}</p>}
   345	      <div className="btns"><button className="yes" onClick={onHome}><CheckIcon /> Done</button></div>
   346	    </main>
   347	  );
   348	}
   349	
   350	function Confetti() {
   351	  const bits = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ l: (i * 37) % 100, d: (i % 6) * 0.15, c: ["#f3c7e6", "#d8ecd2", "#ffe9a8", "#dbe7f7"][i % 4] })), []);
   352	  return <div className="confetti" aria-hidden>{bits.map((b, i) => <i key={i} style={{ left: `${b.l}%`, animationDelay: `${b.d}s`, background: b.c }} />)}</div>;
   353	}

exec
/bin/zsh -lc 'nl -ba docs/plan-v2.md' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	# StoryTime plan v3 — follow-along in "I read", phoneme audio, narrator voice (2026-09-11)
     2	
     3	v2 → v3: folded Grok's review (docs/reviews/grok-plan-v2.md). Every [P1] accepted except where noted under "Not taken".
     4	
     5	Context: StoryTime is a phonics PWA (Vite/React/TS, IndexedDB, GitHub Pages + Vercel) for a 4-year-old who knows letters and most sounds. A grown-up reads the story; the child reads decodable "magic words" (Letters & Sounds phase 2, CVC only, adult-judged verdicts, no machine grading). Modes: "Nani reads" (recorded narration, karaoke highlight via tokens[].ms, stops at each magic word) and "I read" (sound off; the grown-up reads the grey words aloud; the child taps the pink word, then the word card with letter tiles and a blended model). Today in "I read" nothing highlights (`token={listen ? ctx.token : -1}` in Story.tsx).
     6	
     7	## Owner feedback (parent)
     8	1. In "I read" the child cannot follow the print; wants words to light up as the grown-up reads.
     9	2. Phoneme clips are wrong: "s" plays as "sss-aa-aa-sss". Confirmed: the current Commons files are `[sa asa]` and `[ata]` style; plosives have no isolated sound; vowels are fine.
    10	3. Narrator: a regular US voice, not Indian English.
    11	
    12	## Execution order
    13	### 1. Phoneme fallback clips, hand-cut (one accent)
    14	- Keep the original .ogg files. A `scripts/phoneme-cuts.json` of start/end ms per clip, decided by listening, cut with a 10 ms fade. Class rules: `s f h` = unvoiced portion, stop at first voicing; `m n l r` = the steady continuant before the vowel transition; vowels = 280–350 ms from the middle; `t p k` = burst + 25–40 ms, nothing voiced after; `b d g` = burst −10 ms to burst +15–25 ms. Voicing map is a check, not the cutter.
    15	- Acceptance: play s, t, m alone; blend sat / pin / dog / puff; reject any clip with a vowel tail or a letter name.
    16	- One accent: narrator becomes US (edge-tts `en-US-AndrewMultilingualNeural` default, rate retuned; Jenny alternative); `pickVoice()` in speech.ts prefers en-US; the `o` clip becomes the US `/ɑ/` recording so got/pot/not match the narrator. Attribution + "edited: cut to isolated sound" noted in manifest.json (CC BY-SA derivative).
    17	- blend.ts: stop hold becomes `min(clipMs, 80)`, the vowel starts during the burst, crossfade scaled to the clip; never a digital-silence gap. Re-run library contract tests after re-rendering timings with the new voice; confirm WordBoundary events align 1:1.
    18	
    19	### 2. Finger-follow in "I read" (primary, default, offline)
    20	- pointerdown/pointermove on `.sentence` with setPointerCapture + elementFromPoint → `TOKEN` index; `touch-action: none` on the sentence; pass `token={ctx.token}` in read mode.
    21	- The word under the finger lights now (moving underline + the existing `.now`); previously passed words keep a light `.read` trail as secondary cue.
    22	- Sliding onto the pending pink word never opens the card and never marks it read; the tap does that as today.
    23	- Word hit targets ≥ 48 px (padding + line-height) before this ships. No tap-to-hear on grey words.
    24	- Also works for the child: "you drive the finger while Papa reads".
    25	
    26	### 3. "Record the sounds" screen (family voice beats the fallback)
    27	- Settings → Sounds: ~19 unique sounds (c/k/ck, f/ff, l/ll, s/ss share one clip). Coaching per sound (stretchy sss mmm nnn fff lll rrr; bouncy t p k b d g with almost no "uh"; never the letter name). Hold-to-record with a 500 ms minimum, trim silence on save, reject > 1.2 s, autoplay then Keep / Redo. Stored in IndexedDB as blobs.
    28	- One sound resolver used by every call site (tiles, playBlend, Teach, Warm-up, SegmentPanel): family blob → fallback clip. Invalidate the blend.ts buffer cache on re-record. `<audio>` fallback if decodeAudioData fails on WebKit.
    29	- Progress "12 of 19 sounds in Papa's voice".
    30	
    31	### 4. Voice follow (opt-in enhancement, push-to-talk contract)
    32	- Off until a tap on "Follow my voice" on the page. Singleton `webkitSpeechRecognition`, `lang=en-US`, `continuous=false` on iOS, `interimResults=true`. On silence `onend` → restart once within 200 ms, at most 3 times per page, else drop to finger-follow with a "Tap to follow again" chip. Never `start()` from an effect; abort on MagicPanel open, on visibilitychange, on Home; do not resume automatically after the word card. Never runs beside MediaRecorder.
    33	- Aligner: accept the next token, or skip at most one closed-class word (a, the, to, of, and…); never move on a low-confidence interim; ignore hits on the pending pink word; catch-up is a tap on the word just said (finger-follow is always live underneath).
    34	- Honest UI: an "offline / not available here" state instead of a spinning mic. Privacy copy rewritten in-app and README before the toggle ships ("with voice follow on, audio is processed by Apple or Google"); opt-in per session.
    35	- Test matrix the owner runs: iPhone Safari tab, iPhone home-screen app, iPad, Android Chrome. Chrome emits final results only; one aligner handles both shapes.
    36	- Ships only if the lag stays under a word on the owner's phone; otherwise it stays hidden behind a settings flag.
    37	
    38	### 5. "I'll try" — one extra word per page
    39	- At most one upcoming (not yet highlighted) decodable grey word per page can be offered as the child's word, grown-up confirms, through the same fail-closed validator (CVC, not tricky, no exceptions). Never competes with the designed pink word.
    40	
    41	### 6. Family-story timings by tap-as-you-record
    42	- When recording a family page, the parent taps each word as they say it; `Date.now() − t0` fills `tokens[].ms` in the format gen-audio.py writes. Also offered on playback for existing recordings. Offline, no cloud. Replaces the ASR-during-record idea.
    43	
    44	## Not taken from the review, and why
    45	- "Do not ship voice follow at all": kept as an opt-in enhancement behind the iOS contract above, because the owner asked for it and Android Chrome is a fair target; finger-follow is the default and the plan does not depend on voice.
    46	
    47	## Rules that must hold
    48	Never TTS for phoneme clips (recordings only). No red/buzzer on a miss. Validator fails closed. Don't remove features to satisfy a reviewer. Neutral names in the public repo. Adult keeps every verdict; ASR never judges the child.

exec
/bin/zsh -lc 'nl -ba src/components/MagicPanel.tsx' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	import { useEffect, useMemo, useState } from "react";
     2	import { GRAPHEME_SOUND } from "../lib/phonics/learner";
     3	import { checkWord, type LearnerModel } from "../lib/phonics/validator";
     4	import { playClip } from "../lib/audio/player";
     5	import { soundAsset } from "../lib/library";
     6	import { CheckIcon } from "./Icons";
     7	
     8	export type Verdict = "first_try" | "prompted";
     9	
    10	/**
    11	 * The child's word card. Plain letters, no picture: "Start here and slide through the word."
    12	 * Progressive disclosure for the grown-up: first only "First try" / "Needs help"; after "Needs help"
    13	 * one precise nudge, then "After a nudge" / "Show me" / skip. Tile taps only play sounds and never
    14	 * decide the label. A sweep under the graphemes shows the voice sliding through during a model.
    15	 */
    16	export function MagicPanel({ word, learner, modelling, modelledOnce, sweep, kid, reader, kicker, onSound, onYes, onTogether, onSkip }: {
    17	  word: string; learner: LearnerModel; modelling: boolean; modelledOnce?: boolean; sweep?: number; kid: string; reader: string; kicker?: string;
    18	  onSound: () => void; onYes: (v: Verdict) => void; onTogether: () => void; onSkip?: () => void;
    19	}) {
    20	  const gs = useMemo(() => checkWord(word, learner).graphemes, [word, learner]);
    21	  const [said, setSaid] = useState(0);
    22	  const [help, setHelp] = useState(false);
    23	  useEffect(() => { setSaid(0); setHelp(false); }, [word]);
    24	  useEffect(() => { if (modelledOnce) setHelp(true); }, [modelledOnce]);
    25	  const tap = (i: number) => {
    26	    if (modelling) return;
    27	    void playClip(soundAsset(GRAPHEME_SOUND[gs[i]].clip)).done.catch(() => {});
    28	    if (i === said) { setSaid(i + 1); onSound(); }
    29	  };
    30	  return (
    31	    <section className="panel" role="dialog" aria-label="Magic word">
    32	      <div className="kicker">{kicker ?? `Magic word · ${kid}'s turn`}</div>
    33	      <h2 className="panel-h">Start here and slide through the word. Keep your voice going.</h2>
    34	      <div className="tiles-wrap">
    35	        <div className="tiles">
    36	          {gs.map((g, i) => (
    37	            <button key={i} className={["tile", i < said || modelling ? "said" : "", i === said && !modelling ? "next" : ""].join(" ")} onClick={() => tap(i)} aria-label={`${g}, says ${GRAPHEME_SOUND[g].label}`}>
    38	              <small>{GRAPHEME_SOUND[g].label}</small>{g}
    39	            </button>
    40	          ))}
    41	        </div>
    42	        <div className="sweep" aria-hidden><i style={{ width: `${Math.round((sweep ?? 0) * 100)}%`, opacity: modelling ? 1 : 0 }} /></div>
    43	      </div>
    44	      <div className="verdict grownup">
    45	        {!help ? (
    46	          <>
    47	            <div className="hint"><span className="tag">{reader}</span> wait 5 seconds. Did {kid} say it as <b>one word</b>? <small className="legend">(stuck on a sound? tap that letter — never say its name)</small></div>
    48	            <div className="btns">
    49	              <button className="no" disabled={modelling} onClick={() => setHelp(true)}>Needs help</button>
    50	              <button className="yes" disabled={modelling} onClick={() => onYes("first_try")}><CheckIcon /> First try</button>
    51	            </div>
    52	          </>
    53	        ) : modelledOnce ? (
    54	          <>
    55	            <div className="hint"><span className="tag">{reader}</span> now {kid} slides through it alone.</div>
    56	            <div className="btns">
    57	              <button className="no" disabled={modelling} onClick={onTogether}>Show me again</button>
    58	              <button className="yes soft" disabled={modelling} onClick={() => onYes("prompted")}>✓ Slid through it after the model</button>
    59	            </div>
    60	          </>
    61	        ) : (
    62	          <>
    63	            <div className="hint"><span className="tag">{reader}</span> one nudge, then wait: point to the first letter and say <em>“Start here… slide.”</em> Nothing more.</div>
    64	            <div className="btns">
    65	              <button className="no" disabled={modelling} onClick={onTogether}>Show me: slide through it</button>
    66	              <button className="yes soft" disabled={modelling} onClick={() => onYes("prompted")}><CheckIcon /> After a nudge</button>
    67	            </div>
    68	          </>
    69	        )}
    70	        <div className="row center">
    71	          <button className="skip" disabled={modelling} onClick={() => setSaid(0)}>look again — start here ↺</button>
    72	          {help && onSkip && <button className="skip" disabled={modelling} onClick={onSkip}>skip for today →</button>}
    73	        </div>
    74	        {help && <p className="adultnote">Sounds, not letter names · don't give the first sound · no guessing from the picture · any accent is fine · ✓ only after the whole word.</p>}
    75	      </div>
    76	    </section>
    77	  );
    78	}

exec
/bin/zsh -lc 'nl -ba src/lib/blend.ts' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	/**
     2	 * Continuous blending model ("slide through the word").
     3	 *
     4	 * Real IPA recordings, scheduled on a Web Audio graph so each sound genuinely overlaps the
     5	 * next (crossfade), with explicit targets: continuants ~450 ms, vowels ~320 ms, stops as short
     6	 * as their release allows. Never a whole-word recording, never a gap, never a letter name.
     7	 * Falls back to back-to-back clips when Web Audio is unavailable.
     8	 */
     9	import { playClip } from "./audio/player";
    10	import { GRAPHEME_SOUND } from "./phonics/learner";
    11	import { soundAsset } from "./library";
    12	
    13	export const CONTINUANTS = new Set(["s", "ss", "f", "ff", "m", "n", "l", "ll", "r", "h"]);
    14	export const VOWELS = new Set(["a", "e", "i", "o", "u"]);
    15	const HOLD_MS = (g: string) => (CONTINUANTS.has(g) ? 450 : VOWELS.has(g) ? 320 : 230);
    16	const XFADE_MS = 70;
    17	
    18	let ctx: AudioContext | null = null;
    19	const buffers = new Map<string, Promise<AudioBuffer>>();
    20	
    21	/** Create/resume the graph inside a user gesture (called from unlock()). */
    22	export function unlockBlendAudio(): void {
    23	  try {
    24	    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    25	    if (ctx.state === "suspended") void ctx.resume();
    26	  } catch { ctx = null; }
    27	}
    28	
    29	async function buffer(clip: string): Promise<AudioBuffer> {
    30	  const url = soundAsset(clip);
    31	  let p = buffers.get(url);
    32	  if (!p) { p = fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)); buffers.set(url, p); }
    33	  return p;
    34	}
    35	
    36	export interface BlendOpts { rate?: number; alive?: () => boolean; onProgress?: (fraction: number) => void }
    37	
    38	/** Play the graphemes as one continuous, overlapping stretch. Resolves when the last sound fades. */
    39	export async function playBlend(graphemes: string[], opts: BlendOpts = {}): Promise<void> {
    40	  const alive = opts.alive ?? (() => true);
    41	  const rate = opts.rate ?? 1;
    42	  unlockBlendAudio();
    43	  if (ctx && ctx.state !== "closed") {
    44	    try {
    45	      const bufs = await Promise.all(graphemes.map((g) => buffer(GRAPHEME_SOUND[g].clip)));
    46	      if (!alive()) return;
    47	      const t0 = ctx.currentTime + 0.05; let t = t0; const total = graphemes.reduce((n, g) => n + HOLD_MS(g) / rate, 0) / 1000;
    48	      graphemes.forEach((g, i) => {
    49	        const src = ctx!.createBufferSource(); src.buffer = bufs[i];
    50	        const gain = ctx!.createGain(); src.connect(gain); gain.connect(ctx!.destination);
    51	        const hold = HOLD_MS(g) / rate / 1000; const fade = XFADE_MS / 1000;
    52	        gain.gain.setValueAtTime(i === 0 ? 1 : 0.0001, t);
    53	        if (i > 0) gain.gain.exponentialRampToValueAtTime(1, t + fade);
    54	        gain.gain.setValueAtTime(1, t + hold);
    55	        gain.gain.exponentialRampToValueAtTime(0.0001, t + hold + fade);
    56	        src.start(t, 0, hold + fade); // the next sound starts before this one has faded: no gap, real overlap
    57	        t += hold - fade * 0.5;
    58	      });
    59	      const end = t + XFADE_MS / 1000;
    60	      await new Promise<void>((res) => { const id = setInterval(() => { const f = Math.min(1, (ctx!.currentTime - t0) / total); opts.onProgress?.(f); if (ctx!.currentTime >= end || !alive()) { clearInterval(id); opts.onProgress?.(1); res(); } }, 30); });
    61	      return;
    62	    } catch { /* fall through to the simple player */ }
    63	  }
    64	  // fallback: back-to-back clips through the singleton player
    65	  for (let i = 0; i < graphemes.length; i++) {
    66	    if (!alive()) return;
    67	    let p; try { p = playClip(soundAsset(GRAPHEME_SOUND[graphemes[i]].clip)); } catch { continue; }
    68	    opts.onProgress?.(i / graphemes.length);
    69	    await new Promise<void>((res) => { const t0 = Date.now(); const id = setInterval(() => { const el = p.el; if (el.currentTime * 1000 >= HOLD_MS(graphemes[i]) || el.ended || Date.now() - t0 > 1500) { clearInterval(id); res(); } }, 30); });
    70	  }
    71	  opts.onProgress?.(1);
    72	}
    73	
    74	/** Caption for a blend: no dots, no gaps — the whole word as one stretched shape. */
    75	export const stretched = (graphemes: string[]) => graphemes.map((g) => (CONTINUANTS.has(g) || VOWELS.has(g) ? GRAPHEME_SOUND[g].label.replace(/(.)\1+/g, "$1$1$1") : GRAPHEME_SOUND[g].label)).join("");
    76	/** Kept for the parent summary. */
    77	export const dotted = (graphemes: string[]) => graphemes.map((g) => GRAPHEME_SOUND[g]?.label ?? g).join("·");

exec
/bin/zsh -lc 'nl -ba src/lib/audio/record.ts' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	/**
     2	 * Parent-recorded narration (MediaRecorder). The recording is stored as a data URL on the
     3	 * page, so a family story can be read in Nani's real voice, offline, with no server.
     4	 * iOS Safari records audio/mp4; Chrome records audio/webm. Both play back in <audio>.
     5	 */
     6	export interface Recorder { stop: () => Promise<{ dataUrl: string; ms: number } | null> }
     7	
     8	export async function startRecording(): Promise<Recorder> {
     9	  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    10	  const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    11	  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    12	  const chunks: Blob[] = [];
    13	  const t0 = Date.now();
    14	  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    15	  rec.start();                        // no timeslice: iOS produces an empty/invalid mp4 with one
    16	  let settled: Promise<{ dataUrl: string; ms: number } | null> | null = null;
    17	  const release = () => stream.getTracks().forEach((t) => t.stop());
    18	  return {
    19	    stop: () => settled ??= new Promise((resolve) => {   // idempotent: every outcome settles exactly once
    20	      const ms = Date.now() - t0;                          // measured at stop, not after encoding
    21	      const finish = (v: { dataUrl: string; ms: number } | null) => { release(); resolve(v); };
    22	      rec.onerror = () => finish(null);
    23	      rec.onstop = () => {
    24	        const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
    25	        if (!blob.size) return finish(null);
    26	        const fr = new FileReader();
    27	        fr.onerror = () => finish(null);
    28	        fr.onload = () => finish({ dataUrl: fr.result as string, ms });
    29	        fr.readAsDataURL(blob);
    30	      };
    31	      if (rec.state === "inactive") { rec.onstop?.(new Event("stop")); return; }
    32	      try { rec.stop(); } catch { finish(null); }
    33	      setTimeout(() => finish(null), 8000);               // never leave the builder waiting
    34	    }),
    35	  };
    36	}
    37	
    38	export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

exec
/bin/zsh -lc 'nl -ba scripts/fetch-phonemes.py' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	#!/usr/bin/env python3
     2	"""
     3	Fetch real human phoneme recordings from Wikimedia Commons (the canonical IPA sound
     4	files, CC-licensed) and convert them into public/sounds/<grapheme>.m4a.
     5	
     6	Why not TTS: a neural voice cannot say a bare consonant — "sss" comes out as "ess"
     7	(measured: ~45% voiced frames). The Commons IPA set is what phonetics courses use.
     8	
     9	  python3 scripts/fetch-phonemes.py
    10	
    11	Writes public/sounds/manifest.json with source URL + licence per clip.
    12	"""
    13	import json, re, shutil, subprocess, sys, urllib.parse, urllib.request
    14	from pathlib import Path
    15	
    16	ROOT = Path(__file__).resolve().parents[1]
    17	OUT = ROOT / "public" / "sounds"; OUT.mkdir(parents=True, exist_ok=True)
    18	
    19	def ffmpeg():
    20	    f = shutil.which("ffmpeg")
    21	    if f: return f
    22	    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
    23	FF = ffmpeg()
    24	
    25	# grapheme (as taught in Letters & Sounds phase 2) -> Commons IPA recording
    26	FILES = {
    27	    "s": "Voiceless_alveolar_sibilant.ogg",
    28	    "a": "Near-open_front_unrounded_vowel.ogg",      # /æ/ as in cat
    29	    "t": "Voiceless_alveolar_plosive.ogg",
    30	    "p": "Voiceless_bilabial_plosive.ogg",
    31	    "i": "Near-close_near-front_unrounded_vowel.ogg", # /ɪ/ as in sit
    32	    "n": "Alveolar_nasal.ogg",
    33	    "m": "Bilabial_nasal.ogg",
    34	    "d": "Voiced_alveolar_plosive.ogg",
    35	    "g": "Voiced_velar_plosive.ogg",
    36	    "o": "Open_back_rounded_vowel.ogg",               # /ɒ/ as in dog
    37	    "k": "Voiceless_velar_plosive.ogg",               # also c, ck
    38	    "e": "Open-mid_front_unrounded_vowel.ogg",        # /ɛ/ as in bed
    39	    "u": "Open-mid_back_unrounded_vowel.ogg",         # /ʌ/ as in cup
    40	    "r": "Alveolar_approximant.ogg",
    41	    "h": "Voiceless_glottal_fricative.ogg",
    42	    "b": "Voiced_bilabial_plosive.ogg",
    43	    "f": "Voiceless_labiodental_fricative.ogg",       # also ff
    44	    "l": "Alveolar_lateral_approximant.ogg",          # also ll
    45	}
    46	
    47	API = "https://commons.wikimedia.org/w/api.php"
    48	UA = {"User-Agent": "StoryTime/0.1 (phonics app; https://github.com/soodr321/StoryTime)"}
    49	
    50	def info(title):
    51	    q = urllib.parse.urlencode({"action": "query", "titles": f"File:{title}", "prop": "imageinfo", "iiprop": "url|extmetadata", "format": "json"})
    52	    with urllib.request.urlopen(urllib.request.Request(f"{API}?{q}", headers=UA)) as r:
    53	        d = json.load(r)
    54	    page = next(iter(d["query"]["pages"].values()))
    55	    if "imageinfo" not in page: raise SystemExit(f"not found on Commons: {title}")
    56	    ii = page["imageinfo"][0]; md = ii.get("extmetadata", {})
    57	    return ii["url"], md.get("LicenseShortName", {}).get("value", "?"), re.sub("<[^>]+>", "", md.get("Artist", {}).get("value", "?")).strip()
    58	
    59	def main():
    60	    man = {}
    61	    for g, title in FILES.items():
    62	        url, lic, artist = info(title)
    63	        raw = OUT / f"{g}.ogg"
    64	        with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r, open(raw, "wb") as f: f.write(r.read())
    65	        m4a = OUT / f"{g}.m4a"
    66	        # trim silence, normalise loudness, cap at 1.2 s (IPA files are sometimes repeated twice)
    67	        subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(raw), "-af",
    68	                        "silenceremove=start_periods=1:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse,atrim=0:1.2,loudnorm=I=-18:TP=-2,apad=pad_dur=0.1",
    69	                        "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1", str(m4a)], check=True)
    70	        raw.unlink()
    71	        probe = subprocess.run([FF, "-i", str(m4a)], capture_output=True, text=True).stderr
    72	        mm = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe); ms = int((int(mm[1]) * 3600 + int(mm[2]) * 60 + float(mm[3])) * 1000)
    73	        man[g] = {"audio": f"{g}.m4a", "ms": ms, "recorded": True, "source": f"https://commons.wikimedia.org/wiki/File:{title}", "license": lic, "artist": artist}
    74	        print(f"  {g:2s} {ms:5d} ms  {lic:12s} {title}")
    75	    (OUT / "manifest.json").write_text(json.dumps(man, indent=1))
    76	    print(f"{len(man)} phoneme clips → public/sounds/ (attribution in manifest.json)")
    77	
    78	if __name__ == "__main__": main()

exec
/bin/zsh -lc 'nl -ba scripts/gen-audio.py' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	#!/usr/bin/env python3
     2	"""
     3	Generate narration audio + word timings for every story in library/, plus the
     4	shared narrator prompts, into public/library/<slug>/ and public/prompts/.
     5	
     6	  python3 scripts/gen-audio.py            # all stories
     7	  python3 scripts/gen-audio.py fox-and-crow
     8	
     9	Voice: edge-tts en-IN-NeerjaNeural ($0, word boundaries built in). Audio is a
    10	deploy-time artefact: public/library/**/*.m4a is gitignored. Recorded phoneme
    11	clips live in public/sounds/ and are committed; this script only creates
    12	nothing under public/sounds/ — phoneme clips are real recordings fetched by
    13	scripts/fetch-phonemes.py (Wikimedia Commons IPA set, CC BY-SA).
    14	
    15	Requires: pip install edge-tts ; ffmpeg on PATH (or imageio-ffmpeg).
    16	"""
    17	import asyncio, json, os, re, shutil, subprocess, sys
    18	from pathlib import Path
    19	
    20	try:
    21	    import edge_tts
    22	except ImportError:
    23	    sys.exit("pip install edge-tts")
    24	
    25	ROOT = Path(__file__).resolve().parents[1]
    26	LIB, PUB = ROOT / "library", ROOT / "public"
    27	NANI, RATE = "en-IN-NeerjaNeural", "-8%"
    28	
    29	def ffmpeg():
    30	    f = shutil.which("ffmpeg")
    31	    if f: return f
    32	    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
    33	FF = ffmpeg()
    34	
    35	def norm(s): return re.sub(r"[^a-z]", "", s.lower())
    36	
    37	async def tts(text, out_m4a, voice=NANI, rate=RATE):
    38	    """Synthesize text → m4a (AAC, plays on iOS). Returns (duration_ms, [(word, start_ms)])."""
    39	    tmp = out_m4a.with_suffix(".mp3"); words = []
    40	    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    41	    with open(tmp, "wb") as f:
    42	        async for ch in com.stream():
    43	            if ch["type"] == "audio": f.write(ch["data"])
    44	            elif ch["type"] == "WordBoundary": words.append((ch["text"], ch["offset"] / 1e4))
    45	    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(tmp), "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1", str(out_m4a)], check=True)
    46	    tmp.unlink()
    47	    probe = subprocess.run([FF, "-i", str(out_m4a)], capture_output=True, text=True).stderr
    48	    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
    49	    ms = int((int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])) * 1000)
    50	    return ms, words
    51	
    52	def align(tokens, words):
    53	    """Map TTS word boundaries onto display tokens 1:1 by normalised text, in order.
    54	    A token may span several TTS words (e.g. 'Caw!' vs 'Caw'); a TTS word may never span tokens.
    55	    Returns list of start_ms per token, or raises with a clear message."""
    56	    out, wi = [], 0
    57	    for ti, tok in enumerate(tokens):
    58	        target = norm(tok)
    59	        if not target:  # pure punctuation token
    60	            out.append(words[wi][1] if wi < len(words) else (out[-1] if out else 0)); continue
    61	        acc, start = "", None
    62	        while wi < len(words) and len(acc) < len(target):
    63	            w, ms = words[wi]
    64	            if start is None: start = ms
    65	            acc += norm(w); wi += 1
    66	        if acc != target:
    67	            raise SystemExit(f"alignment failed at token {ti} {tok!r}: tts gave {acc!r}")
    68	        out.append(int(start))
    69	    if wi != len(words):
    70	        raise SystemExit(f"alignment failed: {len(words) - wi} unused tts words")
    71	    return out
    72	
    73	async def build_story(slug):
    74	    src = LIB / slug / "story.json"; story = json.loads(src.read_text())
    75	    out = PUB / "library" / slug; out.mkdir(parents=True, exist_ok=True)
    76	    for i, p in enumerate(story["pages"], 1):
    77	        text = p.pop("text", None) or " ".join(t["t"] for t in p["tokens"])
    78	        toks = text.split(" ")
    79	        ms, words = await tts(text, out / f"p{i}.m4a")
    80	        starts = align(toks, words)
    81	        p["tokens"] = [{"t": t, "ms": s} for t, s in zip(toks, starts)]
    82	        p["audio"], p["audioMs"] = f"p{i}.m4a", ms
    83	        print(f"  {slug} p{i}: {ms} ms, {len(toks)} tokens")
    84	    ms, _ = await tts(story["moral"]["spoken"], out / "moral.m4a")
    85	    story["moral"]["audio"], story["moral"]["audioMs"] = "moral.m4a", ms
    86	    # story-specific narrator prompts (magic word feedback)
    87	    story["prompts"] = {}
    88	    for p in story["pages"]:
    89	        for w in p.get("magic", []):
    90	            for key, text in ((f"yes:{w}", f"Yes! {w}."), (f"word:{w}", f"{w}.")):
    91	                m, _ = await tts(text, out / f"{key.replace(':', '-')}.m4a"); story["prompts"][key] = {"audio": f"{key.replace(':', '-')}.m4a", "ms": m}
    92	    (out / "story.json").write_text(json.dumps(story, ensure_ascii=False, indent=1))
    93	    src.write_text(json.dumps(story, ensure_ascii=False, indent=1))  # tokens + timings are part of the contract
    94	
    95	SHARED = {
    96	    "yours": "This one is yours. Can you read it?",
    97	    "fast": "Now say it fast.",
    98	    "notyet": "That's okay. Listen to me blend it, then you try.",
    99	    "yourturn": "Your turn.",
   100	    "practise": "We'll practise it tomorrow.",
   101	    "line": "Now you. Read your line.",
   102	    "done": "Beautiful reading. This story goes on your shelf.",
   103	    "pick": "Pick today's story. One tap.",
   104	}
   105	async def build_shared():
   106	    out = PUB / "prompts"; out.mkdir(parents=True, exist_ok=True); man = {}
   107	    for k, text in SHARED.items():
   108	        ms, _ = await tts(text, out / f"{k}.m4a"); man[k] = {"audio": f"{k}.m4a", "ms": ms}
   109	    (out / "manifest.json").write_text(json.dumps(man, indent=1))
   110	    print("  shared prompts done (phoneme clips come from scripts/fetch-phonemes.py, not TTS)")
   111	
   112	async def main():
   113	    slugs = sys.argv[1:] or [p.name for p in LIB.iterdir() if (p / "story.json").exists()]
   114	    await build_shared()
   115	    for s in slugs: print(s); await build_story(s)
   116	
   117	asyncio.run(main())

exec
/bin/zsh -lc 'nl -ba docs/reviews/grok-plan-v2.md' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	I'll read the plan and the implementation files you named, then review them as a K-1 phonics teacher and as someone who ships iPhone PWAs.The plan is thin on iOS PWA mic behavior and clip-cutting. I’ll pull the rest of the audio, PWA, and phonics code so the findings map to what actually ships.There's already a prior plan review on disk. I'll read the audio, store, and PWA pieces next, plus current iOS Speech Recognition constraints.I’ll check the actual phoneme files and current iOS Speech Recognition behavior so the clip-cutting and PWA findings aren’t guesswork.The plan solves the right three problems (broken phoneme clips, no print-following in “I read”, Indian-English narrator) and then aims the implementation at the wrong tools. Finger-follow is the product. Wikimedia auto-cutting and live `webkitSpeechRecognition` karaoke are the risks. Several numbered steps will fail on a home-screen iPhone or teach the 4-year-old the wrong print-to-voice map.
     2	
     3	---
     4	
     5	## Phoneme clips
     6	
     7	**[P1] “Cut the first isolated segment” is false for the files you actually download.**
     8	
     9	`scripts/fetch-phonemes.py` pulls the *current* Commons objects, then keeps the first 1.2 s plus 100 ms pad. That is why `s.m4a` / `t.m4a` / `p.m4a` / `m.m4a` are all **1.30 s**. The live files are not “sound, then example”:
    10	
    11	- `Voiceless_alveolar_sibilant.ogg` is labelled **`[sa asa]`** (2024 Isotalo remaster). There is no isolated `[s]`. First-segment cutting yields **`sa`**, which is exactly the “sss-aa-aa-sss” the parent heard.
    12	- `Voiceless_alveolar_plosive.ogg` is labelled **`[ata]`**, 1.9 s. There is no isolated `[t]`. “First segment” is the leading **`[a]`**.
    13	
    14	A generic cutter cannot be the plan. For 19 clips, write a `cuts.json` of `start_ms` / `end_ms` after a human listen, then `ffmpeg -ss -t` with a short fade. Keep the original `.ogg`. Automated voicing is a **check**, not a cutter.
    15	
    16	**[P1] Burst + ~60 ms will still be “tuh”, and a voiced/hiss map will wreck nasals and liquids.**
    17	
    18	Stops are silence + burst + vowel. English aspirated `/t/` VOT is ~40–80 ms; 60 ms after the burst of `[ata]` is already into `[a]`. Voiced `/b d g/` have near-zero VOT, so 60 ms is “buh/duh/guh”.
    19	
    20	A 20 ms voiced/hiss map is the wrong feature for a mixed set:
    21	
    22	| Class | What to keep | What “hiss = good” does |
    23	|---|---|---|
    24	| `s f h` | unvoiced, high ZCR, cut at first F0 | OK |
    25	| `m n l r` | voiced nasal/liquid, cut at the F2 jump into a vowel | throws the clip away or keeps the VCV |
    26	| vowels | 280–350 ms of stable formants from the **middle** | irrelevant |
    27	| `t p k` | burst + **25–40 ms**, 10 ms fade, no formants after | maybe |
    28	| `b d g` | burst−10 ms to burst+**15–25 ms** | fails |
    29	
    30	Acceptance is not a frame histogram. Play `s`, `t`, `m` alone, then blend **sat / pin / dog / puff**. Reject any clip with a second vowel or a letter name.
    31	
    32	**[P1] Cutting stops without changing `blend.ts` reintroduces gaps.**
    33	
    34	```15:16:src/lib/blend.ts
    35	const HOLD_MS = (g: string) => (CONTINUANTS.has(g) ? 450 : VOWELS.has(g) ? 320 : 230);
    36	const XFADE_MS = 70;
    37	```
    38	
    39	`src.start(t, 0, hold + fade)` on a ~40 ms buffer plays 40 ms of burst then **~190 ms of digital silence**. That fights the “never a gap” contract. Same item as the cutter must set stop hold to `min(clipMs, 80)` and start the vowel during the burst, not after a 230 ms hold. A 70 ms crossfade on a 40 ms stop is the whole stop.
    40	
    41	**[P1] US Andrew + British `/ɒ/` + leftover `en-IN` synthesis is three accents.**
    42	
    43	`o` is `Open_back_rounded_vowel.ogg` (`/ɒ/`, L&S “dog”). US Andrew will say *got/pot/not* as `/ɑ/`. Magic words in the library include `got`, `pot`, `not`. And the live fallback is still Indian English:
    44	
    45	```12:12:src/lib/audio/speech.ts
    46	voice = vs.find((v) => /en-IN/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang) && /female|samantha|karen|moira/i.test(v.name)) ?? ...
    47	```
    48	
    49	That path still speaks family stories with no recording, listener tap-to-hear, and the “I read” captions. Changing `NANI` in `gen-audio.py` is not enough. Pick **one** accent for Commons vowels, edge-tts, and `pickVoice()`. If the narrator is US, swap `o` to an unrounded `/ɑ/` recording.
    50	
    51	**[P2] CC BY-SA 3.0:** a cut is a derivative work. Keep attribution and note the edit in `manifest.json`. Fine if the cutter is a table of offsets.
    52	
    53	---
    54	
    55	## Family-recorded sounds
    56	
    57	**[P1] Uncoached MediaRecorder will reproduce the bug you are trying to kill.**
    58	
    59	Parents say letter names (“ess”, “tee”) or a full “tuh”. That is the failure `fetch-phonemes.py` was written to avoid. The plan has no coaching, no listen-back, no max length, no silence trim, no reject.
    60	
    61	Minimum gate, same screen:
    62	
    63	1. Script: stretchy `sss mmm nnn fff lll rrr`; bouncy `t p k b d g` with almost no “uh”; **never the letter name**.
    64	2. Record → autoplay → Keep / Redo.
    65	3. Trim leading/trailing silence on save.
    66	4. Reject > ~1.2 s (they said a word or a name).
    67	5. One resolver used by tiles, `playBlend`, Teach, Warm-up, SegmentPanel. Today every call site goes through `soundAsset()` → `/sounds/${clip}.m4a`.
    68	
    69	**[P1] Short iOS `audio/mp4` clips are the empty-file case `record.ts` already documents.** `MediaRecorder.start()` with no timeslice is required, but a 300 ms tap-and-release still yields an invalid mp4. Force a minimum hold (~500 ms) then trim. `decodeAudioData` on AAC from IndexedDB is historically flaky on WebKit; have an `<audio>` fallback in `playBlend` (it already falls back, but only when the whole graph throws).
    70	
    71	**[P2] “14 of 23 recorded” counts graphemes, not sounds.** `c` / `k` / `ck` share `k`; `ff`/`f`, `ll`/`l`, `ss`/`s` share clips. Ask for ~19 unique sounds. Recording `/k/` three times is busywork and invites three different “kuh”s.
    72	
    73	**[P2] `blend.ts` caches `AudioBuffer`s by URL.** A family re-record must drop that entry or the old Commons clip keeps playing until reload.
    74	
    75	---
    76	
    77	## Web Speech API on iOS Safari / home-screen PWA
    78	
    79	The constraints section already says “historically flaky”. The plan then specifies the exact pattern that fails: **interim results + auto-restart + stop during the word card + resume**.
    80	
    81	**[P1] `recognition.start()` needs a user gesture. `onend` is not one. After MagicPanel, auto-resume will not be reliable.**
    82	
    83	On iPhone:
    84	
    85	- Constructor is `webkitSpeechRecognition`.
    86	- Secure context only (GitHub Pages is fine).
    87	- `start()` must run in the tap’s call stack. Restarting from `onend` after silence sometimes works for a few cycles; restarting after a 20-second word card **usually does not**. `InvalidStateError` / `aborted` / silent no-op.
    88	- Re-`new`ing the recogniser every restart plays the Siri start chime. Use one singleton.
    89	- WebKit’s `continuous` is not Chrome’s. `true` accumulates transcript history and throttles (WebKit bug 288963, still open against Safari 18). On iOS set `continuous = false` and treat `onend` as “this utterance ended”.
    90	- `interimResults = true` is on-device **until** it isn’t: noise, similar words, a pause, then it falls through to Apple’s cloud recogniser. The disclosure is not hypothetical. Offline bedtime = no voice follow-along. The plan already says “No offline voice”; the UI must show that, not a spinning mic.
    91	- Native `SFSpeechRecognizer` cap behind this API: **~60 s per session**, ~1000 requests/hour/device. A silence-restart loop over a six-page story will hit it.
    92	- Playing phoneme tiles uses the audio session and kills recognition. Abort (not ignore) while the word card is open, or the child’s blend will skip-ahead the rest of the page.
    93	- `getUserMedia` / `MediaRecorder` and `SpeechRecognition` **do not share the mic** on iOS. Plan item 5 (recognise *while* the parent records) is the wrong architecture.
    94	
    95	Home-screen PWA is not “Safari with a different icon”:
    96	
    97	- Standalone is a separate WebKit process. Mic / speech permission granted in the Safari tab often **does not** carry to the home-screen app.
    98	- Wake Lock was broken in installed iOS PWAs until 18.4. Bedtime reading dims the screen and dies the recogniser. `visibilitychange` must abort; a dimmed phone is not “still following”.
    99	- Test matrix the plan must name: **iPhone Safari tab, iPhone Add-to-Home-Screen standalone, iPad, Android Chrome**. Chrome ignores `continuous` and emits only `isFinal`. One aligner, two result shapes.
   100	
   101	**[P1] The API has no word timestamps.** You get a growing transcript string. Karaoke in “Nani reads” works because `tokens[].ms` is aligned to `audio.currentTime`. ASR cannot do that. You are fuzzy-matching a lagging string against remaining tokens. The plan’s own “~0.5 s lag” at adult rate (2–3 words/s) is **one to two words behind**. For a 4-year-old using the highlight as “the word being said”, that trains the wrong mapping.
   102	
   103	Concrete iOS contract to write into the plan (or don’t ship voice follow-along):
   104	
   105	1. Mic is **off** until a tap on “Follow my voice”.
   106	2. Singleton, `lang = 'en-US'`, `continuous = false`, `interimResults = true`.
   107	3. Silence `onend` → `setTimeout(start, 200)` **only while that page is still in the same gesture session**; after 3 failures, drop to finger-follow and stop looping.
   108	4. MagicPanel: `abort()`, drop pending results, show **“Tap to follow again”**. Do not claim auto-resume.
   109	5. `visibilitychange` / Home → abort.
   110	6. Never start recognition from a `useEffect`.
   111	7. Do not run beside `MediaRecorder`.
   112	
   113	Push-to-talk is the only pattern iOS developers currently call stable. Continuous bedtime karaoke is not.
   114	
   115	---
   116	
   117	## Pedagogy of highlighting while a grown-up reads
   118	
   119	The parent’s request is right: in “I read”, `token` is hardcoded off, so nothing lights.
   120	
   121	```182:182:src/screens/Story.tsx
   122	token={listen ? ctx.token : -1}
   123	```
   124	
   125	The CSS (`.w.now` / `.w.read`) and `TOKEN` events already exist. The missing feature is a **zero-lag pointer under the word**, not a speech recogniser.
   126	
   127	**[P1] Skip-ahead, never-block alignment is the opposite of K–1 print referencing.**
   128	
   129	Concept of word (Clay / shared reading): one spoken word ↔ one printed word, **at the same moment**. The teacher’s finger *is* the highlight. A 4-year-old who “knows letters and most sounds” is still learning that match. Therefore:
   130	
   131	- Highlight must not lag the voice by a word.
   132	- Highlight must not jump past a word the adult said.
   133	- Highlight must not jump to a later token because ASR hallucinated `branch` during `crow`.
   134	- The pending **pink** word must never light from the adult track (plan gets this right). Also ignore ASR hits on that word, or a child blurting it ends the adult’s sentence early.
   135	- Function words (`a`, `the`, `to`, `of`) dominate these pages (`A crow found a big piece of cheese`) and are exactly what ASR drops. Unlimited skip-ahead will leapfrog them and teach the child to skip them too.
   136	
   137	If you keep ASR at all, the aligner is: **accept the next token, or skip at most one closed-class word**. Never skip to token+3. Never move the highlight from a low-confidence interim. Catch-up is a **tap on the word just said**, already mentioned in constraints and missing from the numbered steps.
   138	
   139	**[P1] Finger-follow is the primary interaction, not the fallback.**
   140	
   141	What a K–1 teacher does: point, then say, or point with the voice. Sliding a finger under the line with the word under the finger lighting **now** is that practice. ASR that is 0.5 s late is worse than no highlight.
   142	
   143	Build this first, on the existing machine:
   144	
   145	- `pointerdown` / `pointermove` on the sentence, `setPointerCapture`, `elementFromPoint`, `send({ type: "TOKEN", index })`.
   146	- `touch-action: none` on `.sentence` so iOS does not scroll the page mid-slide.
   147	- Stop at the pending magic word; sliding onto it does not open the card and does not mark it read.
   148	- Pass `token={ctx.token}` in read mode (today it is always `-1`).
   149	- Hit targets: `.w` is `min-height: 40px` with `padding: 1px 5px`. Below the 48 px rule in `docs/plan.md`. Fat-finger follow on a phone will light the neighbour. Increase padding and line-height before this ships; “iPad likely” is not an excuse for the bedtime iPhone.
   150	
   151	Do not add tap-to-hear on grey words. That turns the adult’s fluent model into echo.
   152	
   153	A moving underline on the current word beats painting every previous word `.read` for this age. The karaoke trail is fine as a secondary cue.
   154	
   155	---
   156	
   157	## The other two items
   158	
   159	**[P1] Item 5 — ASR while recording a family story — cannot work on iPhone as specified.**
   160	
   161	You cannot run `MediaRecorder` and `webkitSpeechRecognition` on the same mic. The API still would not give per-word `ms`. The code already knows untimed parent audio cannot stop before a magic word (`Story.tsx` ~line 86).
   162	
   163	Replace with **tap-as-you-record** (or tap-on-playback): each word tap stores `Date.now() - t0` into `tokens[].ms`, the format `gen-audio.py` already writes. Offline, no Apple/Google, actually aligns. Do this when you touch family stories; do not block clip-fixing or finger-follow on it.
   164	
   165	**[P2] “I’ll try” on every decodable grey word will wreck bedtime.**
   166	
   167	Stories are written as **one child turn per page**. Opening every CVC (`big`, `sat`, `did`…) turns a 6-page fable into a decoding slog, and if the adult has already said the word the child is echoing, not blending. Google Read Along’s own research: kids freeze on “every word must go green”.
   168	
   169	Cap: **one extra word per page**, grown-up confirms, and only a word not yet highlighted (upcoming, not echoing). Still fail closed through `checkMagicWord` (CVC, not tricky). Do not let this compete with the designed pink word.
   170	
   171	**[P2] Privacy copy is currently a lie the moment ASR exists.** README: “No account, no ads, no microphone, nothing leaves the phone.” Finger-follow default is correct; rewrite the promise **before** the toggle ships, in-app and in README. Opt-in per session, not a buried forever flag.
   172	
   173	**[P2] `gen-audio.py` writes timings back into `library/*/story.json`.** Regenerating with Andrew will rewrite every `ms`. Run the library contract tests; confirm Andrew’s `WordBoundary` events still 1:1 with `align()`. Male `-8%` may need a different rate than Neerja.
   174	
   175	---
   176	
   177	## Prioritised changes to the plan
   178	
   179	1. **[P1] Reorder.** (a) Hand-cut phoneme table + retune `HOLD_MS` + one accent across Commons / edge-tts / `pickVoice()`. (b) Finger-follow in “I read” as the default, reusing `TOKEN` + `.w.now`. (c) Family sound recorder with coaching, listen-back, trim, minimum hold. (d) ASR as opt-in enhancement with the iOS gesture contract above. (e) “I’ll try” with a cap. (f) Family timings by tap-as-you-record, not ASR-during-record.
   180	
   181	2. **[P1] Replace the cutter spec.** No “first isolated segment”, no universal 60 ms, no hiss map as a cutter. `cuts.json` per file; class-specific windows; human sign-off on sat/pin/dog/puff. Keep originals.
   182	
   183	3. **[P1] Write the iOS SpeechRecognition contract into the plan**, including: singleton, no `start()` from `useEffect`/`onend` after the word card, “Tap to follow again”, abort on MagicPanel and on hide, `continuous=false` on iOS, no timestamps so no karaoke-quality claim, test standalone vs Safari tab, no coexistence with `MediaRecorder`.
   184	
   185	4. **[P1] Align the adult-read highlighter with print referencing:** next-token match, skip at most one function word, never light the pink word from the adult track, catch-up tap specified in the steps. If lag is a word, do not use ASR as the print cue.
   186	
   187	5. **[P1] One sound resolver** (family blob beats Commons) used by every clip call site; invalidate the `blend.ts` buffer cache; unique-sound progress, not 23.
   188	
   189	6. **[P2] Privacy strings, 48 px word hit targets, wake lock, Andrew alignment check, “I’ll try” bedtime cap.**
   190	
   191	Do not start item 3 or item 5 as written. Item 1 as written will recut `[sa asa]` and `[ata]` into another wrong set, then the blend graph will put holes between the stops. Fix the clips by hand, put a finger under the line, and treat Apple’s recogniser as a nice-to-have that the home-screen PWA is allowed to refuse.

exec
/bin/zsh -lc 'nl -ba docs/plan-v2.md' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	# StoryTime plan v3 — follow-along in "I read", phoneme audio, narrator voice (2026-09-11)
     2	
     3	v2 → v3: folded Grok's review (docs/reviews/grok-plan-v2.md). Every [P1] accepted except where noted under "Not taken".
     4	
     5	Context: StoryTime is a phonics PWA (Vite/React/TS, IndexedDB, GitHub Pages + Vercel) for a 4-year-old who knows letters and most sounds. A grown-up reads the story; the child reads decodable "magic words" (Letters & Sounds phase 2, CVC only, adult-judged verdicts, no machine grading). Modes: "Nani reads" (recorded narration, karaoke highlight via tokens[].ms, stops at each magic word) and "I read" (sound off; the grown-up reads the grey words aloud; the child taps the pink word, then the word card with letter tiles and a blended model). Today in "I read" nothing highlights (`token={listen ? ctx.token : -1}` in Story.tsx).
     6	
     7	## Owner feedback (parent)
     8	1. In "I read" the child cannot follow the print; wants words to light up as the grown-up reads.
     9	2. Phoneme clips are wrong: "s" plays as "sss-aa-aa-sss". Confirmed: the current Commons files are `[sa asa]` and `[ata]` style; plosives have no isolated sound; vowels are fine.
    10	3. Narrator: a regular US voice, not Indian English.
    11	
    12	## Execution order
    13	### 1. Phoneme fallback clips, hand-cut (one accent)
    14	- Keep the original .ogg files. A `scripts/phoneme-cuts.json` of start/end ms per clip, decided by listening, cut with a 10 ms fade. Class rules: `s f h` = unvoiced portion, stop at first voicing; `m n l r` = the steady continuant before the vowel transition; vowels = 280–350 ms from the middle; `t p k` = burst + 25–40 ms, nothing voiced after; `b d g` = burst −10 ms to burst +15–25 ms. Voicing map is a check, not the cutter.
    15	- Acceptance: play s, t, m alone; blend sat / pin / dog / puff; reject any clip with a vowel tail or a letter name.
    16	- One accent: narrator becomes US (edge-tts `en-US-AndrewMultilingualNeural` default, rate retuned; Jenny alternative); `pickVoice()` in speech.ts prefers en-US; the `o` clip becomes the US `/ɑ/` recording so got/pot/not match the narrator. Attribution + "edited: cut to isolated sound" noted in manifest.json (CC BY-SA derivative).
    17	- blend.ts: stop hold becomes `min(clipMs, 80)`, the vowel starts during the burst, crossfade scaled to the clip; never a digital-silence gap. Re-run library contract tests after re-rendering timings with the new voice; confirm WordBoundary events align 1:1.
    18	
    19	### 2. Finger-follow in "I read" (primary, default, offline)
    20	- pointerdown/pointermove on `.sentence` with setPointerCapture + elementFromPoint → `TOKEN` index; `touch-action: none` on the sentence; pass `token={ctx.token}` in read mode.
    21	- The word under the finger lights now (moving underline + the existing `.now`); previously passed words keep a light `.read` trail as secondary cue.
    22	- Sliding onto the pending pink word never opens the card and never marks it read; the tap does that as today.
    23	- Word hit targets ≥ 48 px (padding + line-height) before this ships. No tap-to-hear on grey words.
    24	- Also works for the child: "you drive the finger while Papa reads".
    25	
    26	### 3. "Record the sounds" screen (family voice beats the fallback)
    27	- Settings → Sounds: ~19 unique sounds (c/k/ck, f/ff, l/ll, s/ss share one clip). Coaching per sound (stretchy sss mmm nnn fff lll rrr; bouncy t p k b d g with almost no "uh"; never the letter name). Hold-to-record with a 500 ms minimum, trim silence on save, reject > 1.2 s, autoplay then Keep / Redo. Stored in IndexedDB as blobs.
    28	- One sound resolver used by every call site (tiles, playBlend, Teach, Warm-up, SegmentPanel): family blob → fallback clip. Invalidate the blend.ts buffer cache on re-record. `<audio>` fallback if decodeAudioData fails on WebKit.
    29	- Progress "12 of 19 sounds in Papa's voice".
    30	
    31	### 4. Voice follow (opt-in enhancement, push-to-talk contract)
    32	- Off until a tap on "Follow my voice" on the page. Singleton `webkitSpeechRecognition`, `lang=en-US`, `continuous=false` on iOS, `interimResults=true`. On silence `onend` → restart once within 200 ms, at most 3 times per page, else drop to finger-follow with a "Tap to follow again" chip. Never `start()` from an effect; abort on MagicPanel open, on visibilitychange, on Home; do not resume automatically after the word card. Never runs beside MediaRecorder.
    33	- Aligner: accept the next token, or skip at most one closed-class word (a, the, to, of, and…); never move on a low-confidence interim; ignore hits on the pending pink word; catch-up is a tap on the word just said (finger-follow is always live underneath).
    34	- Honest UI: an "offline / not available here" state instead of a spinning mic. Privacy copy rewritten in-app and README before the toggle ships ("with voice follow on, audio is processed by Apple or Google"); opt-in per session.
    35	- Test matrix the owner runs: iPhone Safari tab, iPhone home-screen app, iPad, Android Chrome. Chrome emits final results only; one aligner handles both shapes.
    36	- Ships only if the lag stays under a word on the owner's phone; otherwise it stays hidden behind a settings flag.
    37	
    38	### 5. "I'll try" — one extra word per page
    39	- At most one upcoming (not yet highlighted) decodable grey word per page can be offered as the child's word, grown-up confirms, through the same fail-closed validator (CVC, not tricky, no exceptions). Never competes with the designed pink word.
    40	
    41	### 6. Family-story timings by tap-as-you-record
    42	- When recording a family page, the parent taps each word as they say it; `Date.now() − t0` fills `tokens[].ms` in the format gen-audio.py writes. Also offered on playback for existing recordings. Offline, no cloud. Replaces the ASR-during-record idea.
    43	
    44	## Not taken from the review, and why
    45	- "Do not ship voice follow at all": kept as an opt-in enhancement behind the iOS contract above, because the owner asked for it and Android Chrome is a fair target; finger-follow is the default and the plan does not depend on voice.
    46	
    47	## Rules that must hold
    48	Never TTS for phoneme clips (recordings only). No red/buzzer on a miss. Validator fails closed. Don't remove features to satisfy a reviewer. Neutral names in the public repo. Adult keeps every verdict; ASR never judges the child.

exec
/bin/zsh -lc 'nl -ba src/lib/blend.ts' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	/**
     2	 * Continuous blending model ("slide through the word").
     3	 *
     4	 * Real IPA recordings, scheduled on a Web Audio graph so each sound genuinely overlaps the
     5	 * next (crossfade), with explicit targets: continuants ~450 ms, vowels ~320 ms, stops as short
     6	 * as their release allows. Never a whole-word recording, never a gap, never a letter name.
     7	 * Falls back to back-to-back clips when Web Audio is unavailable.
     8	 */
     9	import { playClip } from "./audio/player";
    10	import { GRAPHEME_SOUND } from "./phonics/learner";
    11	import { soundAsset } from "./library";
    12	
    13	export const CONTINUANTS = new Set(["s", "ss", "f", "ff", "m", "n", "l", "ll", "r", "h"]);
    14	export const VOWELS = new Set(["a", "e", "i", "o", "u"]);
    15	const HOLD_MS = (g: string) => (CONTINUANTS.has(g) ? 450 : VOWELS.has(g) ? 320 : 230);
    16	const XFADE_MS = 70;
    17	
    18	let ctx: AudioContext | null = null;
    19	const buffers = new Map<string, Promise<AudioBuffer>>();
    20	
    21	/** Create/resume the graph inside a user gesture (called from unlock()). */
    22	export function unlockBlendAudio(): void {
    23	  try {
    24	    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    25	    if (ctx.state === "suspended") void ctx.resume();
    26	  } catch { ctx = null; }
    27	}
    28	
    29	async function buffer(clip: string): Promise<AudioBuffer> {
    30	  const url = soundAsset(clip);
    31	  let p = buffers.get(url);
    32	  if (!p) { p = fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)); buffers.set(url, p); }
    33	  return p;
    34	}
    35	
    36	export interface BlendOpts { rate?: number; alive?: () => boolean; onProgress?: (fraction: number) => void }
    37	
    38	/** Play the graphemes as one continuous, overlapping stretch. Resolves when the last sound fades. */
    39	export async function playBlend(graphemes: string[], opts: BlendOpts = {}): Promise<void> {
    40	  const alive = opts.alive ?? (() => true);
    41	  const rate = opts.rate ?? 1;
    42	  unlockBlendAudio();
    43	  if (ctx && ctx.state !== "closed") {
    44	    try {
    45	      const bufs = await Promise.all(graphemes.map((g) => buffer(GRAPHEME_SOUND[g].clip)));
    46	      if (!alive()) return;
    47	      const t0 = ctx.currentTime + 0.05; let t = t0; const total = graphemes.reduce((n, g) => n + HOLD_MS(g) / rate, 0) / 1000;
    48	      graphemes.forEach((g, i) => {
    49	        const src = ctx!.createBufferSource(); src.buffer = bufs[i];
    50	        const gain = ctx!.createGain(); src.connect(gain); gain.connect(ctx!.destination);
    51	        const hold = HOLD_MS(g) / rate / 1000; const fade = XFADE_MS / 1000;
    52	        gain.gain.setValueAtTime(i === 0 ? 1 : 0.0001, t);
    53	        if (i > 0) gain.gain.exponentialRampToValueAtTime(1, t + fade);
    54	        gain.gain.setValueAtTime(1, t + hold);
    55	        gain.gain.exponentialRampToValueAtTime(0.0001, t + hold + fade);
    56	        src.start(t, 0, hold + fade); // the next sound starts before this one has faded: no gap, real overlap
    57	        t += hold - fade * 0.5;
    58	      });
    59	      const end = t + XFADE_MS / 1000;
    60	      await new Promise<void>((res) => { const id = setInterval(() => { const f = Math.min(1, (ctx!.currentTime - t0) / total); opts.onProgress?.(f); if (ctx!.currentTime >= end || !alive()) { clearInterval(id); opts.onProgress?.(1); res(); } }, 30); });
    61	      return;
    62	    } catch { /* fall through to the simple player */ }
    63	  }
    64	  // fallback: back-to-back clips through the singleton player
    65	  for (let i = 0; i < graphemes.length; i++) {
    66	    if (!alive()) return;
    67	    let p; try { p = playClip(soundAsset(GRAPHEME_SOUND[graphemes[i]].clip)); } catch { continue; }
    68	    opts.onProgress?.(i / graphemes.length);
    69	    await new Promise<void>((res) => { const t0 = Date.now(); const id = setInterval(() => { const el = p.el; if (el.currentTime * 1000 >= HOLD_MS(graphemes[i]) || el.ended || Date.now() - t0 > 1500) { clearInterval(id); res(); } }, 30); });
    70	  }
    71	  opts.onProgress?.(1);
    72	}
    73	
    74	/** Caption for a blend: no dots, no gaps — the whole word as one stretched shape. */
    75	export const stretched = (graphemes: string[]) => graphemes.map((g) => (CONTINUANTS.has(g) || VOWELS.has(g) ? GRAPHEME_SOUND[g].label.replace(/(.)\1+/g, "$1$1$1") : GRAPHEME_SOUND[g].label)).join("");
    76	/** Kept for the parent summary. */
    77	export const dotted = (graphemes: string[]) => graphemes.map((g) => GRAPHEME_SOUND[g]?.label ?? g).join("·");

exec
/bin/zsh -lc 'nl -ba src/lib/audio/record.ts' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	/**
     2	 * Parent-recorded narration (MediaRecorder). The recording is stored as a data URL on the
     3	 * page, so a family story can be read in Nani's real voice, offline, with no server.
     4	 * iOS Safari records audio/mp4; Chrome records audio/webm. Both play back in <audio>.
     5	 */
     6	export interface Recorder { stop: () => Promise<{ dataUrl: string; ms: number } | null> }
     7	
     8	export async function startRecording(): Promise<Recorder> {
     9	  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    10	  const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    11	  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    12	  const chunks: Blob[] = [];
    13	  const t0 = Date.now();
    14	  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    15	  rec.start();                        // no timeslice: iOS produces an empty/invalid mp4 with one
    16	  let settled: Promise<{ dataUrl: string; ms: number } | null> | null = null;
    17	  const release = () => stream.getTracks().forEach((t) => t.stop());
    18	  return {
    19	    stop: () => settled ??= new Promise((resolve) => {   // idempotent: every outcome settles exactly once
    20	      const ms = Date.now() - t0;                          // measured at stop, not after encoding
    21	      const finish = (v: { dataUrl: string; ms: number } | null) => { release(); resolve(v); };
    22	      rec.onerror = () => finish(null);
    23	      rec.onstop = () => {
    24	        const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
    25	        if (!blob.size) return finish(null);
    26	        const fr = new FileReader();
    27	        fr.onerror = () => finish(null);
    28	        fr.onload = () => finish({ dataUrl: fr.result as string, ms });
    29	        fr.readAsDataURL(blob);
    30	      };
    31	      if (rec.state === "inactive") { rec.onstop?.(new Event("stop")); return; }
    32	      try { rec.stop(); } catch { finish(null); }
    33	      setTimeout(() => finish(null), 8000);               // never leave the builder waiting
    34	    }),
    35	  };
    36	}
    37	
    38	export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

exec
/bin/zsh -lc 'nl -ba src/components/MagicPanel.tsx' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	import { useEffect, useMemo, useState } from "react";
     2	import { GRAPHEME_SOUND } from "../lib/phonics/learner";
     3	import { checkWord, type LearnerModel } from "../lib/phonics/validator";
     4	import { playClip } from "../lib/audio/player";
     5	import { soundAsset } from "../lib/library";
     6	import { CheckIcon } from "./Icons";
     7	
     8	export type Verdict = "first_try" | "prompted";
     9	
    10	/**
    11	 * The child's word card. Plain letters, no picture: "Start here and slide through the word."
    12	 * Progressive disclosure for the grown-up: first only "First try" / "Needs help"; after "Needs help"
    13	 * one precise nudge, then "After a nudge" / "Show me" / skip. Tile taps only play sounds and never
    14	 * decide the label. A sweep under the graphemes shows the voice sliding through during a model.
    15	 */
    16	export function MagicPanel({ word, learner, modelling, modelledOnce, sweep, kid, reader, kicker, onSound, onYes, onTogether, onSkip }: {
    17	  word: string; learner: LearnerModel; modelling: boolean; modelledOnce?: boolean; sweep?: number; kid: string; reader: string; kicker?: string;
    18	  onSound: () => void; onYes: (v: Verdict) => void; onTogether: () => void; onSkip?: () => void;
    19	}) {
    20	  const gs = useMemo(() => checkWord(word, learner).graphemes, [word, learner]);
    21	  const [said, setSaid] = useState(0);
    22	  const [help, setHelp] = useState(false);
    23	  useEffect(() => { setSaid(0); setHelp(false); }, [word]);
    24	  useEffect(() => { if (modelledOnce) setHelp(true); }, [modelledOnce]);
    25	  const tap = (i: number) => {
    26	    if (modelling) return;
    27	    void playClip(soundAsset(GRAPHEME_SOUND[gs[i]].clip)).done.catch(() => {});
    28	    if (i === said) { setSaid(i + 1); onSound(); }
    29	  };
    30	  return (
    31	    <section className="panel" role="dialog" aria-label="Magic word">
    32	      <div className="kicker">{kicker ?? `Magic word · ${kid}'s turn`}</div>
    33	      <h2 className="panel-h">Start here and slide through the word. Keep your voice going.</h2>
    34	      <div className="tiles-wrap">
    35	        <div className="tiles">
    36	          {gs.map((g, i) => (
    37	            <button key={i} className={["tile", i < said || modelling ? "said" : "", i === said && !modelling ? "next" : ""].join(" ")} onClick={() => tap(i)} aria-label={`${g}, says ${GRAPHEME_SOUND[g].label}`}>
    38	              <small>{GRAPHEME_SOUND[g].label}</small>{g}
    39	            </button>
    40	          ))}
    41	        </div>
    42	        <div className="sweep" aria-hidden><i style={{ width: `${Math.round((sweep ?? 0) * 100)}%`, opacity: modelling ? 1 : 0 }} /></div>
    43	      </div>
    44	      <div className="verdict grownup">
    45	        {!help ? (
    46	          <>
    47	            <div className="hint"><span className="tag">{reader}</span> wait 5 seconds. Did {kid} say it as <b>one word</b>? <small className="legend">(stuck on a sound? tap that letter — never say its name)</small></div>
    48	            <div className="btns">
    49	              <button className="no" disabled={modelling} onClick={() => setHelp(true)}>Needs help</button>
    50	              <button className="yes" disabled={modelling} onClick={() => onYes("first_try")}><CheckIcon /> First try</button>
    51	            </div>
    52	          </>
    53	        ) : modelledOnce ? (
    54	          <>
    55	            <div className="hint"><span className="tag">{reader}</span> now {kid} slides through it alone.</div>
    56	            <div className="btns">
    57	              <button className="no" disabled={modelling} onClick={onTogether}>Show me again</button>
    58	              <button className="yes soft" disabled={modelling} onClick={() => onYes("prompted")}>✓ Slid through it after the model</button>
    59	            </div>
    60	          </>
    61	        ) : (
    62	          <>
    63	            <div className="hint"><span className="tag">{reader}</span> one nudge, then wait: point to the first letter and say <em>“Start here… slide.”</em> Nothing more.</div>
    64	            <div className="btns">
    65	              <button className="no" disabled={modelling} onClick={onTogether}>Show me: slide through it</button>
    66	              <button className="yes soft" disabled={modelling} onClick={() => onYes("prompted")}><CheckIcon /> After a nudge</button>
    67	            </div>
    68	          </>
    69	        )}
    70	        <div className="row center">
    71	          <button className="skip" disabled={modelling} onClick={() => setSaid(0)}>look again — start here ↺</button>
    72	          {help && onSkip && <button className="skip" disabled={modelling} onClick={onSkip}>skip for today →</button>}
    73	        </div>
    74	        {help && <p className="adultnote">Sounds, not letter names · don't give the first sound · no guessing from the picture · any accent is fine · ✓ only after the whole word.</p>}
    75	      </div>
    76	    </section>
    77	  );
    78	}

exec
/bin/zsh -lc 'nl -ba scripts/fetch-phonemes.py' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	#!/usr/bin/env python3
     2	"""
     3	Fetch real human phoneme recordings from Wikimedia Commons (the canonical IPA sound
     4	files, CC-licensed) and convert them into public/sounds/<grapheme>.m4a.
     5	
     6	Why not TTS: a neural voice cannot say a bare consonant — "sss" comes out as "ess"
     7	(measured: ~45% voiced frames). The Commons IPA set is what phonetics courses use.
     8	
     9	  python3 scripts/fetch-phonemes.py
    10	
    11	Writes public/sounds/manifest.json with source URL + licence per clip.
    12	"""
    13	import json, re, shutil, subprocess, sys, urllib.parse, urllib.request
    14	from pathlib import Path
    15	
    16	ROOT = Path(__file__).resolve().parents[1]
    17	OUT = ROOT / "public" / "sounds"; OUT.mkdir(parents=True, exist_ok=True)
    18	
    19	def ffmpeg():
    20	    f = shutil.which("ffmpeg")
    21	    if f: return f
    22	    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
    23	FF = ffmpeg()
    24	
    25	# grapheme (as taught in Letters & Sounds phase 2) -> Commons IPA recording
    26	FILES = {
    27	    "s": "Voiceless_alveolar_sibilant.ogg",
    28	    "a": "Near-open_front_unrounded_vowel.ogg",      # /æ/ as in cat
    29	    "t": "Voiceless_alveolar_plosive.ogg",
    30	    "p": "Voiceless_bilabial_plosive.ogg",
    31	    "i": "Near-close_near-front_unrounded_vowel.ogg", # /ɪ/ as in sit
    32	    "n": "Alveolar_nasal.ogg",
    33	    "m": "Bilabial_nasal.ogg",
    34	    "d": "Voiced_alveolar_plosive.ogg",
    35	    "g": "Voiced_velar_plosive.ogg",
    36	    "o": "Open_back_rounded_vowel.ogg",               # /ɒ/ as in dog
    37	    "k": "Voiceless_velar_plosive.ogg",               # also c, ck
    38	    "e": "Open-mid_front_unrounded_vowel.ogg",        # /ɛ/ as in bed
    39	    "u": "Open-mid_back_unrounded_vowel.ogg",         # /ʌ/ as in cup
    40	    "r": "Alveolar_approximant.ogg",
    41	    "h": "Voiceless_glottal_fricative.ogg",
    42	    "b": "Voiced_bilabial_plosive.ogg",
    43	    "f": "Voiceless_labiodental_fricative.ogg",       # also ff
    44	    "l": "Alveolar_lateral_approximant.ogg",          # also ll
    45	}
    46	
    47	API = "https://commons.wikimedia.org/w/api.php"
    48	UA = {"User-Agent": "StoryTime/0.1 (phonics app; https://github.com/soodr321/StoryTime)"}
    49	
    50	def info(title):
    51	    q = urllib.parse.urlencode({"action": "query", "titles": f"File:{title}", "prop": "imageinfo", "iiprop": "url|extmetadata", "format": "json"})
    52	    with urllib.request.urlopen(urllib.request.Request(f"{API}?{q}", headers=UA)) as r:
    53	        d = json.load(r)
    54	    page = next(iter(d["query"]["pages"].values()))
    55	    if "imageinfo" not in page: raise SystemExit(f"not found on Commons: {title}")
    56	    ii = page["imageinfo"][0]; md = ii.get("extmetadata", {})
    57	    return ii["url"], md.get("LicenseShortName", {}).get("value", "?"), re.sub("<[^>]+>", "", md.get("Artist", {}).get("value", "?")).strip()
    58	
    59	def main():
    60	    man = {}
    61	    for g, title in FILES.items():
    62	        url, lic, artist = info(title)
    63	        raw = OUT / f"{g}.ogg"
    64	        with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r, open(raw, "wb") as f: f.write(r.read())
    65	        m4a = OUT / f"{g}.m4a"
    66	        # trim silence, normalise loudness, cap at 1.2 s (IPA files are sometimes repeated twice)
    67	        subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(raw), "-af",
    68	                        "silenceremove=start_periods=1:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse,atrim=0:1.2,loudnorm=I=-18:TP=-2,apad=pad_dur=0.1",
    69	                        "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1", str(m4a)], check=True)
    70	        raw.unlink()
    71	        probe = subprocess.run([FF, "-i", str(m4a)], capture_output=True, text=True).stderr
    72	        mm = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe); ms = int((int(mm[1]) * 3600 + int(mm[2]) * 60 + float(mm[3])) * 1000)
    73	        man[g] = {"audio": f"{g}.m4a", "ms": ms, "recorded": True, "source": f"https://commons.wikimedia.org/wiki/File:{title}", "license": lic, "artist": artist}
    74	        print(f"  {g:2s} {ms:5d} ms  {lic:12s} {title}")
    75	    (OUT / "manifest.json").write_text(json.dumps(man, indent=1))
    76	    print(f"{len(man)} phoneme clips → public/sounds/ (attribution in manifest.json)")
    77	
    78	if __name__ == "__main__": main()

exec
/bin/zsh -lc 'nl -ba scripts/gen-audio.py' in /Users/rish_ai/StoryTime
 succeeded in 0ms:
     1	#!/usr/bin/env python3
     2	"""
     3	Generate narration audio + word timings for every story in library/, plus the
     4	shared narrator prompts, into public/library/<slug>/ and public/prompts/.
     5	
     6	  python3 scripts/gen-audio.py            # all stories
     7	  python3 scripts/gen-audio.py fox-and-crow
     8	
     9	Voice: edge-tts en-IN-NeerjaNeural ($0, word boundaries built in). Audio is a
    10	deploy-time artefact: public/library/**/*.m4a is gitignored. Recorded phoneme
    11	clips live in public/sounds/ and are committed; this script only creates
    12	nothing under public/sounds/ — phoneme clips are real recordings fetched by
    13	scripts/fetch-phonemes.py (Wikimedia Commons IPA set, CC BY-SA).
    14	
    15	Requires: pip install edge-tts ; ffmpeg on PATH (or imageio-ffmpeg).
    16	"""
    17	import asyncio, json, os, re, shutil, subprocess, sys
    18	from pathlib import Path
    19	
    20	try:
    21	    import edge_tts
    22	except ImportError:
    23	    sys.exit("pip install edge-tts")
    24	
    25	ROOT = Path(__file__).resolve().parents[1]
    26	LIB, PUB = ROOT / "library", ROOT / "public"
    27	NANI, RATE = "en-IN-NeerjaNeural", "-8%"
    28	
    29	def ffmpeg():
    30	    f = shutil.which("ffmpeg")
    31	    if f: return f
    32	    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
    33	FF = ffmpeg()
    34	
    35	def norm(s): return re.sub(r"[^a-z]", "", s.lower())
    36	
    37	async def tts(text, out_m4a, voice=NANI, rate=RATE):
    38	    """Synthesize text → m4a (AAC, plays on iOS). Returns (duration_ms, [(word, start_ms)])."""
    39	    tmp = out_m4a.with_suffix(".mp3"); words = []
    40	    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    41	    with open(tmp, "wb") as f:
    42	        async for ch in com.stream():
    43	            if ch["type"] == "audio": f.write(ch["data"])
    44	            elif ch["type"] == "WordBoundary": words.append((ch["text"], ch["offset"] / 1e4))
    45	    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(tmp), "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1", str(out_m4a)], check=True)
    46	    tmp.unlink()
    47	    probe = subprocess.run([FF, "-i", str(out_m4a)], capture_output=True, text=True).stderr
    48	    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
    49	    ms = int((int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])) * 1000)
    50	    return ms, words
    51	
    52	def align(tokens, words):
    53	    """Map TTS word boundaries onto display tokens 1:1 by normalised text, in order.
    54	    A token may span several TTS words (e.g. 'Caw!' vs 'Caw'); a TTS word may never span tokens.
    55	    Returns list of start_ms per token, or raises with a clear message."""
    56	    out, wi = [], 0
    57	    for ti, tok in enumerate(tokens):
    58	        target = norm(tok)
    59	        if not target:  # pure punctuation token
    60	            out.append(words[wi][1] if wi < len(words) else (out[-1] if out else 0)); continue
    61	        acc, start = "", None
    62	        while wi < len(words) and len(acc) < len(target):
    63	            w, ms = words[wi]
    64	            if start is None: start = ms
    65	            acc += norm(w); wi += 1
    66	        if acc != target:
    67	            raise SystemExit(f"alignment failed at token {ti} {tok!r}: tts gave {acc!r}")
    68	        out.append(int(start))
    69	    if wi != len(words):
    70	        raise SystemExit(f"alignment failed: {len(words) - wi} unused tts words")
    71	    return out
    72	
    73	async def build_story(slug):
    74	    src = LIB / slug / "story.json"; story = json.loads(src.read_text())
    75	    out = PUB / "library" / slug; out.mkdir(parents=True, exist_ok=True)
    76	    for i, p in enumerate(story["pages"], 1):
    77	        text = p.pop("text", None) or " ".join(t["t"] for t in p["tokens"])
    78	        toks = text.split(" ")
    79	        ms, words = await tts(text, out / f"p{i}.m4a")
    80	        starts = align(toks, words)
    81	        p["tokens"] = [{"t": t, "ms": s} for t, s in zip(toks, starts)]
    82	        p["audio"], p["audioMs"] = f"p{i}.m4a", ms
    83	        print(f"  {slug} p{i}: {ms} ms, {len(toks)} tokens")
    84	    ms, _ = await tts(story["moral"]["spoken"], out / "moral.m4a")
    85	    story["moral"]["audio"], story["moral"]["audioMs"] = "moral.m4a", ms
    86	    # story-specific narrator prompts (magic word feedback)
    87	    story["prompts"] = {}
    88	    for p in story["pages"]:
    89	        for w in p.get("magic", []):
    90	            for key, text in ((f"yes:{w}", f"Yes! {w}."), (f"word:{w}", f"{w}.")):
    91	                m, _ = await tts(text, out / f"{key.replace(':', '-')}.m4a"); story["prompts"][key] = {"audio": f"{key.replace(':', '-')}.m4a", "ms": m}
    92	    (out / "story.json").write_text(json.dumps(story, ensure_ascii=False, indent=1))
    93	    src.write_text(json.dumps(story, ensure_ascii=False, indent=1))  # tokens + timings are part of the contract
    94	
    95	SHARED = {
    96	    "yours": "This one is yours. Can you read it?",
    97	    "fast": "Now say it fast.",
    98	    "notyet": "That's okay. Listen to me blend it, then you try.",
    99	    "yourturn": "Your turn.",
   100	    "practise": "We'll practise it tomorrow.",
   101	    "line": "Now you. Read your line.",
   102	    "done": "Beautiful reading. This story goes on your shelf.",
   103	    "pick": "Pick today's story. One tap.",
   104	}
   105	async def build_shared():
   106	    out = PUB / "prompts"; out.mkdir(parents=True, exist_ok=True); man = {}
   107	    for k, text in SHARED.items():
   108	        ms, _ = await tts(text, out / f"{k}.m4a"); man[k] = {"audio": f"{k}.m4a", "ms": ms}
   109	    (out / "manifest.json").write_text(json.dumps(man, indent=1))
   110	    print("  shared prompts done (phoneme clips come from scripts/fetch-phonemes.py, not TTS)")
   111	
   112	async def main():
   113	    slugs = sys.argv[1:] or [p.name for p in LIB.iterdir() if (p / "story.json").exists()]
   114	    await build_shared()
   115	    for s in slugs: print(s); await build_story(s)
   116	
   117	asyncio.run(main())

web search: 
exec
/bin/zsh -lc "nl -ba src/screens/Story.tsx | sed -n '210,310p'
rg -n 'sentence|\\.w[ .:{]|sweep|screen-wrap|panel-open' src --glob '*.css'
rg --files src public -g '*sw*' -g '*machine*' -g '*validator*' -g '*learner*'
nl -ba src/machine/story.machine.ts
nl -ba src/lib/phonics/validator.ts" in /Users/rish_ai/StoryTime
 succeeded in 0ms:
   210	function StoryView({ page, pageNo, total, token, results, readMode, listener, reader, kid, stalled, pageHeld, hideArt, onRetry, onMagicTap, onWordTap, onNext }: {
   211	  page: Page; pageNo: number; total: number; token: number; results: WordResult[];
   212	  readMode: boolean; listener: boolean; reader: string; kid: string; stalled: boolean; pageHeld: boolean; hideArt: boolean;
   213	  onRetry: () => void; onMagicTap: (w: string, i: number) => void; onWordTap: (tok: string) => void; onNext: () => void;
   214	}) {
   215	  const resAt = (i: number) => results.find((r) => r.id === `${pageNo}:${i}`);
   216	  const firstIdx = new Set((page.magic ?? []).map((w) => page.tokens.findIndex((t) => normalise(t.t) === w)));
   217	  const pending = listener ? [] : [...firstIdx].filter((i) => i >= 0 && !resAt(i));
   218	  // trailing punctuation sits outside the highlight: the child decodes letters, not full stops
   219	  const split = (tok: string) => { const m = tok.match(/^([^A-Za-z]*)([A-Za-z]+(?:['’][A-Za-z]+)?)([^A-Za-z]*)$/); return m ? [m[1], m[2], m[3]] : ["", tok, ""]; };
   220	  const last = pageNo + 1 >= total;
   221	  return (
   222	    <main className="story">
   223	      {/* the picture is hidden while a magic word is open: the child reads the letters, not the picture */}
   224	      <div className={"art-box" + (hideArt ? " veiled" : "")}>{hideArt ? <span className="veil"><LockIcon size={28} />read the letters</span> : <Art art={page.art} />}</div>
   225	      <div className="text-card">
   226	        <div className="pg">Page {pageNo + 1} of {total}</div>
   227	        <p className="sentence">
   228	          {page.tokens.map((t, i) => {
   229	            const n = normalise(t.t);
   230	            const magic = !listener && firstIdx.has(i);
   231	            const res = magic ? resAt(i) : undefined;
   232	            const cls = ["w", i === token ? "now" : "", i < token ? "read" : "", magic ? "magic" : "", magic && res ? (res.ok ? "done" : "skipped") : ""].join(" ");
   233	            const [lead, core0, punct] = split(t.t);
   234	            const core = magic ? core0.toLowerCase() : core0;   // a magic word is shown in the letterforms the child was taught
   235	            if (readMode && magic && !res) return <span key={i} className="tokwrap">{lead}<button className={cls + " tap"} onClick={() => onMagicTap(n, i)}>{core}</button>{punct} </span>;
   236	            if (listener) return <span key={i} className="tokwrap">{lead}<button className={cls + " listener-tap"} onClick={() => onWordTap(t.t)}>{core}</button>{punct} </span>;   // read mode: grey words are the grown-up's, never tap-to-hear
   237	            return <span key={i} className="tokwrap">{lead}<span className={cls}>{core}</span>{punct} </span>;
   238	          })}
   239	        </p>
   240	        {stalled && <div className="readbar"><button className="next" onClick={onRetry}>▶ Try again</button></div>}
   241	        {readMode && !stalled && (
   242	          <div className="readbar">
   243	            <span className="script">{pending.length ? <><b>{reader}</b> reads the story. <b>{kid}</b> reads the <em className="pinkword">pink word</em>: tap it, then say the sounds and blend.</> : <><b>{reader}</b> reads the page. Then go on.</>}</span>
   244	            <button className="next" disabled={pending.length > 0} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
   245	          </div>
   246	        )}
   247	        {listener && !readMode && !stalled && (
   248	          <div className="readbar">
   249	            <span className="script">{pageHeld ? <><b>{reader}</b>: {["“What happened on this page?”", "“Point to the picture. What is it?”", "“Which word did you like? Tap it.”", "“What do you think happens next?”"][pageNo % 4]}</> : "Listen…"}</span>
   250	            <button className="next" disabled={!pageHeld} onClick={onNext}>{last ? "The end →" : "Next page →"}</button>
   251	          </div>
   252	        )}
   253	      </div>
   254	    </main>
   255	  );
   256	}
   257	
   258	/**
   259	 * Read-back routine: the child tries the WHOLE line first. If a word needs help, the grown-up taps it:
   260	 * the app shows regular vs tricky parts (tricky word) or stretches the sounds (decodable word),
   261	 * the child re-reads that word, then re-reads the whole line smoothly before ✓.
   262	 */
   263	function Moral({ story, learner, listener, kid, reader, listen, setCaption, buildWord, onBuilt, onYes }: { story: Story; learner: LearnerModel; listener: boolean; kid: string; reader: string; listen: boolean; setCaption: (s: string) => void; buildWord: string | null; onBuilt: (w: string, ok: boolean) => void; onYes: () => void }) {
   264	  const line = checkLine(story.moral.line, learner);
   265	  const raw = story.moral.line.split(/\s+/);
   266	  const parts = raw.map((w, i) => { const m = w.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/); const r = line.results[i]; const core = m ? m[2] : w; const shown = r?.ok ? (r.kind === "tricky" ? (r.word === "i" ? "I" : r.word) : core.toLowerCase()) : core; return { lead: m ? m[1] : "", core: shown, punct: m ? m[3] : "" }; });   // taught letterforms; punctuation outside
   267	  const words = parts.map((p) => p.core);
   268	  const [stage, setStage] = useState<"try" | "help" | "word" | "reread" | "build">("try");
   269	  // after the read-back: one-word dictation on a word the child just blended (skipped when none)
   270	  const finishLine = () => { if (buildWord) { setStage("build"); setCaption(`${reader}: say "${buildWord}". ${kid} counts the sounds, then builds it.`); } else onYes(); };
   271	  const [helped, setHelped] = useState<number | null>(null);
   272	  const help = async (i: number) => {
   273	    const r = line.results[i]; setHelped(i);
   274	    if (!r.ok) return;
   275	    if (r.kind === "tricky") {
   276	      setCaption(`${words[i]} is a tricky word. The underlined part is the odd bit. Just say the word, then read the line again.`);
   277	      if (listen) speakText(words[i], {});   // a tricky word is taught as a whole, so hearing it is fine
   278	    } else {
   279	      setCaption(`${stretched(r.graphemes)} … ${reader}: slide through the sounds, but let ${kid} say the word.`);
   280	      await playBlend(r.graphemes);   // never the whole word: that would be echoing, not blending
   281	      setStage("word"); return;       // stay on this word until the grown-up confirms the child blended it
   282	    }
   283	    setStage("reread");
   284	  };
   285	  if (stage === "build" && buildWord) return (
   286	    <div className="screen-wrap panel-open">
   287	      <main className="moral"><div className="kicker">One more: build a word</div><p className="spoken">“{story.moral.spoken}”</p></main>
   288	      <SegmentPanel word={buildWord} learner={learner} kid={kid} reader={reader} listen={listen} onDone={(ok) => { onBuilt(buildWord, ok); onYes(); }} />
   289	    </div>
   290	  );
   291	  return (
   292	    <main className="moral">
   293	      <div className="kicker">The end</div>
   294	      <p className="spoken">“{story.moral.spoken}”</p>
   295	      {!listener && (
   296	        <>
   297	          <div className="kicker">{stage === "try" ? `${kid} reads the whole line` : stage === "help" ? "tap the word that needs help" : stage === "word" ? `${kid} blends that word` : "now the whole line again, smoothly"}</div>
   298	          <p className="line">
   299	            {line.results.map((r, i) => {
   300	              const tp = r.ok && r.kind === "tricky" ? (TRICKY_PARTS[r.word] ?? `|${r.word}`).split("|") : null;
   301	              return (
   302	                <span key={i} className="tokwrap">{parts[i].lead}<button className={"lw " + (r.ok && r.kind === "tricky" ? "tricky" : "magic") + (helped === i ? " helped" : "")} disabled={stage === "try"} onClick={() => help(i)}>
   303	                  {tp ? <><span>{words[i].slice(0, tp[0].length)}</span><u className="odd">{words[i].slice(tp[0].length)}</u></> : words[i]}
   304	                </button>{parts[i].punct}</span>
   305	              );
   306	            })}
   307	          </p>
   308	          <div className="legend"><i className="sw magic" /> sound it out <i className="sw tricky" /> tricky word: <u className="odd">odd bit</u> underlined</div>
   309	          <div className="script"><b>{reader}</b>: {stage === "try" ? "let them read the whole line first." : stage === "help" ? "tap the word they stuck on." : stage === "word" ? "wait for them to slide through it and say it as one word." : "ask for the whole line once more, smoothly."}</div>
   310	        </>
src/index.css:43:.w.tap { border: 0; font: inherit; }
src/index.css:55:.sentence { margin: 0; font-size: clamp(24px, 6.4vw, 34px); line-height: 1.6; }
src/index.css:56:.w { display: inline-block; padding: 1px 5px; border-radius: 8px; }
src/index.css:57:.w.read { background: var(--done); color: var(--done-ink); }
src/index.css:58:.w.magic { background: var(--magic); color: var(--magic-ink); font-weight: 700; box-shadow: 0 0 0 2px #e9a6d3 inset; }
src/index.css:59:.w.magic.done { background: var(--done); color: var(--done-ink); box-shadow: none; }
src/index.css:60:.w.magic.skipped { opacity: .7; text-decoration: underline dotted; }
src/index.css:61:.w.now { background: var(--now); color: var(--ink); box-shadow: none; }
src/index.css:110:.screen-wrap { display: contents; }
src/index.css:178:.panel-open .story { padding-bottom: 300px; }
src/index.css:179:.w { min-height: 40px; line-height: 1.35; }
src/index.css:180:.w.tap { padding: 4px 8px; }
src/index.css:236:.sweep { height: 6px; margin: 2px 12px 8px; background: var(--line); border-radius: 3px; overflow: hidden; }
src/index.css:237:.sweep i { display: block; height: 100%; background: var(--accent); transition: width .05s linear, opacity .3s; }
src/index.css:255:.w.listener-tap { padding: 1px 3px; margin: 0; }
src/lib/phonics/validator.ts
src/lib/phonics/validator.test.ts
src/lib/phonics/learner.ts
src/machine/story.machine.ts
src/machine/story.machine.test.ts
     1	/**
     2	 * Story session state machine (Phase 0: stateless between sessions; Phase 1 persists
     3	 * context at every transition). Inputs that arrive while audio plays are ignored
     4	 * except HOME — a 4-year-old double-taps everything.
     5	 */
     6	import { assign, setup } from "xstate";
     7	import type { Story } from "../lib/content/types";
     8	
     9	export type VerdictMode = "first_try" | "prompted" | "modelled" | "skipped";
    10	/** id = `${page}:${tokenIndex}` so every occurrence of a magic word gets its own turn */
    11	export interface WordResult { id?: string; word: string; ok: boolean; mode: VerdictMode }
    12	
    13	export interface Ctx {
    14	  story: Story;
    15	  page: number;
    16	  /** index of the token currently highlighted, or -1 */
    17	  token: number;
    18	  /** which magic word (normalised) is open, if any, and its token index */
    19	  magic: string | null;
    20	  magicIdx: number;
    21	  mode: VerdictMode;
    22	  results: WordResult[];
    23	}
    24	
    25	export type Ev =
    26	  | { type: "START" }
    27	  | { type: "TOKEN"; index: number }
    28	  | { type: "NARRATION_DONE" }
    29	  | { type: "MAGIC_REACHED"; word: string; index: number }
    30	  | { type: "SOUND_TAPPED" }
    31	  | { type: "YES"; verdict?: "first_try" | "prompted" }
    32	  | { type: "NOT_YET" }
    33	  | { type: "MODEL_DONE" }
    34	  | { type: "SKIP" }
    35	  | { type: "REREAD_DONE" }
    36	  | { type: "RESUME" }
    37	  | { type: "PAGE_NEXT" }
    38	  | { type: "PAGE_DONE" }
    39	  | { type: "LINE_YES" }
    40	  | { type: "HOME" };
    41	
    42	export const storyMachine = setup({
    43	  types: { context: {} as Ctx, events: {} as Ev, input: {} as { story: Story; page?: number; results?: WordResult[] } },
    44	  guards: {
    45	    hasNextPage: ({ context }) => context.page + 1 < context.story.pages.length,
    46	  },
    47	  actions: {
    48	    nextPage: assign({ page: ({ context }) => context.page + 1, token: -1, magic: null, mode: "first_try" }),
    49	    setToken: assign({ token: ({ event }) => (event.type === "TOKEN" ? event.index : -1) }),
    50	    openMagic: assign({ magic: ({ event }) => (event.type === "MAGIC_REACHED" ? event.word : null), magicIdx: ({ event }) => (event.type === "MAGIC_REACHED" ? event.index : -1), mode: "first_try" }),
    51	    sounded: assign({ mode: ({ context }) => context.mode }),   // tile taps play sounds; they never decide the label
    52	    modelled: assign({ mode: "modelled" }),
    53	    record: assign({
    54	      results: ({ context, event }) => [
    55	        ...context.results,
    56	        { id: `${context.page}:${context.magicIdx}`, word: context.magic ?? "", ok: event.type === "YES", mode: event.type === "SKIP" ? "skipped" : context.mode === "modelled" ? "modelled" : event.type === "YES" && event.verdict ? event.verdict : context.mode },
    57	      ],
    58	    }),
    59	  },
    60	}).createMachine({
    61	  id: "story",
    62	  context: ({ input }) => ({ story: input.story, page: input.page ?? 0, token: -1, magic: null, magicIdx: -1, mode: "first_try", results: input.results ?? [] }),
    63	  initial: "idle",
    64	  on: { HOME: ".idle" },
    65	  states: {
    66	    idle: { on: { START: "narrating" } },
    67	    narrating: {
    68	      on: {
    69	        TOKEN: { actions: "setToken" },
    70	        MAGIC_REACHED: { target: "magicWord", actions: "openMagic" },
    71	        NARRATION_DONE: [{ guard: "hasNextPage", target: "narrating", actions: "nextPage", reenter: true }, { target: "moral" }],
    72	        PAGE_NEXT: [{ guard: "hasNextPage", target: "narrating", actions: "nextPage", reenter: true }, { target: "moral" }],
    73	      },
    74	    },
    75	    magicWord: {
    76	      // waiting for the parent's verdict; the child may tap sounds meanwhile
    77	      on: {
    78	        SOUND_TAPPED: { actions: "sounded" },
    79	        YES: { target: "reread", actions: "record" },
    80	        SKIP: { target: "reread", actions: "record" },
    81	        NOT_YET: { target: "modelling", actions: "modelled" },
    82	      },
    83	    },
    84	    modelling: {
    85	      // app blends the word slowly, then hands it back; taps are ignored here
    86	      on: { MODEL_DONE: "magicWord" },
    87	    },
    88	    reread: {
    89	      // the whole sentence is read again fluently so the word reconnects to meaning
    90	      on: {
    91	        TOKEN: { actions: "setToken" },
    92	        REREAD_DONE: [{ guard: "hasNextPage", target: "narrating", actions: "nextPage" }, { target: "moral" }],
    93	        // read mode: no re-read audio; stay on the page until the grown-up taps Next
    94	        RESUME: { target: "narrating", reenter: true },
    95	      },
    96	    },
    97	    moral: { on: { LINE_YES: "done" } },
    98	    done: { on: { START: "narrating" } },   // not `final`: a final root state would stop the actor and swallow HOME
    99	  },
   100	});
     1	/**
     2	 * Decodability validator.
     3	 *
     4	 * Tokenises a word into graphemes using ONLY the learner's taught
     5	 * grapheme–phoneme correspondences (GPCs), longest-grapheme-first.
     6	 * Tricky (exception) words are accepted only when explicitly taught and are
     7	 * never tokenised: their pronunciation is not the sum of their letters.
     8	 * Empty input fails closed. Every failure carries a reason a parent can act on.
     9	 */
    10	
    11	export interface LearnerModel {
    12	  /** Ordered as taught. Multi-letter graphemes allowed (ck, sh, ai …). */
    13	  gpcs: string[];
    14	  /** Exception words taught as wholes. Locked set; parent may delay, never reclassify. */
    15	  tricky: string[];
    16	  /** true once adjacent-consonant blends (Phase 4) have been taught */
    17	  clusters?: boolean;
    18	}
    19	
    20	export type CheckResult =
    21	  | { ok: true; kind: "decodable"; word: string; graphemes: string[] }
    22	  | { ok: true; kind: "tricky"; word: string; graphemes: [string] }
    23	  | { ok: false; word: string; graphemes: string[]; reasons: string[] };
    24	
    25	/** Lowercase, strip everything that is not a–z. Case is display-only. */
    26	export function normalise(word: string): string {
    27	  return (word ?? "").toLowerCase().replace(/[^a-z]/g, "");
    28	}
    29	
    30	/**
    31	 * Multi-letter graphemes English children are taught later (Letters & Sounds phases 3–5).
    32	 * A word containing one of these that the child has NOT been taught is not decodable letter by
    33	 * letter — "mango" is not m-a-n-g-o, "tree" is not t-r-e-e — so it is rejected even when every
    34	 * single letter is known. This is the cheap stand-in for a pronunciation lexicon.
    35	 */
    36	export const LATER_GRAPHEMES = ["ng", "sh", "ch", "th", "qu", "wh", "ph", "ai", "ee", "igh", "oa", "oo", "ar", "or", "ur", "ow", "oi", "ear", "air", "ure", "er", "ay", "ou", "ie", "ea", "oy", "ir", "ue", "aw", "ew", "oe", "au", "ey", "tch", "dge", "wr", "kn", "ck", "ff", "ll", "ss", "zz"];
    37	
    38	/** Exception words (Letters & Sounds phases 2–3). These are never sounded out; they are taught as wholes or not at all. */
    39	export const EXCEPTIONS = new Set(["the", "a", "i", "is", "to", "no", "go", "into", "put", "of", "do", "he", "she", "we", "me", "be", "was", "you", "they", "all", "are", "my", "her", "said", "have", "like", "so", "some", "come", "were", "there", "little", "one", "when", "out", "what"]);
    40	
    41	export function checkWord(word: string, learner: LearnerModel): CheckResult {
    42	  const w = normalise(word);
    43	  if (!w) return { ok: false, word: w, graphemes: [], reasons: ["empty word"] };
    44	  if (/['’]/.test((word ?? "").replace(/^['’]+|['’]+$/g, ""))) return { ok: false, word: w, graphemes: [], reasons: [`"${word}" has an apostrophe; contractions are not decodable`] };
    45	
    46	  const tricky = new Set(learner.tricky.map(normalise));
    47	  if (tricky.has(w)) return { ok: true, kind: "tricky", word: w, graphemes: [w] };
    48	  if (EXCEPTIONS.has(w)) return { ok: false, word: w, graphemes: [], reasons: [`"${w}" is a tricky word that has not been taught yet; it is never sounded out`] };
    49	
    50	  const taught = new Set(learner.gpcs.map(normalise));
    51	  if (/[^aeiou]e$/.test(w) && w.length > 2 && !taught.has("a-e")) return { ok: false, word: w, graphemes: [], reasons: [`"${w}" ends in a silent e (split digraph), which has not been taught yet`] };
    52	  const later = LATER_GRAPHEMES.filter((g) => !taught.has(g)).sort((a, b) => b.length - a.length).find((g) => w.includes(g));
    53	  if (later) return { ok: false, word: w, graphemes: [], reasons: [`"${later}" in "${w}" is one sound that has not been taught yet`] };
    54	
    55	  const gpcs = [...new Set(learner.gpcs.map(normalise).filter(Boolean))].sort(
    56	    (a, b) => b.length - a.length,
    57	  );
    58	  const out: string[] = [];
    59	  let i = 0;
    60	  while (i < w.length) {
    61	    const g = gpcs.find((g) => w.startsWith(g, i));
    62	    if (!g) {
    63	      return {
    64	        ok: false,
    65	        word: w,
    66	        graphemes: out,
    67	        reasons: [`"${w[i]}" (letter ${i + 1} of "${w}") is not a taught sound`],
    68	      };
    69	    }
    70	    out.push(g);
    71	    i += g.length;
    72	  }
    73	  return { ok: true, kind: "decodable", word: w, graphemes: out };
    74	}
    75	
    76	const VOWELS = new Set(["a", "e", "i", "o", "u"]);
    77	/** Phase 2 blends CVC only. Adjacent consonants (must, trick, and) are Phase 4. */
    78	export function isCvcShaped(graphemes: string[]): boolean {
    79	  if (graphemes.length > 3) return false;
    80	  for (let i = 1; i < graphemes.length; i++) if (!VOWELS.has(graphemes[i]) && !VOWELS.has(graphemes[i - 1])) return false;
    81	  return true;
    82	}
    83	
    84	/** A magic word must be decodable, not tricky, and blendable at this stage: the child sounds it out. */
    85	export function checkMagicWord(word: string, learner: LearnerModel): CheckResult {
    86	  const r = checkWord(word, learner);
    87	  if (r.ok && r.kind === "decodable" && !learner.clusters && !isCvcShaped(r.graphemes)) {
    88	    return { ok: false, word: r.word, graphemes: r.graphemes, reasons: [`"${r.word}" has adjacent consonants (${r.graphemes.join("-")}); stick to three sounds like sat, got, sad until blends are taught`] };
    89	  }
    90	  if (r.ok && r.kind === "tricky") {
    91	    return {
    92	      ok: false,
    93	      word: r.word,
    94	      graphemes: r.graphemes,
    95	      reasons: [`"${r.word}" is a tricky word; magic words must be sounded out`],
    96	    };
    97	  }
    98	  return r;
    99	}
   100	
   101	/** Every word of the child's read-back line must be decodable or a taught tricky word. */
   102	export function checkLine(line: string, learner: LearnerModel): { ok: boolean; results: CheckResult[] } {
   103	  const results = line
   104	    .split(/\s+/)
   105	    .filter((t) => normalise(t))
   106	    .map((t) => { const r = checkWord(t, learner); return r.ok && r.kind === "decodable" && !learner.clusters && !isCvcShaped(r.graphemes) ? { ok: false as const, word: r.word, graphemes: r.graphemes, reasons: [`"${r.word}" has adjacent consonants; not yet`] } : r; });
   107	  return { ok: results.length > 0 && results.every((r) => r.ok), results };
   108	}

web search: site.webkit.org SpeechRecognition Siri Safari 14.1 speech recognition ...
codex
The plan still has two major gaps: shortening the clips won’t fix the blend graph’s timing and cancellation, and finger position cannot reliably tell the app which words the adult has read. Some SpeechRecognition claims inherited from the previous review also need correction; I’m checking those before treating them as platform constraints.
web search: 
exec
/bin/zsh -lc "nl -ba src/lib/phonics/validator.ts | sed -n '50,130p'
nl -ba src/index.css | sed -n '1,65p'
nl -ba src/lib/audio/player.ts
rg -n 'serviceWorker|registerSW|CacheFirst|precache|sounds|maximumFileSize' vite.config.* src/lib/library.ts src/lib/offline* public/sw* 2>/dev/null" in /Users/rish_ai/StoryTime
 exited 1 in 0ms:
    50	  const taught = new Set(learner.gpcs.map(normalise));
    51	  if (/[^aeiou]e$/.test(w) && w.length > 2 && !taught.has("a-e")) return { ok: false, word: w, graphemes: [], reasons: [`"${w}" ends in a silent e (split digraph), which has not been taught yet`] };
    52	  const later = LATER_GRAPHEMES.filter((g) => !taught.has(g)).sort((a, b) => b.length - a.length).find((g) => w.includes(g));
    53	  if (later) return { ok: false, word: w, graphemes: [], reasons: [`"${later}" in "${w}" is one sound that has not been taught yet`] };
    54	
    55	  const gpcs = [...new Set(learner.gpcs.map(normalise).filter(Boolean))].sort(
    56	    (a, b) => b.length - a.length,
    57	  );
    58	  const out: string[] = [];
    59	  let i = 0;
    60	  while (i < w.length) {
    61	    const g = gpcs.find((g) => w.startsWith(g, i));
    62	    if (!g) {
    63	      return {
    64	        ok: false,
    65	        word: w,
    66	        graphemes: out,
    67	        reasons: [`"${w[i]}" (letter ${i + 1} of "${w}") is not a taught sound`],
    68	      };
    69	    }
    70	    out.push(g);
    71	    i += g.length;
    72	  }
    73	  return { ok: true, kind: "decodable", word: w, graphemes: out };
    74	}
    75	
    76	const VOWELS = new Set(["a", "e", "i", "o", "u"]);
    77	/** Phase 2 blends CVC only. Adjacent consonants (must, trick, and) are Phase 4. */
    78	export function isCvcShaped(graphemes: string[]): boolean {
    79	  if (graphemes.length > 3) return false;
    80	  for (let i = 1; i < graphemes.length; i++) if (!VOWELS.has(graphemes[i]) && !VOWELS.has(graphemes[i - 1])) return false;
    81	  return true;
    82	}
    83	
    84	/** A magic word must be decodable, not tricky, and blendable at this stage: the child sounds it out. */
    85	export function checkMagicWord(word: string, learner: LearnerModel): CheckResult {
    86	  const r = checkWord(word, learner);
    87	  if (r.ok && r.kind === "decodable" && !learner.clusters && !isCvcShaped(r.graphemes)) {
    88	    return { ok: false, word: r.word, graphemes: r.graphemes, reasons: [`"${r.word}" has adjacent consonants (${r.graphemes.join("-")}); stick to three sounds like sat, got, sad until blends are taught`] };
    89	  }
    90	  if (r.ok && r.kind === "tricky") {
    91	    return {
    92	      ok: false,
    93	      word: r.word,
    94	      graphemes: r.graphemes,
    95	      reasons: [`"${r.word}" is a tricky word; magic words must be sounded out`],
    96	    };
    97	  }
    98	  return r;
    99	}
   100	
   101	/** Every word of the child's read-back line must be decodable or a taught tricky word. */
   102	export function checkLine(line: string, learner: LearnerModel): { ok: boolean; results: CheckResult[] } {
   103	  const results = line
   104	    .split(/\s+/)
   105	    .filter((t) => normalise(t))
   106	    .map((t) => { const r = checkWord(t, learner); return r.ok && r.kind === "decodable" && !learner.clusters && !isCvcShaped(r.graphemes) ? { ok: false as const, word: r.word, graphemes: r.graphemes, reasons: [`"${r.word}" has adjacent consonants; not yet`] } : r; });
   107	  return { ok: results.length > 0 && results.every((r) => r.ok), results };
   108	}
     1	:root {
     2	  --bg: #fbf6ea; --ink: #2b2418; --muted: #5f5442; --card: #fffdf7; --line: #e7dcc4;
     3	  --accent: #b8541a; --magic: #f3c7e6; --magic-ink: #5c1447; --tricky: #dbe7f7; --tricky-ink: #1e3a6b;
     4	  --done: #d8ecd2; --done-ink: #1f4a17; --now: #ffe9a8; --capH: 56px;
     5	  --print: "Futura", "Century Gothic", "Avenir Next", system-ui, sans-serif;
     6	  --serif: "Literata", "Georgia", "Iowan Old Style", serif;
     7	  --display: "Baloo 2", "Avenir Next", "Futura", system-ui, sans-serif;
     8	  --star: #ffe9a8; --star-ink: #b8541a; --glow: #f1c9a8; --warm: #fff3e8;
     9	  --paper: radial-gradient(120% 80% at 50% -10%, #fff8ea 0%, #fbf6ea 45%, #f5ecd8 100%);
    10	}
    11	* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    12	html, body, #root { margin: 0; height: 100%; }
    13	body { background: var(--bg); background-image: var(--paper); background-attachment: fixed; color: var(--ink); font-family: var(--serif); -webkit-font-smoothing: antialiased; overscroll-behavior: none; }
    14	button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; touch-action: manipulation; }
    15	button:disabled { opacity: .4; cursor: default; }
    16	
    17	.app { min-height: 100dvh; display: flex; flex-direction: column; padding: env(safe-area-inset-top) env(safe-area-inset-right) calc(var(--capH) + env(safe-area-inset-bottom)) env(safe-area-inset-left); }
    18	.top { display: flex; align-items: center; gap: 10px; padding: 10px 14px 6px; }
    19	.top .home { width: 48px; height: 48px; border-radius: 12px; border: 2px solid var(--line); background: var(--card); font-size: 26px; }
    20	.top .title { flex: 1; font-size: 20px; font-weight: 800; font-family: var(--display); text-align: center; letter-spacing: .01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    21	.top .home { display: grid; place-items: center; border-radius: 14px; color: var(--ink); }
    22	.top .lvl { display: inline-flex; align-items: center; gap: 4px; justify-content: flex-end; }
    23	.top .lvl { font-size: 12px; color: var(--muted); font-family: system-ui, sans-serif; min-width: 48px; text-align: right; }
    24	main { flex: 1; display: flex; flex-direction: column; padding: 8px 14px 14px; gap: 12px; min-height: 0; }
    25	.kicker { color: var(--muted); letter-spacing: .12em; text-transform: uppercase; font-size: 12px; font-family: system-ui, sans-serif; }
    26	
    27	/* HOME */
    28	.home-screen { justify-content: center; align-items: center; text-align: center; }
    29	.big-tile { width: min(100%, 420px); background: var(--card); border: 3px solid var(--accent); border-radius: 26px; padding: 22px 18px 18px; display: flex; flex-direction: column; align-items: center; gap: 8px; box-shadow: 0 10px 0 var(--glow); position: relative; overflow: hidden; }
    30	.big-tile::before { content: ""; position: absolute; inset: 0; background: radial-gradient(60% 50% at 50% 0%, var(--now) 0%, transparent 70%); opacity: .7; pointer-events: none; }
    31	.big-tile > * { position: relative; }
    32	.big-tile .art { font-size: 96px; line-height: 1; }
    33	.big-tile .t { font-size: 28px; font-weight: 800; font-family: var(--display); line-height: 1.1; }
    34	.big-tile .s { color: var(--muted); font-size: 16px; }
    35	.note { color: var(--muted); font-size: 16px; line-height: 1.5; }
    36	.modes { display: flex; gap: 12px; width: min(100%, 420px); }
    37	.mode { flex: 1; background: var(--card); border: 2px solid var(--line); border-radius: 18px; padding: 14px 10px; display: flex; flex-direction: column; align-items: center; gap: 4px; min-height: 110px; }
    38	.mode .mi { width: 40px; height: 40px; border-radius: 12px; background: #f5ecd8; display: grid; place-items: center; color: var(--ink); }
    39	.mode:first-child .mi { background: var(--warm); color: var(--accent); }
    40	.mode b { font-size: 20px; font-family: var(--display); font-weight: 800; }
    41	.mode small { color: var(--muted); font-size: 13px; font-family: system-ui, sans-serif; line-height: 1.3; }
    42	.mode:first-child { border-color: var(--accent); box-shadow: 0 6px 0 #f1c9a8; }
    43	.w.tap { border: 0; font: inherit; }
    44	.readbar { margin-top: auto; display: flex; flex-direction: column; gap: 8px; align-items: stretch; padding-top: 12px; }
    45	.hintline { color: var(--muted); font-size: 14px; font-family: system-ui, sans-serif; text-align: center; }
    46	.next { min-height: 60px; border-radius: 18px; background: var(--accent); color: #fff; font-size: 22px; font-family: var(--display); font-weight: 800; }
    47	.text-card { display: flex; flex-direction: column; }
    48	
    49	/* STORY */
    50	.story { gap: 10px; }
    51	.art-box { background: linear-gradient(160deg, #f9e2b8, #f2c9a0); border-radius: 22px; display: grid; place-items: center; height: 30dvh; min-height: 140px; font-size: 96px; }
    52	.art-box.big { height: 24dvh; }
    53	.text-card { background: var(--card); border: 2px solid var(--line); border-radius: 22px; padding: 16px 18px; flex: 1; }
    54	.pg { color: var(--muted); font-size: 12px; letter-spacing: .1em; text-transform: uppercase; font-family: system-ui, sans-serif; margin-bottom: 8px; }
    55	.sentence { margin: 0; font-size: clamp(24px, 6.4vw, 34px); line-height: 1.6; }
    56	.w { display: inline-block; padding: 1px 5px; border-radius: 8px; }
    57	.w.read { background: var(--done); color: var(--done-ink); }
    58	.w.magic { background: var(--magic); color: var(--magic-ink); font-weight: 700; box-shadow: 0 0 0 2px #e9a6d3 inset; }
    59	.w.magic.done { background: var(--done); color: var(--done-ink); box-shadow: none; }
    60	.w.magic.skipped { opacity: .7; text-decoration: underline dotted; }
    61	.w.now { background: var(--now); color: var(--ink); box-shadow: none; }
    62	
    63	/* MAGIC PANEL: a bottom sheet in portrait, never wider than the phone */
    64	.panel { position: fixed; left: 0; right: 0; bottom: 0; background: var(--card); border-top: 2px solid var(--line); border-radius: 26px 26px 0 0; padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); box-shadow: 0 -12px 40px rgba(0, 0, 0, .18); z-index: 5; }
    65	.tiles { display: flex; gap: 10px; justify-content: center; margin: 10px 0 12px; }
     1	/**
     2	 * One global <audio> element for narration (unlocked on the first user tap and
     3	 * reused by swapping src — iOS blocks new elements created off-gesture) and one
     4	 * singleton element for short clips (phonemes, prompts) so rapid taps never stack.
     5	 *
     6	 * Each play() returns a Playing whose listeners are its own: a superseded track's
     7	 * late `play()` rejection ("interrupted by a new load request") must never touch
     8	 * the listeners of the track that replaced it.
     9	 */
    10	let narration: HTMLAudioElement | null = null;
    11	let clip: HTMLAudioElement | null = null;
    12	let unlocked = false;
    13	
    14	function make(): HTMLAudioElement {
    15	  const a = document.createElement("audio");
    16	  a.setAttribute("playsinline", "");
    17	  a.preload = "auto";
    18	  a.style.display = "none";
    19	  document.body.appendChild(a); // detached media elements can be collected mid-play
    20	  return a;
    21	}
    22	const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
    23	
    24	/** Call from a user gesture (the Start tap). Safe to call repeatedly. */
    25	export async function unlock(): Promise<void> {
    26	  narration ??= make();
    27	  clip ??= make();
    28	  if (unlocked) return;
    29	  const silent = "data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAAAAE00QSBpc29tbXA0MgAAAAhmcmVlAAAAAG1kYXQ=";
    30	  // every engine must be kicked synchronously inside the tap; awaiting one first can spend the user activation
    31	  const kicks: Promise<unknown>[] = [];
    32	  for (const a of [narration, clip]) { try { a.src = silent; kicks.push(a.play().then(() => a.pause())); } catch { /* still counts as gestured on most engines */ } }
    33	  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance("")); } catch { /* no speech engine */ }
    34	  try { const { unlockBlendAudio } = await import("../blend"); unlockBlendAudio(); } catch { /* no web audio */ }
    35	  unlocked = true;
    36	  await withTimeout(Promise.allSettled(kicks), 400);
    37	}
    38	
    39	export interface Playing {
    40	  /** Resolves when playback ends or is stopped. Rejects only on a load error. */
    41	  done: Promise<void>;
    42	  stop: () => void;
    43	  el: HTMLAudioElement;
    44	}
    45	
    46	const cleanups = new WeakMap<HTMLAudioElement, () => void>();
    47	const blobUrls = new Map<string, string>();
    48	/** iOS plays data: URLs badly (rate changes go silent, `ended` is unreliable); hand it an object URL instead. */
    49	function resolveSrc(src: string): string {
    50	  if (!src.startsWith("data:")) return src;
    51	  const hit = blobUrls.get(src); if (hit) return hit;
    52	  if (blobUrls.size >= 6) { const [k, v] = blobUrls.entries().next().value as [string, string]; URL.revokeObjectURL(v); blobUrls.delete(k); }
    53	  try {
    54	    const [head, b64] = src.split(",", 2); const mime = head.slice(5, head.indexOf(";")) || "audio/mp4";
    55	    const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    56	    const url = URL.createObjectURL(new Blob([bytes], { type: mime })); blobUrls.set(src, url); return url;
    57	  } catch { return src; }
    58	}
    59	function playOn(el: HTMLAudioElement, src: string, rate = 1): Playing {
    60	  cleanups.get(el)?.();               // a superseded track must not keep listeners on the shared element
    61	  el.pause();
    62	  el.src = resolveSrc(src);            // assigning src resets the clock; writing currentTime before load throws on WebKit
    63	  const onMeta = () => { try { el.playbackRate = rate; } catch { /* not supported for this source */ } };
    64	  el.addEventListener("loadedmetadata", onMeta, { once: true });
    65	  let settled = false;
    66	  let resolve!: () => void, reject!: (e: unknown) => void;
    67	  const done = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    68	  const off = () => { el.removeEventListener("ended", onEnded); el.removeEventListener("error", onError); el.removeEventListener("timeupdate", onTime); el.removeEventListener("loadedmetadata", onMeta); };
    69	  const finish = () => { if (settled) return; settled = true; off(); resolve(); };
    70	  const onEnded = () => finish();
    71	  const onError = () => { if (!settled) { settled = true; off(); reject(new Error(`audio failed: ${src}`)); } };
    72	  // safety net: some engines drop `ended` after a stall; treat reaching the end as ended
    73	  const onTime = () => { if (el.duration && el.currentTime >= el.duration - 0.05) { el.pause(); finish(); } };
    74	  el.addEventListener("ended", onEnded);
    75	  el.addEventListener("error", onError);
    76	  el.addEventListener("timeupdate", onTime);
    77	  cleanups.set(el, () => { if (!settled) { settled = true; off(); resolve(); } });
    78	  void el.play().catch((e) => { if (!settled) { settled = true; off(); reject(e); } });
    79	  return { done, stop: () => { if (settled) return; el.pause(); finish(); }, el };
    80	}
    81	
    82	export function playNarration(src: string, rate = 1): Playing {
    83	  narration ??= make();
    84	  clip?.pause();
    85	  return playOn(narration, src, rate);
    86	}
    87	
    88	export function playClip(src: string): Playing {
    89	  clip ??= make();
    90	  return playOn(clip, src);
    91	}
    92	
    93	export function stopAll(): void {
    94	  narration?.pause();
    95	  clip?.pause();
    96	}
zsh:4: no matches found: src/lib/offline*

web search: site.webkit.org/blog "Siri" "recognition" ...
web search: 
web search: https://webaudio.github.io/web-speech-api/
exec
/bin/zsh -lc "rg -n 'serviceWorker|registerSW|CacheFirst|precache|sounds|maximumFileSize|StaleWhileRevalidate' vite.config.ts src/lib/library.ts
nl -ba src/lib/phonics/learner.ts | sed -n '1,100p'
rg -n '\"(his|has|as|gas|bag|dog|put)\"' library --glob 'story.json' | head -15" in /Users/rish_ai/StoryTime
 succeeded in 0ms:
vite.config.ts:29:        // App shell is precached. Library audio is cache-on-play with a small LRU so the
vite.config.ts:35:            urlPattern: ({ url }) => /\/(library|prompts|sounds)\/.*\.(m4a|mp3|json)$/.test(url.pathname),
vite.config.ts:36:            handler: "CacheFirst",
src/lib/library.ts:12:export const soundAsset = (clip: string) => `${BASE}/sounds/${clip}.m4a`;
     1	import type { LearnerModel } from "./validator";
     2	
     3	/**
     4	 * Phonics sequence as data (decision: Letters & Sounds phase 2 order; a school
     5	 * sequence can replace this file without a code change).
     6	 */
     7	export const LS_PHASE2_ORDER = [
     8	  "s", "a", "t", "p",           // set 1
     9	  "i", "n", "m", "d",           // set 2
    10	  "g", "o", "c", "k",           // set 3
    11	  "ck", "e", "u", "r",          // set 4
    12	  "h", "b", "f", "ff", "l", "ll", "ss", // set 5
    13	] as const;
    14	
    15	/** Locked tricky-word set for phase 2. The parent may delay teaching one; nothing may reclassify one. */
    16	export const TRICKY_PHASE2 = ["the", "a", "I", "is", "to", "no", "go", "into"] as const;
    17	
    18	/** Tricky words are mostly regular: show the regular part and mark only the odd bit. `|` separates regular | tricky. */
    19	export const TRICKY_PARTS: Record<string, string> = { the: "th|e", a: "|a", i: "|i", is: "i|s", to: "t|o", no: "n|o", go: "g|o", into: "in|to" };
    20	
    21	/** Named levels: how far along the order a child is. */
    22	export const LEVELS: Record<string, LearnerModel> = {
    23	  "ls-phase2-set1": { gpcs: LS_PHASE2_ORDER.slice(0, 4) as unknown as string[], tricky: [] },
    24	  "ls-phase2-set2": { gpcs: LS_PHASE2_ORDER.slice(0, 8) as unknown as string[], tricky: ["the", "a", "I"] },
    25	  "ls-phase2-set3": { gpcs: LS_PHASE2_ORDER.slice(0, 12) as unknown as string[], tricky: ["the", "a", "I", "is"] },
    26	  "ls-phase2-set4": { gpcs: LS_PHASE2_ORDER.slice(0, 16) as unknown as string[], tricky: ["the", "a", "I", "is", "to"] },
    27	  "ls-phase2-set5": { gpcs: [...LS_PHASE2_ORDER], tricky: [...TRICKY_PHASE2] },
    28	};
    29	
    30	/** How each grapheme is spoken in the UI label and which recorded clip plays. */
    31	export const GRAPHEME_SOUND: Record<string, { label: string; clip: string }> = {
    32	  s: { label: "sss", clip: "s" }, a: { label: "a", clip: "a" }, t: { label: "t", clip: "t" }, p: { label: "p", clip: "p" },
    33	  i: { label: "i", clip: "i" }, n: { label: "nnn", clip: "n" }, m: { label: "mmm", clip: "m" }, d: { label: "d", clip: "d" },
    34	  g: { label: "g", clip: "g" }, o: { label: "o", clip: "o" }, c: { label: "k", clip: "k" }, k: { label: "k", clip: "k" },
    35	  ck: { label: "k", clip: "k" }, e: { label: "e", clip: "e" }, u: { label: "u", clip: "u" }, r: { label: "rrr", clip: "r" },
    36	  h: { label: "h", clip: "h" }, b: { label: "b", clip: "b" }, f: { label: "fff", clip: "f" }, ff: { label: "fff", clip: "f" },
    37	  l: { label: "lll", clip: "l" }, ll: { label: "lll", clip: "l" }, ss: { label: "sss", clip: "s" },
    38	};
    39	
    40	/** Phase 0 default. Phase 1 makes this per-child and parent-editable. */
    41	export const DEFAULT_LEVEL = "ls-phase2-set4";
library/lion-and-mouse/story.json:78:     "t": "his",
library/lion-and-mouse/story.json:129:     "t": "his",
library/pat-and-the-tap/story.json:124:     "t": "put",
library/pat-and-the-tap/story.json:328:     "t": "as",
library/boy-who-cried-wolf/story.json:354:     "t": "his",
library/sam-and-the-pit/story.json:46:     "t": "dog",
library/sam-and-the-pit/story.json:333:     "t": "his",
library/sam-and-the-pit/story.json:371:     "t": "put",
library/sam-and-the-pit/story.json:379:     "t": "his",
library/monkey-and-crocodile/story.json:269:     "t": "his",
library/monkey-and-crocodile/story.json:445:     "t": "his",

web search: 
web search: site.phonetics.linguistics.ucla.edu stops formant transitions burst identification ...
exec
/bin/zsh -lc "nl -ba vite.config.ts | sed -n '17,60p'
nl -ba src/lib/library.ts | sed -n '1,110p'
rg --files library | head -12" in /Users/rish_ai/StoryTime
 succeeded in 0ms:
    17	        display: "standalone",
    18	        orientation: "portrait",
    19	        start_url: ".",
    20	        scope: "./",
    21	        background_color: "#fbf6ea",
    22	        theme_color: "#fbf6ea",
    23	        icons: [
    24	          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    25	          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    26	        ],
    27	      },
    28	      workbox: {
    29	        // App shell is precached. Library audio is cache-on-play with a small LRU so the
    30	        // audio cache can never push the origin over iOS quota and evict IndexedDB.
    31	        globPatterns: ["**/*.{js,css,html,png,svg,json,woff2}"],
    32	        globIgnores: ["library/**", "prompts/**"],
    33	        runtimeCaching: [
    34	          {
    35	            urlPattern: ({ url }) => /\/(library|prompts|sounds)\/.*\.(m4a|mp3|json)$/.test(url.pathname),
    36	            handler: "CacheFirst",
    37	            options: { cacheName: "storytime-audio", expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 } },
    38	          },
    39	        ],
    40	      },
    41	    }),
    42	  ],
    43	  test: {
    44	    environment: "jsdom",
    45	    globals: true,
    46	    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    47	  },
    48	});
     1	/** Built-in library: every library/<slug>/story.json, bundled at build time. */
     2	import type { Story } from "./content/types";
     3	import type { LearnerModel } from "./phonics/validator";
     4	import { checkLine, checkMagicWord } from "./phonics/validator";
     5	
     6	const mods = import.meta.glob("../../library/*/story.json", { eager: true, import: "default" }) as Record<string, Story>;
     7	export const LIBRARY: Story[] = Object.values(mods).sort((a, b) => a.title.localeCompare(b.title));
     8	
     9	export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    10	export const storyAsset = (story: Story, file: string) => (story.tradition === "family" ? file : `${BASE}/library/${story.slug}/${file}`);
    11	export const promptAsset = (file: string) => `${BASE}/prompts/${file}`;
    12	export const soundAsset = (clip: string) => `${BASE}/sounds/${clip}.m4a`;
    13	
    14	/** Can this child do every magic word and the read-back line of this story? */
    15	export function fits(story: Story, learner: LearnerModel): boolean {
    16	  const magicOk = story.pages.every((p) => (p.magic ?? []).every((m) => checkMagicWord(m, learner).ok));
    17	  return magicOk && checkLine(story.moral.line, learner).ok;
    18	}
    19	
    20	export const TRADITION_LABEL: Record<Story["tradition"], string> = { aesop: "Aesop", panchatantra: "Panchatantra", classic: "Classic", family: "Family story" };
library/lion-and-mouse/story.json
library/ant-and-grasshopper/story.json
library/fox-and-crow/story.json
library/hare-and-tortoise/story.json
library/tap-tap-tap/story.json
library/pat-and-the-tap/story.json
library/sam-and-the-pit/story.json
library/boy-who-cried-wolf/story.json
library/blue-jackal/story.json
library/monkey-and-crocodile/story.json

codex
I found a concrete “I’ll try” failure: the validator accepts `his` and would play `h-i-sss`, although its final sound is /z/. The audio rollout also needs cache versioning—new bundled timings could otherwise play against old narration still cached on the phone.
web search: 
exec
/bin/zsh -lc "nl -ba src/screens/Story.tsx | sed -n '310,390p'
rg -n 'download|caches.open|storytime-audio|cache.add|sounds' src --glob '*.ts' --glob '*.tsx'" in /Users/rish_ai/StoryTime
 succeeded in 0ms:
   310	        </>
   311	      )}
   312	      <div className="btns">
   313	        {listener ? <button className="yes" onClick={onYes}>The end ✓</button> : stage === "try" ? (
   314	          <><button className="no" onClick={() => setStage("help")}>Needs help on a word</button><button className="yes" onClick={finishLine}><CheckIcon /> Read it smoothly</button></>
   315	        ) : stage === "help" ? (
   316	          <button className="no" onClick={() => setStage("try")}>← back</button>
   317	        ) : stage === "word" ? (
   318	          <><button className="no" onClick={() => helped !== null && help(helped)}>Show me again</button><button className="yes" onClick={() => setStage("reread")}>✓ They blended it</button></>
   319	        ) : (
   320	          <><button className="no" onClick={() => setStage("help")}>Another word</button><button className="yes" onClick={finishLine}>✓ Read it smoothly</button></>
   321	        )}
   322	      </div>
   323	    </main>
   324	  );
   325	}
   326	
   327	/** Specific feedback, not a trophy: what the child actually did with each word. */
   328	function Done({ story, results, bedtime, kid, learner, onHome }: { story: Story; results: WordResult[]; bedtime: boolean; kid: string; learner: LearnerModel; onHome: () => void }) {
   329	  const ok = results.filter((r) => r.ok);
   330	  const line = (r: WordResult) => {
   331	    const gs = checkWord(r.word, learner).graphemes.join("-");
   332	    if (!r.ok) return `${r.word} · tomorrow`;
   333	    if (r.mode === "first_try") return `${r.word} · slid through ${gs} first try`;
   334	    if (r.mode === "prompted") return `${r.word} · blended it after a nudge`;
   335	    return `${r.word} · heard it slid through, then did it`;
   336	  };
   337	  return (
   338	    <main className="done">
   339	      {!bedtime && ok.length > 0 && <Confetti />}
   340	      <div className="badge rise">{bedtime ? <MoonIcon size={84} /> : <Art art={story.pages[0].art} />}</div>
   341	      <h2 className="rise">{story.title}</h2>
   342	      {results.length > 0 && <ul className="results">{results.map((r, i) => <li key={(r.id ?? r.word) + i} className={r.ok ? "ok" : "no"}>{line(r)}</li>)}</ul>}
   343	      <p className="show">{bedtime ? `Lights low. One real book, then sleep.` : ok.length ? `Now go find someone and read them your ${ok.length === 1 ? "word" : "words"}, ${kid}!` : `Good listening, ${kid}. Those words come back tomorrow for a warm-up.`}</p>
   344	      {!bedtime && ok.length > 0 && <p className="bigwords">{ok.map((r, i) => <span key={(r.id ?? r.word) + i}>{r.word}</span>)}</p>}
   345	      <div className="btns"><button className="yes" onClick={onHome}><CheckIcon /> Done</button></div>
   346	    </main>
   347	  );
   348	}
   349	
   350	function Confetti() {
   351	  const bits = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ l: (i * 37) % 100, d: (i % 6) * 0.15, c: ["#f3c7e6", "#d8ecd2", "#ffe9a8", "#dbe7f7"][i % 4] })), []);
   352	  return <div className="confetti" aria-hidden>{bits.map((b, i) => <i key={i} style={{ left: `${b.l}%`, animationDelay: `${b.d}s`, background: b.c }} />)}</div>;
   353	}
src/lib/store.ts:75:/** One finished reading session (the same story twice counts twice), stamped with how many sounds the child knew. */
src/lib/phonics/validator.ts:84:/** A magic word must be decodable, not tricky, and blendable at this stage: the child sounds it out. */
src/lib/phonics/validator.ts:88:    return { ok: false, word: r.word, graphemes: r.graphemes, reasons: [`"${r.word}" has adjacent consonants (${r.graphemes.join("-")}); stick to three sounds like sat, got, sad until blends are taught`] };
src/screens/AddStory.tsx:69:      retelling: { level: `${kid.gpcs.length} sounds`, checklist: { setup: true, want: true, action: true, consequence: true, feeling: true } },
src/screens/AddStory.tsx:83:        <label className="lbl">For <select value={kidId} onChange={(e) => setKidId(e.target.value)}>{kids.map((k) => <option key={k.id} value={k.id}>{k.avatar} {k.name} · {k.gpcs.length} sounds</option>)}</select></label>
src/lib/phonics/validator.test.ts:33:  it("never sounds out an untaught exception word (is, to, put)", () => {
src/lib/library.ts:12:export const soundAsset = (clip: string) => `${BASE}/sounds/${clip}.m4a`;
src/screens/TeachSound.tsx:21:  const advanceReady = (ready || (kid?.gpcs.length ?? 0) < 4) && !taughtToday;   // the first four sounds need no story evidence, but one new sound per day
src/screens/TeachSound.tsx:30:  if (!kid || !g || !t) return <main className="home-screen"><p className="note">All phase-2 sounds are taught. 🎉</p><button className="yes" onClick={onDone}>Back</button></main>;
src/screens/TeachSound.tsx:38:    { title: "Blend one word", body: t.blend.length ? <><div className="tiles">{t.blend.map((x, i) => <button key={i} className="tile" onClick={() => void playClip(soundAsset(GRAPHEME_SOUND[x].clip)).done.catch(() => {})}>{x}</button>)}</div><div className="row center"><button className="small" onClick={() => void playBlend(t.blend)}>▶ slide through it</button></div><p className="script">{kid.name} slides through it and says the word.</p></> : <p className="script">No blend yet — with only a few sounds, just find the sound in the words above.</p> },
src/screens/TeachSound.tsx:49:      {last && !advanceReady && !override && <p className="legend">{taughtToday ? `One new sound a day: ${kid.name} learned one today already. Replay it now; come back tomorrow for the next.` : `${kid.name} has not blended the current sounds first-try in two sessions yet, so this stays practice for today.`} <button className="linkbtn" onClick={() => setOverride(true)}>mark it taught anyway</button></p>}
src/screens/TeachSound.tsx:50:      <p className="legend">“Taught today” adds {g}{newTricky.length ? ` and the tricky word${newTricky.length > 1 ? "s" : ""} ${newTricky.join(", ")}` : ""} to {kid.name}'s sounds. They show up in magic words and the warm-up from tomorrow.</p>
src/machine/story.machine.ts:51:    sounded: assign({ mode: ({ context }) => context.mode }),   // tile taps play sounds; they never decide the label
src/machine/story.machine.ts:76:      // waiting for the parent's verdict; the child may tap sounds meanwhile
src/screens/Library.tsx:64:                    <small>{mid ? `page ${session!.page + 1} · continue` : p ? `read ${p.timesFinished}× · ${p.results.filter((r) => r.ok).length}/${p.results.length} magic words` : ok ? "new" : "needs more sounds"}</small>
src/components/MagicPanel.tsx:13: * one precise nudge, then "After a nudge" / "Show me" / skip. Tile taps only play sounds and never
src/screens/Welcome.tsx:12:  { n: 4, label: "s a t p", hint: "knows these four sounds" },
src/screens/Welcome.tsx:16:  { n: 23, label: "+ h b f l ss", hint: "all phase-2 sounds" },
src/screens/Welcome.tsx:46:        <p className="legend">How far along are they? Tap the last row that is true (you'll hear its newest sound — these are sounds, never letter names).</p>
src/screens/Story.tsx:160:    if (listen) await speakPrompt("notyet", "That's okay. Listen: I'll slide through the sounds, then you try."); else setCaption(`${reader}: keep your voice going, slide through the sounds. Do NOT say the whole word.`);
src/screens/Story.tsx:243:            <span className="script">{pending.length ? <><b>{reader}</b> reads the story. <b>{kid}</b> reads the <em className="pinkword">pink word</em>: tap it, then say the sounds and blend.</> : <><b>{reader}</b> reads the page. Then go on.</>}</span>
src/screens/Story.tsx:260: * the app shows regular vs tricky parts (tricky word) or stretches the sounds (decodable word),
src/screens/Story.tsx:270:  const finishLine = () => { if (buildWord) { setStage("build"); setCaption(`${reader}: say "${buildWord}". ${kid} counts the sounds, then builds it.`); } else onYes(); };
src/screens/Story.tsx:279:      setCaption(`${stretched(r.graphemes)} … ${reader}: slide through the sounds, but let ${kid} say the word.`);
src/screens/Family.tsx:28:            <small>{k.role === "listener" ? "listens & taps" : `${k.gpcs.length} sounds · night ${Math.min(30, nightsFor(k.id) + 1)}`}</small>
src/screens/Family.tsx:35:      <button className="linkbtn" onClick={onSettings}>Grown-ups: settings, stories, sounds →</button>
src/components/SegmentPanel.tsx:12: * the child counts the sounds, then drags-by-tapping taught grapheme tiles into the sound boxes,
src/components/SegmentPanel.tsx:42:      <h2 className="panel-h">{reader} says the word. {kid} counts the sounds on fingers, then builds it{learner.gpcs.filter((g) => "aeiou".includes(g)).length > 1 ? " — listen for the middle sound" : ""}.</h2>
src/components/SegmentPanel.tsx:45:        <div className="row center"><span className="legend">How many sounds? Fingers up.</span><button className="small" onClick={() => setCounted(true)}>they held up {target.length} ✓</button></div>
src/screens/Home.tsx:46:        <button className="readycard" onClick={onTeach}><b>{(kid.teachDays ?? []).some((d) => new Date(d).toDateString() === new Date().toDateString()) ? `Replay today's sound: ${kid.gpcs[kid.gpcs.length - 1]}` : `Teach today's sound: ${LS_PHASE2_ORDER[kid.gpcs.length]}`}</b><small>90 seconds, one new sound a day. After four sounds the first story unlocks.</small></button>
src/screens/Home.tsx:96:        <p className="note">{kid.gpcs.length < 4 ? `Four sounds, then the first story. ${4 - kid.gpcs.length} to go.` : `No story fits ${kid.name}'s sounds yet. A grown-up can add sounds in Settings.`}</p>
src/screens/Settings.tsx:50:        {customs.length === 0 && <p className="legend">None yet. Add one about Nani, the dog, or the blue cup — the app keeps the magic words to sounds your child knows.</p>}
src/screens/Settings.tsx:59:  const known = kid.gpcs.length; // taught sounds are always a prefix of the order
src/screens/Settings.tsx:72:      <p className="legend">Tap any sound to hear it (the sound, never the letter name). Taught sounds are green; change them with the list above or the 90-second teach routine on Home.</p>

web search: 
codex
**Plan v3 still needs changes before implementation.** The largest risks are incorrect sound models, a validator that is not actually fail-closed for arbitrary words, and interaction state being mistaken for reading progress.

I read the requested files and relevant validator, state-machine, CSS, player, and caching code. No files were modified; excluded directories were not read. This is a source review, not an on-device or listening test.

1. **[P1] Hand-cutting removes unwanted vowels; it does not guarantee a teachable consonant.**  
   [Plan line 14](/Users/rish_ai/StoryTime/docs/plan-v2.md:14)

   The proposed millisecond windows are starting hypotheses, not acceptance criteria. Cutting `/b d g/` down to a release burst can remove information that distinguishes them. Applying a blanket 10 ms fade to a tiny burst can also suppress the very sound you need. Consonant identity involves transitions as well as release noise; mixing a burst from one speaker with an unrelated vowel does not reconstruct those transitions. See Oxford’s [consonant acoustics explanation](https://www.phon.ox.ac.uk/jcoleman/consonant_acoustics).

   Require listening to **every sound**, plus initial/final positions and contrasts such as *pat/bat, ten/den, cap/gap, sat/sad*. The current *sat/pin/dog/puff* set misses several clips and important contrasts. Include normal and bedtime rates, on the phone speaker.

   Add an explicit escape hatch: **replace a source recording when cutting cannot produce an intelligible instructional sound**. Do not force every Commons file through the same production method. Pin original bytes with hashes so future downloads cannot silently invalidate hand-picked offsets.

2. **[P1] The blend graph still produces gaps and misleading visual timing after the proposed stop fix.**  
   [Plan line 17](/Users/rish_ai/StoryTime/docs/plan-v2.md:17), [blend.ts line 47](/Users/rish_ai/StoryTime/src/lib/blend.ts:47)

   The plan fixes stop holds but leaves vowel/continuant scheduling unspecified. A proposed **280 ms vowel** ends before the existing next-source start at **285 ms**. At bedtime rate `0.88`, that next start becomes approximately **329 ms**, while the buffer still lasts 280 ms: roughly **49 ms of silence**. Changing scheduling intervals does not stretch the recording; `src.playbackRate` is never changed.

   Also, “the vowel starts during the burst” can mask the stop. “Never any digital silence” is the wrong universal invariant: stop closure is part of speech. The goal is an intelligible connected model without **artificial inter-clip gaps**.

   Specify one timeline containing each source’s audible duration, envelope, transition, and grapheme interval. Drive the sweep from that timeline; a uniform percentage across equal-width tiles cannot track unequal sound durations. Make the `<audio>` fallback explicitly a **segmented-sound aid**, since sequential playback cannot promise the same continuous model.

3. **[P1] Audio cancellation and interruption recovery belong in this plan.**  
   [blend.ts line 60](/Users/rish_ai/StoryTime/src/lib/blend.ts:60), [speech.ts line 33](/Users/rish_ai/StoryTime/src/lib/audio/speech.ts:33)

   `alive() === false` ends the blend’s polling promise but **does not stop scheduled AudioBufferSourceNodes**. `stopAll()` only pauses HTML audio. A child can leave the screen and still hear the blend.

   If the AudioContext remains suspended, its clock does not advance, so the blend completion loop can wait indefinitely. Separately, `speakText().stop()` does not cancel its queued `setTimeout(synth.speak)`, allowing a stopped utterance to start afterward.

   Require cancellable playback handles, retained source nodes, cancelled queued utterances, bounded resume/start timeouts, and cleanup on hide/navigation. Acceptance must include **Home mid-blend, lock/unlock, interrupted audio, and immediate retry**.

4. **[P1] Audio deployment can pair new timings with old narration.**  
   [vite.config.ts line 28](/Users/rish_ai/StoryTime/vite.config.ts:28)

   The app bundles story timings, but audio uses stable URLs and a `CacheFirst` cache lasting up to 30 days. Regenerating Andrew’s narration at those URLs can leave an existing installation using **new `tokens[].ms` with old Neerja audio**. The magic-word stop may disclose the answer or interrupt the wrong word. Corrected phoneme clips can likewise remain stale.

   Version audio URLs and bind each timing manifest to its audio version. Test an **upgrade from an already-cached installation**, not just a clean install.

   The offline promise also needs an explicit download policy: `.m4a` files are not precached, and the shared 40-entry runtime cache can evict previously played sounds.

5. **[P1] “48 px targets + elementFromPoint” is not a complete 390 px interaction design.**  
   [Plan lines 20–24](/Users/rish_ai/StoryTime/docs/plan-v2.md:20), [index.css line 53](/Users/rish_ai/StoryTime/src/index.css:53)

   With current outer padding, card padding, and borders, a 390 px viewport leaves approximately **322 px for text**. Making every word at least 48 px wide fits at most six minimum-sized targets before spaces; actual words force more wrapping. Increasing line-height alone does not make narrow words like *a* 48 px wide.

   A finger directly on the word also covers the print. `elementFromPoint` does not resolve whitespace, punctuation, or a finger travelling beneath the baseline. Returning diagonally to the next line can briefly activate unrelated words.

   Specify and prototype **row-aware hit regions beneath the print**, boundaries between neighbouring words, whitespace behaviour, and an explicit lift/reposition rule for line returns. Handle `pointercancel`, lost capture, and drag-versus-tap suppression—particularly when a gesture begins on the pink button.

   `touch-action:none` across the entire sentence also removes that area as a scrolling surface. Test the longest page and enlarged text with a real finger, including access to content below the fold.

6. **[P1] Finger position must not become evidence that words were read.**  
   [Plan lines 21–24](/Users/rish_ai/StoryTime/docs/plan-v2.md:21), [Story.tsx line 232](/Users/rish_ai/StoryTime/src/screens/Story.tsx:232)

   The existing `.read` rule is simply `i < token`. Touch a later word and every earlier word receives the trail—even if nobody said them. Move backwards and the trail disappears. Sliding beyond an unresolved pink word also makes that word qualify as “read”, despite the plan’s prohibition.

   Separate **current pointer**, **adult-confirmed reading position**, and **child-word result**. Define whether an unresolved child turn blocks the adult cursor from crossing it.

   From the teacher lens, “you drive while Papa reads” reverses the coordination task: the child must already map speech to print to drive accurately. Start with the adult pointing in time with their voice; offer child driving when they can coordinate it. Present the highlight as a shared-reading cue, not evidence of decoding. The broader instructional goal still includes children reading connected text themselves, as described in the [IES foundational reading guide](https://ies.ed.gov/ncee/WWC/PracticeGuide/21/Published).

7. **[P1] The SpeechRecognition “push-to-talk contract” is neither push-to-talk nor a sufficient failure contract.**  
   [Plan line 32](/Users/rish_ai/StoryTime/docs/plan-v2.md:32)

   A tap followed by automatic restarts is a tap-started listening session. A 200 ms timer does not create user activation or prove the recognizer is ready. “Never start from an effect” is an implementation convention; the important invariant is **authorized, serialized session ownership**.

   Specify `off → starting → listening → stopping/error`, a visible Stop control, startup/no-progress timeouts, and terminal handling for permission denial, service unavailability, and capture failure. Every callback and restart timer needs a page/session generation check. Clear timers on **Next page as well as MagicPanel, Home, and hide**.

   There is a particularly relevant recent report: [WebKit bug 321436](https://bugs.webkit.org/show_bug.cgi?id=321436) describes recognition hanging after media playback, with **no result, error, or end event**, including standalone mode. It is a single-device report, not proof of universal failure—but it directly challenges this app’s “word-card audio, then tap to follow again” path. Counting `onend` failures will not catch it.

8. **[P1] The ASR aligner still cannot deliver the claimed word-level teaching cue.**  
   [Plan lines 33–36](/Users/rish_ai/StoryTime/docs/plan-v2.md:33)

   “Never move on low-confidence interim” lacks a usable definition. Confidence describes a recognition alternative, not a calibrated score for each displayed word. Interim results can be replaced or removed; the aligner needs revision handling, not just an advancing cursor. These behaviours are explicit in the [Web Speech API draft](https://webaudio.github.io/web-speech-api/).

   Concrete unresolved cases:

   - Repeated text: *“The cat … the cat …”* must not reuse an old match.
   - A parent rereads or discusses the illustration.
   - A child says a nearby grey word; this API supplies no speaker identity.
   - A finger correction is immediately overwritten by a delayed ASR result.
   - A result spans the pending pink word: ignoring that token must not allow matching beyond the child turn.

   “Chrome emits final results only” is also false as a general contract; Google documents both interim and final output in its [Chrome example](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api/).

   Define manual correction as invalidating the prior alignment session. Replace “lag under a word” with measured **wrong-word rate, latency distribution, and recovery behaviour**, using representative readers and full stories. A highlight can be less than one word late and still point at the wrong word throughout.

9. **[P1] “I’ll try” exposes a pronunciation hole in the validator.**  
   [Plan line 39](/Users/rish_ai/StoryTime/docs/plan-v2.md:39), [validator.ts line 41](/Users/rish_ai/StoryTime/src/lib/phonics/validator.ts:41)

   `checkMagicWord()` verifies known letter sequences plus a limited exception list; it does not establish the word’s pronunciation. **`his` is already in the library**, passes with phase-2 graphemes, and would receive `h-i-sss`, although its final phoneme is /z/. `has` has the same problem.

   Opening arbitrary grey words materially expands the validator’s responsibility. Use a **reviewed candidate lexicon with explicit phoneme mappings**, intersected with the learner’s taught correspondences. Reject unknown candidates. Do not patch only these examples and continue calling arbitrary text fail-closed.

10. **[P1] “One upcoming word” lacks both a pedagogical selection rule and a turn contract.**  
    [Plan line 39](/Users/rish_ai/StoryTime/docs/plan-v2.md:39), [Story.tsx line 129](/Users/rish_ai/StoryTime/src/screens/Story.tsx:129)

    “Not yet highlighted” does not mean “not yet spoken”, especially with optional finger-follow and lagging recognition. If the adult has already supplied the word, it can still be useful supported practice; it should not be recorded as independent decoding.

    Choose the optional word **before the adult reaches it**, give it an explicit child-turn marker, and distinguish independent versus supported attempts through adult judgment. One extra is a ceiling, not a quota.

    Specify occurrence ID, ordering against the designed target, cancellation, resume persistence, and post-verdict cursor position. If this feature extends to Listen mode, the current reread path reads the entire page and advances; it does not revisit another pending target. “Never competes” needs executable behaviour.

11. **[P1] The prohibition on modelling the whole word confuses teaching with testing.**  
    [Story.tsx line 160](/Users/rish_ai/StoryTime/src/screens/Story.tsx:160), [MagicPanel.tsx line 63](/Users/rish_ai/StoryTime/src/components/MagicPanel.tsx:63)

    After a child struggles, the code repeatedly insists the adult must not say the whole word. But a novice may know the sounds and still need someone to demonstrate how they become a recognisable word. A model that stops before that outcome leaves the hardest step unexplained.

    Keep an initial independent attempt, then allow: **adult models sounds into the whole word → child practises → both reread the phrase for meaning**. Record that as modelled; assess independence on a later attempt. IES explicitly recommends demonstrating blending before independent application in its [practice guide](https://ies.ed.gov/ncee/WWC/PracticeGuide/21/Published).

    Likewise, “keep your voice going” needs a stop-consonant exception. Children should not be pushed to turn `/t/` into a sustained “tuh”.

12. **[P1] Family recording and tap timings need validity gates, not duration heuristics.**  
    [Plan lines 27 and 42](/Users/rish_ai/StoryTime/docs/plan-v2.md:27), [record.ts line 8](/Users/rish_ai/StoryTime/src/lib/audio/record.ts:8)

    A 500 ms minimum does not prove a valid recording, and a clip shorter than 1.2 seconds can still contain “tee” or “tuh”. Silence trimming can remove weak consonants or closure. Require successful decode, audible playback, and approval **both alone and in a representative blend**. Include a way to restore the fallback.

    First-use permission is another race: the parent may release their finger while `getUserMedia()` is pending. Specify permission preparation and a recording-ready cue; install error/track-ended cleanup before recording starts.

    For existing recordings, `Date.now() − t0` fails immediately after pause, seek, or playback-rate changes. Capture **`audio.currentTime`**. Live-recording timestamps need a monotonic clock and playback correction.

    Crucially, `Story.tsx` treats **any positive token timestamp** as a timed page. A partially tapped page could enter precise-stop playback with invalid remaining timings. Validate completeness, order, duration bounds, and the pre-magic stop by listening; otherwise retain the untimed path.

13. **[P2] Tighten the remaining content and family-voice details.**

    - The current mapping contains **18 unique clips**, not 19. Derive progress from the resolver’s inventory.
    - Treat “US voice” as a production preference, not a complete phonetic specification. Approve the actual narrator’s target words alongside the clips; accept the family’s dialect without making pronunciation differences look like mistakes.
    - Add optional undo/re-anchor and a tap-only alternative for people who cannot comfortably drag. Neither should require voice recognition.

The prioritised plan changes are:

1. **[P1] Make the sound model teachable:** replace unsuitable recordings, broaden listening acceptance, and permit complete whole-word modelling after an independent attempt.
2. **[P1] Specify one audio timeline and cancellation contract:** decoded durations, envelopes, grapheme sweep, interruption recovery, and honest fallback behaviour.
3. **[P1] Version audio and timings together; define verified offline availability.**
4. **[P1] Prototype finger-follow at 390 px:** unobscured print, row returns, drag/tap arbitration, scrolling, and separate pointer/reading/verdict state.
5. **[P1] Restrict “I’ll try” to pronunciation-reviewed candidates and explicitly ordered child turns.**
6. **[P1] Replace the ASR restart recipe with a bounded session state machine, revision-aware alignment, manual override, and post-audio device tests.**
7. **[P1] Require validated recordings and complete, playback-checked family timings.**
8. **[P2] Correct the sound count and add dialect, undo, and tap-only refinements.**
tokens used
78,336
**Plan v3 still needs changes before implementation.** The largest risks are incorrect sound models, a validator that is not actually fail-closed for arbitrary words, and interaction state being mistaken for reading progress.

I read the requested files and relevant validator, state-machine, CSS, player, and caching code. No files were modified; excluded directories were not read. This is a source review, not an on-device or listening test.

1. **[P1] Hand-cutting removes unwanted vowels; it does not guarantee a teachable consonant.**  
   [Plan line 14](/Users/rish_ai/StoryTime/docs/plan-v2.md:14)

   The proposed millisecond windows are starting hypotheses, not acceptance criteria. Cutting `/b d g/` down to a release burst can remove information that distinguishes them. Applying a blanket 10 ms fade to a tiny burst can also suppress the very sound you need. Consonant identity involves transitions as well as release noise; mixing a burst from one speaker with an unrelated vowel does not reconstruct those transitions. See Oxford’s [consonant acoustics explanation](https://www.phon.ox.ac.uk/jcoleman/consonant_acoustics).

   Require listening to **every sound**, plus initial/final positions and contrasts such as *pat/bat, ten/den, cap/gap, sat/sad*. The current *sat/pin/dog/puff* set misses several clips and important contrasts. Include normal and bedtime rates, on the phone speaker.

   Add an explicit escape hatch: **replace a source recording when cutting cannot produce an intelligible instructional sound**. Do not force every Commons file through the same production method. Pin original bytes with hashes so future downloads cannot silently invalidate hand-picked offsets.

2. **[P1] The blend graph still produces gaps and misleading visual timing after the proposed stop fix.**  
   [Plan line 17](/Users/rish_ai/StoryTime/docs/plan-v2.md:17), [blend.ts line 47](/Users/rish_ai/StoryTime/src/lib/blend.ts:47)

   The plan fixes stop holds but leaves vowel/continuant scheduling unspecified. A proposed **280 ms vowel** ends before the existing next-source start at **285 ms**. At bedtime rate `0.88`, that next start becomes approximately **329 ms**, while the buffer still lasts 280 ms: roughly **49 ms of silence**. Changing scheduling intervals does not stretch the recording; `src.playbackRate` is never changed.

   Also, “the vowel starts during the burst” can mask the stop. “Never any digital silence” is the wrong universal invariant: stop closure is part of speech. The goal is an intelligible connected model without **artificial inter-clip gaps**.

   Specify one timeline containing each source’s audible duration, envelope, transition, and grapheme interval. Drive the sweep from that timeline; a uniform percentage across equal-width tiles cannot track unequal sound durations. Make the `<audio>` fallback explicitly a **segmented-sound aid**, since sequential playback cannot promise the same continuous model.

3. **[P1] Audio cancellation and interruption recovery belong in this plan.**  
   [blend.ts line 60](/Users/rish_ai/StoryTime/src/lib/blend.ts:60), [speech.ts line 33](/Users/rish_ai/StoryTime/src/lib/audio/speech.ts:33)

   `alive() === false` ends the blend’s polling promise but **does not stop scheduled AudioBufferSourceNodes**. `stopAll()` only pauses HTML audio. A child can leave the screen and still hear the blend.

   If the AudioContext remains suspended, its clock does not advance, so the blend completion loop can wait indefinitely. Separately, `speakText().stop()` does not cancel its queued `setTimeout(synth.speak)`, allowing a stopped utterance to start afterward.

   Require cancellable playback handles, retained source nodes, cancelled queued utterances, bounded resume/start timeouts, and cleanup on hide/navigation. Acceptance must include **Home mid-blend, lock/unlock, interrupted audio, and immediate retry**.

4. **[P1] Audio deployment can pair new timings with old narration.**  
   [vite.config.ts line 28](/Users/rish_ai/StoryTime/vite.config.ts:28)

   The app bundles story timings, but audio uses stable URLs and a `CacheFirst` cache lasting up to 30 days. Regenerating Andrew’s narration at those URLs can leave an existing installation using **new `tokens[].ms` with old Neerja audio**. The magic-word stop may disclose the answer or interrupt the wrong word. Corrected phoneme clips can likewise remain stale.

   Version audio URLs and bind each timing manifest to its audio version. Test an **upgrade from an already-cached installation**, not just a clean install.

   The offline promise also needs an explicit download policy: `.m4a` files are not precached, and the shared 40-entry runtime cache can evict previously played sounds.

5. **[P1] “48 px targets + elementFromPoint” is not a complete 390 px interaction design.**  
   [Plan lines 20–24](/Users/rish_ai/StoryTime/docs/plan-v2.md:20), [index.css line 53](/Users/rish_ai/StoryTime/src/index.css:53)

   With current outer padding, card padding, and borders, a 390 px viewport leaves approximately **322 px for text**. Making every word at least 48 px wide fits at most six minimum-sized targets before spaces; actual words force more wrapping. Increasing line-height alone does not make narrow words like *a* 48 px wide.

   A finger directly on the word also covers the print. `elementFromPoint` does not resolve whitespace, punctuation, or a finger travelling beneath the baseline. Returning diagonally to the next line can briefly activate unrelated words.

   Specify and prototype **row-aware hit regions beneath the print**, boundaries between neighbouring words, whitespace behaviour, and an explicit lift/reposition rule for line returns. Handle `pointercancel`, lost capture, and drag-versus-tap suppression—particularly when a gesture begins on the pink button.

   `touch-action:none` across the entire sentence also removes that area as a scrolling surface. Test the longest page and enlarged text with a real finger, including access to content below the fold.

6. **[P1] Finger position must not become evidence that words were read.**  
   [Plan lines 21–24](/Users/rish_ai/StoryTime/docs/plan-v2.md:21), [Story.tsx line 232](/Users/rish_ai/StoryTime/src/screens/Story.tsx:232)

   The existing `.read` rule is simply `i < token`. Touch a later word and every earlier word receives the trail—even if nobody said them. Move backwards and the trail disappears. Sliding beyond an unresolved pink word also makes that word qualify as “read”, despite the plan’s prohibition.

   Separate **current pointer**, **adult-confirmed reading position**, and **child-word result**. Define whether an unresolved child turn blocks the adult cursor from crossing it.

   From the teacher lens, “you drive while Papa reads” reverses the coordination task: the child must already map speech to print to drive accurately. Start with the adult pointing in time with their voice; offer child driving when they can coordinate it. Present the highlight as a shared-reading cue, not evidence of decoding. The broader instructional goal still includes children reading connected text themselves, as described in the [IES foundational reading guide](https://ies.ed.gov/ncee/WWC/PracticeGuide/21/Published).

7. **[P1] The SpeechRecognition “push-to-talk contract” is neither push-to-talk nor a sufficient failure contract.**  
   [Plan line 32](/Users/rish_ai/StoryTime/docs/plan-v2.md:32)

   A tap followed by automatic restarts is a tap-started listening session. A 200 ms timer does not create user activation or prove the recognizer is ready. “Never start from an effect” is an implementation convention; the important invariant is **authorized, serialized session ownership**.

   Specify `off → starting → listening → stopping/error`, a visible Stop control, startup/no-progress timeouts, and terminal handling for permission denial, service unavailability, and capture failure. Every callback and restart timer needs a page/session generation check. Clear timers on **Next page as well as MagicPanel, Home, and hide**.

   There is a particularly relevant recent report: [WebKit bug 321436](https://bugs.webkit.org/show_bug.cgi?id=321436) describes recognition hanging after media playback, with **no result, error, or end event**, including standalone mode. It is a single-device report, not proof of universal failure—but it directly challenges this app’s “word-card audio, then tap to follow again” path. Counting `onend` failures will not catch it.

8. **[P1] The ASR aligner still cannot deliver the claimed word-level teaching cue.**  
   [Plan lines 33–36](/Users/rish_ai/StoryTime/docs/plan-v2.md:33)

   “Never move on low-confidence interim” lacks a usable definition. Confidence describes a recognition alternative, not a calibrated score for each displayed word. Interim results can be replaced or removed; the aligner needs revision handling, not just an advancing cursor. These behaviours are explicit in the [Web Speech API draft](https://webaudio.github.io/web-speech-api/).

   Concrete unresolved cases:

   - Repeated text: *“The cat … the cat …”* must not reuse an old match.
   - A parent rereads or discusses the illustration.
   - A child says a nearby grey word; this API supplies no speaker identity.
   - A finger correction is immediately overwritten by a delayed ASR result.
   - A result spans the pending pink word: ignoring that token must not allow matching beyond the child turn.

   “Chrome emits final results only” is also false as a general contract; Google documents both interim and final output in its [Chrome example](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api/).

   Define manual correction as invalidating the prior alignment session. Replace “lag under a word” with measured **wrong-word rate, latency distribution, and recovery behaviour**, using representative readers and full stories. A highlight can be less than one word late and still point at the wrong word throughout.

9. **[P1] “I’ll try” exposes a pronunciation hole in the validator.**  
   [Plan line 39](/Users/rish_ai/StoryTime/docs/plan-v2.md:39), [validator.ts line 41](/Users/rish_ai/StoryTime/src/lib/phonics/validator.ts:41)

   `checkMagicWord()` verifies known letter sequences plus a limited exception list; it does not establish the word’s pronunciation. **`his` is already in the library**, passes with phase-2 graphemes, and would receive `h-i-sss`, although its final phoneme is /z/. `has` has the same problem.

   Opening arbitrary grey words materially expands the validator’s responsibility. Use a **reviewed candidate lexicon with explicit phoneme mappings**, intersected with the learner’s taught correspondences. Reject unknown candidates. Do not patch only these examples and continue calling arbitrary text fail-closed.

10. **[P1] “One upcoming word” lacks both a pedagogical selection rule and a turn contract.**  
    [Plan line 39](/Users/rish_ai/StoryTime/docs/plan-v2.md:39), [Story.tsx line 129](/Users/rish_ai/StoryTime/src/screens/Story.tsx:129)

    “Not yet highlighted” does not mean “not yet spoken”, especially with optional finger-follow and lagging recognition. If the adult has already supplied the word, it can still be useful supported practice; it should not be recorded as independent decoding.

    Choose the optional word **before the adult reaches it**, give it an explicit child-turn marker, and distinguish independent versus supported attempts through adult judgment. One extra is a ceiling, not a quota.

    Specify occurrence ID, ordering against the designed target, cancellation, resume persistence, and post-verdict cursor position. If this feature extends to Listen mode, the current reread path reads the entire page and advances; it does not revisit another pending target. “Never competes” needs executable behaviour.

11. **[P1] The prohibition on modelling the whole word confuses teaching with testing.**  
    [Story.tsx line 160](/Users/rish_ai/StoryTime/src/screens/Story.tsx:160), [MagicPanel.tsx line 63](/Users/rish_ai/StoryTime/src/components/MagicPanel.tsx:63)

    After a child struggles, the code repeatedly insists the adult must not say the whole word. But a novice may know the sounds and still need someone to demonstrate how they become a recognisable word. A model that stops before that outcome leaves the hardest step unexplained.

    Keep an initial independent attempt, then allow: **adult models sounds into the whole word → child practises → both reread the phrase for meaning**. Record that as modelled; assess independence on a later attempt. IES explicitly recommends demonstrating blending before independent application in its [practice guide](https://ies.ed.gov/ncee/WWC/PracticeGuide/21/Published).

    Likewise, “keep your voice going” needs a stop-consonant exception. Children should not be pushed to turn `/t/` into a sustained “tuh”.

12. **[P1] Family recording and tap timings need validity gates, not duration heuristics.**  
    [Plan lines 27 and 42](/Users/rish_ai/StoryTime/docs/plan-v2.md:27), [record.ts line 8](/Users/rish_ai/StoryTime/src/lib/audio/record.ts:8)

    A 500 ms minimum does not prove a valid recording, and a clip shorter than 1.2 seconds can still contain “tee” or “tuh”. Silence trimming can remove weak consonants or closure. Require successful decode, audible playback, and approval **both alone and in a representative blend**. Include a way to restore the fallback.

    First-use permission is another race: the parent may release their finger while `getUserMedia()` is pending. Specify permission preparation and a recording-ready cue; install error/track-ended cleanup before recording starts.

    For existing recordings, `Date.now() − t0` fails immediately after pause, seek, or playback-rate changes. Capture **`audio.currentTime`**. Live-recording timestamps need a monotonic clock and playback correction.

    Crucially, `Story.tsx` treats **any positive token timestamp** as a timed page. A partially tapped page could enter precise-stop playback with invalid remaining timings. Validate completeness, order, duration bounds, and the pre-magic stop by listening; otherwise retain the untimed path.

13. **[P2] Tighten the remaining content and family-voice details.**

    - The current mapping contains **18 unique clips**, not 19. Derive progress from the resolver’s inventory.
    - Treat “US voice” as a production preference, not a complete phonetic specification. Approve the actual narrator’s target words alongside the clips; accept the family’s dialect without making pronunciation differences look like mistakes.
    - Add optional undo/re-anchor and a tap-only alternative for people who cannot comfortably drag. Neither should require voice recognition.

The prioritised plan changes are:

1. **[P1] Make the sound model teachable:** replace unsuitable recordings, broaden listening acceptance, and permit complete whole-word modelling after an independent attempt.
2. **[P1] Specify one audio timeline and cancellation contract:** decoded durations, envelopes, grapheme sweep, interruption recovery, and honest fallback behaviour.
3. **[P1] Version audio and timings together; define verified offline availability.**
4. **[P1] Prototype finger-follow at 390 px:** unobscured print, row returns, drag/tap arbitration, scrolling, and separate pointer/reading/verdict state.
5. **[P1] Restrict “I’ll try” to pronunciation-reviewed candidates and explicitly ordered child turns.**
6. **[P1] Replace the ASR restart recipe with a bounded session state machine, revision-aware alignment, manual override, and post-audio device tests.**
7. **[P1] Require validated recordings and complete, playback-checked family timings.**
8. **[P2] Correct the sound count and add dialect, undo, and tap-only refinements.**
