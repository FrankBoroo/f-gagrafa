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

  // 32^6 ≈ 1.07 billion codes, so 20,000 of them have ~0.19 expected repeats (birthday maths).
  // Demanding zero failed ~18% of runs; more than 3 repeats would mean a broken generator.
  it("rarely repeats across many codes", () => {
    const codes = new Set(Array.from({ length: 20_000 }, () => generateBookingCode()));
    expect(20_000 - codes.size).toBeLessThanOrEqual(3);
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
