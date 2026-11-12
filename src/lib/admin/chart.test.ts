import { describe, expect, it } from "vitest";
import { barHeight } from "@/lib/admin/chart";

describe("barHeight", () => {
  it("scales a value against the largest one", () => {
    expect(barHeight(50, 100, 150)).toBe(75);
    expect(barHeight(100, 100, 150)).toBe(150);
  });

  it("draws nothing for a negative value (a day where refunds exceed receipts)", () => {
    expect(barHeight(-300, 100, 150)).toBe(0);
  });

  it("draws nothing when there is no largest value or the value isn't a number", () => {
    expect(barHeight(10, 0, 150)).toBe(0);
    expect(barHeight(Number.NaN, 100, 150)).toBe(0);
  });
});
