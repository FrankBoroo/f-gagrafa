import { describe, expect, it } from "vitest";
import { balanceProblem, balanceReference, parseBalanceReference } from "@/lib/payments/balance";

const NOTHING_LEFT = "There's nothing left to pay on this booking.";
const CANT_PAY = "This booking can't be paid online. Please contact us.";

describe("balanceReference", () => {
  it("adds -B and six characters to the booking code", () => {
    expect(balanceReference("GAG-2026-AB12CD", () => "ZZ99ZZ")).toBe("GAG-2026-AB12CD-BZZ99ZZ");
  });

  it("makes a random suffix from A-Z and 0-9 by default", () => {
    const ref = balanceReference("GAG-2026-AB12CD");
    expect(ref).toMatch(/^GAG-2026-AB12CD-B[A-Z0-9]{6}$/);
    expect(balanceReference("GAG-2026-AB12CD")).not.toBe(ref);
  });
});

describe("parseBalanceReference", () => {
  it("round-trips the booking code", () => {
    expect(parseBalanceReference(balanceReference("GAG-2026-AB12CD"))).toBe("GAG-2026-AB12CD");
    expect(parseBalanceReference("GAG-2027-XY23ZW-BZZ99ZZ")).toBe("GAG-2027-XY23ZW");
  });

  it("is null for a plain booking code or a malformed suffix", () => {
    expect(parseBalanceReference("GAG-2026-AB12CD")).toBeNull();
    expect(parseBalanceReference("GAG-2026-AB12CD-Bzz99zz")).toBeNull();
    expect(parseBalanceReference("GAG-2026-AB12CD-BZZ99Z")).toBeNull();
    expect(parseBalanceReference("refund:GAG-2026-AB12CD:123")).toBeNull();
  });
});

describe("balanceProblem", () => {
  const booking = (status: string, payment_status: string, total_amount = 1000) => ({ status, payment_status, total_amount });

  it("is null for a confirmed partial booking owing 500", () => {
    expect(balanceProblem(booking("confirmed", "partial"), 500)).toBeNull();
  });

  it("is null for a 'paid' booking whose total went up after a date change", () => {
    expect(balanceProblem(booking("confirmed", "paid", 3000), 2500)).toBeNull();
  });

  it("is null for an unpaid staff booking and for checked-in / checked-out stays", () => {
    expect(balanceProblem(booking("confirmed", "unpaid"), 0)).toBeNull();
    expect(balanceProblem(booking("checked_in", "partial"), 500)).toBeNull();
    expect(balanceProblem(booking("checked_out", "partial"), 500)).toBeNull();
  });

  it("says nothing is left to pay at a rounding remainder", () => {
    expect(balanceProblem(booking("confirmed", "partial"), 999.996)).toBe(NOTHING_LEFT);
    expect(balanceProblem(booking("confirmed", "paid"), 1000)).toBe(NOTHING_LEFT);
  });

  it("refuses pending, cancelled, no-show and refunded bookings", () => {
    expect(balanceProblem(booking("pending", "unpaid"), 0)).toBe(CANT_PAY);
    expect(balanceProblem(booking("cancelled", "partial"), 500)).toBe(CANT_PAY);
    expect(balanceProblem(booking("no_show", "partial"), 500)).toBe(CANT_PAY);
    expect(balanceProblem(booking("confirmed", "refunded"), 500)).toBe(CANT_PAY);
  });
});
