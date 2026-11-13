import { describe, expect, it } from "vitest";
import { findClashes, type ExternalStay } from "@/lib/airbnb/clashes";

const external = (over: Partial<ExternalStay> = {}): ExternalStay => ({
  id: "ext-1",
  room_id: "room-3",
  check_in: "2026-12-11",
  check_out: "2026-12-14",
  guest_name: "Ada",
  ...over,
});

const booking = (over: Record<string, unknown> = {}) => ({
  id: "b-1",
  booking_code: "GAG-2026-AAAAAA",
  guest_name: "Ama Mensah",
  room_id: "room-3" as string | null,
  check_in: "2026-12-10",
  check_out: "2026-12-13",
  status: "confirmed",
  payment_status: "paid",
  ...over,
});

const TODAY = "2026-12-01";

describe("findClashes", () => {
  it("flags a website booking that overlaps an Airbnb stay on the same room", () => {
    const out = findClashes([external()], [booking()], TODAY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ bookingId: "b-1", bookingCode: "GAG-2026-AAAAAA", externalId: "ext-1" });
    expect(out[0].detail).toContain("Ama Mensah");
  });

  it("back to back is not a clash", () => {
    const out = findClashes([external({ check_in: "2026-12-13", check_out: "2026-12-15" })], [booking()], TODAY);
    expect(out).toEqual([]);
  });

  it("different rooms do not clash", () => {
    expect(findClashes([external({ room_id: "room-4" })], [booking()], TODAY)).toEqual([]);
    expect(findClashes([external()], [booking({ room_id: null })], TODAY)).toEqual([]);
  });

  it("cancelled bookings and unpaid holds do not clash", () => {
    expect(findClashes([external()], [booking({ status: "cancelled" })], TODAY)).toEqual([]);
    expect(findClashes([external()], [booking({ status: "pending", payment_status: "unpaid" })], TODAY)).toEqual([]);
  });

  it("ignores stays that already ended", () => {
    const out = findClashes(
      [external({ check_in: "2026-11-01", check_out: "2026-11-05" })],
      [booking({ check_in: "2026-11-02", check_out: "2026-11-04" })],
      TODAY
    );
    expect(out).toEqual([]);
  });
});
