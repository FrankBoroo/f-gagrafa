import { describe, expect, it } from "vitest";
import { addDays, defaultCheckOut } from "@/lib/dates";

describe("addDays", () => {
  it("moves across month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("defaultCheckOut", () => {
  it("sets check-out to the next day when none is chosen", () => {
    expect(defaultCheckOut("2026-11-10", "")).toBe("2026-11-11");
  });

  it("moves check-out forward when it is on or before the new check-in", () => {
    expect(defaultCheckOut("2026-11-10", "2026-11-10")).toBe("2026-11-11");
    expect(defaultCheckOut("2026-11-10", "2026-11-05")).toBe("2026-11-11");
  });

  it("keeps a later check-out the guest already picked", () => {
    expect(defaultCheckOut("2026-11-10", "2026-11-14")).toBe("2026-11-14");
  });

  it("leaves check-out alone when check-in is cleared", () => {
    expect(defaultCheckOut("", "2026-11-14")).toBe("2026-11-14");
  });
});
