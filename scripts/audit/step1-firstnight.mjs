import { openApp, see, hear, onboard, finish, OUT } from "./lib.mjs";
const { b, p, errors } = await openApp();
console.log("AUDIT STEP 1 — the first night, as the family sees and hears it\nscreens and audio →", OUT);
await see(p, "1-01 welcome");
await hear(p, "1-01-welcome-level-taps", async () => { await p.click("text=+ i n m d"); await p.waitForTimeout(1500); await p.click("text=none yet"); await p.waitForTimeout(1200); });
await onboard(p, { level: "none yet", sibling: "Veda", grown: "Papa" });
await see(p, "1-02 home night 1");
await hear(p, "1-02-teach-sound", async () => {
  await p.click("text=Teach today's sound"); await p.waitForTimeout(600);
  await see(p, "1-03 teach step 1");
  await p.click(".bigsound"); await p.waitForTimeout(1500);
  await p.click(".bigsound"); await p.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) { const n = await p.$("text=Next →"); if (n) { await n.click(); await p.waitForTimeout(500); } }
  await see(p, "1-04 teach words step");
  for (const w of await p.$$(".wordchip")) { await w.click(); await p.waitForTimeout(1600); }
});
await p.click("text=← Back").catch(() => {}); await p.waitForTimeout(500);
await see(p, "1-05 home after teaching");
await finish(b, errors);
