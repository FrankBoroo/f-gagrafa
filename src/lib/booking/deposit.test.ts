import { describe, expect, it } from "vitest";
import { canOfferDeposit, depositAmount, DEPOSIT_MIN_DAYS_BEFORE_CHECKIN } from "@/lib/booking/deposit";

const NOW = new Date("2026-11-01T09:00:00Z");

describe("depositAmount", () => {
  it("takes the percentage of the total, rounded to the pesewa", () => {
    expect(depositAmount(2400, 50)).toBe(1200);
    expect(depositAmount(1001, 50)).toBe(500.5);
    expect(depositAmount(333.33, 30)).toBe(100);
  });
});

describe("canOfferDeposit", () => {
  it("is offered only when check-in is far enough away", () => {
    expect(DEPOSIT_MIN_DAYS_BEFORE_CHECKIN).toBe(7);
    expect(canOfferDeposit("2026-11-08", 50, NOW)).toBe(true); // exactly 7 days
    expect(canOfferDeposit("2026-11-07", 50, NOW)).toBe(false); // 6 days
  });

  it("is off at 0% and refuses nonsense percentages", () => {
    expect(canOfferDeposit("2026-12-01", 0, NOW)).toBe(false);
    expect(canOfferDeposit("2026-12-01", 95, NOW)).toBe(false);
    expect(canOfferDeposit("2026-12-01", -10, NOW)).toBe(false);
    expect(canOfferDeposit("2026-12-01", 90, NOW)).toBe(true);
  });
});
