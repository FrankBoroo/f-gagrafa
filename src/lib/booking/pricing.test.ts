import { describe, expect, it } from "vitest";
import { bookedPriceSuffix, pricingFromSettings, toChargeAmount } from "@/lib/booking/pricing";
import { formatCurrency } from "@/lib/utils";

describe("pricingFromSettings", () => {
  it("defaults to cedis when the settings row or columns are missing", () => {
    expect(pricingFromSettings(null)).toEqual({ currency: "GHS", usdToGhsRate: null });
    expect(pricingFromSettings({})).toEqual({ currency: "GHS", usdToGhsRate: null });
  });

  it("reads USD with its rate", () => {
    expect(pricingFromSettings({ price_currency: "USD", usd_to_ghs_rate: "15.5" })).toEqual({
      currency: "USD",
      usdToGhsRate: 15.5,
    });
  });

  it("treats a zero, negative or junk rate as unset", () => {
    expect(pricingFromSettings({ price_currency: "USD", usd_to_ghs_rate: 0 }).usdToGhsRate).toBeNull();
    expect(pricingFromSettings({ price_currency: "USD", usd_to_ghs_rate: -3 }).usdToGhsRate).toBeNull();
    expect(pricingFromSettings({ price_currency: "USD", usd_to_ghs_rate: "abc" }).usdToGhsRate).toBeNull();
  });
});

describe("toChargeAmount", () => {
  it("passes cedi prices straight through", () => {
    expect(toChargeAmount(1200, { currency: "GHS", usdToGhsRate: null })).toBe(1200);
  });

  it("converts dollars to cedis, rounded to the pesewa", () => {
    expect(toChargeAmount(400, { currency: "USD", usdToGhsRate: 15.5 })).toBe(6200);
    expect(toChargeAmount(100, { currency: "USD", usdToGhsRate: 15.3333 })).toBe(1533.33);
  });

  it("refuses to convert without a rate", () => {
    expect(toChargeAmount(400, { currency: "USD", usdToGhsRate: null })).toBeNull();
  });
});

describe("formatCurrency", () => {
  it("uses a fixed format with no locale", () => {
    expect(formatCurrency(1200)).toBe("GH₵1,200");
    expect(formatCurrency(1234567, "USD")).toBe("$1,234,567");
    expect(formatCurrency(1533.33)).toBe("GH₵1,533.33");
    expect(formatCurrency(-50, "USD")).toBe("-$50");
    expect(formatCurrency(0)).toBe("GH₵0");
  });
});

describe("bookedPriceSuffix", () => {
  it("shows the USD price for bookings made in dollars", () => {
    expect(bookedPriceSuffix({ display_currency: "USD", display_total: "400.00" })).toBe(" ($400)");
  });
  it("is empty for cedi bookings", () => {
    expect(bookedPriceSuffix({ display_currency: null, display_total: null })).toBe("");
    expect(bookedPriceSuffix({})).toBe("");
  });
});
