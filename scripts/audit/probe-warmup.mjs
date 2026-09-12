import { openApp, see, hear, onboard, finish } from "./lib.mjs";
const { b, p, errors } = await openApp();
await onboard(p, { level: "+ ck e u r", grown: "Papa" });
// seed a due review word directly, the way a missed word would
await p.evaluate(async () => {
  const { set, get, keys } = await import("/node_modules/.vite/deps/idb-keyval.js?v=1").catch(() => ({}));
  void set; void get; void keys;
});
await p.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("keyval-store");
  r.onsuccess = () => {
    const db = r.result;
    const ks = db.transaction("keyval").objectStore("keyval").getAllKeys();
    ks.onsuccess = () => {
      const kid = ks.result.map(String).find((k) => k.startsWith("st:kids")) ? null : null; void kid;
      const id = ks.result.map(String).find((k) => k.startsWith("st:progress:"))?.split(":")[2]
        || ks.result.map(String).find((k) => k.startsWith("st:session:"))?.split(":")[2];
      const kidsReq = db.transaction("keyval").objectStore("keyval").get("st:kids");
      kidsReq.onsuccess = () => {
        const who = id || (kidsReq.result || [])[0]?.id;
        const tx = db.transaction("keyval", "readwrite").objectStore("keyval");
        tx.put({ ran: { word: "ran", due: Date.now() - 1000, interval: 1, last: "skip", misses: 1 }, sat: { word: "sat", due: Date.now() - 1000, interval: 1, last: "help", misses: 1 } }, `st:review:${who}`);
        tx.transaction.oncomplete = () => res();
      };
    };
  };
}));
await p.reload(); await p.waitForTimeout(1500);
await see(p, "w-01 home with words due");
await p.click("text=Warm-up first").catch(async () => { await p.click(".big-tile"); });
await p.waitForTimeout(1200);
await see(p, "w-02 the warm-up");
await hear(p, "w-02-model", async () => { await p.click("text=Needs help"); await p.waitForTimeout(300); await p.click("text=Show me: slide through it"); await p.waitForTimeout(4500); });
await see(p, "w-03 after the warm-up model");
await finish(b, errors);
