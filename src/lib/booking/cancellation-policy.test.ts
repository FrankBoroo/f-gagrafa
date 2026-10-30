import { describe, expect, it } from "vitest";
import {
  CANCELLATION_POLICY, daysUntilCheckIn, isFreeCancellation, oneNightCharge, suggestedRefund,
} from "@/lib/booking/cancellation-policy";

const NOW = new Date("2026-11-01T15:30:00Z");

describe("daysUntilCheckIn", () => {
  it("counts whole calendar days, ignoring the time of day", () => {
    expect(daysUntilCheckIn("2026-11-01", NOW)).toBe(0);
    expect(daysUntilCheckIn("2026-11-08", NOW)).toBe(7);
    expect(daysUntilCheckIn("2026-10-30", NOW)).toBe(-2);
  });
});

describe("isFreeCancellation", () => {
  it("is free until exactly 72 hours before 2 PM on the check-in day", () => {
    expect(isFreeCancellation("2026-11-10", new Date("2026-11-07T13:59:59Z"))).toBe(true);
    expect(isFreeCancellation("2026-11-10", new Date("2026-11-07T14:00:00Z"))).toBe(false);
  });
});

describe("oneNightCharge", () => {
  it("is the stay's total over its nights, to the pesewa", () => {
    expect(oneNightCharge({ total_amount: 800, nights: 4 })).toBe(200);
    expect(oneNightCharge({ total_amount: 1000, nights: 3 })).toBe(333.33);
  });
});

describe("suggestedRefund", () => {
  const booking = { check_in: "2026-11-10", total_amount: 800, nights: 4 };

  it("refunds everything paid when cancelled more than 72 hours before check-in", () => {
    expect(suggestedRefund(400, booking, new Date("2026-11-01T09:00:00Z"))).toBe(400);
  });

  it("keeps one night within 72 hours", () => {
    expect(suggestedRefund(400, booking, new Date("2026-11-08T09:00:00Z"))).toBe(200);
  });

  it("keeps one night after check-in", () => {
    expect(suggestedRefund(800, booking, new Date("2026-11-12T09:00:00Z"))).toBe(600);
  });

  it("is never negative when less than one night was paid", () => {
    expect(suggestedRefund(150, booking, new Date("2026-11-08T09:00:00Z"))).toBe(0);
  });

  it("rounds to the pesewa", () => {
    const threeNights = { check_in: "2026-11-10", total_amount: 1000, nights: 3 };
    expect(suggestedRefund(500, threeNights, new Date("2026-11-08T09:00:00Z"))).toBe(166.67);
  });
});

describe("CANCELLATION_POLICY", () => {
  it("states both rules", () => {
    expect(CANCELLATION_POLICY).toEqual([
      "Cancel more than 72 hours before check-in (2 PM on your arrival day) for a full refund of what you've paid.",
      "Cancel within 72 hours of check-in, or don't arrive, and one night is charged; the rest of what you've paid is refunded.",
    ]);
  });
});
