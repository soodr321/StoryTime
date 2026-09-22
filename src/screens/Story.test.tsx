import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { StoryView } from "./Story";
import type { Page } from "../lib/content/types";
import type { LearnerModel } from "../lib/phonics/validator";

// Mock setPointerCapture in jsdom if missing
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn(() => true);
}

const fakeLearner: LearnerModel = {
  gpcs: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "w"],
  tricky: [],
};

const samplePage: Page = {
  art: "dog",
  tokens: [
    { t: "The", ms: 0 },
    { t: "little", ms: 200 },
    { t: "dog", ms: 400 },
    { t: "was", ms: 600 },
    { t: "fast.", ms: 800 },
  ],
  magic: ["dog"],
};

describe("StoryView finger follow & tapping", () => {
  const defaultProps = {
    page: samplePage,
    pageNo: 0,
    total: 3,
    slug: "dog-story",
    family: false,
    token: -1,
    results: [],
    readMode: true,
    listener: false,
    reader: "Parent",
    kid: "Maya",
    stalled: false,
    pageHeld: false,
    hideArt: false,
    learner: fakeLearner,
    bedtime: false,
    voiceFollow: false,
    onRetry: vi.fn(),
    onMagicTap: vi.fn(),
    onWordTap: vi.fn(),
    onNext: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tapping a word sets pointer and advances cursor", () => {
    render(<StoryView {...defaultProps} />);
    const words = document.querySelectorAll("[data-i]");
    expect(words.length).toBeGreaterThanOrEqual(4);

    // Tap word 0 ("The")
    fireEvent.click(words[0]);
    expect(words[0].className).toContain("now");

    // Tap word 1 ("little")
    fireEvent.click(words[1]);
    expect(words[0].className).toContain("read");
    expect(words[1].className).toContain("now");
  });

  it("tapping a magic word invokes onMagicTap", () => {
    const onMagicTap = vi.fn();
    render(<StoryView {...defaultProps} onMagicTap={onMagicTap} />);

    // Word 2 is "dog" (magic)
    const magicBtn = screen.getByRole("button", { name: "dog" });
    fireEvent.click(magicBtn);

    expect(onMagicTap).toHaveBeenCalledWith("dog", 2);
  });

  it("dragging under the line tracks words smoothly across wrapped lines", () => {
    render(<StoryView {...defaultProps} />);
    const card = document.querySelector(".text-card.follow")!;
    expect(card).toBeInTheDocument();

    // Mock bounding rects for words:
    // Line 1: words 0, 1
    // Line 2: words 2, 3, 4
    const wordRectMap: Record<number, { left: number; right: number; top: number; bottom: number }> = {
      0: { left: 20, right: 80, top: 20, bottom: 60 },
      1: { left: 90, right: 160, top: 20, bottom: 60 },
      2: { left: 20, right: 90, top: 80, bottom: 120 }, // magic word "dog"
      3: { left: 100, right: 160, top: 80, bottom: 120 },
      4: { left: 170, right: 230, top: 80, bottom: 120 },
    };

    const wordEls = document.querySelectorAll<HTMLElement>("[data-i]");
    wordEls.forEach((el) => {
      const idx = Number(el.dataset.i);
      const rect = wordRectMap[idx];
      if (rect) {
        vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
          x: rect.left,
          y: rect.top,
          toJSON: () => {},
        });
      }
    });

    // Start drag on word 0 (x=50, y=70)
    fireEvent.pointerDown(card, { clientX: 50, clientY: 70, pointerId: 1, pointerType: "touch" });

    // Drag past 6px threshold under word 0
    fireEvent.pointerMove(card, { clientX: 58, clientY: 70, pointerId: 1, pointerType: "touch" });
    expect(wordEls[0].className).toContain("now");

    // Drag under word 1
    fireEvent.pointerMove(card, { clientX: 120, clientY: 70, pointerId: 1, pointerType: "touch" });
    expect(wordEls[0].className).toContain("read");
    expect(wordEls[1].className).toContain("now");

    // Diagonal drag down to line 2 towards magic word 2 (x=50, y=130)
    // Moving diagonally across the gap
    fireEvent.pointerMove(card, { clientX: 90, clientY: 100, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(card, { clientX: 50, clientY: 130, pointerId: 1, pointerType: "touch" });
    expect(wordEls[1].className).toContain("read");
    expect(wordEls[2].className).toContain("now");

    // Attempting to drag past magic word 2 to word 3:
    // The pink/magic word rule: cursor and pointer MUST NEVER cross unresolved word 2!
    fireEvent.pointerMove(card, { clientX: 130, clientY: 130, pointerId: 1, pointerType: "touch" });
    expect(wordEls[3].className).not.toContain("now");
    expect(wordEls[3].className).not.toContain("read");

    // Lifting finger
    fireEvent.pointerUp(card, { clientX: 130, clientY: 130, pointerId: 1, pointerType: "touch" });
  });

  it("works seamlessly with mouse pointer drag", () => {
    render(<StoryView {...defaultProps} />);
    const card = document.querySelector(".text-card.follow")!;

    const wordEls = document.querySelectorAll<HTMLElement>("[data-i]");
    vi.spyOn(wordEls[0], "getBoundingClientRect").mockReturnValue({
      left: 10, right: 60, top: 10, bottom: 40, width: 50, height: 30, x: 10, y: 10, toJSON: () => {},
    });
    vi.spyOn(wordEls[1], "getBoundingClientRect").mockReturnValue({
      left: 70, right: 130, top: 10, bottom: 40, width: 60, height: 30, x: 70, y: 10, toJSON: () => {},
    });

    // Mouse down at bezel edge (e.g. x=5) should NOT be rejected for mouse
    fireEvent.pointerDown(card, { clientX: 5, clientY: 45, pointerId: 2, pointerType: "mouse" });

    // Drag mouse under word 0
    fireEvent.pointerMove(card, { clientX: 30, clientY: 45, pointerId: 2, pointerType: "mouse" });
    expect(wordEls[0].className).toContain("now");

    // Drag mouse under word 1
    fireEvent.pointerMove(card, { clientX: 90, clientY: 45, pointerId: 2, pointerType: "mouse" });
    expect(wordEls[0].className).toContain("read");
    expect(wordEls[1].className).toContain("now");

    fireEvent.pointerUp(card, { clientX: 90, clientY: 45, pointerId: 2, pointerType: "mouse" });
  });
});
