/** Family context: kids, settings, custom stories, session — loaded once, saved on change. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Story } from "./content/types";
import { LIBRARY, fits } from "./library";
import {
  defaultKids, learnerOf, loadAllSessions, loadCustomStories, loadKids, loadProgress, loadSettings,
  recordFinish, saveCustomStories, saveKids, saveSession, saveSettings,
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
  stories: Story[];                       // library + family stories
  storiesFor: (kid: Kid) => Story[];      // those the kid can do
  todayFor: (kid: Kid) => Story | null;   // next unfinished that fits, else least recently finished
  setActiveKid: (id: string) => void;
  updateKid: (kid: Kid) => void;
  addKid: (kid: Kid) => void;
  removeKid: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  setSession: (s: Session | null) => Promise<void>;
  toast: string | null;
  finish: (kidId: string, slug: string, results: Session["results"]) => Promise<void>;
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
  const [toast, setToast] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const progGen = useRef(0);
  const fail = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 6000); };

  useEffect(() => {
    void (async () => { try {
      let k = await loadKids();
      if (!k.length) { k = defaultKids(); await saveKids(k); }
      const s = await loadSettings();
      const active = s.activeKid ?? k[0].id;
      setProgress(await loadProgress(active));             // before ready, so Home never flashes "first story"
      setKids(k); setSettingsState({ ...s, activeKid: active });
      setCustoms(await loadCustomStories()); setSessions(await loadAllSessions(k));
    } catch (e) { setFatal(String((e as Error)?.message ?? e)); if (!kids.length) setKids(defaultKids()); } finally { setReady(true); }
    })();
  }, []);

  const activeKid = useMemo(() => kids.find((k) => k.id === settings.activeKid) ?? kids[0] ?? null, [kids, settings.activeKid]);
  useEffect(() => { if (!activeKid) return; const my = ++progGen.current; void loadProgress(activeKid.id).then((p) => { if (my === progGen.current) setProgress(p); }); }, [activeKid]);

  const stories = useMemo(() => [...customs, ...LIBRARY], [customs]);
  const storiesFor = useCallback((kid: Kid) => (kid.role === "listener" ? stories : stories.filter((s) => fits(s, learnerOf(kid)))), [stories]);
  const todayFor = useCallback((kid: Kid) => {
    const list = storiesFor(kid); if (!list.length) return null;
    const unfinished = list.filter((s) => !progress[s.slug]);
    if (unfinished.length) return unfinished[0];
    return [...list].sort((a, b) => (progress[a.slug]?.lastFinished ?? 0) - (progress[b.slug]?.lastFinished ?? 0))[0];
  }, [storiesFor, progress]);

  // functional updates: two edits in one tick (welcome screen) must not clobber each other
  const mutateKids = (f: (prev: Kid[]) => Kid[]) => setKids(f);
  useEffect(() => { if (ready) void saveKids(kids).catch(() => fail("Couldn't save on this device.")); }, [kids, ready]);
  const updateSettings = useCallback((p: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...p })), []);
  useEffect(() => { if (ready) void saveSettings(settings).catch(() => fail("Couldn't save settings on this device.")); }, [settings, ready]);

  const session = activeKid ? sessions[activeKid.id] ?? null : null;
  const value: Family = {
    ready, fatal, kids, settings, customs, sessions, session, activeKid, progress, stories, storiesFor, todayFor,
    setActiveKid: (id) => updateSettings({ activeKid: id }),
    updateKid: (kid) => mutateKids((prev) => prev.map((k) => (k.id === kid.id ? kid : k))),
    addKid: (kid) => mutateKids((prev) => [...prev, kid]),
    removeKid: (id) => { mutateKids((prev) => prev.filter((k) => k.id !== id)); void saveSession(id, null); if (settings.activeKid === id) updateSettings({ activeKid: kids.find((k) => k.id !== id)?.id }); },
    updateSettings,
    toast,
    setSession: async (s) => { if (!activeKid) return; setSessions((all) => { const n = { ...all }; if (s) n[activeKid.id] = s; else delete n[activeKid.id]; return n; }); try { await saveSession(activeKid.id, s); } catch { fail("Couldn't save your place on this device."); } },
    finish: async (kidId, slug, results) => { try { await recordFinish(kidId, slug, results); setProgress(await loadProgress(kidId)); await saveSession(kidId, null); } catch { fail("Couldn't save progress on this device."); } setSessions((all) => { const n = { ...all }; delete n[kidId]; return n; }); },
    addCustom: async (s) => { const n = [s, ...customs.filter((c) => c.slug !== s.slug)]; try { await saveCustomStories(n); setCustoms(n); return true; } catch { fail("Not saved — this device is out of space. Remove a photo and try again."); return false; } },
    removeCustom: (slug) => { const n = customs.filter((c) => c.slug !== slug); setCustoms(n); void saveCustomStories(n); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
