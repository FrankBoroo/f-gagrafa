import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { log } from "@/lib/logger";

export type ReleaseHoldResult =
  | { outcome: "released"; booking: any }
  | { outcome: "kept"; booking: any } // Paystack still shows a payment in progress, or couldn't be reached
  | { outcome: "not_held"; booking: any | null }; // already paid, cancelled or unknown

// Paystack statuses that mean no money was taken and none is on its way. Anything else
// ("ongoing", "pending", "processing", ...) may still turn into a payment, so keep the hold.
const RELEASABLE_STATUSES = ["abandoned", "failed"];

export function isReleasableStatus(status: string | null | undefined): boolean {
  return RELEASABLE_STATUSES.includes(String(status ?? ""));
}

export const RELEASED_NOTE = "Released: guest left the Paystack checkout without paying";

// The guest closed the Paystack checkout (or the payment failed): free their dates now
// instead of after the 30-minute hold. This does exactly what the hold expiry does
// (`expire_stale_pending_bookings`): cancel without `cancelled_at`, so if a payment
// still arrives, confirmPaymentByReference confirms it when the dates are free and
// flags it for review when they were re-booked. Callers must first check the guest's
// own checkout cookie (`isOwnCheckout`).
export async function releaseUnpaidHold(reference: string): Promise<ReleaseHoldResult> {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, units(name, slug)")
    .eq("booking_code", reference)
    .single();

  if (!booking || booking.status !== "pending" || booking.payment_status !== "unpaid" || booking.cancelled_at) {
    return { outcome: "not_held", booking: booking ?? null };
  }

  try {
    const verification = await verifyPaystackTransaction(reference);
    if (!isReleasableStatus(verification.status)) return { outcome: "kept", booking };
  } catch (err) {
    log.warn("payment.release_check_failed", { booking_code: reference }, err);
    return { outcome: "kept", booking };
  }

  // Compare-and-set: if the webhook marked it paid a moment ago, this matches no row.
  const { data: released, error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      admin_notes: [booking.admin_notes, RELEASED_NOTE].filter(Boolean).join("\n"),
    })
    .eq("id", booking.id)
    .eq("status", "pending")
    .eq("payment_status", "unpaid")
    .select("id")
    .maybeSingle();

  if (error) {
    log.error("payment.release_failed", { booking_code: reference }, error);
    return { outcome: "kept", booking };
  }
  if (!released) return { outcome: "not_held", booking };

  log.info("payment.hold_released", { booking_code: reference });
  return { outcome: "released", booking };
}

// "/booking" with the same residence, dates and guests filled in, for a quick retry.
export function rebookHref(booking: any): string {
  const slug = booking?.units?.slug;
  if (!slug) return "/booking";
  const params = new URLSearchParams({
    unit: String(slug),
    checkIn: String(booking.check_in),
    checkOut: String(booking.check_out),
    guests: String(Number(booking.adults ?? 1) + Number(booking.children ?? 0)),
  });
  return `/booking?${params.toString()}`;
}
