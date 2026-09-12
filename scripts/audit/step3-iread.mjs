import { openApp, see, hear, onboard, finish } from "./lib.mjs";
const { b, p, errors } = await openApp();
console.log("AUDIT STEP 3 — 'I read', step by step");
await onboard(p, { level: "+ ck e u r", grown: "Papa" });
await p.click(".modes button.mode:nth-child(2)"); await p.waitForTimeout(1500);
await see(p, "3-01 I read, page one");
const next = async () => { const n = await p.$(".readbar .next"); if (n && !(await n.isDisabled())) { await n.click(); await p.waitForTimeout(900); return true; } return false; };
await next();
await see(p, "3-02 a page with the pink word");
await p.click(".w.magic.tap"); await p.waitForTimeout(600);
await see(p, "3-03 the card in I read");
await hear(p, "3-03-show-me-silent", async () => { await p.click("text=Needs help"); await p.waitForTimeout(300); await p.click("text=Show me: slide through it"); await p.waitForTimeout(4000); });
await see(p, "3-04 the silent model in I read");
await p.click("text=Slid through it after the model").catch(() => {}); await p.waitForTimeout(800);
const t = await p.$(".w.try"); if (t) { await t.click(); await p.waitForTimeout(600); await see(p, "3-05 the extra word card"); await p.click("text=They read it").catch(() => {}); await p.waitForTimeout(600); }
for (let s = 0; s < 24 && !(await p.$(".line")); s++) { if (await p.$(".panel .yes")) { await p.click(".panel .yes").catch(() => {}); await p.waitForTimeout(600); continue; } if (!(await next())) await p.waitForTimeout(500); }
await see(p, "3-06 read-back in I read");
await p.click("text=Read it smoothly").catch(() => {}); await p.waitForTimeout(1200);
await see(p, "3-07 build a word in I read");
await p.click("text=Not tonight").catch(() => {}); await p.waitForTimeout(1500);
await see(p, "3-08 done in I read");
await finish(b, errors);
