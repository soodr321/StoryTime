import { openApp, see, hear, onboard, finish } from "./lib.mjs";
const { b, p, errors } = await openApp();
console.log("AUDIT STEP 6 — warm-up, bookshelf, bedtime, resume");
await onboard(p, { level: "+ ck e u r", grown: "Papa" });
// finish one story quickly with a miss, so words are due tomorrow
await p.click(".modes button.mode:nth-child(2)"); await p.waitForTimeout(1200);
for (let s = 0; s < 30 && !(await p.$(".done")); s++) {
  await p.waitForTimeout(500);
  if (await p.$(".panel")) { const skip = await p.$("text=Needs help"); if (skip) { await skip.click(); await p.waitForTimeout(300); await p.click("text=skip for today").catch(() => {}); } else await p.click(".panel .yes").catch(() => {}); await p.waitForTimeout(700); continue; }
  if (await p.$("text=Read it smoothly")) { await p.click("text=Read it smoothly"); await p.waitForTimeout(600); continue; }
  if (await p.$("text=Not tonight")) { await p.click("text=Not tonight"); await p.waitForTimeout(800); continue; }
  const n = await p.$(".readbar .next"); if (n && !(await n.isDisabled())) await n.click();
}
await p.click("text=Done").catch(() => {}); await p.waitForTimeout(1200);
await see(p, "6-01 home after a night with a missed word");
// make the review due: shift the clock a day
await p.evaluate(() => { const D = Date; const shift = 26 * 3600e3; window.Date = class extends D { constructor(...a) { if (!a.length) super(D.now() + shift); else super(...a); } static now() { return D.now() + shift; } }; });
await p.reload(); await p.waitForTimeout(1500);
await see(p, "6-02 the next evening: words are due");
const shelf = await p.$("text=Bookshelf"); if (shelf) { await shelf.click(); await p.waitForTimeout(900); await see(p, "6-03 bookshelf while words are due");
  const bk = await p.$(".books .bk:not(.locked)"); if (bk) { await bk.click(); await p.waitForTimeout(1200); await see(p, "6-04 tapping a book sends you to the warm-up"); } }
await hear(p, "6-04-warmup-model", async () => { const t = await p.$("text=Show me: slide through it") || await p.$("text=Needs help"); if (t) { await t.click(); await p.waitForTimeout(400); const s2 = await p.$("text=Show me: slide through it"); if (s2) { await s2.click(); await p.waitForTimeout(4000); } } });
await see(p, "6-05 the warm-up card after the model");
const skipall = await p.$("text=not tonight"); if (skipall) { await skipall.click(); await p.waitForTimeout(1500); await see(p, "6-06 after 'not tonight'"); }
await finish(b, errors);
