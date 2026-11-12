import { beforeEach, describe, expect, it, vi } from "vitest";

// cancelBookingWithRefund with Paystack refunds split across a booking's Paystack payments.
const BOOKING_ID = "00000000-0000-0000-0000-0000000000c1";
const CODE = "GAG-2026-REFUND";
const BAL = `${CODE}-BZZ99ZZ`;

const mocks = vi.hoisted(() => ({
  booking: null as Record<string, unknown> | null,
  payments: [] as Record<string, unknown>[],
  inserts: [] as unknown[],
  bookingUpdates: [] as Record<string, unknown>[],
  refund: vi.fn(),
  sendCancelled: vi.fn(),
}));

class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  insert(payload: unknown) { this.op = "insert"; mocks.inserts.push(payload); return this; }
  update(payload: Record<string, unknown>) { this.op = "update"; if (this.table === "bookings") mocks.bookingUpdates.push(payload); return this; }
  maybeSingle() { return Promise.resolve({ data: mocks.booking, error: null }); }
  single() { return Promise.resolve({ data: mocks.booking, error: null }); }
  then<T>(resolve: (v: { data: unknown; error: null }) => T) {
    const data = this.op === "select" && this.table === "payments" ? mocks.payments : null;
    return Promise.resolve({ data, error: null }).then(resolve);
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/notify/email", () => ({ sendBookingCancelledEmail: mocks.sendCancelled, sendBookingChangedEmail: vi.fn() }));
vi.mock("@/lib/payments/paystack", () => ({ refundPaystackTransaction: mocks.refund }));
vi.mock("@/lib/auth", () => ({
  isStaff: vi.fn().mockResolvedValue(true),
  isAdmin: vi.fn().mockResolvedValue(true),
  UNAUTHORIZED: { ok: false, error: "Unauthorized" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => new FakeQuery(table),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

const { cancelBookingWithRefund } = await import("@/app/admin/bookings/actions");
const { formatMoney } = await import("@/lib/format");

const paystackPayment = (reference: string, amount: number, paid_at: string) => ({
  amount, status: "success", method: "paystack", paystack_reference: reference, paid_at, created_at: paid_at,
});

const refundRows = () => mocks.inserts.flat() as Record<string, unknown>[];
const request = (refundAmount: number) => ({ bookingId: BOOKING_ID, refundMethod: "paystack" as const, refundAmount, reason: "" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.booking = {
    id: BOOKING_ID, booking_code: CODE, status: "confirmed", payment_status: "paid",
    total_amount: 1000, currency: "GHS", refunded_amount: 0, cancelled_at: null, units: { name: "Studio Suite" },
  };
  mocks.payments = [paystackPayment(CODE, 500, "2026-11-01T10:00:00Z"), paystackPayment(BAL, 500, "2026-11-10T10:00:00Z")];
  mocks.inserts = [];
  mocks.bookingUpdates = [];
  mocks.refund.mockResolvedValue({ status: "pending" });
});

describe("cancelBookingWithRefund through Paystack", () => {
  it("refunds a single payment as before: one call, one row, booking cancelled", async () => {
    mocks.payments = [paystackPayment(CODE, 1000, "2026-11-01T10:00:00Z")];

    expect(await cancelBookingWithRefund(request(1000))).toEqual({ ok: true });
    expect(mocks.refund).toHaveBeenCalledTimes(1);
    expect(mocks.refund).toHaveBeenCalledWith(expect.objectContaining({ reference: CODE, amountInMajorUnits: 1000 }));
    expect(refundRows()).toHaveLength(1);
    expect(refundRows()[0]).toMatchObject({ amount: -1000, status: "refunded", method: "paystack" });
    expect(String(refundRows()[0].paystack_reference)).toMatch(new RegExp(`^refund:${CODE}:\\d+$`));
    expect(mocks.bookingUpdates[0]).toMatchObject({ status: "cancelled", refunded_amount: 1000, payment_status: "refunded" });
  });

  it("splits a deposit + balance refund across both payments, newest first", async () => {
    expect(await cancelBookingWithRefund(request(1000))).toEqual({ ok: true });

    expect(mocks.refund.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      expect.objectContaining({ reference: BAL, amountInMajorUnits: 500 }),
      expect.objectContaining({ reference: CODE, amountInMajorUnits: 500 }),
    ]);
    const rows = refundRows();
    expect(rows).toHaveLength(2);
    expect(String(rows[0].paystack_reference)).toMatch(new RegExp(`^refund:${BAL}:\\d+$`));
    expect(String(rows[1].paystack_reference)).toMatch(new RegExp(`^refund:${CODE}:\\d+$`));
    expect(rows.map((r: Record<string, unknown>) => r.amount)).toEqual([-500, -500]);
    expect(mocks.bookingUpdates[0]).toMatchObject({ status: "cancelled", refunded_amount: 1000, payment_status: "refunded" });
  });

  it("refuses a refund the Paystack payments can't cover and calls nothing", async () => {
    // 1300 received in all, but only 1000 of it through Paystack.
    mocks.payments.push({ amount: 300, status: "success", method: "cash", paystack_reference: null, paid_at: "2026-11-11T10:00:00Z" });

    const result = await cancelBookingWithRefund(request(1200));
    expect(result.ok).toBe(false);
    expect(result.error).toContain(formatMoney(1000, "GHS"));
    expect(result.error).toContain("manual refund");
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.bookingUpdates).toHaveLength(0);
  });

  it("records the part Paystack refunded when a later call fails, and leaves the booking open", async () => {
    mocks.refund.mockResolvedValueOnce({ status: "pending" }).mockRejectedValueOnce(new Error("Transaction too old"));

    const result = await cancelBookingWithRefund(request(1000));
    expect(result.ok).toBe(false);
    expect(result.error).toContain(`${formatMoney(500, "GHS")} was refunded through Paystack`);
    expect(result.error).toContain(`${formatMoney(500, "GHS")} is left to refund manually`);
    expect(refundRows()).toHaveLength(1);
    expect(refundRows()[0]).toMatchObject({ amount: -500 });
    expect(String(refundRows()[0].paystack_reference)).toMatch(new RegExp(`^refund:${BAL}:\\d+$`));
    expect(mocks.bookingUpdates).toHaveLength(1);
    expect(mocks.bookingUpdates[0]).toEqual({ refunded_amount: 500 });
    expect(mocks.sendCancelled).not.toHaveBeenCalled();
  });
});
