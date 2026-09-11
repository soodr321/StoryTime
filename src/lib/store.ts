/**
 * Local-first family store (IndexedDB via idb-keyval). One device, one family.
 * Everything a reload must survive lives here: kids, their levels, progress,
 * the in-flight session (resume on the exact page/word), custom stories, settings.
 */
import { get, set, del } from "idb-keyval";
import type { LearnerModel } from "./phonics/validator";
import { LEVELS, LS_PHASE2_ORDER, TRICKY_PHASE2 } from "./phonics/learner";
import type { Story } from "./content/types";

export interface Kid {
  id: string;
  name: string;
  avatar: string;           // emoji
  /** ordered taught GPCs — a prefix of LS_PHASE2_ORDER plus nothing else in v1 */
  gpcs: string[];
  /** taught tricky words — subset of the locked TRICKY_PHASE2 set */
  tricky: string[];
  /** "reader" does magic words; "listener" (younger sibling) only listens and taps */
  role: "reader" | "listener";
  createdAt: number;
}

export interface WordResult { word: string; ok: boolean; mode: string; at: number }
export interface StoryProgress {
  slug: string;
  timesFinished: number;
  lastFinished?: number;
  history?: number[];       // every completion, for the week strip
  results: WordResult[];    // most recent run
}
export interface Session {
  kidId: string;
  slug: string;
  mode: "listen" | "read";
  page: number;
  results: { word: string; ok: boolean; mode: string }[];
  updatedAt: number;
}
export interface Settings {
  bedtime: boolean;         // dim, slow, no celebration
  readers: string[];        // grown-ups who read: names shown in the adult script
  tonight?: string;         // which grown-up is reading tonight
  onboarded?: boolean;
  activeKid?: string;
}

const K = { kids: "st:kids", settings: "st:settings", customs: "st:custom-stories" };
const sessionKey = (kidId: string) => `st:session:${kidId}`;
const progressKey = (kidId: string) => `st:progress:${kidId}`;

export const uid = () => Math.random().toString(36).slice(2, 10);

export async function loadKids(): Promise<Kid[]> { return (await get<Kid[]>(K.kids)) ?? []; }
export async function saveKids(kids: Kid[]): Promise<void> { await set(K.kids, kids); }
export async function loadSettings(): Promise<Settings> { return (await get<Settings>(K.settings)) ?? { bedtime: false, readers: [] }; }
export async function saveSettings(s: Settings): Promise<void> { await set(K.settings, s); }

export async function loadProgress(kidId: string): Promise<Record<string, StoryProgress>> { return (await get(progressKey(kidId))) ?? {}; }
export async function recordFinish(kidId: string, slug: string, results: { word: string; ok: boolean; mode: string }[]): Promise<void> {
  const all = await loadProgress(kidId);
  const prev = all[slug];
  all[slug] = { slug, timesFinished: (prev?.timesFinished ?? 0) + 1, lastFinished: Date.now(), history: [...(prev?.history ?? (prev?.lastFinished ? [prev.lastFinished] : [])), Date.now()].slice(-60), results: results.map((r) => ({ ...r, at: Date.now() })) };
  await set(progressKey(kidId), all);
}

export async function loadSession(kidId: string): Promise<Session | null> { return (await get<Session>(sessionKey(kidId))) ?? null; }
export async function saveSession(kidId: string, s: Session | null): Promise<void> { if (s) await set(sessionKey(kidId), s); else await del(sessionKey(kidId)); }
export async function loadAllSessions(kids: { id: string }[]): Promise<Record<string, Session>> { const out: Record<string, Session> = {}; for (const k of kids) { const s = await loadSession(k.id); if (s) out[k.id] = s; } return out; }

export async function loadCustomStories(): Promise<Story[]> { return (await get<Story[]>(K.customs)) ?? []; }
export async function saveCustomStories(list: Story[]): Promise<void> { await set(K.customs, list); }

export function learnerOf(kid: Kid): LearnerModel { return { gpcs: kid.gpcs, tricky: kid.tricky }; }

/** Default kids on first launch: neutral names, parent renames in Settings. */
export function defaultKids(): Kid[] {
  const now = Date.now();
  return [
    { id: uid(), name: "Reader", avatar: "🦁", gpcs: [...LEVELS["ls-phase2-set4"].gpcs], tricky: [...LEVELS["ls-phase2-set4"].tricky], role: "reader", createdAt: now },
    { id: uid(), name: "Little one", avatar: "🐣", gpcs: LS_PHASE2_ORDER.slice(0, 4) as unknown as string[], tricky: [], role: "listener", createdAt: now + 1 },
  ];
}

export const ALL_GPCS = [...LS_PHASE2_ORDER] as string[];
export const ALL_TRICKY = [...TRICKY_PHASE2] as string[];
