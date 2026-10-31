import { describe, expect, it } from "vitest";
import { coverImage, priceParts, unitFacts } from "@/lib/apartment-facts";

describe("priceParts", () => {
  it("shows nightly and monthly prices", () => {
    expect(priceParts({ base_price_per_night: 300, monthly_price: 2500 }, "USD")).toEqual(["$300 a night", "$2,500 a month"]);
  });

  it("shows only the nightly price when the type has no monthly price", () => {
    expect(priceParts({ base_price_per_night: 100, monthly_price: null }, "USD")).toEqual(["$100 a night"]);
  });
});

describe("unitFacts", () => {
  it("describes guests and how long you can stay", () => {
    expect(unitFacts({ max_guests: 2, monthly_price: 2500, size_sqm: null })).toEqual(["Up to 2 adults", "A night or a month"]);
  });

  it("says by the night when the type has no monthly price", () => {
    expect(unitFacts({ max_guests: 2, monthly_price: null, size_sqm: null })).toEqual(["Up to 2 adults", "By the night"]);
  });

  it("adds the size once staff have filled it in", () => {
    expect(unitFacts({ max_guests: 1, monthly_price: null, size_sqm: 40 })).toEqual(["1 adult", "By the night", "40 m²"]);
  });
});

describe("coverImage", () => {
  it("uses the type's first photo", () => {
    expect(coverImage({ images: ["/apartments/studio/1.jpg"] })).toBe("/apartments/studio/1.jpg");
  });

  it("falls back to a real photo, never stock", () => {
    expect(coverImage({ images: [] })).toBe("/photos/lounge.jpg");
  });
});
