/**
 * Continuous blending model ("say it together").
 * Not chopping: the sounds run into each other with no gap, continuants are held,
 * then the whole word is said, then the child is asked to say the sounds and blend.
 * Real IPA recordings only; the clip player is a singleton so nothing stacks.
 */
import { playClip, type Playing } from "./audio/player";
import { GRAPHEME_SOUND } from "./phonics/learner";
import { soundAsset } from "./library";

/** Sounds a mouth can hold: play these longer and let the next one start just before they end. */
export const CONTINUANTS = new Set(["s", "ss", "f", "ff", "m", "n", "l", "ll", "r", "a", "e", "i", "o", "u", "h"]);

export interface BlendOpts { rate?: number; alive?: () => boolean }

/** Play the graphemes as one continuous stretch. Resolves when the last sound ends. */
export async function playBlend(graphemes: string[], opts: BlendOpts = {}): Promise<void> {
  const alive = opts.alive ?? (() => true);
  for (let i = 0; i < graphemes.length; i++) {
    if (!alive()) return;
    const g = graphemes[i];
    let p: Playing;
    try { p = playClip(soundAsset(GRAPHEME_SOUND[g].clip)); } catch { continue; }
    const hold = CONTINUANTS.has(g) ? 1.0 : 0.6;   // stretch continuants, keep stops short
    // wait for most of the clip, then start the next sound so they run together instead of chopping
    // interval, not requestAnimationFrame: rAF stops when the tab is hidden and would freeze the routine
    await new Promise<void>((res) => {
      const t0 = Date.now();
      const id = setInterval(() => {
        const el = p.el; const dur = (isFinite(el.duration) && el.duration > 0 ? el.duration : 0.6) * 1000;
        const target = Math.min(dur, dur * hold) - (i < graphemes.length - 1 ? 60 : 0);
        if (el.currentTime * 1000 >= target || el.ended || Date.now() - t0 > dur + 800) { clearInterval(id); res(); }
      }, 30);
    });
  }
}

/** Grapheme list shown with dots for the caption, e.g. "c·u·t". */
export const dotted = (graphemes: string[]) => graphemes.map((g) => GRAPHEME_SOUND[g]?.label ?? g).join("·");
