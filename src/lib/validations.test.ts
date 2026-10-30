import { describe, expect, it } from "vitest";
import { unitDetailsSchema } from "@/lib/validations";

const details = {
  name: "Studio", type: "studio", short_description: "", description: "", base_price_per_night: 100,
  max_guests: 2, bedrooms: 1, bathrooms: 1, size_sqm: null, amenities: [], access_code: "", is_active: true,
};

describe("unitDetailsSchema monthly_price", () => {
  it("turns a blank monthly price into null", () => {
    expect(unitDetailsSchema.parse({ ...details, monthly_price: "" }).monthly_price).toBeNull();
    expect(unitDetailsSchema.parse({ ...details, monthly_price: null }).monthly_price).toBeNull();
  });

  it("keeps a real monthly price", () => {
    expect(unitDetailsSchema.parse({ ...details, monthly_price: "1500" }).monthly_price).toBe(1500);
  });

  it("refuses a negative monthly price", () => {
    expect(unitDetailsSchema.safeParse({ ...details, monthly_price: -5 }).success).toBe(false);
  });
});
