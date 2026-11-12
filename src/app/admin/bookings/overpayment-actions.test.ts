import { beforeEach, describe, expect, it, vi } from "vitest";

// refundOverpayment: an admin refunds what was paid above the stay total, without cancelling.
const BOOKING_ID = "00000000-0000-0000-0000-0000000000d1";
const CODE = "GAG-2026-OVERPD";
const BAL = `${CODE}-BTAB111`;

const mocks = vi.hoisted(() => ({
  booking: null as Record<string, unknown> | null,
  payments: [] as Record<string, unknown>[],
  inserts: [] as unknown[],
  bookingUpdates: [] as Record<string, unknown>[],
  refund: vi.fn(),
  audit: vi.fn(),
  isAdmin: vi.fn(),
  isStaff: vi.fn(),
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
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/lib/notify/email", () => ({ sendBookingCancelledEmail: vi.fn(), sendBookingChangedEmail: vi.fn() }));
vi.mock("@/lib/payments/paystack", () => ({ refundPaystackTransaction: mocks.refund }));
vi.mock("@/lib/auth", () => ({
  isStaff: mocks.isStaff,
  isAdmin: mocks.isAdmin,
  UNAUTHORIZED: { ok: false, error: "Unauthorized" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => new FakeQuery(table),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

const { refundOverpayment } = await import("@/app/admin/bookings/actions");
const { formatMoney } = await import("@/lib/format");

const paystackPayment = (reference: string, amount: number, paid_at: string) => ({
  amount, status: "success", method: "paystack", paystack_reference: reference, paid_at, created_at: paid_at,
});
const refundRows = () => mocks.inserts.flat() as Record<string, unknown>[];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin.mockResolvedValue(true);
  mocks.isStaff.mockResolvedValue(true);
  // A 1000 stay paid 1000 + a second-tab 500: 500 overpaid.
  mocks.booking = {
    id: BOOKING_ID, booking_code: CODE, status: "confirmed", payment_status: "paid",
    total_amount: 1000, currency: "GHS", refunded_amount: 0, cancelled_at: null,
    admin_notes: "OVERPAID: refund GHS 500", attention_cleared_at: null, units: { name: "Studio Suite" },
  };
  mocks.payments = [paystackPayment(CODE, 1000, "2026-11-01T10:00:00Z"), paystackPayment(BAL, 500, "2026-11-10T10:00:00Z")];
  mocks.inserts = [];
  mocks.bookingUpdates = [];
  mocks.refund.mockResolvedValue({ status: "pending" });
});

describe("refundOverpayment", () => {
  it("is admin-only", async () => {
    mocks.isAdmin.mockResolvedValue(false);

    expect(await refundOverpayment({ bookingId: BOOKING_ID, method: "paystack", amount: 500 })).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.bookingUpdates).toHaveLength(0);
  });

  it("refuses more than the amount paid above the total, and calls nothing", async () => {
    const result = await refundOverpayment({ bookingId: BOOKING_ID, method: "paystack", amount: 600 });

    expect(result).toEqual({ ok: false, error: `You can refund at most ${formatMoney(500, "GHS")}, the amount paid above the stay total.` });
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.bookingUpdates).toHaveLength(0);
  });

  it("refuses when nothing was paid above the total", async () => {
    mocks.payments = [paystackPayment(CODE, 1000, "2026-11-01T10:00:00Z")];

    const result = await refundOverpayment({ bookingId: BOOKING_ID, method: "cash", amount: 1 });
    expect(result.ok).toBe(false);
    expect(mocks.inserts).toHaveLength(0);
  });

  it("refunds through Paystack against the newest payment and never touches the status", async () => {
    expect(await refundOverpayment({ bookingId: BOOKING_ID, method: "paystack", amount: 500, reason: "Paid twice" })).toEqual({ ok: true });

    expect(mocks.refund).toHaveBeenCalledTimes(1);
    expect(mocks.refund).toHaveBeenCalledWith(expect.objectContaining({ reference: BAL, amountInMajorUnits: 500 }));
    const rows = refundRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ booking_id: BOOKING_ID, amount: -500, status: "refunded", method: "paystack" });
    expect(String(rows[0].paystack_reference)).toMatch(new RegExp(`^refund:${BAL}:\\d+$`));

    expect(mocks.bookingUpdates).toHaveLength(1);
    const update = mocks.bookingUpdates[0];
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("cancelled_at");
    expect(update).toMatchObject({ refunded_amount: 500, payment_status: "paid" });
    expect(String(update.admin_notes)).toContain("OVERPAID: refund GHS 500");
    expect(String(update.admin_notes)).toContain(`OVERPAYMENT REFUNDED: ${formatMoney(500, "GHS")}`);
    expect(typeof update.attention_cleared_at).toBe("string");
    expect(mocks.audit).toHaveBeenCalledWith("booking.overpayment_refunded", "booking", BOOKING_ID, expect.objectContaining({ amount: 500, method: "paystack" }));
  });

  it("records a manual refund as one negative row, with no Paystack call", async () => {
    expect(await refundOverpayment({ bookingId: BOOKING_ID, method: "momo", amount: 200 })).toEqual({ ok: true });

    expect(mocks.refund).not.toHaveBeenCalled();
    const rows = refundRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ booking_id: BOOKING_ID, amount: -200, status: "refunded", method: "momo", paystack_reference: null });
    expect(mocks.bookingUpdates).toHaveLength(1);
    expect(mocks.bookingUpdates[0]).not.toHaveProperty("status");
    expect(mocks.bookingUpdates[0]).toMatchObject({ refunded_amount: 200, payment_status: "paid" });
  });

  it("records only the Paystack part that went through when a later call fails", async () => {
    // 900 over: 500 from the balance payment, then 400 from the first, which fails.
    mocks.booking = { ...mocks.booking, total_amount: 600 };
    mocks.refund.mockResolvedValueOnce({ status: "pending" }).mockRejectedValueOnce(new Error("Transaction too old"));

    const result = await refundOverpayment({ bookingId: BOOKING_ID, method: "paystack", amount: 900 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain(`${formatMoney(500, "GHS")} was refunded through Paystack`);
    expect(result.error).toContain(`${formatMoney(400, "GHS")} is left to refund manually`);
    expect(refundRows()).toHaveLength(1);
    expect(refundRows()[0]).toMatchObject({ amount: -500 });
    expect(mocks.bookingUpdates).toEqual([{ refunded_amount: 500 }]);
  });
});
