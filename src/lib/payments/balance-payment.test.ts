import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/lib/format";

// A small stand-in for the Supabase query builder. It answers reads from `db`, records
// every write with its filters, and applies the payment compare-and-set to `db.payments`
// like Postgres would: only a row still `pending` is updated and returned.
interface DbError {
  code: string;
  message: string;
}
interface Write {
  table: string;
  op: "insert" | "update";
  payload: Record<string, unknown>;
  filters: Record<string, unknown>;
}
interface PaymentRow {
  id: string;
  booking_id: string;
  amount: number;
  currency: string;
  status: string;
  paystack_reference: string | null;
}

const mocks = vi.hoisted(() => ({
  db: {} as {
    booking: Record<string, unknown> | null;
    payments: PaymentRow[];
    insertError: DbError | null;
    // Simulates another call (webhook vs portal) winning the compare-and-set first.
    loseCompareAndSet: boolean;
    writes: Write[];
  },
  verify: vi.fn(),
  initPaystack: vi.fn(),
  sendBalanceEmail: vi.fn(),
  sendConflictAlert: vi.fn(),
  sendSystemAlert: vi.fn(),
}));

class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> = {};
  private filters: Record<string, unknown> = {};
  private returning = false;
  constructor(private table: string) {}
  select() { this.returning = true; return this; }
  eq(column: string, value: unknown) { this.filters[column] = value; return this; }
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
      if (this.table === "bookings") return { data: db.booking, error: null };
      if (this.filters.paystack_reference) {
        const row = db.payments.find((p: PaymentRow) => p.paystack_reference === this.filters.paystack_reference);
        return { data: row ? { ...row, bookings: db.booking } : null, error: null };
      }
      return { data: db.payments.filter((p: PaymentRow) => p.booking_id === this.filters.booking_id), error: null };
    }
    db.writes.push({ table: this.table, op: this.op, payload: this.payload, filters: { ...this.filters } });
    if (this.op === "insert") {
      if (db.insertError) return { data: null, error: db.insertError };
      const row = { id: "pay-new", ...this.payload } as unknown as PaymentRow;
      db.payments.push(row);
      return { data: { id: row.id }, error: null };
    }
    if (this.table === "payments") {
      const row = db.payments.find((p: PaymentRow) => p.id === this.filters.id);
      const matches = row && (this.filters.status === undefined || row.status === this.filters.status) && !db.loseCompareAndSet;
      if (row && matches) Object.assign(row, this.payload);
      return { data: this.returning ? (matches ? [row] : []) : null, error: null };
    }
    if (db.booking) Object.assign(db.booking, this.payload);
    return { data: null, error: null };
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => new FakeQuery(table) }),
}));
vi.mock("@/lib/payments/paystack", () => ({
  verifyPaystackTransaction: mocks.verify,
  initializePaystackTransaction: mocks.initPaystack,
}));
vi.mock("@/lib/notify/email", () => ({
  sendBalanceReceivedEmail: mocks.sendBalanceEmail,
  sendAdminPaymentConflictAlert: mocks.sendConflictAlert,
  sendAdminSystemAlert: mocks.sendSystemAlert,
}));
vi.mock("@/lib/logger", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/env", () => ({ siteUrl: () => "https://example.test" }));

const { startBalancePayment, confirmBalancePayment } = await import("@/lib/payments/balance-payment");

const CODE = "GAG-2026-ABCDEF";
const REF = `${CODE}-BZZ99ZZ`;

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    booking_code: CODE,
    status: "confirmed",
    payment_status: "partial",
    total_amount: 1000,
    currency: "GHS",
    guest_email: "ama@example.com",
    cancelled_at: null,
    admin_notes: null,
    units: { name: "Studio Suite" },
    ...overrides,
  };
}

function payment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return { id: "pay-1", booking_id: "booking-1", amount: 500, currency: "GHS", status: "success", paystack_reference: CODE, ...overrides };
}

function paystackSuccess(amountMajor: number, currency = "GHS") {
  return { status: "success", amount: Math.round(amountMajor * 100), currency, paid_at: "2026-11-12T10:00:00Z" };
}

const writes = (table: string, op: "insert" | "update") =>
  mocks.db.writes.filter((w: Write) => w.table === table && w.op === op);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.booking = booking();
  mocks.db.payments = [payment()];
  mocks.db.insertError = null;
  mocks.db.loseCompareAndSet = false;
  mocks.db.writes = [];
  mocks.initPaystack.mockResolvedValue({ authorization_url: "https://checkout.paystack.com/abc", access_code: "abc", reference: "x" });
  mocks.verify.mockResolvedValue(paystackSuccess(500));
});

describe("startBalancePayment", () => {
  it("refuses a cancelled booking and inserts nothing", async () => {
    mocks.db.booking = booking({ status: "cancelled" });

    expect(await startBalancePayment(CODE)).toEqual({ ok: false, error: "This booking can't be paid online. Please contact us." });
    expect(mocks.db.writes).toHaveLength(0);
    expect(mocks.initPaystack).not.toHaveBeenCalled();
  });

  it("refuses when nothing is owed", async () => {
    mocks.db.payments = [payment({ amount: 1000 })];

    expect(await startBalancePayment(CODE)).toEqual({ ok: false, error: "There's nothing left to pay on this booking." });
    expect(mocks.db.writes).toHaveLength(0);
  });

  it("inserts one pending row for the owed amount and returns Paystack's URL", async () => {
    const result = await startBalancePayment(CODE);

    expect(result).toEqual({ ok: true, url: "https://checkout.paystack.com/abc" });
    const inserts = writes("payments", "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toMatchObject({ booking_id: "booking-1", amount: 500, currency: "GHS", method: "paystack", status: "pending" });
    const reference = inserts[0].payload.paystack_reference as string;
    expect(reference).toMatch(/^GAG-2026-ABCDEF-B[A-Z0-9]{6}$/);
    expect(mocks.initPaystack).toHaveBeenCalledWith({
      email: "ama@example.com",
      amountInMajorUnits: 500,
      reference,
      currency: "GHS",
      callbackUrl: `https://example.test/portal/${CODE}`,
      metadata: { booking_code: CODE, kind: "balance", cancel_action: `https://example.test/portal/${CODE}` },
    });
  });

  it("charges the exact difference after a total went up on a 'paid' booking", async () => {
    mocks.db.booking = booking({ payment_status: "paid", total_amount: 3000 });
    mocks.db.payments = [payment({ amount: 2500 }), payment({ id: "pay-old", amount: 700, status: "pending", paystack_reference: `${CODE}-BOLD111` })];

    await startBalancePayment(CODE);
    expect(writes("payments", "insert")[0].payload).toMatchObject({ amount: 500 });
  });

  it("marks the row failed when Paystack can't start the checkout", async () => {
    mocks.initPaystack.mockRejectedValue(new Error("Paystack down"));

    expect(await startBalancePayment(CODE)).toEqual({ ok: false, error: "We couldn't start the payment. Please try again in a moment." });
    expect(writes("payments", "insert")).toHaveLength(1);
    const updates = writes("payments", "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toEqual({ status: "failed" });
    expect(updates[0].filters).toMatchObject({ id: "pay-new" });
    expect(mocks.sendSystemAlert).toHaveBeenCalledTimes(1);
  });

  it("doesn't call Paystack when the row can't be saved", async () => {
    mocks.db.insertError = { code: "23505", message: "duplicate key" };

    expect(await startBalancePayment(CODE)).toEqual({ ok: false, error: "We couldn't start the payment. Please try again in a moment." });
    expect(mocks.initPaystack).not.toHaveBeenCalled();
  });
});

describe("confirmBalancePayment", () => {
  const pendingBalance = (amount = 500) => payment({ id: "pay-2", amount, status: "pending", paystack_reference: REF });

  beforeEach(() => {
    mocks.db.payments = [payment(), pendingBalance()];
  });

  it("returns not_found for an unknown reference", async () => {
    expect(await confirmBalancePayment(`${CODE}-BNOPE00`)).toEqual({ outcome: "not_found" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("returns not_found when the row's booking is gone", async () => {
    mocks.db.booking = null;
    expect(await confirmBalancePayment(REF)).toEqual({ outcome: "not_found" });
  });

  it("does nothing more for a row already confirmed", async () => {
    mocks.db.payments = [payment(), pendingBalance()];
    mocks.db.payments[1].status = "success";

    expect((await confirmBalancePayment(REF)).outcome).toBe("paid");
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.db.writes).toHaveLength(0);
    expect(mocks.sendBalanceEmail).not.toHaveBeenCalled();
    expect(mocks.sendConflictAlert).not.toHaveBeenCalled();
  });

  it("answers closed for an already confirmed row on a cancelled booking", async () => {
    mocks.db.booking = booking({ status: "cancelled" });
    mocks.db.payments[1].status = "success";

    expect((await confirmBalancePayment(REF)).outcome).toBe("closed");
    expect(mocks.db.writes).toHaveLength(0);
  });

  it("fails without writes when Paystack says the checkout was abandoned", async () => {
    mocks.verify.mockResolvedValue({ status: "abandoned", amount: 0, currency: "GHS" });

    expect(await confirmBalancePayment(REF)).toMatchObject({ outcome: "failed", reason: "abandoned" });
    expect(mocks.db.writes).toHaveLength(0);
    expect(mocks.db.payments[1].status).toBe("pending");
  });

  it("flags a charge below the row's amount once and never confirms it", async () => {
    mocks.verify.mockResolvedValue(paystackSuccess(400));

    expect(await confirmBalancePayment(REF)).toMatchObject({ outcome: "failed", reason: "amount_mismatch" });
    expect(await confirmBalancePayment(REF)).toMatchObject({ outcome: "failed", reason: "amount_mismatch" });

    const notes = writes("bookings", "update");
    expect(notes).toHaveLength(1);
    expect(notes[0].payload.admin_notes).toContain(`BALANCE PAYMENT MISMATCH (${REF})`);
    expect(mocks.sendConflictAlert).toHaveBeenCalledTimes(1);
    expect(writes("payments", "update")).toHaveLength(0);
    expect(mocks.db.payments[1].status).toBe("pending");
  });

  it("flags a charge in another currency", async () => {
    mocks.verify.mockResolvedValue(paystackSuccess(500, "USD"));

    expect(await confirmBalancePayment(REF)).toMatchObject({ outcome: "failed", reason: "currency_mismatch" });
    expect(mocks.sendConflictAlert).toHaveBeenCalledTimes(1);
  });

  it("returns paid without notifying when another call already won the compare-and-set", async () => {
    mocks.db.loseCompareAndSet = true;

    expect((await confirmBalancePayment(REF)).outcome).toBe("paid");
    const cas = writes("payments", "update");
    expect(cas).toHaveLength(1);
    expect(cas[0].filters).toEqual({ id: "pay-2", status: "pending" });
    expect(writes("bookings", "update")).toHaveLength(0);
    expect(mocks.sendBalanceEmail).not.toHaveBeenCalled();
    expect(mocks.sendConflictAlert).not.toHaveBeenCalled();
  });

  it("records the balance, marks the booking paid and emails the guest", async () => {
    const result = await confirmBalancePayment(REF);

    expect(result.outcome).toBe("paid");
    expect(writes("payments", "update")[0].payload).toEqual({ status: "success", amount: 500, paid_at: "2026-11-12T10:00:00Z" });
    expect(writes("bookings", "update")[0].payload).toEqual({ payment_status: "paid" });
    expect(mocks.sendBalanceEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendBalanceEmail).toHaveBeenCalledWith(expect.objectContaining({ booking_code: CODE }), "Studio Suite", 500, 0);
  });

  it("keeps a booking partial when part of the balance is paid", async () => {
    mocks.db.payments = [payment(), pendingBalance(300)];
    mocks.verify.mockResolvedValue(paystackSuccess(300));

    expect((await confirmBalancePayment(REF)).outcome).toBe("paid");
    expect(writes("bookings", "update")[0].payload).toEqual({ payment_status: "partial" });
    expect(mocks.sendBalanceEmail).toHaveBeenCalledWith(expect.anything(), "Studio Suite", 300, 200);
  });

  it("records a payment on a cancelled booking, leaves it cancelled and alerts once", async () => {
    mocks.db.booking = booking({ status: "cancelled", cancelled_at: "2026-11-12T09:00:00Z" });

    expect((await confirmBalancePayment(REF)).outcome).toBe("needs_review");
    expect(mocks.db.payments[1].status).toBe("success");
    const updates = writes("bookings", "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).not.toHaveProperty("status");
    expect(updates[0].payload.admin_notes).toContain("PAID AFTER CANCELLATION (balance)");
    expect(mocks.db.booking?.status).toBe("cancelled");
    expect(mocks.sendConflictAlert).toHaveBeenCalledTimes(1);
    expect(mocks.sendBalanceEmail).not.toHaveBeenCalled();

    // A webhook retry afterwards changes nothing and alerts no one.
    expect((await confirmBalancePayment(REF)).outcome).toBe("closed");
    expect(mocks.sendConflictAlert).toHaveBeenCalledTimes(1);
  });

  it("flags an overpayment when a second tab pays the same balance", async () => {
    mocks.db.booking = booking({ total_amount: 2000, payment_status: "paid" });
    mocks.db.payments = [
      payment({ amount: 1000 }),
      payment({ id: "pay-tab1", amount: 1000, paystack_reference: `${CODE}-BTAB111` }),
      pendingBalance(1000),
    ];
    mocks.verify.mockResolvedValue(paystackSuccess(1000));

    expect((await confirmBalancePayment(REF)).outcome).toBe("needs_review");
    const updates = writes("bookings", "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].payload.payment_status).toBe("paid");
    expect(updates[0].payload.admin_notes).toContain(`OVERPAID: refund ${formatMoney(1000, "GHS")}`);
    expect(mocks.sendConflictAlert).toHaveBeenCalledTimes(1);
    expect(mocks.sendBalanceEmail).not.toHaveBeenCalled();
  });
});
