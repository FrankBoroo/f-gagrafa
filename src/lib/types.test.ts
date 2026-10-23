import { describe, expect, it } from "vitest";
import { calculateNights, generateBookingCode } from "@/lib/types";

describe("generateBookingCode", () => {
  it("has the GAG-year-XXXXXX shape with no look-alike characters", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateBookingCode(new Date("2026-06-01T00:00:00Z"))).toMatch(
        /^GAG-2026-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
      );
    }
  });

  it("uses the UTC year", () => {
    expect(generateBookingCode(new Date("2027-01-01T00:30:00Z"))).toMatch(/^GAG-2027-/);
  });

  it("does not repeat across many codes", () => {
    const codes = new Set(Array.from({ length: 20_000 }, () => generateBookingCode()));
    expect(codes.size).toBe(20_000);
  });
});

describe("calculateNights", () => {
  it("counts nights between two dates", () => {
    expect(calculateNights("2026-11-10", "2026-11-11")).toBe(1);
    expect(calculateNights("2026-12-30", "2027-01-02")).toBe(3);
    expect(calculateNights("2026-11-10", "2026-11-10")).toBe(0);
    expect(calculateNights("2026-11-10", "2026-11-08")).toBe(-2);
  });
});
