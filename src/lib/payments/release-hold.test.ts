import { beforeEach, describe, expect, it, vi } from "vitest";

// Stand-in for the Supabase query builder: answers the booking read from `db.booking`,
// records the update with its filters, and returns `db.updated` for it.
interface Update {
  payload: Record<string, unknown>;
  filters: Record<string, unknown>;
}

const mocks = vi.hoisted(() => ({
  db: {} as {
    booking: Record<string, unknown> | null;
    updated: { id: string } | null;
    updateError: { code: string; message: string } | null;
    updates: Update[];
  },
  verify: vi.fn(),
}));

class FakeQuery {
  private op: "select" | "update" = "select";
  private payload: Record<string, unknown> = {};
  private filters: Record<string, unknown> = {};
  select() { return this; }
  eq(column: string, value: unknown) { this.filters[column] = value; return this; }
  single() { return this; }
  maybeSingle() { return this; }
  update(payload: Record<string, unknown>) { this.op = "update"; this.payload = payload; return this; }
  then<T>(resolve: (value: { data: unknown; error: unknown }) => T) {
    const { db } = mocks;
    if (this.op === "select") return Promise.resolve({ data: db.booking, error: null }).then(resolve);
    db.updates.push({ payload: this.payload, filters: this.filters });
    return Promise.resolve({ data: db.updateError ? null : db.updated, error: db.updateError }).then(resolve);
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: () => new FakeQuery() }),
}));
vi.mock("@/lib/payments/paystack", () => ({ verifyPaystackTransaction: mocks.verify }));

const { isReleasableStatus, rebookHref, releaseUnpaidHold, RELEASED_NOTE } = await import("@/lib/payments/release-hold");

const REF = "GAG-2026-ABCDEF";

function pendingBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    booking_code: REF,
    status: "pending",
    payment_status: "unpaid",
    cancelled_at: null,
    admin_notes: null,
    check_in: "2027-03-01",
    check_out: "2027-03-04",
    adults: 2,
    children: 1,
    units: { name: "Studio Suite", slug: "studio-suite" },
    ...overrides,
  };
}

beforeEach(() => {
  mocks.db = { booking: pendingBooking(), updated: { id: "booking-1" }, updateError: null, updates: [] };
  mocks.verify.mockReset();
  mocks.verify.mockResolvedValue({ status: "abandoned", amount: 0, currency: "GHS" });
});

describe("isReleasableStatus", () => {
  it("releases only when Paystack says nothing was or will be paid", () => {
    expect(isReleasableStatus("abandoned")).toBe(true);
    expect(isReleasableStatus("failed")).toBe(true);
    for (const status of ["success", "ongoing", "pending", "processing", "queued", "reversed", "", null, undefined]) {
      expect(isReleasableStatus(status)).toBe(false);
    }
  });
});

describe("releaseUnpaidHold", () => {
  it("cancels an abandoned unpaid hold like the 30-minute expiry (no cancelled_at)", async () => {
    const result = await releaseUnpaidHold(REF);
    expect(result.outcome).toBe("released");
    expect(mocks.db.updates).toHaveLength(1);
    const [{ payload, filters }] = mocks.db.updates;
    expect(payload).toEqual({ status: "cancelled", admin_notes: RELEASED_NOTE });
    expect(payload).not.toHaveProperty("cancelled_at");
    // Compare-and-set, so a payment the webhook recorded a moment ago is never undone.
    expect(filters).toEqual({ id: "booking-1", status: "pending", payment_status: "unpaid" });
  });

  it("keeps existing admin notes", async () => {
    mocks.db.booking = pendingBooking({ admin_notes: "VIP guest" });
    await releaseUnpaidHold(REF);
    expect(mocks.db.updates[0].payload.admin_notes).toBe(`VIP guest\n${RELEASED_NOTE}`);
  });

  it("releases after a failed payment", async () => {
    mocks.verify.mockResolvedValue({ status: "failed", amount: 0, currency: "GHS" });
    expect((await releaseUnpaidHold(REF)).outcome).toBe("released");
  });

  it("keeps the hold while a payment may still complete", async () => {
    for (const status of ["ongoing", "pending", "success"]) {
      mocks.verify.mockResolvedValue({ status, amount: 240000, currency: "GHS" });
      expect((await releaseUnpaidHold(REF)).outcome).toBe("kept");
    }
    expect(mocks.db.updates).toHaveLength(0);
  });

  it("keeps the hold when Paystack can't be reached", async () => {
    mocks.verify.mockRejectedValue(new Error("network down"));
    expect((await releaseUnpaidHold(REF)).outcome).toBe("kept");
    expect(mocks.db.updates).toHaveLength(0);
  });

  it("never touches paid, cancelled or unknown bookings", async () => {
    const cases = [
      null,
      pendingBooking({ payment_status: "paid", status: "confirmed" }),
      pendingBooking({ payment_status: "partial" }),
      pendingBooking({ status: "cancelled" }),
      pendingBooking({ cancelled_at: "2027-01-01T10:00:00Z" }),
    ];
    for (const booking of cases) {
      mocks.db.booking = booking;
      expect((await releaseUnpaidHold(REF)).outcome).toBe("not_held");
    }
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.db.updates).toHaveLength(0);
  });

  it("reports not_held when the webhook confirmed it first (no row matched)", async () => {
    mocks.db.updated = null;
    expect((await releaseUnpaidHold(REF)).outcome).toBe("not_held");
  });

  it("keeps the hold when the update fails", async () => {
    mocks.db.updateError = { code: "XX000", message: "boom" };
    expect((await releaseUnpaidHold(REF)).outcome).toBe("kept");
  });
});

describe("rebookHref", () => {
  it("prefills residence, dates and guests", () => {
    expect(rebookHref(pendingBooking())).toBe(
      "/booking?unit=studio-suite&checkIn=2027-03-01&checkOut=2027-03-04&guests=3"
    );
  });
  it("falls back to the plain booking page", () => {
    expect(rebookHref(null)).toBe("/booking");
    expect(rebookHref({ check_in: "2027-03-01" })).toBe("/booking");
  });
});
