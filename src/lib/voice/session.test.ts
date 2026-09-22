import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isIOS, startVoice, voiceSupported, type VoiceHandlers } from "./session";

describe("voice session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("voiceSupported", () => {
    it("returns false when window has no SpeechRecognition", () => {
      // @ts-expect-error test override
      delete globalThis.window.SpeechRecognition;
      // @ts-expect-error test override
      delete globalThis.window.webkitSpeechRecognition;
      expect(voiceSupported()).toBe(false);
    });

    it("returns true when window.webkitSpeechRecognition is defined", () => {
      // @ts-expect-error test mock
      globalThis.window.webkitSpeechRecognition = class MockRec {};
      expect(voiceSupported()).toBe(true);
      // @ts-expect-error cleanup
      delete globalThis.window.webkitSpeechRecognition;
    });

    it("returns true when window.SpeechRecognition is defined", () => {
      // @ts-expect-error test mock
      globalThis.window.SpeechRecognition = class MockRec {};
      expect(voiceSupported()).toBe(true);
      // @ts-expect-error cleanup
      delete globalThis.window.SpeechRecognition;
    });
  });

  describe("isIOS", () => {
    it("detects iPhone/iPad in userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        platform: "iPhone",
        maxTouchPoints: 5,
      });
      expect(isIOS()).toBe(true);
    });

    it("detects iPadOS with desktop userAgent (MacIntel + maxTouchPoints > 1)", () => {
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      });
      expect(isIOS()).toBe(true);
    });

    it("returns false on desktop Mac without touch points", () => {
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 0,
      });
      expect(isIOS()).toBe(false);
    });

    it("returns false on Android or Windows", () => {
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
        platform: "Linux armv8l",
        maxTouchPoints: 5,
      });
      expect(isIOS()).toBe(false);
    });
  });

  describe("startVoice lifecycle", () => {
    class MockSpeechRecognition {
      static instances: MockSpeechRecognition[] = [];
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onresult: ((e: any) => void) | null = null;
      onerror: ((e: { error?: string }) => void) | null = null;
      onend: (() => void) | null = null;

      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();

      constructor() {
        MockSpeechRecognition.instances.push(this);
      }
    }

    beforeEach(() => {
      MockSpeechRecognition.instances = [];
      // @ts-expect-error test mock
      globalThis.window.SpeechRecognition = MockSpeechRecognition;
    });

    afterEach(() => {
      // @ts-expect-error cleanup
      delete globalThis.window.SpeechRecognition;
    });

    it("transitions state starting -> listening on start", () => {
      const states: string[] = [];
      const h: VoiceHandlers = {
        onState: (s) => states.push(s),
        onHeard: vi.fn(),
      };

      const session = startVoice(h);
      expect(session).not.toBeNull();
      expect(states).toEqual(["starting"]);

      // Trigger onstart
      const activeInstance = MockSpeechRecognition.instances[0];
      activeInstance.onstart?.();
      expect(states).toEqual(["starting", "listening"]);

      session?.stop();
      expect(states).toEqual(["starting", "listening", "off"]);
      expect(activeInstance.abort).toHaveBeenCalled();
    });

    it("creates a fresh recognizer instance on subsequent starts without reusing aborted instance", () => {
      const h: VoiceHandlers = { onState: vi.fn(), onHeard: vi.fn() };

      const s1 = startVoice(h);
      const instance1 = MockSpeechRecognition.instances[0];
      s1?.stop();
      expect(instance1.abort).toHaveBeenCalled();

      const s2 = startVoice(h);
      const instance2 = MockSpeechRecognition.instances[1];
      expect(instance1).not.toBe(instance2);
      expect(instance2.start).toHaveBeenCalled();
      s2?.stop();
    });

    it("handles onresult parsing and calculates final accurately", () => {
      const heardCalls: Array<{ words: string[]; final: boolean }> = [];
      const h: VoiceHandlers = {
        onState: vi.fn(),
        onHeard: (words, final) => heardCalls.push({ words, final }),
      };

      const session = startVoice(h);
      const inst = MockSpeechRecognition.instances[0];

      // Event 1: Interim result
      inst.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: "on sunday" } }],
      });
      expect(heardCalls[0]).toEqual({ words: ["on", "sunday"], final: false });

      // Event 2: Multiple results, last is final
      inst.onresult?.({
        resultIndex: 0,
        results: [
          { isFinal: true, 0: { transcript: "on sunday" } },
          { isFinal: true, 0: { transcript: "afternoon" } },
        ],
      });
      expect(heardCalls[1]).toEqual({ words: ["on", "sunday", "afternoon"], final: true });

      session?.stop();
    });

    it("handles onerror 'not-allowed' by transitioning to 'denied'", () => {
      const states: string[] = [];
      const h: VoiceHandlers = { onState: (s) => states.push(s), onHeard: vi.fn() };

      const session = startVoice(h);
      const inst = MockSpeechRecognition.instances[0];

      inst.onerror?.({ error: "not-allowed" });
      expect(states).toContain("denied");

      session?.stop();
    });

    it("handles onerror 'network' by transitioning to 'unavailable'", () => {
      const states: string[] = [];
      const h: VoiceHandlers = { onState: (s) => states.push(s), onHeard: vi.fn() };

      const session = startVoice(h);
      const inst = MockSpeechRecognition.instances[0];

      inst.onerror?.({ error: "network" });
      expect(states).toContain("unavailable");

      session?.stop();
    });

    it("transitions to stopped when onend restart fails (e.g. iOS no user gesture)", () => {
      const states: string[] = [];
      const h: VoiceHandlers = { onState: (s) => states.push(s), onHeard: vi.fn() };

      const session = startVoice(h);
      const inst = MockSpeechRecognition.instances[0];
      inst.onstart?.();

      // Simulate start() throwing on restart due to no user activation
      inst.start.mockImplementation(() => {
        throw new Error("NotAllowedError");
      });

      inst.onend?.();
      vi.advanceTimersByTime(250);

      expect(states).toContain("stopped");
      session?.stop();
    });
  });
});
