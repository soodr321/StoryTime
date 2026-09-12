import { openApp, onboard, finish } from "./lib.mjs";
const { b, p, errors } = await openApp();
const lum = (c) => { const [r, g, bl] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
const audit = async (label) => {
  const rows = await p.evaluate(() => {
    const bgOf = (el) => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)/.test(c)) return c; n = n.parentElement; } return "rgb(251,246,234)"; };
    const out = [];
    document.querySelectorAll("button, a, input, select, .w, .tile, .tog, .chip").forEach((el) => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const cs = getComputedStyle(el);
      out.push({ tag: el.tagName.toLowerCase(), cls: el.className.toString().slice(0, 28), text: (el.textContent || "").trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top), fs: parseFloat(cs.fontSize), fg: cs.color, bg: bgOf(el) });
    });
    return out;
  });
  const small = rows.filter((r) => (r.h < 44 || r.w < 30) && !r.cls.includes("w ") && r.tag !== "select");
  const low = rows.map((r) => { const L1 = lum(r.fg), L2 = lum(r.bg); const c = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); return { ...r, contrast: +c.toFixed(2) }; })
    .filter((r) => r.contrast < (r.fs >= 24 ? 3 : 4.5));
  const low_reach = rows.filter((r) => r.tag === "button" && r.y > 0 && r.y < 300 && /next|yes|mode|big-tile/.test(r.cls));
  console.log(`\n── ${label}: ${rows.length} interactive elements`);
  if (small.length) { console.log(`  small targets (<44px tall):`); small.slice(0, 8).forEach((r) => console.log(`    ${r.h}×${r.w} "${r.text}" (${r.cls})`)); }
  if (low.length) { console.log(`  low contrast:`); low.slice(0, 8).forEach((r) => console.log(`    ${r.contrast}:1 at ${r.fs}px "${r.text}" (${r.cls})`)); }
  if (low_reach.length) console.log(`  primary action in the top third: ${low_reach.map((r) => r.text).join(", ")}`);
  if (!small.length && !low.length) console.log("  ok");
};
await audit("welcome");
await onboard(p, { level: "+ ck e u r", sibling: "Veda", grown: "Papa" });
await audit("home");
await p.click(".modes button.mode:nth-child(2)"); await p.waitForTimeout(1200);
await audit("story, I read");
const n = await p.$(".readbar .next"); if (n && !(await n.isDisabled())) { await n.click(); await p.waitForTimeout(800); }
await p.click(".w.magic.tap"); await p.waitForTimeout(600);
await audit("the word card");
await p.click('button[aria-label="Home"]'); await p.waitForTimeout(600);
await p.click('button[aria-label="Settings"]'); await p.waitForTimeout(600);
await audit("settings");
await finish(b, errors);
