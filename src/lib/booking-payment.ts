import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { sendBookingConfirmationEmail, sendAdminPaymentConflictAlert } from "@/lib/email";
import { sendBookingConfirmationWhatsApp } from "@/lib/whatsapp";

export type PaymentConfirmationResult =
  | { outcome: "paid"; booking: any }
  | { outcome: "failed"; booking: any | null; reason: string }
  | { outcome: "needs_review"; booking: any }
  | { outcome: "closed"; booking: any }
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

  // Already handled (e.g. the webhook beat us to it) — nothing more to do. A booking
  // that is paid but cancelled is the "paid after the hold expired and the dates
  // were re-let" case, which needs a person to resolve it.
  if (booking.payment_status !== "unpaid") {
    // Refunded or cancelled by an admin: a late webhook retry, or a revisit to the success
    // page, must never bring the booking back to life.
    if (booking.payment_status === "refunded" || booking.cancelled_at) return { outcome: "closed", booking };
    return booking.status === "cancelled" ? { outcome: "needs_review", booking } : { outcome: "paid", booking };
  }

  const verification = await verifyPaystackTransaction(reference);

  if (verification.status !== "success") {
    return { outcome: "failed", booking, reason: verification.status };
  }

  // Compare what was actually charged with what this booking expected: the full total, or
  // the deposit if the guest chose to reserve with a deposit.
  const expected = Number(booking.deposit_amount ?? booking.total_amount);
  const charged = verification.amount / 100;
  if (charged + 0.005 < expected) {
    return { outcome: "failed", booking, reason: "amount_mismatch" };
  }
  const paidInFull = charged + 0.005 >= Number(booking.total_amount);

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

  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update({ status: "confirmed", payment_status: paidInFull ? "paid" : "partial" })
    .eq("id", booking.id)
    .select("*, units(name)")
    .single();

  if (updateError) {
    // Money was taken but the booking couldn't be confirmed. Most likely the unpaid
    // hold expired and the dates were booked by someone else meanwhile (23P01, the
    // database's double-booking guard). The payment row is already recorded; flag
    // the booking and tell the admin so a person can offer new dates or a refund.
    const reason =
      updateError.code === "23P01"
        ? "PAID AFTER HOLD EXPIRED — the dates were re-booked. Contact the guest: offer new dates or refund in full."
        : `PAID BUT NOT CONFIRMED — automatic confirmation failed (${updateError.message}). Check this booking.`;
    await supabase
      .from("bookings")
      .update({
        payment_status: paidInFull ? "paid" : "partial",
        admin_notes: [booking.admin_notes, reason].filter(Boolean).join("\n"),
      })
      .eq("id", booking.id);
    if (!existingPayment) {
      await sendAdminPaymentConflictAlert(booking, (booking as any).units?.name ?? "a residence", reason);
    }
    return { outcome: "needs_review", booking };
  }

  // Only fire notifications the first time this booking is confirmed —
  // `existingPayment` means either the webhook or the success page already
  // handled this reference.
  if (!existingPayment) {
    const unitName = (updatedBooking as any)?.units?.name ?? (booking as any).units?.name ?? "your residence";
    await Promise.all([
      sendBookingConfirmationEmail(updatedBooking ?? booking, unitName, charged),
      sendBookingConfirmationWhatsApp(updatedBooking ?? booking, unitName),
    ]);

    if (booking.promo_code) {
      await supabase.rpc("increment_promo_usage", { p_code: booking.promo_code });
    }
  }

  return { outcome: "paid", booking: updatedBooking ?? booking };
}
