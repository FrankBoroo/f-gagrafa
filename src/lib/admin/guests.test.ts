import { describe, expect, it } from "vitest";
import { groupGuests, netPaid } from "@/lib/admin/guests";

type Row = Parameters<typeof groupGuests>[0][number];
let n = 0;

function booking(over: Partial<Row> = {}): Row {
  n += 1;
  return {
    id: `b-${n}`,
    guest_name: "Ama Mensah",
    guest_email: "ama@example.com",
    guest_phone: "059 381 0182",
    check_in: "2026-12-10",
    status: "confirmed",
    currency: "GHS",
    net_paid: 1000,
    ...over,
  };
}

describe("groupGuests", () => {
  it("treats the same email in different case or with spaces as one guest", () => {
    const guests = groupGuests([
      booking({ guest_email: "Ama@Example.com" }),
      booking({ guest_email: "ama@example.com " }),
    ]);
    expect(guests).toHaveLength(1);
    expect(guests[0].key).toBe("ama@example.com");
    expect(guests[0].bookings).toBe(2);
  });

  it("doesn't count a cancelled booking or a no-show as a stay", () => {
    const [guest] = groupGuests([
      booking({ status: "checked_out" }),
      booking({ status: "cancelled" }),
      booking({ status: "no_show" }),
    ]);
    expect(guest.bookings).toBe(3);
    expect(guest.stays).toBe(1);
    expect(guest.isReturning).toBe(false);
  });

  it("marks a guest with two real stays as returning", () => {
    const [guest] = groupGuests([booking({ status: "checked_out" }), booking({ status: "confirmed" })]);
    expect(guest.stays).toBe(2);
    expect(guest.isReturning).toBe(true);
  });

  it("takes the name, phone and booking id from the latest check-in, whatever the row order", () => {
    const [guest] = groupGuests([
      booking({ id: "old", guest_name: "A. Mensah", guest_phone: "0200000000", check_in: "2026-01-05" }),
      booking({ id: "new", guest_name: "Ama Mensah-Osei", guest_phone: "0244444444", check_in: "2026-12-20" }),
      booking({ id: "mid", guest_name: "Ama M.", check_in: "2026-06-01" }),
    ]);
    expect(guest.guest_name).toBe("Ama Mensah-Osei");
    expect(guest.guest_phone).toBe("0244444444");
    expect(guest.latestBookingId).toBe("new");
    expect(guest.lastStay).toBe("2026-12-20");
  });

  it("adds up what was paid net of refunds", () => {
    const [guest] = groupGuests([booking({ net_paid: 1200.5 }), booking({ net_paid: 0 }), booking({ net_paid: 300 })]);
    expect(guest.totalPaid).toBe(1500.5);
    expect(guest.currency).toBe("GHS");
  });

  it("lists the most recent guest first", () => {
    const guests = groupGuests([
      booking({ guest_email: "kofi@example.com", check_in: "2026-03-01" }),
      booking({ guest_email: "ama@example.com", check_in: "2026-12-01" }),
      booking({ guest_email: "esi@example.com", check_in: "2026-08-01" }),
    ]);
    expect(guests.map((g) => g.key)).toEqual(["ama@example.com", "esi@example.com", "kofi@example.com"]);
  });

  it("returns nothing for no bookings", () => {
    expect(groupGuests([])).toEqual([]);
  });
});

describe("netPaid", () => {
  it("adds successful payments and subtracts refunds, ignoring pending and failed ones", () => {
    expect(
      netPaid([
        { amount: 1000, status: "success" },
        { amount: -400, status: "refunded" },
        { amount: 500, status: "pending" },
        { amount: 500, status: "failed" },
      ])
    ).toBe(600);
  });

  it("is 0 with no payments", () => {
    expect(netPaid([])).toBe(0);
    expect(netPaid(null)).toBe(0);
  });
});
