import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { sendBookingConfirmationEmail, sendAdminPaymentConflictAlert } from "@/lib/notify/email";
import { sendBookingConfirmationWhatsApp } from "@/lib/notify/whatsapp";
import { log } from "@/lib/logger";

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
  const mismatch =
    charged + 0.005 < expected
      ? "amount_mismatch"
      : booking.currency && verification.currency !== booking.currency
        ? "currency_mismatch"
        : null;
  if (mismatch) {
    // Paystack took money that doesn't match this booking: a bug or a tampered checkout.
    // Never confirm it; flag it once for a person (the webhook and success page both land here).
    const note = `PAYMENT MISMATCH (${mismatch}): expected ${booking.currency} ${expected}, Paystack reported ${verification.currency} ${charged}.`;
    log.error("payment.mismatch", { booking_code: reference, mismatch, expected, charged, charged_currency: verification.currency });
    if (!String(booking.admin_notes ?? "").includes("PAYMENT MISMATCH")) {
      await supabase
        .from("bookings")
        .update({ admin_notes: [booking.admin_notes, note].filter(Boolean).join("\n") })
        .eq("id", booking.id);
      await sendAdminPaymentConflictAlert(booking, (booking as any).units?.name ?? "a residence", `${note} Do not confirm this booking; check the payment in Paystack and refund or contact the guest.`);
    }
    return { outcome: "failed", booking, reason: mismatch };
  }
  const paidInFull = charged + 0.005 >= Number(booking.total_amount);

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  // Only the call that records the payment sends notifications. The webhook and the success
  // page can both get here at once; the unique `paystack_reference` lets just one insert win
  // (23505 = the other one already recorded it).
  let firstConfirmation = false;
  if (!existingPayment) {
    const { error: insertError } = await supabase.from("payments").insert({
      booking_id: booking.id,
      amount: verification.amount / 100,
      currency: booking.currency, // same as Paystack's: a mismatch returned above
      method: "paystack",
      paystack_reference: reference,
      status: "success",
      paid_at: verification.paid_at ?? new Date().toISOString(),
    });
    firstConfirmation = insertError?.code !== "23505";
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
    log.error("payment.paid_not_confirmed", { booking_code: reference, first: firstConfirmation }, updateError);
    if (firstConfirmation) {
      await sendAdminPaymentConflictAlert(booking, (booking as any).units?.name ?? "a residence", reason);
    }
    return { outcome: "needs_review", booking };
  }

  // Only fire notifications the first time this booking is confirmed —
  // `firstConfirmation` is false when the webhook or the success page already
  // handled this reference.
  if (firstConfirmation) {
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
