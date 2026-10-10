import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendBookingConfirmationWhatsApp } from "@/lib/whatsapp";

export type PaymentConfirmationResult =
  | { outcome: "paid"; booking: any }
  | { outcome: "failed"; booking: any | null; reason: string }
  | { outcome: "not_found" };

// Shared by the booking-success page (user redirected back from Paystack) and
// the Paystack webhook (server-to-server). Both end up here so a booking is
// only ever marked paid once verification actually succeeds, and it's safe
// to call this twice for the same reference (e.g. webhook + page both fire).
export async function confirmPaymentByReference(
  reference: string
): Promise<PaymentConfirmationResult> {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, units(name)")
    .eq("booking_code", reference)
    .single();

  if (!booking) return { outcome: "not_found" };

  // Already confirmed (e.g. webhook beat us to it) — nothing more to do.
  if (booking.payment_status === "paid") {
    return { outcome: "paid", booking };
  }

  const verification = await verifyPaystackTransaction(reference);

  if (verification.status !== "success") {
    return { outcome: "failed", booking, reason: verification.status };
  }

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (!existingPayment) {
    await supabase.from("payments").insert({
      booking_id: booking.id,
      amount: verification.amount / 100,
      currency: verification.currency,
      method: "paystack",
      paystack_reference: reference,
      status: "success",
      paid_at: verification.paid_at ?? new Date().toISOString(),
    });
  }

  const { data: updatedBooking } = await supabase
    .from("bookings")
    .update({ status: "confirmed", payment_status: "paid" })
    .eq("id", booking.id)
    .select("*, units(name)")
    .single();

  // Only fire notifications the first time this booking is confirmed —
  // `existingPayment` means either the webhook or the success page already
  // handled this reference.
  if (!existingPayment) {
    const unitName = (updatedBooking as any)?.units?.name ?? (booking as any).units?.name ?? "your residence";
    await Promise.all([
      sendBookingConfirmationEmail(updatedBooking ?? booking, unitName),
      sendBookingConfirmationWhatsApp(updatedBooking ?? booking, unitName),
    ]);

    if (booking.promo_code) {
      await supabase.rpc("increment_promo_usage", { p_code: booking.promo_code });
    }
  }

  return { outcome: "paid", booking: updatedBooking ?? booking };
}
