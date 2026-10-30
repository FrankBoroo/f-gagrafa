import { describe, expect, it } from "vitest";
import { canOfferDeposit, depositAmount } from "@/lib/booking/deposit";

describe("depositAmount", () => {
  it("takes the percentage of the total, rounded to the pesewa", () => {
    expect(depositAmount(2400, 50)).toBe(1200);
    expect(depositAmount(1001, 50)).toBe(500.5);
    expect(depositAmount(333.33, 30)).toBe(100);
  });
});

describe("canOfferDeposit", () => {
  it("is offered for percentages from 1 to 90", () => {
    expect(canOfferDeposit(1)).toBe(true);
    expect(canOfferDeposit(50)).toBe(true);
    expect(canOfferDeposit(90)).toBe(true);
  });

  it("is off at 0% and refuses nonsense percentages", () => {
    expect(canOfferDeposit(0)).toBe(false);
    expect(canOfferDeposit(95)).toBe(false);
    expect(canOfferDeposit(-10)).toBe(false);
  });
});
