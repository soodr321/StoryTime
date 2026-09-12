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
  /** ISO dates on which a sound was taught (counts as a night; one new sound per day for the first four) */
  teachDays?: string[];
}

export interface WordResult { id?: string; word: string; ok: boolean; mode: string; at: number; extra?: boolean }
export interface StoryProgress {
  slug: string;
  timesFinished: number;
  lastFinished?: number;
  history?: number[];       // every completion, for the week strip
  results: WordResult[];    // most recent run
  encoding?: { word: string; ok: boolean; at: number }[];   // dictation evidence, separate from reading
}
export interface Session {
  kidId: string;
  slug: string;
  mode: "listen" | "read";
  page: number;
  results: { id?: string; word: string; ok: boolean; mode: string; extra?: boolean }[];   // same shape as WordResult: a resume must not lose ids or the extra flag
  updatedAt: number;
}
export interface Settings {
  bedtime: boolean;         // dim, slow, no celebration
  readers: string[];        // grown-ups who read: names shown in the adult script
  tonight?: string;         // which grown-up is reading tonight
  onboarded?: boolean;
  activeKid?: string;
  voiceFollow?: boolean;   // experimental: "I read" follows the grown-up's voice (audio goes to Apple/Google while on)
  pace?: "slower" | "normal";   // how fast the story is read aloud and how long each sound is held
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
export async function recordFinish(kidId: string, slug: string, results: { word: string; ok: boolean; mode: string }[], opts: { listenOnly?: boolean } = {}): Promise<void> {
  const all = await loadProgress(kidId);
  const prev = all[slug];
  const history = [...(prev?.history ?? (prev?.lastFinished ? [prev.lastFinished] : [])), Date.now()].slice(-60);
  // a listen-along night (the child has fewer than four sounds) counts for the ritual — week strip, night count —
  // but it is not a reading of the book: timesFinished stays put so the first decoding night still gets this story
  all[slug] = opts.listenOnly
    ? { ...prev, slug, timesFinished: prev?.timesFinished ?? 0, lastFinished: Date.now(), history, results: prev?.results ?? [] }
    : { ...prev, slug, timesFinished: (prev?.timesFinished ?? 0) + 1, lastFinished: Date.now(), history, results: results.map((r) => ({ ...r, at: Date.now() })) };
  await set(progressKey(kidId), all);
}

export async function recordEncoding(kidId: string, slug: string, word: string, ok: boolean): Promise<void> {
  const all = await loadProgress(kidId);
  // the build runs before the story is finished, so on a first read there is no row yet: create one, or the
  // evidence is dropped and readyToAdvance (which needs one successful build) can never become true
  const p = (all[slug] ??= { slug, timesFinished: 0, results: [] });
  p.encoding = [...(p.encoding ?? []), { word, ok, at: Date.now() }].slice(-30);
  await set(progressKey(kidId), all);
}

/** One finished reading session (the same story twice counts twice), stamped with how many sounds the child knew. */
export interface Attempt { at: number; slug: string; gpcCount: number; firstTryRate: number; words: number; firstTry?: number }
const attemptsKey = (kidId: string) => `st:attempts:${kidId}`;
export async function loadAttempts(kidId: string): Promise<Attempt[]> { return (await get(attemptsKey(kidId))) ?? []; }
export async function recordAttempt(kidId: string, a: Attempt): Promise<void> { const all = await loadAttempts(kidId); await set(attemptsKey(kidId), [...all, a].slice(-200)); }

/** Recommend (never perform) the next sound: two sessions since the last sound was taught, each ≥80% first-try, nothing due, one successful build this week. */
export function readyToAdvance(attempts: Attempt[], gpcCount: number, progress: Record<string, StoryProgress>, due: number, now = Date.now()): boolean {
  const sinceTeach = attempts.filter((a) => a.gpcCount === gpcCount && a.words > 0);
  if (sinceTeach.length < 2 || due > 0) return false;
  // a rolling pool of the last ~10 magic-word attempts, not one tiny story: one nudge on a two-word book must not freeze progress
  let words = 0, ok = 0;
  for (const a of [...sinceTeach].reverse()) { if (words >= 10) break; const take = Math.min(a.words, 10 - words); ok += (a.firstTry ?? Math.round(a.firstTryRate * a.words)) * (take / a.words); words += take; }
  const allOk = words >= 4 && ok / words >= 0.8;
  const built = Object.values(progress).some((p) => (p.encoding ?? []).some((e) => e.ok && now - e.at < 7 * DAY));
  return allOk && built;
}

export async function loadSession(kidId: string): Promise<Session | null> { return (await get<Session>(sessionKey(kidId))) ?? null; }
export async function saveSession(kidId: string, s: Session | null): Promise<void> { if (s) await set(sessionKey(kidId), s); else await del(sessionKey(kidId)); }
export async function loadAllSessions(kids: { id: string }[]): Promise<Record<string, Session>> { const out: Record<string, Session> = {}; for (const k of kids) { const s = await loadSession(k.id); if (s) out[k.id] = s; } return out; }

export async function loadCustomStories(): Promise<Story[]> { return (await get<Story[]>(K.customs)) ?? []; }
export async function saveCustomStories(list: Story[]): Promise<void> { await set(K.customs, list); }

export function learnerOf(kid: Kid): LearnerModel { return { gpcs: kid.gpcs, tricky: kid.tricky }; }

/** Spaced retrieval: a word missed or modelled comes back tomorrow; a word read well comes back at widening intervals. */
export interface ReviewItem { word: string; due: number; interval: number; last: "ok" | "help" | "skip"; misses?: number; retired?: boolean }
const snoozeKey = (kidId: string) => `st:snooze:${kidId}`;
/** "Not tonight": the warm-up is the only door to the story, so a tired family must be able to skip it once. */
export async function snoozeReview(kidId: string, until = nextMorning()): Promise<void> { await set(snoozeKey(kidId), until); }
export async function reviewSnoozedUntil(kidId: string): Promise<number> { return (await get<number>(snoozeKey(kidId))) ?? 0; }
const reviewKey = (kidId: string) => `st:review:${kidId}`;
const DAY = 86_400_000;
/** "Tomorrow" means the next morning, not 24 hours later: a word missed at 7 pm is due at 5 am. */
export function nextMorning(from = Date.now()): number { const d = new Date(from); d.setDate(d.getDate() + 1); d.setHours(5, 0, 0, 0); return d.getTime(); }
export async function loadReview(kidId: string): Promise<Record<string, ReviewItem>> { return (await get(reviewKey(kidId))) ?? {}; }
export async function scheduleReview(kidId: string, results: { word: string; ok: boolean; mode: string }[]): Promise<void> {
  const all = await loadReview(kidId); const now = Date.now();
  for (const r of results) {
    const prev = all[r.word];
    if (!r.ok || r.mode === "modelled" || r.mode === "prompted") {
      // only a first-try blend counts as known. After three returns with no progress the word steps out of the
      // nightly queue — it is not ready yet, and one hard word must not block the story every night for a month.
      const misses = (prev?.misses ?? 0) + 1;
      all[r.word] = { word: r.word, due: nextMorning(now), interval: 1, last: r.ok ? "help" : "skip", misses, retired: misses >= 3 };
    } else { const interval = Math.min(14, (prev?.interval ?? 1) * 3); all[r.word] = { word: r.word, due: now + interval * DAY, interval, last: "ok", misses: 0, retired: false }; }
  }
  await set(reviewKey(kidId), all);
}
export function dueReview(all: Record<string, ReviewItem>, now = Date.now()): ReviewItem[] {
  const due = Object.values(all).filter((r) => r.due <= now && !r.retired);
  const weak = due.filter((r) => r.last !== "ok").slice(0, 3);
  const secure = due.filter((r) => r.last === "ok").slice(0, 1);
  return [...weak, ...secure];
}

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
