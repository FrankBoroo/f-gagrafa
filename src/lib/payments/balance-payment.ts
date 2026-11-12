import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { initializePaystackTransaction, verifyPaystackTransaction } from "@/lib/payments/paystack";
import { balanceProblem, balanceReference } from "@/lib/payments/balance";
import { netPaid } from "@/lib/admin/guests";
import { sendAdminPaymentConflictAlert, sendAdminSystemAlert, sendBalanceReceivedEmail } from "@/lib/notify/email";
import { formatMoney } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { log } from "@/lib/logger";
import type { PaymentConfirmationResult } from "@/lib/payments/booking-payment";

const START_FAILED = "We couldn't start the payment. Please try again in a moment.";

const round2 = (n: number) => Math.round(n * 100) / 100;

// A booking a person has closed: money arriving on it is never allowed to reopen it.
function isClosed(booking: { status: string; payment_status: string; cancelled_at?: string | null }): boolean {
  return (
    booking.status === "cancelled" ||
    booking.status === "no_show" ||
    booking.payment_status === "refunded" ||
    Boolean(booking.cancelled_at)
  );
}

function appendNote(existing: string | null | undefined, note: string): string {
  return [existing, note].filter(Boolean).join("\n");
}

// Starts a Paystack checkout for what's still owed on a booking. The amount comes from the
// database (total less what's been paid), never from the guest. The payment row is saved
// `pending` first and counts for nothing until `confirmBalancePayment` marks it `success`.
export async function startBalancePayment(
  bookingCode: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, booking_code, status, payment_status, total_amount, currency, guest_email")
    .eq("booking_code", bookingCode)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found" };

  const { data: payments } = await supabase.from("payments").select("amount, status").eq("booking_id", booking.id);
  const paid = netPaid(payments);
  const problem = balanceProblem(booking, paid);
  if (problem) return { ok: false, error: problem };

  const owed = round2(Number(booking.total_amount) - paid);
  const reference = balanceReference(booking.booking_code);

  const { data: row, error: insertError } = await supabase
    .from("payments")
    .insert({
      booking_id: booking.id,
      amount: owed,
      currency: booking.currency,
      method: "paystack",
      paystack_reference: reference,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !row) {
    log.error("balance.checkout_failed", { booking_code: booking.booking_code, reference, stage: "insert" }, insertError);
    return { ok: false, error: START_FAILED };
  }

  try {
    const site = siteUrl();
    const portalUrl = `${site}/portal/${booking.booking_code}`;
    const transaction = await initializePaystackTransaction({
      email: booking.guest_email,
      amountInMajorUnits: owed,
      reference,
      currency: "GHS",
      callbackUrl: portalUrl,
      metadata: { booking_code: booking.booking_code, kind: "balance", cancel_action: portalUrl },
    });
    return { ok: true, url: transaction.authorization_url };
  } catch (err) {
    // Nothing was charged; mark this attempt failed so the guest's retry makes a fresh one.
    await supabase.from("payments").update({ status: "failed" }).eq("id", row.id);
    log.error("balance.checkout_failed", { booking_code: booking.booking_code, reference, amount: owed }, err);
    await sendAdminSystemAlert("balance.checkout_failed", "A guest could not start a balance payment", {
      "Booking code": booking.booking_code,
      Amount: formatMoney(owed, booking.currency),
      Note: "Nothing was charged. If this repeats, check the Paystack keys and status.",
    });
    return { ok: false, error: START_FAILED };
  }
}

// Confirms one balance payment, by its Paystack reference. Called through
// `confirmPaymentByReference` by both the Paystack webhook and the portal return, so it
// must be idempotent: the compare-and-set on the `pending` row lets exactly one call
// record the money and send the email or alert.
export async function confirmBalancePayment(reference: string): Promise<PaymentConfirmationResult> {
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("payments")
    .select("*, bookings(*, units(name))")
    .eq("paystack_reference", reference)
    .maybeSingle();
  const booking: any = row?.bookings ?? null;
  if (!row || !booking) return { outcome: "not_found" };

  const code = booking.booking_code;
  const unitName = booking.units?.name ?? "your apartment";
  const settled = (): PaymentConfirmationResult =>
    isClosed(booking) ? { outcome: "closed", booking } : { outcome: "paid", booking };

  if (row.status === "success") return settled();
  // A checkout that never started (marked failed by startBalancePayment): there is no
  // Paystack payment to confirm against it.
  if (row.status !== "pending") return { outcome: "failed", booking, reason: row.status };

  const verification = await verifyPaystackTransaction(reference);
  if (verification.status !== "success") {
    return { outcome: "failed", booking, reason: verification.status };
  }

  const expected = Number(row.amount);
  const charged = verification.amount / 100;
  const mismatch =
    charged + 0.005 < expected
      ? "amount_mismatch"
      : verification.currency !== booking.currency
        ? "currency_mismatch"
        : null;
  if (mismatch) {
    // Never record a short or foreign-currency charge as paid; a person sorts it out.
    // Keyed by reference, so each bad attempt is flagged once however often it's retried.
    const marker = `BALANCE PAYMENT MISMATCH (${reference})`;
    const note = `${marker}: expected ${booking.currency} ${expected}, Paystack reported ${verification.currency} ${charged}.`;
    log.error("balance.mismatch", { booking_code: code, reference, mismatch, expected, charged, charged_currency: verification.currency });
    if (!String(booking.admin_notes ?? "").includes(marker)) {
      await supabase
        .from("bookings")
        .update({ admin_notes: appendNote(booking.admin_notes, note), attention_cleared_at: null })
        .eq("id", booking.id);
      await sendAdminPaymentConflictAlert(booking, unitName, `${note} The balance was not recorded; check the payment in Paystack and refund or contact the guest.`);
    }
    return { outcome: "failed", booking, reason: mismatch };
  }

  const { data: won } = await supabase
    .from("payments")
    .update({ status: "success", amount: charged, paid_at: verification.paid_at ?? new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");
  // Another call (webhook or portal return) recorded this payment first and did the rest.
  if (!won || won.length === 0) return settled();

  // Re-read the booking and its payments now this call owns the payment: staff may have
  // cancelled, or the total changed, while Paystack was being asked.
  const [{ data: fresh }, { data: payments }] = await Promise.all([
    supabase
      .from("bookings")
      .select("status, payment_status, cancelled_at, admin_notes, total_amount")
      .eq("id", booking.id)
      .maybeSingle(),
    supabase.from("payments").select("amount, status").eq("booking_id", booking.id),
  ]);
  if (fresh) Object.assign(booking, fresh);
  const net = netPaid(payments);
  const total = Number(booking.total_amount);

  // Cancelled (or refunded) while the guest had Paystack open: keep the money on record,
  // leave the booking closed and let a person refund or rebook.
  if (isClosed(booking)) {
    const note = `PAID AFTER CANCELLATION (balance): ${formatMoney(charged, booking.currency)} arrived on ${reference} after the booking was closed. Refund the guest, or rebook them if they still want to stay.`;
    await supabase
      .from("bookings")
      .update({ admin_notes: appendNote(booking.admin_notes, note), attention_cleared_at: null })
      .eq("id", booking.id);
    log.error("balance.paid_after_cancellation", { booking_code: code, reference, charged });
    await sendAdminPaymentConflictAlert(booking, unitName, note);
    return { outcome: "needs_review", booking };
  }

  // Paid twice (two tabs) or more than the total: the booking is paid; refund the excess.
  if (net > total + 0.005) {
    const note = `OVERPAID: refund ${formatMoney(round2(net - total), booking.currency)} (balance payment ${reference} took the total paid to ${formatMoney(net, booking.currency)} on a ${formatMoney(total, booking.currency)} booking).`;
    await supabase
      .from("bookings")
      .update({ payment_status: "paid", admin_notes: appendNote(booking.admin_notes, note), attention_cleared_at: null })
      .eq("id", booking.id);
    log.error("balance.overpaid", { booking_code: code, reference, charged, net, total });
    await sendAdminPaymentConflictAlert(booking, unitName, note);
    return { outcome: "needs_review", booking: { ...booking, payment_status: "paid" } };
  }

  const paymentStatus = net + 0.005 >= total ? "paid" : "partial";
  await supabase.from("bookings").update({ payment_status: paymentStatus }).eq("id", booking.id);
  log.info("balance.paid", { booking_code: code, reference, charged, payment_status: paymentStatus });
  const remaining = Math.max(round2(total - net), 0);
  await sendBalanceReceivedEmail(booking, unitName, charged, remaining);
  return { outcome: "paid", booking: { ...booking, payment_status: paymentStatus } };
}
