/** Family context: kids, settings, custom stories, session — loaded once, saved on change. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Story } from "./content/types";
import { LIBRARY, fits } from "./library";
import {
  defaultKids, learnerOf, loadAllSessions, loadCustomStories, loadKids, loadProgress, loadSettings,
  recordFinish, saveCustomStories, saveKids, saveSession, saveSettings,
  type Kid, type Session, type Settings, type StoryProgress,
} from "./store";

interface Family {
  ready: boolean;
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
  setSession: (s: Session | null) => void;
  finish: (kidId: string, slug: string, results: Session["results"]) => Promise<void>;
  addCustom: (s: Story) => void;
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

  useEffect(() => {
    void (async () => {
      let k = await loadKids();
      if (!k.length) { k = defaultKids(); await saveKids(k); }
      const s = await loadSettings();
      setKids(k); setSettingsState({ ...s, activeKid: s.activeKid ?? k[0].id });
      setCustoms(await loadCustomStories()); setSessions(await loadAllSessions(k));
      setReady(true);
    })();
  }, []);

  const activeKid = useMemo(() => kids.find((k) => k.id === settings.activeKid) ?? kids[0] ?? null, [kids, settings.activeKid]);
  useEffect(() => { if (activeKid) void loadProgress(activeKid.id).then(setProgress); }, [activeKid]);

  const stories = useMemo(() => [...customs, ...LIBRARY], [customs]);
  const storiesFor = useCallback((kid: Kid) => (kid.role === "listener" ? stories : stories.filter((s) => fits(s, learnerOf(kid)))), [stories]);
  const todayFor = useCallback((kid: Kid) => {
    const list = storiesFor(kid); if (!list.length) return null;
    const unfinished = list.filter((s) => !progress[s.slug]);
    if (unfinished.length) return unfinished[0];
    return [...list].sort((a, b) => (progress[a.slug]?.lastFinished ?? 0) - (progress[b.slug]?.lastFinished ?? 0))[0];
  }, [storiesFor, progress]);

  const persistKids = (next: Kid[]) => { setKids(next); void saveKids(next); };
  const updateSettings = useCallback((p: Partial<Settings>) => { setSettingsState((s) => { const n = { ...s, ...p }; void saveSettings(n); return n; }); }, []);

  const session = activeKid ? sessions[activeKid.id] ?? null : null;
  const value: Family = {
    ready, kids, settings, customs, sessions, session, activeKid, progress, stories, storiesFor, todayFor,
    setActiveKid: (id) => updateSettings({ activeKid: id }),
    updateKid: (kid) => persistKids(kids.map((k) => (k.id === kid.id ? kid : k))),
    addKid: (kid) => persistKids([...kids, kid]),
    removeKid: (id) => { persistKids(kids.filter((k) => k.id !== id)); void saveSession(id, null); if (settings.activeKid === id) updateSettings({ activeKid: kids.find((k) => k.id !== id)?.id }); },
    updateSettings,
    setSession: (s) => { if (!activeKid) return; setSessions((all) => { const n = { ...all }; if (s) n[activeKid.id] = s; else delete n[activeKid.id]; return n; }); void saveSession(activeKid.id, s); },
    finish: async (kidId, slug, results) => { await recordFinish(kidId, slug, results); setProgress(await loadProgress(kidId)); setSessions((all) => { const n = { ...all }; delete n[kidId]; return n; }); await saveSession(kidId, null); },
    addCustom: (s) => { const n = [s, ...customs.filter((c) => c.slug !== s.slug)]; setCustoms(n); void saveCustomStories(n); },
    removeCustom: (slug) => { const n = customs.filter((c) => c.slug !== slug); setCustoms(n); void saveCustomStories(n); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
