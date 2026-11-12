import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isStaff: vi.fn(),
  email: vi.fn(),
  whatsapp: vi.fn(),
  audit: vi.fn(),
  booking: null as Record<string, unknown> | null,
}));

class FakeQuery {
  select() { return this; }
  eq() { return this; }
  maybeSingle() { return Promise.resolve({ data: mocks.booking, error: null }); }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/lib/notify/email", () => ({
  sendBookingCancelledEmail: vi.fn(),
  sendBookingChangedEmail: vi.fn(),
  sendBalancePaymentLinkEmail: mocks.email,
}));
vi.mock("@/lib/notify/whatsapp", () => ({ sendBalancePaymentLinkWhatsApp: mocks.whatsapp }));
vi.mock("@/lib/payments/paystack", () => ({ refundPaystackTransaction: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  isStaff: mocks.isStaff,
  isAdmin: vi.fn(),
  UNAUTHORIZED: { ok: false, error: "Unauthorized" },
}));
vi.mock("@/lib/booking/special-prices-db", () => ({ specialsForStay: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: () => new FakeQuery(), rpc: vi.fn() }),
}));

const { sendPaymentLink } = await import("@/app/admin/bookings/actions");

function booking(paid: number, extra: Record<string, unknown> = {}) {
  return {
    id: "b1",
    booking_code: "GAG-2026-TEST01",
    status: "confirmed",
    payment_status: "partial",
    total_amount: 1000,
    currency: "GHS",
    guest_email: "ama@example.com",
    guest_phone: "+233200000000",
    units: { name: "1-Bed" },
    payments: [{ amount: paid, status: "success" }],
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isStaff.mockResolvedValue(true);
  mocks.email.mockResolvedValue(undefined);
  mocks.whatsapp.mockResolvedValue(undefined);
  mocks.booking = booking(400);
});

describe("sendPaymentLink", () => {
  it("refuses non-staff", async () => {
    mocks.isStaff.mockResolvedValue(false);
    expect(await sendPaymentLink("b1")).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("refuses a fully paid booking and sends nothing", async () => {
    mocks.booking = booking(1000, { payment_status: "paid" });
    const r = await sendPaymentLink("b1");
    expect(r).toEqual({ ok: false, error: "There's nothing left to pay on this booking." });
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.whatsapp).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("emails once with the owed amount and writes the audit entry", async () => {
    expect(await sendPaymentLink("b1")).toEqual({ ok: true });
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(mocks.email.mock.calls[0][2]).toBe(600);
    expect(mocks.audit).toHaveBeenCalledWith("booking.payment_link_sent", "booking", "b1", expect.objectContaining({ owed: 600 }));
  });

  it("still returns ok when a send throws", async () => {
    mocks.email.mockRejectedValue(new Error("resend down"));
    mocks.whatsapp.mockRejectedValue(new Error("twilio down"));
    expect(await sendPaymentLink("b1")).toEqual({ ok: true });
  });
});
