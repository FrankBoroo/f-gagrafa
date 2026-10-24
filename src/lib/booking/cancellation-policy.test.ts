import { describe, expect, it } from "vitest";
import { daysUntilCheckIn, refundPercentFor, suggestedRefund } from "@/lib/booking/cancellation-policy";

const NOW = new Date("2026-11-01T15:30:00Z");

describe("daysUntilCheckIn", () => {
  it("counts whole calendar days, ignoring the time of day", () => {
    expect(daysUntilCheckIn("2026-11-01", NOW)).toBe(0);
    expect(daysUntilCheckIn("2026-11-08", NOW)).toBe(7);
    expect(daysUntilCheckIn("2026-10-30", NOW)).toBe(-2);
  });
});

describe("refundPercentFor", () => {
  it.each([
    ["2026-11-20", 100], // 19 days
    ["2026-11-08", 100], // 7 days: still full refund
    ["2026-11-07", 50], // 6 days
    ["2026-11-03", 50], // 2 days
    ["2026-11-02", 0], // 1 day
    ["2026-11-01", 0], // check-in day
    ["2026-10-25", 0], // stay already started
  ])("check-in %s gives %i%%", (checkIn: string, percent: number) => {
    expect(refundPercentFor(checkIn, NOW)).toBe(percent);
  });
});

describe("suggestedRefund", () => {
  it("applies the tier to what was actually paid, to the pesewa", () => {
    expect(suggestedRefund(1200, "2026-11-20", NOW)).toBe(1200);
    expect(suggestedRefund(1250.5, "2026-11-05", NOW)).toBe(625.25);
    expect(suggestedRefund(1200, "2026-11-02", NOW)).toBe(0);
  });
});
