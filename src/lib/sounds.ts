/**
 * One resolver for every phoneme clip: the family's own recording (IndexedDB blob + trim
 * offsets) wins over the cut Commons fallback in public/sounds/. Used by tiles, the blend,
 * Teach, Warm-up and the build panel, so a re-record changes every place at once.
 */
import { get, set, del, keys } from "idb-keyval";
import { AUDIO_V, BASE } from "./library";
import { playClip } from "./audio/player";

export interface FamilySound { blob: Blob; startMs: number; endMs: number; ms: number; at: number }
export interface SoundSrc { url: string; startMs?: number; endMs?: number; family: boolean }

const key = (clip: string) => `st:sound:${clip}`;
const cache = new Map<string, FamilySound | null>();
const urls = new Map<string, string>();
const versions = new Map<string, number>();
const listeners = new Set<() => void>();

export const fallbackUrl = (clip: string) => `${BASE}/sounds/${clip}.wav?v=${AUDIO_V}`;
export function soundVersion(clip: string): number { return versions.get(clip) ?? 0; }
export function onSoundsChanged(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }

export async function loadFamilySound(clip: string): Promise<FamilySound | null> {
  if (cache.has(clip)) return cache.get(clip)!;
  let v: FamilySound | null = null; try { v = (await get(key(clip))) ?? null; } catch { v = null; }
  cache.set(clip, v); return v;
}
export async function saveFamilySound(clip: string, s: FamilySound): Promise<void> {
  await set(key(clip), s); cache.set(clip, s); const old = urls.get(clip); if (old) { URL.revokeObjectURL(old); urls.delete(clip); }
  versions.set(clip, (versions.get(clip) ?? 0) + 1); listeners.forEach((f) => f());
}
export async function removeFamilySound(clip: string): Promise<void> {
  await del(key(clip)); cache.set(clip, null); const old = urls.get(clip); if (old) { URL.revokeObjectURL(old); urls.delete(clip); }
  versions.set(clip, (versions.get(clip) ?? 0) + 1); listeners.forEach((f) => f());
}
export async function familySoundClips(): Promise<string[]> { try { return (await keys()).map(String).filter((k) => k.startsWith("st:sound:")).map((k) => k.slice(9)); } catch { return []; } }

/** Where a clip plays from right now. Family recordings are handed out as object URLs (iOS plays data: URLs badly). */
export async function soundSource(clip: string): Promise<SoundSrc> {
  const fam = await loadFamilySound(clip);
  if (!fam) return { url: fallbackUrl(clip), family: false };
  let u = urls.get(clip); if (!u) { u = URL.createObjectURL(fam.blob); urls.set(clip, u); }
  return { url: u, startMs: fam.startMs, endMs: fam.endMs, family: true };
}

/** Play one sound through the singleton clip player (family recording or fallback). Never throws. */
export async function playSound(clip: string): Promise<void> {
  try { const s = await soundSource(clip); await playClip(s.url, s.family ? { startMs: s.startMs, endMs: s.endMs } : undefined).done; } catch { /* clip missing: the tile still shows the letter */ }
}
