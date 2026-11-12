import { describe, expect, it } from "vitest";
import { minNightsError, requiredMinNights, stayPriceForDates, unitStayPrice, type SpecialPrice } from "@/lib/booking/special-prices";
import { stayPrice } from "@/lib/booking/stay-price";

const RATES = { nightly: 170, monthly: null };

function special(start_date: string, end_date: string, nightly_price: number | null, min_nights: number | null = null): SpecialPrice {
  return { start_date, end_date, nightly_price, min_nights };
}

describe("stayPriceForDates", () => {
  it("charges the special price only on the nights it covers", () => {
    const specials = [special("2026-12-24", "2026-12-27", 250)];
    expect(stayPriceForDates({ checkIn: "2026-12-23", checkOut: "2026-12-26", rates: RATES, specials })).toBe(670);
  });

  it("doesn't charge a special that starts on the check-out day", () => {
    const specials = [special("2026-12-26", "2026-12-30", 250)];
    expect(stayPriceForDates({ checkIn: "2026-12-23", checkOut: "2026-12-26", rates: RATES, specials })).toBe(510);
  });

  it("doesn't charge a special that ended on the check-in day (its end date is exclusive)", () => {
    const specials = [special("2026-12-20", "2026-12-23", 250)];
    expect(stayPriceForDates({ checkIn: "2026-12-23", checkOut: "2026-12-26", rates: RATES, specials })).toBe(510);
  });

  it("equals the ordinary stay price when there are no specials", () => {
    expect(stayPriceForDates({ checkIn: "2026-12-23", checkOut: "2026-12-26", rates: RATES, specials: [] })).toBe(
      stayPrice(3, RATES)
    );
  });

  it("ignores a special that only sets minimum nights", () => {
    const specials = [special("2026-12-20", "2026-12-30", null, 3)];
    expect(stayPriceForDates({ checkIn: "2026-12-23", checkOut: "2026-12-26", rates: RATES, specials })).toBe(510);
  });

  it("keeps the monthly rate for a stay of 30 nights, even with a special inside", () => {
    const specials = [special("2026-12-24", "2026-12-27", 250)];
    expect(
      stayPriceForDates({ checkIn: "2026-12-10", checkOut: "2027-01-09", rates: { nightly: 170, monthly: 1500 }, specials })
    ).toBe(1500);
  });

  it("prices a long stay night by night when the type has no monthly price", () => {
    const specials = [special("2026-12-24", "2026-12-27", 250)];
    expect(stayPriceForDates({ checkIn: "2026-12-10", checkOut: "2027-01-09", rates: RATES, specials })).toBe(
      27 * 170 + 3 * 250
    );
  });

  it("uses cents exactly", () => {
    const specials = [special("2026-12-24", "2026-12-25", 199.99)];
    expect(
      stayPriceForDates({ checkIn: "2026-12-23", checkOut: "2026-12-26", rates: { nightly: 170.1, monthly: null }, specials })
    ).toBe(540.19);
  });

  it("is 0 when check-out is not after check-in", () => {
    expect(stayPriceForDates({ checkIn: "2026-12-26", checkOut: "2026-12-23", rates: RATES, specials: [] })).toBe(0);
  });
});

describe("requiredMinNights", () => {
  it("picks the largest minimum among the ranges the stay touches", () => {
    const specials = [special("2026-12-20", "2026-12-25", null, 3), special("2026-12-25", "2027-01-02", 250, 5)];
    expect(requiredMinNights("2026-12-23", "2026-12-27", specials)).toBe(5);
  });

  it("ignores a range that starts on the check-out day", () => {
    const specials = [special("2026-12-26", "2026-12-30", null, 7)];
    expect(requiredMinNights("2026-12-23", "2026-12-26", specials)).toBeNull();
  });

  it("ignores a range that only sets a price", () => {
    expect(requiredMinNights("2026-12-23", "2026-12-26", [special("2026-12-20", "2026-12-30", 250)])).toBeNull();
  });
});

describe("minNightsError", () => {
  it("says how many nights the dates need", () => {
    expect(minNightsError(3, 5)).toBe("These dates need a stay of at least 5 nights.");
  });

  it("is null when the stay is long enough or nothing is required", () => {
    expect(minNightsError(5, 5)).toBeNull();
    expect(minNightsError(2, null)).toBeNull();
  });
});

describe("unitStayPrice", () => {
  const unit = { base_price_per_night: 170, monthly_price: null };

  it("prices a type's stay with the specials loaded on it", () => {
    const withSpecials = { ...unit, special_prices: [special("2026-12-24", "2026-12-27", 250)] };
    expect(unitStayPrice(withSpecials, "2026-12-23", "2026-12-26")).toBe(670);
  });

  it("uses the ordinary price when the type carries no specials", () => {
    expect(unitStayPrice(unit, "2026-12-23", "2026-12-26")).toBe(510);
  });

  it("is 0 until both dates are chosen", () => {
    expect(unitStayPrice(unit, "2026-12-23", "")).toBe(0);
  });
});
