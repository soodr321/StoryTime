import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { storyMachine } from "./story.machine";
import type { Story } from "../lib/content/types";

const story: Story = {
  slug: "t", title: "t", tradition: "aesop", source: { work: "x", rights: "public-domain" },
  retelling: { level: "ls-phase2-set4", checklist: { setup: true, want: true, action: true, consequence: true, feeling: true } },
  level: "ls-phase2-set4",
  pages: [
    { art: "a", tokens: [{ t: "A", ms: 0 }, { t: "cat.", ms: 200 }] },
    { art: "b", tokens: [{ t: "It", ms: 0 }, { t: "sat.", ms: 200 }], magic: ["sat"] },
  ],
  moral: { spoken: "m", line: "It is a trick." },
};

describe("storyMachine", () => {
  it("walks narrate → magic → reread → moral → done", () => {
    const a = createActor(storyMachine, { input: { story } }).start();
    a.send({ type: "START" }); expect(a.getSnapshot().value).toBe("narrating");
    a.send({ type: "NARRATION_DONE" }); expect(a.getSnapshot().context.page).toBe(1);
    a.send({ type: "MAGIC_REACHED", word: "sat", index: 1 }); expect(a.getSnapshot().value).toBe("magicWord");
    a.send({ type: "SOUND_TAPPED" });
    a.send({ type: "YES", verdict: "prompted" }); expect(a.getSnapshot().value).toBe("reread");
    expect(a.getSnapshot().context.results).toEqual([{ id: "1:1", word: "sat", ok: true, mode: "prompted" }]);
    a.send({ type: "REREAD_DONE" }); expect(a.getSnapshot().value).toBe("moral");
    a.send({ type: "LINE_YES" }); expect(a.getSnapshot().value).toBe("done");
    a.send({ type: "HOME" }); expect(a.getSnapshot().value).toBe("idle");
  });
  it("records the adult's judgement, not tap behaviour", () => {
    const a = createActor(storyMachine, { input: { story } }).start();
    a.send({ type: "START" }); a.send({ type: "NARRATION_DONE" }); a.send({ type: "MAGIC_REACHED", word: "sat", index: 1 }); a.send({ type: "SOUND_TAPPED" }); a.send({ type: "YES", verdict: "first_try" });
    expect(a.getSnapshot().context.results[0].mode).toBe("first_try");
  });
  it("ignores taps while modelling and records modelled on a later yes", () => {
    const a = createActor(storyMachine, { input: { story } }).start();
    a.send({ type: "START" }); a.send({ type: "NARRATION_DONE" }); a.send({ type: "MAGIC_REACHED", word: "sat", index: 1 });
    a.send({ type: "NOT_YET" }); expect(a.getSnapshot().value).toBe("modelling");
    a.send({ type: "YES" }); expect(a.getSnapshot().value).toBe("modelling");
    a.send({ type: "MODEL_DONE" }); a.send({ type: "SOUND_TAPPED" }); a.send({ type: "YES", verdict: "first_try" });
    expect(a.getSnapshot().context.results[0].mode).toBe("modelled");   // a modelled word stays modelled whatever ✓ is pressed
  });
  it("read mode: RESUME returns to the same page, PAGE_NEXT advances", () => {
    const a = createActor(storyMachine, { input: { story } }).start();
    a.send({ type: "START" }); a.send({ type: "PAGE_NEXT" }); expect(a.getSnapshot().context.page).toBe(1);
    a.send({ type: "MAGIC_REACHED", word: "sat", index: 1 }); a.send({ type: "YES" }); expect(a.getSnapshot().value).toBe("reread");
    a.send({ type: "RESUME" }); expect(a.getSnapshot().value).toBe("narrating"); expect(a.getSnapshot().context.page).toBe(1);
    a.send({ type: "PAGE_NEXT" }); expect(a.getSnapshot().value).toBe("moral");
  });
  it("HOME from anywhere returns to idle", () => {
    const a = createActor(storyMachine, { input: { story } }).start();
    a.send({ type: "START" }); a.send({ type: "NARRATION_DONE" }); a.send({ type: "MAGIC_REACHED", word: "sat", index: 1 });
    a.send({ type: "HOME" }); expect(a.getSnapshot().value).toBe("idle");
  });
});
