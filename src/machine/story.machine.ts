/**
 * Story session state machine (Phase 0: stateless between sessions; Phase 1 persists
 * context at every transition). Inputs that arrive while audio plays are ignored
 * except HOME — a 4-year-old double-taps everything.
 */
import { assign, setup } from "xstate";
import type { Story } from "../lib/content/types";

export type VerdictMode = "sight" | "sounded" | "modelled" | "skipped";
export interface WordResult { word: string; ok: boolean; mode: VerdictMode }

export interface Ctx {
  story: Story;
  page: number;
  /** index of the token currently highlighted, or -1 */
  token: number;
  /** which magic word (normalised) is open, if any */
  magic: string | null;
  mode: VerdictMode;
  results: WordResult[];
}

export type Ev =
  | { type: "START" }
  | { type: "TOKEN"; index: number }
  | { type: "NARRATION_DONE" }
  | { type: "MAGIC_REACHED"; word: string }
  | { type: "SOUND_TAPPED" }
  | { type: "YES" }
  | { type: "NOT_YET" }
  | { type: "MODEL_DONE" }
  | { type: "SKIP" }
  | { type: "REREAD_DONE" }
  | { type: "PAGE_DONE" }
  | { type: "LINE_YES" }
  | { type: "HOME" };

export const storyMachine = setup({
  types: { context: {} as Ctx, events: {} as Ev, input: {} as { story: Story } },
  guards: {
    hasNextPage: ({ context }) => context.page + 1 < context.story.pages.length,
  },
  actions: {
    nextPage: assign({ page: ({ context }) => context.page + 1, token: -1, magic: null, mode: "sight" }),
    setToken: assign({ token: ({ event }) => (event.type === "TOKEN" ? event.index : -1) }),
    openMagic: assign({ magic: ({ event }) => (event.type === "MAGIC_REACHED" ? event.word : null), mode: "sight" }),
    sounded: assign({ mode: ({ context }) => (context.mode === "modelled" ? "modelled" : "sounded") }),
    modelled: assign({ mode: "modelled" }),
    record: assign({
      results: ({ context, event }) => [
        ...context.results,
        { word: context.magic ?? "", ok: event.type === "YES", mode: event.type === "SKIP" ? "skipped" : context.mode },
      ],
    }),
  },
}).createMachine({
  id: "story",
  context: ({ input }) => ({ story: input.story, page: 0, token: -1, magic: null, mode: "sight", results: [] }),
  initial: "idle",
  on: { HOME: ".idle" },
  states: {
    idle: { on: { START: "narrating" } },
    narrating: {
      on: {
        TOKEN: { actions: "setToken" },
        MAGIC_REACHED: { target: "magicWord", actions: "openMagic" },
        NARRATION_DONE: [{ guard: "hasNextPage", target: "narrating", actions: "nextPage", reenter: true }, { target: "moral" }],
      },
    },
    magicWord: {
      // waiting for the parent's verdict; the child may tap sounds meanwhile
      on: {
        SOUND_TAPPED: { actions: "sounded" },
        YES: { target: "reread", actions: "record" },
        SKIP: { target: "reread", actions: "record" },
        NOT_YET: { target: "modelling", actions: "modelled" },
      },
    },
    modelling: {
      // app blends the word slowly, then hands it back; taps are ignored here
      on: { MODEL_DONE: "magicWord" },
    },
    reread: {
      // the whole sentence is read again fluently so the word reconnects to meaning
      on: {
        TOKEN: { actions: "setToken" },
        REREAD_DONE: [{ guard: "hasNextPage", target: "narrating", actions: "nextPage" }, { target: "moral" }],
      },
    },
    moral: { on: { LINE_YES: "done" } },
    done: { type: "final" },
  },
});
