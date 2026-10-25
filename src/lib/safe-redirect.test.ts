import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/admin/bookings")).toBe("/admin/bookings");
    expect(safeNextPath("/admin/bookings?q=GAG-2026-ABCDEF#top")).toBe("/admin/bookings?q=GAG-2026-ABCDEF#top");
  });

  it("falls back for a missing value", () => {
    expect(safeNextPath(null)).toBe("/admin");
    expect(safeNextPath("")).toBe("/admin");
  });

  it("refuses anything that leaves the site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "evil.example/admin",
      "/\t/evil.example",
      " /admin",
    ]) {
      expect(safeNextPath(value)).toBe("/admin");
    }
  });
});
