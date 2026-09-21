/**
 * plan-voice.md B4: Kathryn's permission for the soundcity pack is conditional on credit being
 * shown ("you may share the app as long as you give me credit" — assets/packs/soundcity/NOTICE.md).
 * Settings.tsx and RecordSounds.tsx already render `pack.credit` from `soundPack()`; this is a
 * verification test, not new UI — it must fail if either screen stops rendering it.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Kid, Settings as AppSettings } from "../lib/store";

const CREDIT = "Letter sounds recorded by Kathryn J. Davis, soundcityreading.net, used with permission.";
const fakePack = { name: "soundcity", title: "Sound City Reading alphabet sounds", attribution: "Kathryn J. Davis", credit: CREDIT, license: "Copyright Kathryn J. Davis", builtAt: "2026-09-19" };

vi.mock("../lib/sounds", () => ({
  playSound: vi.fn(),
  soundPack: vi.fn(() => Promise.resolve(fakePack)),
  familySoundClips: vi.fn(() => Promise.resolve([])),
  saveFamilySound: vi.fn(),
  removeFamilySound: vi.fn(),
}));

const fakeFamily = {
  kids: [] as Kid[],
  updateKid: vi.fn(), addKid: vi.fn(), removeKid: vi.fn(),
  settings: { bedtime: false, readers: [] } as AppSettings,
  updateSettings: vi.fn(),
  customs: [], removeCustom: vi.fn(),
  activeKid: null, progress: {},
};
vi.mock("../lib/family", () => ({ useFamily: vi.fn(() => fakeFamily) }));

// Recording needs a browser that can record; RecordSoundsScreen shows a "cannot record" screen
// (never reaching the credit line) otherwise, so give jsdom just enough to pass canRecord().
(globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = class {};
Object.defineProperty(window.navigator, "mediaDevices", { value: { getUserMedia: vi.fn() }, configurable: true });

describe("Kathryn's credit stays on screen", () => {
  it("Settings.tsx renders pack.credit under \"The letter sounds\"", async () => {
    const { SettingsScreen } = await import("./Settings");
    render(<SettingsScreen onBack={vi.fn()} onAddStory={vi.fn()} onSounds={vi.fn()} onTeach={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(CREDIT)).toBeInTheDocument());
  });

  it("RecordSounds.tsx renders pack.credit on the recording screen", async () => {
    const { RecordSoundsScreen } = await import("./RecordSounds");
    render(<RecordSoundsScreen onDone={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(new RegExp(CREDIT))).toBeInTheDocument());
  });
});
