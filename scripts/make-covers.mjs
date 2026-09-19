/**
 * Square covers from the public-domain plates.
 *
 * Milo Winter, The Aesop for Children (1919), Project Gutenberg ebook 19994. The originals are
 * portrait and lose their subject if the app crops them to landscape, so each one is cropped here,
 * once, to the square that holds the subject, and only the covers are used — the reading page has
 * its own drawn banner. Re-run after replacing a plate in assets/plates/.
 *
 *   node scripts/make-covers.mjs
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

const CROPS = {                       // [x, y, size] in the original's pixels
  "fox-and-crow": ["i097", 0, 150, 360],
  "lion-and-mouse": ["i014", 140, 0, 417],
  "hare-and-tortoise": ["i093", 0, 330, 694],
  "ant-and-grasshopper": ["i028", 7, 0, 366],
};
const srv = createServer((q, r) => {
  try { r.setHeader("content-type", q.url.endsWith(".jpg") ? "image/jpeg" : "text/html"); r.end(readFileSync("." + q.url)); }
  catch { r.statusCode = 404; r.end(); }
}).listen(8893);
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto("http://localhost:8893/assets/plates/i014.jpg");
for (const [slug, [file, sx, sy, s]] of Object.entries(CROPS)) {
  const data = await p.evaluate(async ([file, sx, sy, s]) => {
    const img = new Image(); img.src = `/assets/plates/${file}.jpg`; await img.decode();
    const c = document.createElement("canvas"); c.width = c.height = 320;
    c.getContext("2d").drawImage(img, sx, sy, s, s, 0, 0, 320, 320);
    return c.toDataURL("image/jpeg", 0.86);
  }, [file, sx, sy, s]);
  writeFileSync(`public/covers/cover-${slug}.jpg`, Buffer.from(data.split(",")[1], "base64"));
  console.log("  cover-" + slug + ".jpg");
}
await b.close(); srv.close();
