import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The bedtime palette swaps the meaning of the colour tokens. Any rule that hardcodes a light
 * background and takes its text colour from a token will be unreadable at night: "First try" and
 * "Needs help" both landed at a contrast ratio of 1.0 that way - the grown-up's two decision
 * buttons, invisible, in the mode built for bedtime.
 */
const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
const block = (sel: string) => {
  const i = css.indexOf(sel + " {");
  return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
};
const bedtime = block(".app.bedtime");

describe("the bedtime palette", () => {
  it("colours the verdict buttons from tokens, not literals", () => {
    for (const sel of [".yes", ".no"]) {
      const b = block(sel);
      expect(b, sel).toBeTruthy();
      expect(b, `${sel} hardcodes a colour: ${b}`).not.toMatch(/background:\s*#[0-9a-f]{3,8}/i);
    }
  });
  it("redefines every token the night needs", () => {
    for (const token of ["--yes", "--neutral", "--later", "--later-ink", "--done", "--done-ink", "--ink", "--card", "--line", "--magic", "--magic-ink", "--tricky", "--tricky-ink", "--now"]) {
      expect(bedtime, `${token} is not redefined for bedtime`).toContain(token + ":");
    }
  });
  it("defines those same tokens in daylight", () => {
    const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
    for (const token of ["--yes", "--neutral", "--later", "--later-ink"]) expect(root).toContain(token + ":");
  });
});
