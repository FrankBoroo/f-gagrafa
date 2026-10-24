import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMoney, formatMonthYear } from "@/lib/format";

describe("formatMoney", () => {
  it("groups thousands and drops .00", () => {
    expect(formatMoney(1200)).toBe("GH₵1,200");
    expect(formatMoney(1234567.5, "GHS")).toBe("GH₵1,234,567.50");
    expect(formatMoney(400, "USD")).toBe("$400");
  });

  it("handles negatives, unknown currencies and bad input", () => {
    expect(formatMoney(-50.25)).toBe("-GH₵50.25");
    expect(formatMoney(10, "EUR")).toBe("EUR 10");
    expect(formatMoney(Number.NaN)).toBe("GH₵0");
  });
});

describe("formatDate / formatDateTime", () => {
  it("uses a fixed English format in UTC", () => {
    expect(formatDate("2026-11-10")).toBe("10 Nov 2026");
    expect(formatDate("2026-12-31T23:30:00Z")).toBe("31 Dec 2026");
    expect(formatDateTime("2026-10-24T09:05:00Z")).toBe("24 Oct 2026, 09:05 UTC");
  });

  it("returns an empty string for unreadable input", () => {
    expect(formatDate("not a date")).toBe("");
    expect(formatDateTime("")).toBe("");
  });
});

describe("formatMonthYear", () => {
  it("names the month", () => {
    expect(formatMonthYear(2026, 1)).toBe("January 2026");
    expect(formatMonthYear(2026, 12)).toBe("December 2026");
  });
});
