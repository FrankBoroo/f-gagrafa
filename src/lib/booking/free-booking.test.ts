import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendWhatsApp: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/notify/email", () => ({ sendBookingConfirmationEmail: mocks.sendEmail }));
vi.mock("@/lib/notify/whatsapp", () => ({ sendBookingConfirmationWhatsApp: mocks.sendWhatsApp }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));

const { checkFreeStay, freeStayNote, sendFreeStayConfirmations } = await import("@/lib/booking/free-booking");

describe("checkFreeStay", () => {
  it("charges any positive total, promo or not", () => {
    expect(checkFreeStay(1200, null)).toBe("charge");
    expect(checkFreeStay(0.5, "HALF")).toBe("charge");
  });

  it("makes a zero total free only when a promo code covered it", () => {
    expect(checkFreeStay(0, "STAYFREE")).toBe("free");
  });

  it("refuses a zero total without a promo (a pricing error, not a gift)", () => {
    expect(checkFreeStay(0, null)).toBe("invalid");
  });
});

describe("sendFreeStayConfirmations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the guest confirmations with nothing paid and writes the audit entry", async () => {
    const booking = { id: "b-1", booking_code: "GAG-2026-FREE01", promo_code: "STAYFREE", discount_amount: 2400 };
    await sendFreeStayConfirmations(booking, "Penthouse");

    expect(mocks.sendEmail).toHaveBeenCalledWith(booking, "Penthouse", 0);
    expect(mocks.sendWhatsApp).toHaveBeenCalledWith(booking, "Penthouse");
    expect(mocks.logAudit).toHaveBeenCalledWith("booking.free_confirmed", "booking", "b-1", {
      booking_code: "GAG-2026-FREE01",
      promo_code: "STAYFREE",
      discount_amount: 2400,
    });
  });

  it("notes the promo on the booking for staff", () => {
    expect(freeStayNote("STAYFREE")).toContain("STAYFREE");
  });
});
