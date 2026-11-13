import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, sectionFor, visibleSections } from "@/lib/admin/nav";

describe("admin menu", () => {
  it("has the seven sections in the agreed order", () => {
    expect(ADMIN_SECTIONS.map((s) => s.label)).toEqual([
      "Today", "Bookings", "Guests", "Inbox", "Apartments", "Money", "Settings",
    ]);
  });

  it("maps each page to its section", () => {
    expect(sectionFor("/admin")?.key).toBe("today");
    expect(sectionFor("/admin/calendar")?.key).toBe("bookings");
    expect(sectionFor("/admin/bookings/new")?.key).toBe("bookings");
    expect(sectionFor("/admin/units/abc-123")?.key).toBe("apartments");
    expect(sectionFor("/admin/service-requests")?.key).toBe("inbox");
    expect(sectionFor("/admin/audit-log")?.key).toBe("settings");
    expect(sectionFor("/admin/reports")?.key).toBe("money");
  });

  it("has an Airbnb tab under Bookings", () => {
    const bookings = ADMIN_SECTIONS.find((s) => s.key === "bookings");
    expect(bookings?.tabs.find((t) => t.label === "Airbnb")?.href).toBe("/admin/bookings/airbnb");
    expect(sectionFor("/admin/bookings/airbnb")?.key).toBe("bookings");
  });

  it("does not match a page that only starts with the same letters", () => {
    expect(sectionFor("/admin/teamwork")).toBeNull();
  });

  it("hides Money and Settings from staff", () => {
    const keys = visibleSections("staff").map((s) => s.key);
    expect(keys).not.toContain("money");
    expect(keys).not.toContain("settings");
    expect(keys).toHaveLength(5);
  });

  it("shows everything to admins and nothing to anyone else", () => {
    expect(visibleSections("admin")).toHaveLength(7);
    expect(visibleSections("guest")).toEqual([]);
    expect(visibleSections(undefined)).toEqual([]);
  });

  it("uses each tab address once", () => {
    const tabHrefs = ADMIN_SECTIONS.flatMap((s) => s.tabs.map((t) => t.href));
    expect(new Set(tabHrefs).size).toBe(tabHrefs.length);
    for (const s of ADMIN_SECTIONS) {
      const elsewhere = ADMIN_SECTIONS.filter((o) => o !== s).flatMap((o) => o.tabs.map((t) => t.href));
      expect(elsewhere).not.toContain(s.href);
    }
  });
});
