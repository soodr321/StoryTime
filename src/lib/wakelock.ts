/**
 * Keep the screen awake during a story. The narration loop already uses setInterval rather than
 * rAF *because the phone dims* — but a dimmed phone at bedtime still ends the karaoke for the
 * child watching it. Best effort: not every engine has this, and a refusal is not an error.
 */
type Sentinel = { release: () => Promise<void>; released: boolean };

export function keepAwake(): () => void {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
  if (!nav.wakeLock) return () => {};
  let lock: Sentinel | null = null;
  let live = true;
  const acquire = async () => { try { if (live && !document.hidden) lock = await nav.wakeLock!.request("screen"); } catch { /* denied, low battery, or not allowed here */ } };
  const onVisible = () => { if (!document.hidden && (!lock || lock.released)) void acquire(); };   // iOS drops the lock whenever the tab hides
  void acquire();
  document.addEventListener("visibilitychange", onVisible);
  return () => { live = false; document.removeEventListener("visibilitychange", onVisible); void lock?.release().catch(() => {}); lock = null; };
}
