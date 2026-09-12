/** Family context: kids, settings, custom stories, session — loaded once, saved on change. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Story } from "./content/types";
import { LIBRARY, fits, listenAlongStory } from "./library";
import { designed } from "./results";
import {
  defaultKids, learnerOf, loadAllSessions, loadCustomStories, loadKids, loadProgress, loadSettings,
  recordFinish, recordEncoding, readyToAdvance, recordAttempt, loadAttempts, type Attempt, saveCustomStories, saveKids, saveSession, saveSettings, scheduleReview, loadReview, dueReview, reviewSnoozedUntil, snoozeReview, type ReviewItem,
  type Kid, type Session, type Settings, type StoryProgress,
} from "./store";

interface Family {
  ready: boolean;
  fatal: string | null;
  kids: Kid[];
  settings: Settings;
  customs: Story[];
  sessions: Record<string, Session>;   // per child
  session: Session | null;             // for the active child
  activeKid: Kid | null;
  progress: Record<string, StoryProgress>;
  review: ReviewItem[];                 // words due for a quick warm-up today (empty while snoozed)
  snoozeWarmUp: () => Promise<void>;     // "not tonight": clears the gate until tomorrow morning, records nothing
  reviewDone: (results: { word: string; ok: boolean; mode: string }[]) => Promise<void>;
  encodingDone: (slug: string, word: string, ok: boolean) => Promise<void>;
  advanceReady: boolean;
  nights: number;
  pendingBuild: string | null;   // a word whose build failed and has not succeeded since
  stories: Story[];                       // library + family stories
  storiesFor: (kid: Kid) => Story[];      // those the kid can do
  todayFor: (kid: Kid) => Story | null;   // a shaky story again, else next unfinished that fits, else least recently finished
  repeatToday: boolean;
  setActiveKid: (id: string) => void;
  updateKid: (kid: Kid) => void;
  addKid: (kid: Kid) => void;
  removeKid: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  setSession: (s: Session | null) => Promise<void>;
  toast: string | null;
  finish: (kidId: string, slug: string, results: Session["results"], opts?: { listenOnly?: boolean }) => Promise<void>;
  listensAlong: (kid: Kid) => boolean;
  addCustom: (s: Story) => Promise<boolean>;
  removeCustom: (slug: string) => void;
}

const Ctx = createContext<Family | null>(null);
export const useFamily = () => { const f = useContext(Ctx); if (!f) throw new Error("no family"); return f; };

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [kids, setKids] = useState<Kid[]>([]);
  const [settings, setSettingsState] = useState<Settings>({ bedtime: false, readers: [] });
  const [customs, setCustoms] = useState<Story[]>([]);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [progress, setProgress] = useState<Record<string, StoryProgress>>({});
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const progGen = useRef(0);
  const fail = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 6000); };
  const loadedOk = useRef(false);   // true only when the whole boot read succeeded

  useEffect(() => {
    void (async () => { try {
      let k = await loadKids();
      if (!k.length) { k = defaultKids(); await saveKids(k); }
      const s = await loadSettings();
      const active = s.activeKid ?? k[0].id;
      setProgress(await loadProgress(active));             // before ready, so Home never flashes "first story"
      setKids(k); setSettingsState({ ...s, activeKid: active });
      setCustoms(await loadCustomStories()); setSessions(await loadAllSessions(k));
      loadedOk.current = true;   // only now may the save effects write: a failed load must never persist defaults over the real family
    } catch (e) { setFatal(String((e as Error)?.message ?? e)); setKids(defaultKids()); } finally { setReady(true); }
    })();
  }, []);

  const activeKid = useMemo(() => kids.find((k) => k.id === settings.activeKid) ?? kids[0] ?? null, [kids, settings.activeKid]);
  useEffect(() => { if (!activeKid) return; const my = ++progGen.current; void loadProgress(activeKid.id).then((p) => { if (my === progGen.current) setProgress(p); }); void Promise.all([loadReview(activeKid.id), reviewSnoozedUntil(activeKid.id)]).then(([r, snoozed]) => { if (my === progGen.current) setReview(Date.now() < snoozed ? [] : dueReview(r)); }); void loadAttempts(activeKid.id).then((a) => { if (my === progGen.current) setAttempts(a); }); }, [activeKid]);

  const stories = useMemo(() => [...customs, ...LIBRARY], [customs]);
  const listensAlong = useCallback((kid: Kid) => kid.role === "reader" && kid.gpcs.length < 4, []);
  const storiesFor = useCallback((kid: Kid) => {
    if (kid.role === "listener") return stories;
    if (listensAlong(kid)) { const s = listenAlongStory(); return s ? [s] : []; }   // one real book, read to them
    return stories.filter((s) => fits(s, learnerOf(kid)));
  }, [stories, listensAlong]);
  /** The most recent finish had a helped or skipped word → read the same story again tomorrow, smoother. */
  const shaky = useMemo(() => { const last = Object.values(progress).sort((a, b) => (b.lastFinished ?? 0) - (a.lastFinished ?? 0))[0]; return last && designed(last.results).some((r) => !r.ok || r.mode === "modelled") ? last.slug : null; }, [progress]);
  const todayFor = useCallback((kid: Kid) => {
    const list = storiesFor(kid); if (!list.length) return null;
    if (listensAlong(kid)) return list[0];   // the same book each night until the fourth sound is taught
    if (shaky && kid.role !== "listener") { const s = list.find((x) => x.slug === shaky); if (s) return s; }
    // practise the newest sound: prefer the story whose magic words use it most; unfinished first, then least recent
    const newest = kid.gpcs[kid.gpcs.length - 1];
    const uses = (s: Story) => s.pages.flatMap((p) => p.magic ?? []).filter((m) => newest && m.includes(newest)).length;
    const byNewest = (a: Story, b: Story) => uses(b) - uses(a);
    const unfinished = list.filter((s) => !progress[s.slug]?.timesFinished).sort(byNewest);   // a listen-along night does not use up a book
    if (unfinished.length) return unfinished[0];
    return [...list].sort((a, b) => byNewest(a, b) || (progress[a.slug]?.lastFinished ?? 0) - (progress[b.slug]?.lastFinished ?? 0))[0];
  }, [storiesFor, progress, shaky, listensAlong]);

  // functional updates: two edits in one tick (welcome screen) must not clobber each other
  const mutateKids = (f: (prev: Kid[]) => Kid[]) => setKids(f);
  useEffect(() => { if (ready && loadedOk.current) void saveKids(kids).catch(() => fail("Couldn't save on this device.")); }, [kids, ready]);
  const updateSettings = useCallback((p: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...p })), []);
  useEffect(() => { if (ready && loadedOk.current) void saveSettings(settings).catch(() => fail("Couldn't save settings on this device.")); }, [settings, ready]);

  const session = activeKid ? sessions[activeKid.id] ?? null : null;
  const value: Family = {
    ready, fatal, kids, settings, customs, sessions, session, activeKid, progress, review, stories, storiesFor, todayFor, listensAlong, repeatToday: !!shaky && activeKid?.role !== "listener",
    encodingDone: async (slug, word, ok) => { if (!activeKid) return; await recordEncoding(activeKid.id, slug, word, ok); if (!ok) { await scheduleReview(activeKid.id, [{ word, ok: false, mode: "skipped" }]); setReview(dueReview(await loadReview(activeKid.id))); } setProgress(await loadProgress(activeKid.id)); },
    advanceReady: !!activeKid && readyToAdvance(attempts, activeKid.gpcs.length, progress, review.length),
    // distinct days the family did something, counting today as one whether or not it is already in the set:
    // the card used to read "night 1" before the story and "night 2" after it, on the same evening
    nights: (() => { const days = new Set([...Object.values(progress).flatMap((p) => p.history ?? []).map((t) => new Date(t).toDateString()), ...(activeKid?.teachDays ?? []).map((d) => new Date(d).toDateString())]); const today = new Date().toDateString(); return days.size + (days.has(today) ? 0 : 1); })(),
    pendingBuild: (() => { const enc = Object.values(progress).flatMap((p) => p.encoding ?? []).sort((a, b) => a.at - b.at); const failed = enc.filter((e) => !e.ok).map((e) => e.word); return failed.find((w) => !enc.some((e) => e.word === w && e.ok && e.at > (enc.find((f) => f.word === w && !f.ok)?.at ?? 0))) ?? null; })(),
    reviewDone: async (results) => { if (!activeKid) return; await scheduleReview(activeKid.id, results); setReview(dueReview(await loadReview(activeKid.id))); },
    snoozeWarmUp: async () => { if (!activeKid) return; try { await snoozeReview(activeKid.id); } catch { /* a snooze that cannot be saved still clears tonight */ } setReview([]); },
    setActiveKid: (id) => updateSettings({ activeKid: id }),
    updateKid: (kid) => mutateKids((prev) => prev.map((k) => (k.id === kid.id ? kid : k))),
    addKid: (kid) => mutateKids((prev) => [...prev, kid]),
    removeKid: (id) => { mutateKids((prev) => prev.filter((k) => k.id !== id)); void saveSession(id, null); if (settings.activeKid === id) updateSettings({ activeKid: kids.find((k) => k.id !== id)?.id }); },
    updateSettings,
    toast,
    setSession: async (s) => { if (!activeKid) return; setSessions((all) => { const n = { ...all }; if (s) n[activeKid.id] = s; else delete n[activeKid.id]; return n; }); try { await saveSession(activeKid.id, s); } catch { fail("Couldn't save your place on this device."); } },
    finish: async (kidId, slug, results, opts = {}) => { try { await recordFinish(kidId, slug, results, opts); if (opts.listenOnly) { await saveSession(kidId, null); setSessions((all) => { const n = { ...all }; delete n[kidId]; return n; }); setProgress(await loadProgress(kidId)); return; } const real = designed(results); await scheduleReview(kidId, real); const kid = kids.find((k) => k.id === kidId); await recordAttempt(kidId, { at: Date.now(), slug, gpcCount: kid?.gpcs.length ?? 0, firstTryRate: real.length ? real.filter((r) => r.ok && r.mode === "first_try").length / real.length : 0, words: real.length, firstTry: real.filter((r) => r.ok && r.mode === "first_try").length }); setAttempts(await loadAttempts(kidId)); setProgress(await loadProgress(kidId)); setReview(dueReview(await loadReview(kidId))); await saveSession(kidId, null); } catch { fail("Couldn't save progress on this device."); } setSessions((all) => { const n = { ...all }; delete n[kidId]; return n; }); },
    addCustom: async (s) => { const n = [s, ...customs.filter((c) => c.slug !== s.slug)]; try { await saveCustomStories(n); setCustoms(n); return true; } catch { fail("Not saved — this device is out of space. Remove a photo and try again."); return false; } },
    removeCustom: (slug) => { const n = customs.filter((c) => c.slug !== slug); setCustoms(n); void saveCustomStories(n); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
