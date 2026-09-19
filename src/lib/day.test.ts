import { describe, expect, it } from "vitest";
import { countDays, dayStamp, sameDay } from "./day";

const at = (iso: string) => new Date(iso).getTime();

describe("the reading day", () => {
  it("keeps a story that runs past midnight on one night", () => {
    expect(sameDay(at("2026-09-18T23:50:00"), at("2026-09-19T00:05:00"))).toBe(true);
    expect(dayStamp(at("2026-09-19T00:05:00"))).toBe("2026-09-18");
  });
  it("starts a new day in the morning, not at midnight", () => {
    expect(sameDay(at("2026-09-18T23:50:00"), at("2026-09-19T08:00:00"))).toBe(false);
    expect(dayStamp(at("2026-09-19T04:00:00"))).toBe("2026-09-19");
  });
  it("counts two late-night sessions either side of midnight as one night", () => {
    expect(countDays([at("2026-09-18T23:55:00"), at("2026-09-19T00:10:00")])).toBe(1);
    expect(countDays([at("2026-09-18T19:00:00"), at("2026-09-19T19:00:00")])).toBe(2);
  });
  it("accepts the ISO strings stored for taught sounds", () => {
    expect(countDays([new Date(at("2026-09-18T23:00:00")).toISOString()])).toBe(1);
  });
});
