import { describe, expect, it } from "vitest";
import type { ExternalStay } from "@/lib/airbnb/clashes";
import { balanceOwed, buildToday, countsAsStay, roomStatus, type TodayBooking, type TodayRoom } from "@/lib/admin/today";

const TODAY = "2026-12-10";
let n = 0;

function room(number: number, last_cleaned_at: string | null = null): TodayRoom {
  return { id: `room-${number}`, number, unit_name: "1-Bed Standard", last_cleaned_at };
}

function stay(over: Partial<TodayBooking> = {}): TodayBooking {
  n += 1;
  return {
    id: `b-${n}`,
    booking_code: `GAG-2026-T${n}`,
    guest_name: `Guest ${n}`,
    unit_name: "1-Bed Standard",
    room_id: "room-3",
    room_number: 3,
    room_confirmed: true,
    check_in: "2026-12-08",
    check_out: "2026-12-12",
    status: "confirmed",
    payment_status: "paid",
    total_amount: 3480,
    net_paid: 3480,
    currency: "GHS",
    admin_notes: null,
    attention_cleared_at: null,
    ...over,
  };
}

describe("roomStatus", () => {
  it("a room whose guest left today and wasn't cleaned needs cleaning", () => {
    expect(roomStatus(room(3), [stay({ check_in: "2026-12-07", check_out: TODAY })], TODAY)).toBe("needs_cleaning");
  });

  it("cleaning after 11 AM on the check-out day makes the room free", () => {
    const left = [stay({ check_in: "2026-12-07", check_out: TODAY })];
    expect(roomStatus(room(3, "2026-12-10T11:30:00Z"), left, TODAY)).toBe("free");
    expect(roomStatus(room(3, "2026-12-10T10:00:00Z"), left, TODAY)).toBe("needs_cleaning");
  });

  it("a clean room with an arrival today is ready", () => {
    expect(roomStatus(room(3), [stay({ check_in: TODAY, check_out: "2026-12-13" })], TODAY)).toBe("ready");
  });

  it("an arrival today in a room nobody cleaned after the last guest needs cleaning first", () => {
    const stays = [stay({ check_in: "2026-12-07", check_out: TODAY }), stay({ check_in: TODAY, check_out: "2026-12-13" })];
    expect(roomStatus(room(3), stays, TODAY)).toBe("needs_cleaning");
  });

  it("a staying guest makes the room occupied even if it was never cleaned", () => {
    const stays = [stay({ check_in: "2026-12-01", check_out: "2026-12-05" }), stay({ check_in: "2026-12-08", check_out: "2026-12-12" })];
    expect(roomStatus(room(3), stays, TODAY)).toBe("occupied");
  });

  it("a guest who checked in today is occupied", () => {
    expect(roomStatus(room(3), [stay({ check_in: TODAY, check_out: "2026-12-13", status: "checked_in" })], TODAY)).toBe("occupied");
  });

  it("a room with nothing is free", () => {
    expect(roomStatus(room(3), [], TODAY)).toBe("free");
  });
});

describe("countsAsStay and balanceOwed", () => {
  it("an unpaid pending hold is not a stay, a paid pending one is", () => {
    expect(countsAsStay({ status: "pending", payment_status: "unpaid" })).toBe(false);
    expect(countsAsStay({ status: "pending", payment_status: "partial" })).toBe(true);
    expect(countsAsStay({ status: "cancelled", payment_status: "paid" })).toBe(false);
  });

  it("owes what is left, never below zero", () => {
    expect(balanceOwed({ total_amount: 3480, net_paid: 1740 })).toBe(1740);
    expect(balanceOwed({ total_amount: 100, net_paid: 150 })).toBe(0);
  });
});

describe("buildToday", () => {
  const rooms = [room(1), room(2), room(3)];
  const base = { today: TODAY, rooms, cancellationRequests: [], external: [] as ExternalStay[] };

  it("an unpaid pending hold counts nowhere", () => {
    const hold = stay({ status: "pending", payment_status: "unpaid", net_paid: 0, check_in: TODAY, room_confirmed: false });
    const view = buildToday({ ...base, bookings: [hold] });
    expect(view.arriving).toEqual([]);
    expect(view.occupiedTonight).toBe(0);
    expect(view.attention).toEqual([]);
    expect(view.balancesOwed).toBe(0);
  });

  it("lists arrivals and departures", () => {
    const arriving = stay({ check_in: TODAY, check_out: "2026-12-13" });
    const leaving = stay({ check_in: "2026-12-07", check_out: TODAY, room_id: "room-1", room_number: 1 });
    const view = buildToday({ ...base, bookings: [arriving, leaving] });
    expect(view.arriving.map((b) => b.id)).toEqual([arriving.id]);
    expect(view.leaving.map((b) => b.id)).toEqual([leaving.id]);
  });

  it("occupied tonight counts rooms, not bookings, and the room count comes from the rooms given", () => {
    const a = stay({ room_id: "room-1", room_number: 1 });
    const b = stay({ room_id: "room-2", room_number: 2, check_in: TODAY, check_out: "2026-12-11" });
    const leftToday = stay({ room_id: "room-3", room_number: 3, check_in: "2026-12-07", check_out: TODAY });
    const view = buildToday({ ...base, bookings: [a, b, leftToday] });
    expect(view.occupiedTonight).toBe(2);
    expect(view.roomCount).toBe(3);
  });

  it("balances owed sums what's left on current and future stays", () => {
    const owes = stay({ net_paid: 1740 });
    const paid = stay();
    const gone = stay({ status: "checked_out", net_paid: 0, check_out: "2026-12-12" });
    expect(buildToday({ ...base, bookings: [owes, paid, gone] }).balancesOwed).toBe(1740);
  });

  it("a pencilled-in room shows as room to confirm", () => {
    const b = stay({ room_confirmed: false, room_number: 8, check_in: "2026-12-20", check_out: "2026-12-23" });
    const [item] = buildToday({ ...base, bookings: [b] }).attention;
    expect(item).toMatchObject({ kind: "room_to_confirm", bookingId: b.id, bookingCode: b.booking_code });
    expect(item?.detail).toContain("20 Dec 2026 → 23 Dec 2026");
  });

  it("a mismatch note shows until attention is cleared", () => {
    const note = "PAYMENT MISMATCH (amount_mismatch): expected GHS 1740, Paystack reported GHS 17.4.";
    const flagged = stay({ admin_notes: note });
    expect(buildToday({ ...base, bookings: [flagged] }).attention[0]?.kind).toBe("payment_mismatch");
    const cleared = { ...flagged, attention_cleared_at: "2026-12-10T09:00:00Z" };
    expect(buildToday({ ...base, bookings: [cleared] }).attention).toEqual([]);
  });

  it("paid after cancellation shows on a cancelled booking", () => {
    const b = stay({ status: "cancelled", admin_notes: "PAID AFTER CANCELLATION — the booking was cancelled before this payment arrived." });
    expect(buildToday({ ...base, bookings: [b] }).attention.map((i) => i.kind)).toEqual(["paid_after_cancellation"]);
  });

  it("balance payment flags show: overpaid, mismatch and paid after cancellation", () => {
    const overpaid = stay({ admin_notes: "OVERPAID: refund GH₵1,000 (balance payment GAG-2026-AB12CD-BZZ99ZZ ...)." });
    const mismatch = stay({ admin_notes: "BALANCE PAYMENT MISMATCH (GAG-2026-AB12CD-BZZ99ZZ): expected GHS 500, Paystack reported GHS 400." });
    const late = stay({ status: "cancelled", admin_notes: "PAID AFTER CANCELLATION (balance): GH₵500 arrived after the booking was closed." });
    const kinds = (b: TodayBooking) => buildToday({ ...base, bookings: [b] }).attention.map((i) => i.kind);
    expect(kinds(overpaid)).toEqual(["payment_review"]);
    expect(kinds(mismatch)).toEqual(["payment_mismatch"]);
    expect(kinds(late)).toEqual(["paid_after_cancellation"]);
  });

  it("a cancellation request shows", () => {
    const view = buildToday({
      ...base,
      bookings: [],
      cancellationRequests: [{ bookingId: "b-x", bookingCode: "GAG-2026-XX", createdAt: "2026-12-09T10:00:00Z" }],
    });
    expect(view.attention).toMatchObject([{ kind: "cancellation_request", bookingCode: "GAG-2026-XX" }]);
  });

  it("orders attention: rooms to confirm, then payments, then cancellation requests", () => {
    const pencilled = stay({ room_confirmed: false });
    const review = stay({ admin_notes: "PAID AFTER HOLD EXPIRED — the dates were re-booked." });
    const view = buildToday({
      ...base,
      bookings: [review, pencilled],
      cancellationRequests: [{ bookingId: "b-y", bookingCode: "GAG-2026-YY", createdAt: "2026-12-09T10:00:00Z" }],
    });
    expect(view.attention.map((i) => i.kind)).toEqual(["room_to_confirm", "payment_review", "cancellation_request"]);
  });

  it("empty data renders an empty view", () => {
    expect(buildToday({ today: TODAY, bookings: [], rooms: [], cancellationRequests: [], external: [] })).toEqual({
      arriving: [],
      leaving: [],
      externalArriving: [],
      externalLeaving: [],
      occupiedTonight: 0,
      roomCount: 0,
      balancesOwed: 0,
      attention: [],
      rooms: [],
    });
  });

  it("gives each room its status, in room-number order", () => {
    const view = buildToday({ ...base, rooms: [room(3), room(1)], bookings: [stay({ room_id: "room-3", room_number: 3 })] });
    expect(view.rooms.map((r) => [r.room.number, r.status])).toEqual([[1, "free"], [3, "occupied"]]);
  });

  describe("Airbnb stays", () => {
    const ext = (over: Partial<ExternalStay> = {}): ExternalStay => ({
      id: "ext-1",
      room_id: "room-2",
      check_in: "2026-12-09",
      check_out: "2026-12-12",
      guest_name: null,
      ...over,
    });

    it("an Airbnb stay in progress makes the room occupied and is in neither list", () => {
      const view = buildToday({ ...base, bookings: [], external: [ext()] });
      expect(view.rooms.find((r) => r.room.id === "room-2")!.status).toBe("occupied");
      expect(view.occupiedTonight).toBe(1);
      expect(view.externalArriving).toEqual([]);
      expect(view.externalLeaving).toEqual([]);
    });

    it("lists Airbnb arrivals and departures apart from website ones", () => {
      const arriving = ext({ id: "a", check_in: TODAY, check_out: "2026-12-13" });
      const leaving = ext({ id: "l", room_id: "room-1", check_in: "2026-12-07", check_out: TODAY });
      const view = buildToday({ ...base, bookings: [], external: [arriving, leaving] });
      expect(view.externalArriving.map((e) => e.id)).toEqual(["a"]);
      expect(view.externalLeaving.map((e) => e.id)).toEqual(["l"]);
      expect(view.arriving).toEqual([]);
      expect(view.leaving).toEqual([]);
    });

    it("needs cleaning on the Airbnb check-out day when not cleaned since", () => {
      const view = buildToday({ ...base, today: "2026-12-12", bookings: [], external: [ext()] });
      expect(view.rooms.find((r) => r.room.id === "room-2")!.status).toBe("needs_cleaning");
      expect(view.externalLeaving.map((e) => e.id)).toEqual(["ext-1"]);
    });

    it("puts a clash with a website booking in Needs attention", () => {
      const b = stay({ room_id: "room-2", room_number: 2, check_in: "2026-12-11", check_out: "2026-12-14" });
      const view = buildToday({ ...base, bookings: [b], external: [ext()] });
      const item = view.attention.find((a) => a.kind === "airbnb_clash");
      expect(item).toMatchObject({ title: "Airbnb booking clash", bookingId: b.id, bookingCode: b.booking_code });
    });
  });
});
