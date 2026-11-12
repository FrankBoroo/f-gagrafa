import { describe, expect, it } from "vitest";
import { balancesOwed, monthRange, occupancyByRoom, occupancyPercent, revenueByType, type MoneyBooking } from "@/lib/admin/money";

const TODAY = "2026-12-10";
let n = 0;

function booking(over: Partial<MoneyBooking> = {}): MoneyBooking {
  n += 1;
  return {
    id: `b-${n}`,
    booking_code: `GAG-2026-M${n}`,
    guest_name: `Guest ${n}`,
    unit_id: "unit-std",
    unit_name: "1-Bed Standard",
    room_id: "room-3",
    room_number: 3,
    check_in: "2026-12-12",
    check_out: "2026-12-15",
    status: "confirmed",
    payment_status: "partial",
    total_amount: 3000,
    net_paid: 1500,
    currency: "GHS",
    ...over,
  };
}

describe("balancesOwed", () => {
  it("lists a confirmed stay that still owes money, with the amount", () => {
    const owed = balancesOwed([booking({ id: "half" })], TODAY);
    expect(owed).toHaveLength(1);
    expect(owed[0]).toMatchObject({ id: "half", owed: 1500, overdue: false });
  });

  it("skips paid stays, cancelled bookings, unpaid holds and checked-out stays", () => {
    const owed = balancesOwed(
      [
        booking({ payment_status: "paid", net_paid: 3000 }),
        booking({ status: "cancelled" }),
        booking({ status: "no_show" }),
        booking({ status: "pending", payment_status: "unpaid", net_paid: 0 }),
        booking({ status: "checked_out" }),
      ],
      TODAY
    );
    expect(owed).toEqual([]);
  });

  it("orders by check-in, soonest first", () => {
    const owed = balancesOwed(
      [
        booking({ id: "late", check_in: "2026-12-20", check_out: "2026-12-23" }),
        booking({ id: "soon", check_in: "2026-12-11", check_out: "2026-12-14" }),
        booking({ id: "mid", check_in: "2026-12-15", check_out: "2026-12-18" }),
      ],
      TODAY
    );
    expect(owed.map((b) => b.id)).toEqual(["soon", "mid", "late"]);
  });

  it("marks a balance as overdue once the guest's check-in day has come", () => {
    const owed = balancesOwed(
      [
        booking({ id: "in-house", status: "checked_in", check_in: "2026-12-08", check_out: "2026-12-12" }),
        booking({ id: "arriving", check_in: TODAY, check_out: "2026-12-13" }),
      ],
      TODAY
    );
    expect(owed.map((b) => [b.id, b.overdue])).toEqual([["in-house", true], ["arriving", true]]);
  });

  it("is empty with no bookings", () => {
    expect(balancesOwed([], TODAY)).toEqual([]);
  });
});

describe("occupancyByRoom", () => {
  const rooms = [
    { id: "room-5", number: 5, unit_name: "1-Bed Standard" },
    { id: "room-3", number: 3, unit_name: "1-Bed Standard" },
  ];
  const range = { from: "2026-12-01", to: "2026-12-11" }; // 10 nights

  it("counts only the nights that fall inside the range", () => {
    // 4 nights, 29 Nov → 3 Dec: only the nights of 1 and 2 Dec are in range.
    const rows = occupancyByRoom({ rooms, bookings: [booking({ check_in: "2026-11-29", check_out: "2026-12-03" })], ...range });
    expect(rows.find((r) => r.roomId === "room-3")).toEqual({
      roomId: "room-3",
      label: "Room 3",
      unitName: "1-Bed Standard",
      nightsBooked: 2,
      nightsInRange: 10,
      percent: 20,
    });
  });

  it("gives a room with nothing booked 0%, and lists rooms in number order", () => {
    const rows = occupancyByRoom({ rooms, bookings: [booking({ check_in: "2026-12-02", check_out: "2026-12-05" })], ...range });
    expect(rows.map((r) => [r.label, r.nightsBooked, r.percent])).toEqual([["Room 3", 3, 30], ["Room 5", 0, 0]]);
  });

  it("doesn't count cancelled bookings, unpaid holds or stays outside the range", () => {
    const rows = occupancyByRoom({
      rooms,
      bookings: [
        booking({ status: "cancelled", check_in: "2026-12-02", check_out: "2026-12-05" }),
        booking({ status: "pending", payment_status: "unpaid", check_in: "2026-12-05", check_out: "2026-12-08" }),
        booking({ check_in: "2026-12-11", check_out: "2026-12-14" }),
        booking({ check_in: "2026-11-25", check_out: "2026-12-01" }),
      ],
      ...range,
    });
    expect(rows.every((r) => r.nightsBooked === 0)).toBe(true);
  });

  it("handles no rooms and an empty range", () => {
    expect(occupancyByRoom({ rooms: [], bookings: [booking()], ...range })).toEqual([]);
    const [row] = occupancyByRoom({ rooms: [rooms[1]], bookings: [booking()], from: "2026-12-01", to: "2026-12-01" });
    expect(row).toMatchObject({ nightsInRange: 0, percent: 0 });
  });
});

describe("revenueByType", () => {
  it("puts a stay of 30 nights under monthly and a short stay under nightly", () => {
    const rows = revenueByType([
      booking({ check_in: "2026-12-01", check_out: "2026-12-31", net_paid: 15000 }),
      booking({ check_in: "2026-12-12", check_out: "2026-12-15", net_paid: 1500 }),
      booking({ unit_id: "unit-pent", unit_name: "Penthouse", check_in: "2026-12-12", check_out: "2026-12-14", net_paid: 4000 }),
    ]);
    expect(rows).toEqual([
      { unitId: "unit-std", unitName: "1-Bed Standard", nightly: 1500, monthly: 15000, total: 16500 },
      { unitId: "unit-pent", unitName: "Penthouse", nightly: 4000, monthly: 0, total: 4000 },
    ]);
  });

  it("leaves out cancelled bookings and unpaid holds", () => {
    expect(
      revenueByType([booking({ status: "cancelled", net_paid: 500 }), booking({ status: "pending", payment_status: "unpaid", net_paid: 0 })])
    ).toEqual([]);
  });
});

describe("occupancyPercent", () => {
  it("is 0 when there are no rooms", () => {
    expect(occupancyPercent(3, 0)).toBe(0);
  });

  it("rounds to a whole percent", () => {
    expect(occupancyPercent(6, 13)).toBe(46);
    expect(occupancyPercent(13, 13)).toBe(100);
  });
});

describe("monthRange", () => {
  it("reads a month from the address", () => {
    expect(monthRange("2026-12", TODAY)).toEqual({
      year: 2026, month: 12, key: "2026-12", from: "2026-12-01", to: "2027-01-01", previous: "2026-11", next: "2027-01",
    });
  });

  it("falls back to the current month for anything unreadable", () => {
    for (const bad of [undefined, "", "2026-13", "2026-00", "december", "2026-1", "1999-12"]) {
      expect(monthRange(bad, TODAY).key).toBe("2026-12");
    }
  });

  it("steps back across a year", () => {
    expect(monthRange("2027-01", TODAY)).toMatchObject({ previous: "2026-12", next: "2027-02", from: "2027-01-01", to: "2027-02-01" });
  });
});
