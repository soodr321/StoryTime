import { openApp, see, hear, onboard, finish } from "./lib.mjs";
const { b, p, errors } = await openApp();
console.log("AUDIT STEP 2 — a normal night in 'Nani reads', step by step");
await onboard(p, { level: "+ ck e u r", sibling: "Veda", grown: "Papa" });
await see(p, "2-01 home");
await hear(p, "2-01-open-story", async () => { await p.click(".modes button.mode:first-child"); await p.waitForTimeout(4000); });
await see(p, "2-02 page one while it reads");
// walk to the first magic word
for (let i = 0; i < 8 && !(await p.$(".panel")); i++) await p.waitForTimeout(1200);
await see(p, "2-03 the word card as it opens");
await hear(p, "2-03-tap-each-letter", async () => { for (const t of await p.$$(".tile")) { await t.click(); await p.waitForTimeout(1200); } });
await see(p, "2-04 the card after the child taps the letters");
await p.click("text=Needs help"); await p.waitForTimeout(400);
await see(p, "2-05 after 'needs help' — the one nudge");
await hear(p, "2-05-show-me-model", async () => { await p.click("text=Show me: slide through it"); await p.waitForTimeout(6000); });
await see(p, "2-06 after the model");
await hear(p, "2-06-verdict", async () => { await p.click("text=Slid through it after the model"); await p.waitForTimeout(4000); });
await see(p, "2-07 the page reread after the word");
// carry on to the read-back
for (let s = 0; s < 26; s++) {
  await p.waitForTimeout(800);
  if (await p.$(".line")) break;
  if (await p.$(".panel .yes")) { await p.click(".panel .yes").catch(() => {}); continue; }
  const n = await p.$(".readbar .next"); if (n && !(await n.isDisabled())) await n.click();
}
await see(p, "2-08 read-back, the child's line");
await hear(p, "2-08-help-a-word", async () => { await p.click("text=Needs help on a word"); await p.waitForTimeout(400); await p.click(".line .lw"); await p.waitForTimeout(5000); });
await see(p, "2-09 after the word model in the read-back");
await p.click("text=They blended it").catch(() => {}); await p.waitForTimeout(500);
await p.click("text=Read it smoothly").catch(() => {}); await p.waitForTimeout(1500);
await see(p, "2-10 build a word");
await hear(p, "2-10-say-the-word", async () => { await p.click("text=say the word"); await p.waitForTimeout(2500); });
await p.click("text=they held up").catch(() => {}); await p.waitForTimeout(400);
await see(p, "2-11 build boxes and tiles");
await hear(p, "2-11-try-together", async () => { await p.click("text=Try together"); await p.waitForTimeout(6000); });
await see(p, "2-12 after the dictation model");
await p.click("text=Not tonight").catch(() => {}); await p.waitForTimeout(1500);
await see(p, "2-13 done");
await finish(b, errors);
