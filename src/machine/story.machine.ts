/**
 * Story session state machine (Phase 0: stateless between sessions; Phase 1 persists
 * context at every transition). Inputs that arrive while audio plays are ignored
 * except HOME — a 4-year-old double-taps everything.
 */
import { assign, setup } from "xstate";
import type { Story } from "../lib/content/types";

export type VerdictMode = "first_try" | "prompted" | "modelled" | "skipped";
/** id = `${page}:${tokenIndex}` so every occurrence of a magic word gets its own turn */
export interface WordResult { id?: string; word: string; ok: boolean; mode: VerdictMode; extra?: boolean }   // extra = a word the child volunteered for; never counted as evidence

export interface Ctx {
  story: Story;
  page: number;
  /** index of the token currently highlighted, or -1 */
  token: number;
  /** which magic word (normalised) is open, if any, and its token index */
  magic: string | null;
  magicIdx: number;
  mode: VerdictMode;
  /** the open word was volunteered ("I'll try"), not one the story designed */
  extra: boolean;
  results: WordResult[];
}

export type Ev =
  | { type: "START" }
  | { type: "TOKEN"; index: number }
  | { type: "NARRATION_DONE" }
  | { type: "MAGIC_REACHED"; word: string; index: number; extra?: boolean }
  | { type: "SOUND_TAPPED" }
  | { type: "YES"; verdict?: "first_try" | "prompted" }
  | { type: "NOT_YET" }
  | { type: "MODEL_DONE" }
  | { type: "SKIP" }
  | { type: "DISMISS" }   // closed without a verdict (a sibling's tap): nothing is recorded
  | { type: "REREAD_DONE" }
  | { type: "RESUME" }
  | { type: "PAGE_NEXT" }
  | { type: "PAGE_DONE" }
  | { type: "LINE_YES" }
  | { type: "HOME" };

export const storyMachine = setup({
  types: { context: {} as Ctx, events: {} as Ev, input: {} as { story: Story; page?: number; results?: WordResult[] } },
  guards: {
    hasNextPage: ({ context }) => context.page + 1 < context.story.pages.length,
  },
  actions: {
    nextPage: assign({ page: ({ context }) => context.page + 1, token: -1, magic: null, mode: "first_try", extra: false }),
    setToken: assign({ token: ({ event }) => (event.type === "TOKEN" ? event.index : -1) }),
    openMagic: assign({ magic: ({ event }) => (event.type === "MAGIC_REACHED" ? event.word : null), magicIdx: ({ event }) => (event.type === "MAGIC_REACHED" ? event.index : -1), mode: "first_try", extra: ({ event }) => (event.type === "MAGIC_REACHED" ? !!event.extra : false) }),
    closeMagic: assign({ magic: null, magicIdx: -1, mode: "first_try", extra: false }),
    sounded: assign({ mode: ({ context }) => context.mode }),   // tile taps play sounds; they never decide the label
    modelled: assign({ mode: "modelled" }),
    record: assign({
      results: ({ context, event }) => [
        ...context.results,
        { id: `${context.page}:${context.magicIdx}`, word: context.magic ?? "", ok: event.type === "YES", mode: event.type === "SKIP" ? "skipped" : context.mode === "modelled" ? "modelled" : event.type === "YES" && event.verdict ? event.verdict : context.mode, ...(context.extra ? { extra: true } : {}) },
      ],
    }),
  },
}).createMachine({
  id: "story",
  context: ({ input }) => ({ story: input.story, page: input.page ?? 0, token: -1, magic: null, magicIdx: -1, mode: "first_try", extra: false, results: input.results ?? [] }),
  initial: "idle",
  on: { HOME: ".idle" },
  states: {
    idle: { on: { START: "narrating" } },
    narrating: {
      on: {
        TOKEN: { actions: "setToken" },
        MAGIC_REACHED: { target: "magicWord", actions: "openMagic" },
        NARRATION_DONE: [{ guard: "hasNextPage", target: "narrating", actions: "nextPage", reenter: true }, { target: "moral" }],
        PAGE_NEXT: [{ guard: "hasNextPage", target: "narrating", actions: "nextPage", reenter: true }, { target: "moral" }],
      },
    },
    magicWord: {
      // waiting for the parent's verdict; the child may tap sounds meanwhile
      on: {
        SOUND_TAPPED: { actions: "sounded" },
        YES: { target: "reread", actions: "record" },
        SKIP: { target: "reread", actions: "record" },
        NOT_YET: { target: "modelling", actions: "modelled" },
        // closed without a verdict: back to the page, nothing written. Read mode only (listen mode would replay the page).
        DISMISS: { target: "narrating", actions: "closeMagic" },
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
        // read mode: no re-read audio; stay on the page until the grown-up taps Next
        RESUME: { target: "narrating", reenter: true },
      },
    },
    moral: { on: { LINE_YES: "done" } },
    done: { on: { START: "narrating" } },   // not `final`: a final root state would stop the actor and swallow HOME
  },
});
