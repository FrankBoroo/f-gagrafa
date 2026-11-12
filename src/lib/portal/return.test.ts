import { describe, it, expect } from "vitest";
import { returnReferenceFor } from "@/lib/portal/return";

describe("returnReferenceFor", () => {
  const ref = "GAG-2026-AB12CD-BZZ99ZZ";
  it("returns the reference from reference or trxref when it belongs to the booking", () => {
    expect(returnReferenceFor("GAG-2026-AB12CD", { reference: ref })).toBe(ref);
    expect(returnReferenceFor("GAG-2026-AB12CD", { trxref: ref })).toBe(ref);
  });
  it("ignores another booking's balance reference", () => {
    expect(returnReferenceFor("GAG-2026-XY99ZZ", { reference: ref })).toBeNull();
  });
  it("ignores a plain booking code", () => {
    expect(returnReferenceFor("GAG-2026-AB12CD", { reference: "GAG-2026-AB12CD" })).toBeNull();
  });
  it("ignores junk and missing values", () => {
    expect(returnReferenceFor("GAG-2026-AB12CD", { reference: "nonsense" })).toBeNull();
    expect(returnReferenceFor("GAG-2026-AB12CD", {})).toBeNull();
  });
});
