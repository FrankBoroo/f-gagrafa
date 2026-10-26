import { describe, expect, it } from "vitest";
import { guestCountError, stayDatesError } from "@/lib/booking/stay-limits";

const TODAY = "2026-10-26";

describe("stayDatesError", () => {
  it("accepts an ordinary stay", () => {
    expect(stayDatesError("2026-11-10", "2026-11-14", TODAY)).toBeNull();
    expect(stayDatesError(TODAY, "2026-10-27", TODAY)).toBeNull();
  });

  it("refuses dates that aren't real calendar days", () => {
    expect(stayDatesError("2026-02-30", "2026-03-02", TODAY)).toMatch(/valid dates/);
    expect(stayDatesError("10/11/2026", "2026-11-14", TODAY)).toMatch(/valid dates/);
    expect(stayDatesError("2026-11-10", "", TODAY)).toMatch(/valid dates/);
  });

  it("refuses check-out on or before check-in, and check-in in the past", () => {
    expect(stayDatesError("2026-11-10", "2026-11-10", TODAY)).toMatch(/after check-in/);
    expect(stayDatesError("2026-10-25", "2026-10-28", TODAY)).toMatch(/past/);
  });

  it("caps the length of a stay at 365 nights", () => {
    expect(stayDatesError("2026-11-01", "2027-11-01", TODAY)).toBeNull(); // 365 nights
    expect(stayDatesError("2026-11-01", "2027-11-02", TODAY)).toMatch(/365 nights/);
  });

  it("only takes bookings up to two years ahead", () => {
    expect(stayDatesError("2028-10-25", "2028-10-27", TODAY)).toBeNull();
    expect(stayDatesError("2028-10-27", "2028-10-29", TODAY)).toMatch(/two years/);
  });
});

describe("guestCountError", () => {
  it("allows up to the residence's limit", () => {
    expect(guestCountError(2, 0, 2)).toBeNull();
    expect(guestCountError(1, 2, 4)).toBeNull();
  });

  it("refuses more guests than the residence sleeps", () => {
    expect(guestCountError(3, 0, 2)).toMatch(/sleeps 2 guests/);
    expect(guestCountError(2, 1, 2)).toMatch(/sleeps 2 guests/);
    expect(guestCountError(2, 0, 1)).toMatch(/sleeps 1 guest at most/);
  });
});
