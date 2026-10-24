import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// A tiny stand-in for the Supabase query builder: records every write and answers reads
// from `db`. Only the calls confirmPaymentByReference makes are supported.
interface DbError {
  code: string;
  message: string;
}
interface Write {
  table: string;
  op: "insert" | "update";
  payload: Record<string, unknown>;
}

const mocks = vi.hoisted(() => ({
  db: {} as {
    booking: Record<string, unknown> | null;
    existingPayment: { id: string } | null;
    insertError: DbError | null;
    firstUpdateError: DbError | null;
    writes: Write[];
    rpc: Mock<(name: string, params: unknown) => Promise<unknown>>;
  },
  verify: vi.fn(),
  sendEmail: vi.fn(),
  sendWhatsApp: vi.fn(),
  sendConflictAlert: vi.fn(),
}));

class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> = {};
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  single() { return this; }
  maybeSingle() { return this; }
  insert(payload: Record<string, unknown>) { this.op = "insert"; this.payload = payload; return this; }
  update(payload: Record<string, unknown>) { this.op = "update"; this.payload = payload; return this; }
  then<T>(resolve: (value: { data: unknown; error: DbError | null }) => T) {
    return Promise.resolve(this.run()).then(resolve);
  }
  private run(): { data: unknown; error: DbError | null } {
    const { db } = mocks;
    if (this.op === "select") {
      return { data: this.table === "bookings" ? db.booking : db.existingPayment, error: null };
    }
    const isFirstUpdate = this.op === "update" && !db.writes.some((w: Write) => w.op === "update");
    db.writes.push({ table: this.table, op: this.op, payload: this.payload });
    if (this.op === "insert") return { data: null, error: db.insertError };
    if (isFirstUpdate && db.firstUpdateError) return { data: null, error: db.firstUpdateError };
    return { data: { ...db.booking, ...this.payload }, error: null };
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => new FakeQuery(table),
    rpc: (name: string, params: unknown) => mocks.db.rpc(name, params),
  }),
}));
vi.mock("@/lib/payments/paystack", () => ({ verifyPaystackTransaction: mocks.verify }));
vi.mock("@/lib/notify/email", () => ({
  sendBookingConfirmationEmail: mocks.sendEmail,
  sendAdminPaymentConflictAlert: mocks.sendConflictAlert,
}));
vi.mock("@/lib/notify/whatsapp", () => ({ sendBookingConfirmationWhatsApp: mocks.sendWhatsApp }));

const { confirmPaymentByReference } = await import("@/lib/payments/booking-payment");

const REF = "GAG-2026-ABCDEF";

function pendingBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    booking_code: REF,
    status: "pending",
    payment_status: "unpaid",
    total_amount: 2400,
    deposit_amount: null,
    currency: "GHS",
    promo_code: null,
    cancelled_at: null,
    admin_notes: null,
    units: { name: "Studio Suite" },
    ...overrides,
  };
}

function paystackSuccess(amountMajor: number, currency = "GHS") {
  return { status: "success", amount: Math.round(amountMajor * 100), currency, paid_at: "2026-11-01T10:00:00Z" };
}

const bookingUpdates = () => mocks.db.writes.filter((w: Write) => w.table === "bookings" && w.op === "update");
const paymentInserts = () => mocks.db.writes.filter((w: Write) => w.table === "payments" && w.op === "insert");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.booking = pendingBooking();
  mocks.db.existingPayment = null;
  mocks.db.insertError = null;
  mocks.db.firstUpdateError = null;
  mocks.db.writes = [];
  mocks.db.rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  mocks.verify.mockResolvedValue(paystackSuccess(2400));
});

describe("confirmPaymentByReference", () => {
  it("returns not_found for an unknown reference", async () => {
    mocks.db.booking = null;
    expect(await confirmPaymentByReference(REF)).toEqual({ outcome: "not_found" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("confirms a full payment once: payment row, confirmed booking, notifications", async () => {
    const result = await confirmPaymentByReference(REF);

    expect(result.outcome).toBe("paid");
    expect(paymentInserts()).toHaveLength(1);
    expect(paymentInserts()[0].payload).toMatchObject({ amount: 2400, currency: "GHS", status: "success", paystack_reference: REF });
    expect(bookingUpdates()[0].payload).toEqual({ status: "confirmed", payment_status: "paid" });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("marks a deposit payment as partial", async () => {
    mocks.db.booking = pendingBooking({ deposit_amount: 1200 });
    mocks.verify.mockResolvedValue(paystackSuccess(1200));

    expect((await confirmPaymentByReference(REF)).outcome).toBe("paid");
    expect(bookingUpdates()[0].payload).toEqual({ status: "confirmed", payment_status: "partial" });
  });

  it("counts a promo code only when the payment is first confirmed", async () => {
    mocks.db.booking = pendingBooking({ promo_code: "WELCOME10" });
    await confirmPaymentByReference(REF);
    expect(mocks.db.rpc).toHaveBeenCalledWith("increment_promo_usage", { p_code: "WELCOME10" });
  });

  it("fails without touching anything when Paystack says the charge failed", async () => {
    mocks.verify.mockResolvedValue({ status: "failed", amount: 0, currency: "GHS" });

    expect(await confirmPaymentByReference(REF)).toMatchObject({ outcome: "failed", reason: "failed" });
    expect(mocks.db.writes).toHaveLength(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("fails when less than the expected amount was charged, and flags it for the admin", async () => {
    mocks.verify.mockResolvedValue(paystackSuccess(2000));
    expect(await confirmPaymentByReference(REF)).toMatchObject({ outcome: "failed", reason: "amount_mismatch" });
    expect(paymentInserts()).toHaveLength(0);
    expect(bookingUpdates()).toHaveLength(1);
    expect(bookingUpdates()[0].payload).toEqual({ admin_notes: expect.stringContaining("PAYMENT MISMATCH (amount_mismatch)") });
    expect(bookingUpdates()[0].payload).not.toHaveProperty("status");
    expect(mocks.sendConflictAlert).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("fails when the charge is in a different currency from the booking", async () => {
    mocks.verify.mockResolvedValue(paystackSuccess(2400, "USD"));
    expect(await confirmPaymentByReference(REF)).toMatchObject({ outcome: "failed", reason: "currency_mismatch" });
    expect(paymentInserts()).toHaveLength(0);
    expect(mocks.sendConflictAlert).toHaveBeenCalledTimes(1);
  });

  it("alerts about a mismatch only once (webhook and success page both arrive)", async () => {
    mocks.verify.mockResolvedValue(paystackSuccess(2000));
    mocks.db.booking = pendingBooking({ admin_notes: "PAYMENT MISMATCH (amount_mismatch): already flagged" });
    expect(await confirmPaymentByReference(REF)).toMatchObject({ outcome: "failed", reason: "amount_mismatch" });
    expect(mocks.db.writes).toHaveLength(0);
    expect(mocks.sendConflictAlert).not.toHaveBeenCalled();
  });

  it("does nothing more for a booking that is already paid (duplicate webhook)", async () => {
    mocks.db.booking = pendingBooking({ status: "confirmed", payment_status: "paid" });

    expect((await confirmPaymentByReference(REF)).outcome).toBe("paid");
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.db.writes).toHaveLength(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("never revives a refunded or cancelled booking", async () => {
    mocks.db.booking = pendingBooking({ status: "cancelled", payment_status: "refunded" });
    expect((await confirmPaymentByReference(REF)).outcome).toBe("closed");

    mocks.db.booking = pendingBooking({ status: "cancelled", payment_status: "paid", cancelled_at: "2026-11-02T00:00:00Z" });
    expect((await confirmPaymentByReference(REF)).outcome).toBe("closed");

    expect(mocks.db.writes).toHaveLength(0);
  });

  it("sends review for a paid booking whose hold had already been cancelled", async () => {
    mocks.db.booking = pendingBooking({ status: "cancelled", payment_status: "paid" });
    expect((await confirmPaymentByReference(REF)).outcome).toBe("needs_review");
  });

  it("does not notify twice when the payment row already exists", async () => {
    mocks.db.existingPayment = { id: "payment-1" };

    expect((await confirmPaymentByReference(REF)).outcome).toBe("paid");
    expect(paymentInserts()).toHaveLength(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
  });

  it("does not notify twice when the webhook and success page race (unique violation)", async () => {
    mocks.db.booking = pendingBooking({ promo_code: "WELCOME10" });
    mocks.db.insertError = { code: "23505", message: "duplicate key value" };

    expect((await confirmPaymentByReference(REF)).outcome).toBe("paid");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.sendWhatsApp).not.toHaveBeenCalled();
    expect(mocks.db.rpc).not.toHaveBeenCalled();
  });

  it("flags a payment that arrives after the dates were re-booked, and alerts the admin once", async () => {
    mocks.db.firstUpdateError = { code: "23P01", message: "conflicting key value violates exclusion constraint" };

    expect((await confirmPaymentByReference(REF)).outcome).toBe("needs_review");
    const flag = bookingUpdates()[1].payload;
    expect(flag.payment_status).toBe("paid");
    expect(String(flag.admin_notes)).toContain("PAID AFTER HOLD EXPIRED");
    expect(mocks.sendConflictAlert).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
