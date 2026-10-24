import "server-only";
import { sendBookingConfirmationEmail } from "@/lib/notify/email";
import { sendBookingConfirmationWhatsApp } from "@/lib/notify/whatsapp";
import { logAudit } from "@/lib/audit";

// A promo code covering the whole stay leaves nothing to charge, and Paystack rejects a zero
// amount. Such a booking skips Paystack and is confirmed when it's created. Only a promo can
// make a stay free; a zero total without one is a pricing error, not a gift.
export type FreeStayCheck = "free" | "charge" | "invalid";

export function checkFreeStay(chargeTotal: number, promoCode: string | null): FreeStayCheck {
  if (chargeTotal > 0) return "charge";
  return promoCode ? "free" : "invalid";
}

export function freeStayNote(promoCode: string): string {
  return `Free stay: promo code ${promoCode} covered the full total; no payment taken.`;
}

// The notifications a paid booking gets from confirmPaymentByReference, plus an audit entry
// standing in for the payment record. All best-effort: the booking is already confirmed.
export async function sendFreeStayConfirmations(
  booking: { id: string; booking_code: string; promo_code: string | null; discount_amount: number | null },
  unitName: string
): Promise<void> {
  await Promise.all([
    sendBookingConfirmationEmail(booking, unitName, 0),
    sendBookingConfirmationWhatsApp(booking, unitName),
    logAudit("booking.free_confirmed", "booking", booking.id, {
      booking_code: booking.booking_code,
      promo_code: booking.promo_code,
      discount_amount: booking.discount_amount,
    }),
  ]);
}
