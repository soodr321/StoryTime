/**
 * Audit harness: drive the app like a family, and capture what they SEE and HEAR.
 *
 * Hearing: every sound the app makes goes through Web Audio (HTMLAudioElement is routed with
 * createMediaElementSource) into one MediaStreamDestination, recorded with MediaRecorder. So a
 * step's .webm is the actual mix a child in the room would hear, not a reconstruction.
 * speechSynthesis cannot be captured (the engine writes straight to the device), so it is logged.
 */
import { chromium } from "/Users/rish_ai/OpenFinn/.claude/worktrees/recursing-archimedes-ee6056/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

export const OUT = process.env.AUDIT_OUT || "/private/tmp/claude-502/-Users-rish-ai-OpenFinn--claude-worktrees-recursing-archimedes-ee6056/e67f2838-404c-4251-bf50-bcc41c033a87/scratchpad/audit";
mkdirSync(OUT, { recursive: true });

const TAP = () => {
  window.__log = [];
  window.__note = (s) => window.__log.push({ t: Math.round(performance.now()), s });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const dest = ctx.createMediaStreamDestination();
  const mix = ctx.createGain(); mix.connect(dest); mix.connect(ctx.destination);
  window.__mix = mix; window.__actx = ctx;
  // every <audio> the app plays is routed into the same mix
  const wired = new WeakSet();
  const play = HTMLAudioElement.prototype.play;
  HTMLAudioElement.prototype.play = function () {
    try {
      if (!wired.has(this) && this.src && !this.src.startsWith("data:")) {
        this.crossOrigin = "anonymous";
        const src = ctx.createMediaElementSource(this);
        src.connect(mix); wired.add(this);
      }
    } catch { /* already wired or not routable */ }
    window.__note("audio " + (this.src || "").split("/").pop());
    return play.apply(this, arguments);
  };
  // the blend graph builds its own nodes on its own context: mirror them into the mix
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target) {
    const r = connect.apply(this, arguments);
    try { if (target === this.context.destination && this.context !== ctx) connect.call(this, mix); } catch { /* cross-context: fall through */ }
    return r;
  };
  const sp = window.speechSynthesis && window.speechSynthesis.speak;
  if (sp) window.speechSynthesis.speak = function (u) { window.__note(`tts rate=${u.rate} "${(u.text || "").slice(0, 60)}"`); return sp.apply(window.speechSynthesis, arguments); };
  window.__rec = null;
  window.__startRec = () => { const chunks = []; const r = new MediaRecorder(dest.stream, { mimeType: "audio/webm" }); r.ondataavailable = (e) => e.data.size && chunks.push(e.data); r.start(); window.__rec = { r, chunks }; };
  window.__stopRec = () => new Promise((res) => {
    const h = window.__rec; if (!h) return res(null);
    h.r.onstop = async () => { const b = new Blob(h.chunks, { type: "audio/webm" }); const buf = await b.arrayBuffer(); res([...new Uint8Array(buf)]); };
    h.r.stop(); window.__rec = null;
  });
};

export async function openApp({ url = "http://localhost:5178/", mobile = true } = {}) {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"] });
  const c = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 820, height: 1180 }, deviceScaleFactor: 2 });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => { if (!/play\(\) request/.test(e.message)) errors.push("PAGEERROR " + e.message); });
  p.on("console", (m) => { if (m.type() === "error" && !/play\(\) request/.test(m.text())) errors.push("CONSOLE " + m.text()); });
  await p.addInitScript(TAP);
  await p.goto(url); await p.waitForTimeout(1200);
  return { b, p, errors };
}

/** Everything on screen, as the family sees it. */
export async function see(p, label, { shot = true } = {}) {
  const txt = await p.evaluate(() => {
    const parts = [];
    const add = (sel, name) => document.querySelectorAll(sel).forEach((el) => { const t = el.innerText.trim().replace(/\n{2,}/g, "\n"); if (t) parts.push(`[${name}]\n${t}`); });
    add("header.top", "top bar"); add("main", "screen"); add(".panel", "sheet"); add(".cap", "caption"); add(".toast", "toast");
    return parts.join("\n");
  });
  if (shot) await p.screenshot({ path: `${OUT}/${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png` });
  console.log(`\n════ ${label} ════\n${txt}`);
  return txt;
}

/** Record everything audible while `fn` runs; writes <name>.webm and returns the sound log. */
export async function hear(p, name, fn) {
  await p.evaluate(() => { window.__log = []; window.__startRec(); });
  await fn();
  const bytes = await p.evaluate(() => window.__stopRec());
  const log = await p.evaluate(() => window.__log);
  if (bytes && bytes.length > 1000) writeFileSync(`${OUT}/${name}.webm`, Buffer.from(bytes));
  console.log(`\n♪ ${name}: ${bytes ? (bytes.length / 1024).toFixed(0) + " kB" : "no capture"} · ${log.length} sound events`);
  for (const e of log) console.log(`    ${String(e.t).padStart(6)} ms  ${e.s}`);
  return log;
}

export const onboard = async (p, { name = "Veer", level = "+ ck e u r", sibling = "", grown = "Papa" } = {}) => {
  await p.fill('input[placeholder="first name"]', name);
  await p.click(`text=${level}`);
  if (sibling) await p.fill('input[placeholder="name, or leave blank"]', sibling);
  await p.fill('input[placeholder="Nani, Papa, Mama…"]', grown);
  await p.click("text=Start reading"); await p.waitForTimeout(900);
};
export const finish = async (b, errors) => { console.log("\nERRORS: " + (errors.length ? errors.join("\n  ") : "none")); await b.close(); };
