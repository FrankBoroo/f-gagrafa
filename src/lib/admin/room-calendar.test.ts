import { describe, expect, it } from "vitest";
import { roomCalendarRows } from "@/lib/admin/room-calendar";

const TYPE_A = "type-a";
const TYPE_B = "type-b";
const rooms = [
  { id: "r5", number: 5, unit_id: TYPE_A, unit_name: "1-Bed Standard" },
  { id: "r3", number: 3, unit_id: TYPE_A, unit_name: "1-Bed Standard" },
  { id: "r1", number: 1, unit_id: TYPE_B, unit_name: "Studio" },
];

function booking(over: Record<string, unknown>) {
  return {
    id: "b1",
    booking_code: "GAG-2026-AAAAAA",
    guest_name: "Ama Mensah",
    room_id: "r3",
    room_confirmed: true,
    check_in: "2026-12-05",
    check_out: "2026-12-08",
    status: "confirmed",
    payment_status: "paid",
    ...over,
  };
}

const december = (over: Partial<Parameters<typeof roomCalendarRows>[0]> = {}) =>
  roomCalendarRows({ year: 2026, month: 12, rooms, bookings: [], blocks: [], external: [], ...over });

describe("roomCalendarRows", () => {
  it("gives one row per room, in room-number order", () => {
    expect(december().map((r) => r.label)).toEqual(["Room 1", "Room 3", "Room 5"]);
  });

  it("shows the nights of a stay, not the check-out day", () => {
    const [seg] = december({ bookings: [booking({})] }).find((r) => r.roomId === "r3")!.segments;
    expect(seg).toMatchObject({ kind: "booking", startDay: 5, endDay: 7, label: "Ama Mensah", confirmed: true });
    expect(seg.href).toBe("/admin/bookings?q=GAG-2026-AAAAAA");
  });

  it("clips a stay that started last month", () => {
    const [seg] = december({ bookings: [booking({ check_in: "2026-11-28", check_out: "2026-12-03" })] })[1].segments;
    expect([seg.startDay, seg.endDay]).toEqual([1, 2]);
  });

  it("clips a stay that runs into next month", () => {
    const [seg] = december({ bookings: [booking({ check_in: "2026-12-30", check_out: "2027-01-04" })] })[1].segments;
    expect([seg.startDay, seg.endDay]).toEqual([30, 31]);
  });

  it("leaves out stays outside the month", () => {
    expect(december({ bookings: [booking({ check_in: "2026-11-20", check_out: "2026-12-01" })] })[1].segments).toEqual([]);
  });

  it("marks an unpaid checkout as a hold", () => {
    const [seg] = december({ bookings: [booking({ status: "pending", payment_status: "unpaid" })] })[1].segments;
    expect(seg.kind).toBe("hold");
  });

  it("shows a block for the whole type on every room of that type only", () => {
    const rows = december({
      blocks: [{ id: "k1", unit_id: TYPE_A, room_id: null, start_date: "2026-12-24", end_date: "2026-12-27", reason: "Painting" }],
    });
    expect(rows.find((r) => r.roomId === "r3")!.segments).toMatchObject([{ kind: "block", startDay: 24, endDay: 26, label: "Painting", href: null }]);
    expect(rows.find((r) => r.roomId === "r5")!.segments).toHaveLength(1);
    expect(rows.find((r) => r.roomId === "r1")!.segments).toEqual([]);
  });

  it("labels a block without a reason", () => {
    const rows = december({
      blocks: [{ id: "k2", unit_id: TYPE_B, room_id: "r1", start_date: "2026-12-01", end_date: "2026-12-02", reason: null }],
    });
    expect(rows[0].segments[0]).toMatchObject({ label: "Blocked", startDay: 1, endDay: 1 });
  });

  it("returns nothing when there are no rooms", () => {
    expect(roomCalendarRows({ year: 2026, month: 12, rooms: [], bookings: [booking({})], blocks: [], external: [] })).toEqual([]);
  });

  it("shows an Airbnb stay on its room with the guest name, linking to the Airbnb list", () => {
    const rows = december({
      external: [{ id: "x1", room_id: "r3", check_in: "2026-12-10", check_out: "2026-12-12", guest_name: null }],
    });
    const [seg] = rows.find((r) => r.roomId === "r3")!.segments;
    expect(seg).toMatchObject({ kind: "airbnb", label: "Airbnb booking", startDay: 10, endDay: 11, href: "/admin/bookings/airbnb" });
    const named = december({
      external: [{ id: "x2", room_id: "r3", check_in: "2026-12-10", check_out: "2026-12-12", guest_name: "Ada" }],
    });
    expect(named.find((r) => r.roomId === "r3")!.segments[0].label).toBe("Ada");
  });
});
