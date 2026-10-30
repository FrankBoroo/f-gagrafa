import { describe, expect, it } from "vitest";
import { stayPrice, unitRates, usesMonthlyRate } from "@/lib/booking/stay-price";

describe("stayPrice", () => {
  it("charges nightly below 30 nights", () => {
    expect(stayPrice(3, { nightly: 200, monthly: 2000 })).toBe(600);
    expect(stayPrice(29, { nightly: 200, monthly: 2000 })).toBe(5800);
  });

  it("charges the monthly rate from 30 nights, pro rata for extra nights", () => {
    expect(stayPrice(30, { nightly: 200, monthly: 2000 })).toBe(2000);
    expect(stayPrice(45, { nightly: 200, monthly: 2000 })).toBe(3000);
    expect(stayPrice(31, { nightly: 170, monthly: 1500 })).toBe(1550);
  });

  it("rounds to the cent", () => {
    expect(stayPrice(31, { nightly: 100, monthly: 1000 })).toBe(1033.33);
  });

  it("uses nightly when a type has no monthly price", () => {
    expect(stayPrice(40, { nightly: 100, monthly: null })).toBe(4000);
    expect(stayPrice(30, { nightly: 100, monthly: 0 })).toBe(3000);
  });
});

describe("usesMonthlyRate", () => {
  it("starts at 30 nights", () => {
    expect(usesMonthlyRate(30, 2000)).toBe(true);
    expect(usesMonthlyRate(29, 2000)).toBe(false);
  });

  it("is false without a monthly price", () => {
    expect(usesMonthlyRate(30, null)).toBe(false);
    expect(usesMonthlyRate(30, 0)).toBe(false);
  });
});

describe("unitRates", () => {
  it("reads numeric strings from the database and keeps a missing monthly price null", () => {
    expect(unitRates({ base_price_per_night: "170.00" as unknown as number, monthly_price: "1500.00" as unknown as number }))
      .toEqual({ nightly: 170, monthly: 1500 });
    expect(unitRates({ base_price_per_night: 100, monthly_price: null })).toEqual({ nightly: 100, monthly: null });
  });
});
