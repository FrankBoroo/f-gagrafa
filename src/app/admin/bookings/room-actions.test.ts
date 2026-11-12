import { beforeEach, describe, expect, it, vi } from "vitest";

const BOOKING_ID = "00000000-0000-0000-0000-0000000000b1";
const UNIT_ID = "00000000-0000-0000-0000-00000000000a";
const ROOM_2 = "00000000-0000-0000-0000-000000000102";
const ROOM_8 = "00000000-0000-0000-0000-000000000108";

const mocks = vi.hoisted(() => ({
  isStaff: vi.fn(),
  freeRooms: vi.fn(),
  specialsForStay: vi.fn(),
  booking: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  updateError: null as { code?: string; message?: string } | null,
}));

class FakeQuery {
  private pendingUpdate = false;
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  limit() { return this; }
  update(payload: Record<string, unknown>) {
    mocks.updates.push(payload);
    this.pendingUpdate = true;
    return this;
  }
  insert(payload: Record<string, unknown>) {
    mocks.inserts.push(payload);
    return this;
  }
  maybeSingle() {
    if (this.table === "property_settings") return Promise.resolve({ data: { price_currency: "GHS" }, error: null });
    return Promise.resolve({ data: mocks.booking, error: null });
  }
  single() {
    if (this.table === "units") {
      return Promise.resolve({ data: { id: UNIT_ID, name: "1-Bed Executive", base_price_per_night: 200, monthly_price: 2000 }, error: null });
    }
    return Promise.resolve({ data: { id: "new-booking" }, error: null });
  }
  then(resolve: (v: { data: null; error: unknown }) => unknown) {
    // Awaiting an update (no .single()) resolves here.
    return Promise.resolve({ data: null, error: this.pendingUpdate ? mocks.updateError : null }).then(resolve);
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/notify/email", () => ({ sendBookingCancelledEmail: vi.fn(), sendBookingChangedEmail: vi.fn() }));
vi.mock("@/lib/payments/paystack", () => ({ refundPaystackTransaction: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  isStaff: mocks.isStaff,
  isAdmin: vi.fn(),
  UNAUTHORIZED: { ok: false, error: "Unauthorized" },
}));
vi.mock("@/lib/booking/rooms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/booking/rooms")>()),
  freeRoomsForType: mocks.freeRooms,
}));
vi.mock("@/lib/booking/special-prices-db", () => ({ specialsForStay: mocks.specialsForStay }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => new FakeQuery(table),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

const { changeRoom, confirmRoom, createManualBooking } = await import("@/app/admin/bookings/actions");

const liveBooking = {
  id: BOOKING_ID,
  booking_code: "GAG-2026-TEST01",
  unit_id: UNIT_ID,
  room_id: ROOM_2,
  room_confirmed: false,
  check_in: "2026-12-10",
  check_out: "2026-12-13",
  status: "confirmed",
  payment_status: "partial",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isStaff.mockResolvedValue(true);
  mocks.freeRooms.mockResolvedValue([{ id: ROOM_2, number: 2 }, { id: ROOM_8, number: 8 }]);
  mocks.specialsForStay.mockResolvedValue([]);
  mocks.booking = { ...liveBooking };
  mocks.updates = [];
  mocks.inserts = [];
  mocks.updateError = null;
});

describe("changeRoom", () => {
  it("returns UNAUTHORIZED for someone who isn't staff and writes nothing", async () => {
    mocks.isStaff.mockResolvedValue(false);
    expect(await changeRoom({ bookingId: BOOKING_ID, roomId: ROOM_8 })).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.updates).toEqual([]);
  });

  it("refuses a room that isn't free for the whole stay", async () => {
    mocks.freeRooms.mockResolvedValue([{ id: ROOM_2, number: 2 }]);
    const result = await changeRoom({ bookingId: BOOKING_ID, roomId: ROOM_8 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/isn't free for the whole stay/);
    expect(mocks.updates).toEqual([]);
  });

  it("says the room was just booked when the overlap guard fires", async () => {
    mocks.updateError = { code: "23P01" };
    expect(await changeRoom({ bookingId: BOOKING_ID, roomId: ROOM_8 })).toEqual({
      ok: false,
      error: "That room was just booked. Pick another.",
    });
  });

  it("moves the booking and confirms the room in one update", async () => {
    expect(await changeRoom({ bookingId: BOOKING_ID, roomId: ROOM_8 })).toEqual({ ok: true });
    expect(mocks.updates).toEqual([{ room_id: ROOM_8, room_confirmed: true }]);
  });
});

describe("confirmRoom", () => {
  it("refuses a cancelled booking", async () => {
    mocks.booking = { ...liveBooking, status: "cancelled" };
    const result = await confirmRoom(BOOKING_ID);
    expect(result).toEqual({ ok: false, error: "This booking is closed, so its room can't change." });
    expect(mocks.updates).toEqual([]);
  });

  it("confirms the pencilled-in room", async () => {
    expect(await confirmRoom(BOOKING_ID)).toEqual({ ok: true });
    expect(mocks.updates).toEqual([{ room_confirmed: true }]);
  });
});

describe("createManualBooking with a chosen room", () => {
  const input = {
    unit_id: UNIT_ID,
    room_id: ROOM_8,
    check_in: "2026-12-10",
    check_out: "2026-12-13",
    adults: 2,
    children: 0,
    mark_as_paid: false,
    guest_name: "Test Guest",
    guest_email: "test.guest@example.com",
    guest_phone: "+233200000001",
  };

  it("refuses a room that isn't free and inserts nothing", async () => {
    mocks.freeRooms.mockResolvedValue([{ id: ROOM_2, number: 2 }]);
    const result = await createManualBooking(input);
    expect(result).toEqual({ ok: false, error: "That room isn't free for these dates." });
    expect(mocks.inserts).toEqual([]);
  });

  it("books the chosen room as confirmed", async () => {
    await createManualBooking(input);
    expect(mocks.inserts[0]).toMatchObject({ room_id: ROOM_8, room_confirmed: true });
  });

  it("prices the stay with special prices but isn't held to their minimum nights", async () => {
    mocks.specialsForStay.mockResolvedValue([
      { start_date: "2026-12-11", end_date: "2026-12-12", nightly_price: 300, min_nights: 7 },
    ]);
    await createManualBooking(input);
    expect(mocks.inserts[0]).toMatchObject({ total_amount: 700 });
  });

  it("doesn't create the booking when the special prices can't be read", async () => {
    mocks.specialsForStay.mockResolvedValue(null);
    const result = await createManualBooking(input);
    expect(result.ok).toBe(false);
    expect(mocks.inserts).toEqual([]);
  });
});
