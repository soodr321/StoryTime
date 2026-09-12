import { openApp, see, hear, onboard, finish } from "./lib.mjs";
const { b, p, errors } = await openApp();
await onboard(p, { level: "+ ck e u r", grown: "Papa" });
await p.click(".modes button.mode:nth-child(2)"); await p.waitForTimeout(1200);   // I read: the card opens on a tap
const n = await p.$(".readbar .next"); if (n && !(await n.isDisabled())) { await n.click(); await p.waitForTimeout(900); }
await p.click(".w.magic.tap"); await p.waitForTimeout(700);
const tiles = await p.$$(".panel .tile");
console.log("tiles on the card:", tiles.length);
await hear(p, "probe-tiles", async () => { for (const t of tiles) { await t.click(); await p.waitForTimeout(1200); } });
await see(p, "probe tiles after taps");
await finish(b, errors);
