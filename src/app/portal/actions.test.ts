import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  booking: null as Record<string, unknown> | null,
  hasAccess: vi.fn(),
  isOverLimit: vi.fn(),
  startBalance: vi.fn(),
}));

class FakeQuery {
  select() { return this; }
  eq() { return this; }
  maybeSingle() { return Promise.resolve({ data: mocks.booking, error: null }); }
  single() { return Promise.resolve({ data: mocks.booking, error: null }); }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from: () => new FakeQuery() }) }));
vi.mock("@/lib/portal-session", () => ({ grantPortalAccess: vi.fn(), hasPortalAccess: mocks.hasAccess }));
vi.mock("@/lib/notify/email", () => ({ sendCancellationRequestAlert: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ isOverLimit: mocks.isOverLimit, RATE_LIMITED_MESSAGE: "Too many requests" }));
vi.mock("@/lib/logger", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/payments/balance-payment", () => ({ startBalancePayment: mocks.startBalance }));

const { payBalance } = await import("@/app/portal/actions");

const BOOKING_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.booking = { id: BOOKING_ID, booking_code: "GAG-2026-ABCDEF" };
  mocks.hasAccess.mockResolvedValue(true);
  mocks.isOverLimit.mockResolvedValue(false);
  mocks.startBalance.mockResolvedValue({ ok: true, url: "https://checkout.paystack.com/abc" });
});

describe("payBalance", () => {
  it("refuses a visitor without portal access and starts nothing", async () => {
    mocks.hasAccess.mockResolvedValue(false);

    expect(await payBalance(BOOKING_ID)).toEqual({ ok: false, error: "Please verify your booking first." });
    expect(mocks.hasAccess).toHaveBeenCalledWith("GAG-2026-ABCDEF");
    expect(mocks.startBalance).not.toHaveBeenCalled();
  });

  it("refuses when the visitor is over the rate limit", async () => {
    mocks.isOverLimit.mockResolvedValue(true);

    expect(await payBalance(BOOKING_ID)).toEqual({ ok: false, error: "Too many requests" });
    expect(mocks.isOverLimit).toHaveBeenCalledWith("balancePayment");
    expect(mocks.startBalance).not.toHaveBeenCalled();
  });

  it("refuses an unknown booking", async () => {
    mocks.booking = null;

    expect((await payBalance(BOOKING_ID)).ok).toBe(false);
    expect(mocks.startBalance).not.toHaveBeenCalled();
  });

  it("starts the balance payment for the booking's own code", async () => {
    expect(await payBalance(BOOKING_ID)).toEqual({ ok: true, url: "https://checkout.paystack.com/abc" });
    expect(mocks.startBalance).toHaveBeenCalledWith("GAG-2026-ABCDEF");
  });
});
