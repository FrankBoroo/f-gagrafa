import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpecialPrice } from "@/lib/booking/special-prices";

const UNIT_ID = "00000000-0000-0000-0000-00000000000a";
const ROOM_3 = "00000000-0000-0000-0000-000000000103";

const mocks = vi.hoisted(() => ({
  freeRooms: vi.fn(),
  specialsForStay: vi.fn(),
  specialsByUnitForStay: vi.fn(),
  initPaystack: vi.fn(),
  syncRooms: vi.fn(),
  inserts: [] as Record<string, unknown>[],
}));

class FakeQuery {
  private payload: Record<string, unknown> | null = null;
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  limit() { return this; }
  update() { return this; }
  insert(payload: Record<string, unknown>) {
    mocks.inserts.push(payload);
    this.payload = payload;
    return this;
  }
  maybeSingle() {
    return Promise.resolve({ data: { price_currency: "GHS", deposit_percent: 50 }, error: null });
  }
  single() {
    if (this.table === "units") {
      return Promise.resolve({
        data: { id: UNIT_ID, name: "1-Bed Standard", base_price_per_night: 170, monthly_price: null, is_active: true, max_guests: 4 },
        error: null,
      });
    }
    return Promise.resolve({ data: { id: "new-booking", ...this.payload }, error: null });
  }
  then(resolve: (v: { data: unknown; error: null }) => unknown) {
    // The list of active types, awaited without .single().
    return Promise.resolve({ data: this.table === "units" ? [{ id: UNIT_ID }] : null, error: null }).then(resolve);
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => new FakeQuery(table) }),
}));
vi.mock("@/lib/booking/rooms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/booking/rooms")>()),
  freeRoomsForType: mocks.freeRooms,
}));
vi.mock("@/lib/booking/special-prices-db", () => ({
  specialsForStay: mocks.specialsForStay,
  specialsByUnitForStay: mocks.specialsByUnitForStay,
}));
vi.mock("@/lib/airbnb/sync", () => ({ syncRooms: mocks.syncRooms }));
vi.mock("@/lib/booking/availability", () => ({ releaseStaleHolds: vi.fn() }));
vi.mock("@/lib/payments/paystack", () => ({ initializePaystackTransaction: mocks.initPaystack }));
vi.mock("@/lib/notify/email", () => ({ sendAdminNewBookingNotification: vi.fn(), sendAdminSystemAlert: vi.fn() }));
vi.mock("@/lib/booking/promo", () => ({ checkPromoCode: vi.fn(), claimPromoUse: vi.fn(), releasePromoUse: vi.fn() }));
vi.mock("@/lib/booking/free-booking", () => ({
  checkFreeStay: (total: number, promo: string | null) => (total > 0 ? "charge" : promo ? "free" : "invalid"),
  freeStayNote: vi.fn(),
  sendFreeStayConfirmations: vi.fn(),
}));
vi.mock("@/lib/spam-protection", () => ({
  isHoneypotTripped: () => false,
  isSubmittedTooFast: () => false,
  isRateLimited: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/rate-limit", () => ({ isOverLimit: vi.fn().mockResolvedValue(false), RATE_LIMITED_MESSAGE: "Too many requests" }));
vi.mock("@/lib/checkout-session", () => ({ rememberCheckout: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/env", () => ({ siteUrl: () => "https://example.test" }));

const { checkUnitsAvailability, createBookingAndInitializePayment } = await import("@/app/booking/actions");

const input = {
  unit_id: UNIT_ID,
  check_in: "2026-12-23",
  check_out: "2026-12-26",
  adults: 2,
  children: 0,
  payment_option: "full" as const,
  guest_name: "Test Guest",
  guest_email: "test.guest@example.com",
  guest_phone: "+233200000001",
};

const christmas: SpecialPrice = { start_date: "2026-12-24", end_date: "2026-12-27", nightly_price: 250, min_nights: null };
const fiveNights: SpecialPrice = { start_date: "2026-12-20", end_date: "2026-12-28", nightly_price: null, min_nights: 5 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inserts = [];
  mocks.freeRooms.mockResolvedValue([{ id: ROOM_3, number: 3 }]);
  mocks.specialsForStay.mockResolvedValue([]);
  mocks.specialsByUnitForStay.mockResolvedValue({});
  mocks.initPaystack.mockResolvedValue({ authorization_url: "https://paystack.test/pay" });
  mocks.syncRooms.mockResolvedValue({ synced: 1, failed: 0 });
});

describe("createBookingAndInitializePayment with special prices", () => {
  it("charges the ordinary price when no special covers the stay", async () => {
    expect((await createBookingAndInitializePayment(input)).ok).toBe(true);
    expect(mocks.inserts[0]).toMatchObject({ total_amount: 510 });
    expect(mocks.initPaystack).toHaveBeenCalledWith(expect.objectContaining({ amountInMajorUnits: 510 }));
  });

  it("charges the special price on the nights it covers", async () => {
    mocks.specialsForStay.mockResolvedValue([christmas]);
    expect((await createBookingAndInitializePayment(input)).ok).toBe(true);
    expect(mocks.inserts[0]).toMatchObject({ total_amount: 670 });
    expect(mocks.initPaystack).toHaveBeenCalledWith(expect.objectContaining({ amountInMajorUnits: 670 }));
  });

  it("takes the down payment from the special-price total", async () => {
    mocks.specialsForStay.mockResolvedValue([christmas]);
    await createBookingAndInitializePayment({ ...input, payment_option: "deposit" });
    expect(mocks.inserts[0]).toMatchObject({ total_amount: 670, deposit_amount: 335 });
    expect(mocks.initPaystack).toHaveBeenCalledWith(expect.objectContaining({ amountInMajorUnits: 335 }));
  });

  it("refuses a stay shorter than the minimum nights before anything is saved", async () => {
    mocks.specialsForStay.mockResolvedValue([fiveNights]);
    expect(await createBookingAndInitializePayment(input)).toEqual({
      ok: false,
      error: "These dates need a stay of at least 5 nights.",
    });
    expect(mocks.inserts).toEqual([]);
    expect(mocks.initPaystack).not.toHaveBeenCalled();
  });

  it("refuses to book when the special prices can't be read, so nobody is undercharged", async () => {
    mocks.specialsForStay.mockResolvedValue(null);
    const result = await createBookingAndInitializePayment(input);
    expect(result.ok).toBe(false);
    expect(mocks.inserts).toEqual([]);
    expect(mocks.initPaystack).not.toHaveBeenCalled();
  });
});

describe("checkUnitsAvailability with minimum nights", () => {
  it("marks a type unavailable and says how many nights the dates need", async () => {
    mocks.specialsByUnitForStay.mockResolvedValue({ [UNIT_ID]: [fiveNights] });
    expect(await checkUnitsAvailability("2026-12-23", "2026-12-26")).toEqual({
      ok: true,
      availability: { [UNIT_ID]: false },
      minNights: { [UNIT_ID]: 5 },
    });
  });

  it("leaves a type available when the stay is long enough", async () => {
    mocks.specialsByUnitForStay.mockResolvedValue({ [UNIT_ID]: [fiveNights] });
    const result = await checkUnitsAvailability("2026-12-22", "2026-12-27");
    expect(result).toMatchObject({ ok: true, availability: { [UNIT_ID]: true }, minNights: { [UNIT_ID]: null } });
  });

  it("has no minimum when no special covers the dates", async () => {
    expect(await checkUnitsAvailability("2026-12-23", "2026-12-26")).toEqual({
      ok: true,
      availability: { [UNIT_ID]: true },
      minNights: { [UNIT_ID]: null },
    });
  });
});

describe("createBookingAndInitializePayment Airbnb refresh", () => {
  it("refreshes this type's calendars shortly before picking a room", async () => {
    await createBookingAndInitializePayment(input);
    expect(mocks.syncRooms).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ unitId: UNIT_ID, olderThanMinutes: 15, timeoutMs: 3000, skipFailing: true }),
    );
  });

  it("still books when the refresh throws", async () => {
    mocks.syncRooms.mockRejectedValue(new Error("boom"));
    expect((await createBookingAndInitializePayment(input)).ok).toBe(true);
    expect(mocks.inserts[0]).toMatchObject({ total_amount: 510 });
  });

  it("still books when the refresh never settles", async () => {
    vi.useFakeTimers();
    try {
      mocks.syncRooms.mockReturnValue(new Promise(() => {}));
      const pending = createBookingAndInitializePayment(input);
      await vi.advanceTimersByTimeAsync(3100);
      expect((await pending).ok).toBe(true);
      expect(mocks.inserts[0]).toMatchObject({ total_amount: 510 });
    } finally {
      vi.useRealTimers();
    }
  });
});
