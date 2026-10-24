"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  bookingStatusSchema, guestDetailsSchema, cancelRefundSchema, bookingDatesSchema, recordPaymentSchema,
  type CancelRefundInput, type BookingDatesInput, type RecordPaymentInput,
} from "@/lib/validations";
import { refundPaystackTransaction } from "@/lib/paystack";
import { sendBookingCancelledEmail, sendBookingChangedEmail } from "@/lib/email";
import { generateBookingCode } from "@/lib/types";
import { pricingFromSettings, toChargeAmount } from "@/lib/pricing";
import { logAudit } from "@/lib/audit";
import { isStaff, isAdmin, UNAUTHORIZED } from "@/lib/auth";
import type { TablesUpdate } from "@/types/database";

export async function updateBookingStatus(bookingId: string, status: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = bookingStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: parsed.data })
    .eq("id", bookingId);

  if (error) {
    // 23P01 = the database's double-booking guard: these dates were taken since.
    if (error.code === "23P01") {
      return { ok: false, error: "Those dates are now booked by someone else, so this booking can't be restored." };
    }
    return { ok: false, error: error.message };
  }

  await logAudit("booking.status_changed", "booking", bookingId, { status: parsed.data });
  revalidatePath("/admin/bookings");
  return { ok: true };
}

const manualBookingSchema = guestDetailsSchema.extend({
  unit_id: z.string().uuid("Select a residence"),
  check_in: z.string().min(1),
  check_out: z.string().min(1),
  adults: z.coerce.number().int().min(1),
  children: z.coerce.number().int().min(0).default(0),
  mark_as_paid: z.coerce.boolean().default(false),
  payment_method: z.enum(["cash", "bank", "momo"]).optional(),
  admin_notes: z.string().max(1000).optional(),
}).refine((d) => new Date(d.check_out) > new Date(d.check_in), {
  message: "Check-out must be after check-in",
  path: ["check_out"],
});
export type ManualBookingInput = z.infer<typeof manualBookingSchema>;

export async function createManualBooking(input: ManualBookingInput) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = manualBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid booking details" };
  }
  const data = parsed.data;

  const supabase = createServiceClient();

  const { data: unit } = await supabase
    .from("units")
    .select("id, name, base_price_per_night")
    .eq("id", data.unit_id)
    .single();

  if (!unit) return { ok: false, error: "Residence not found" };

  // Release unpaid checkouts that were abandoned, so a ghost hold can't block these dates.
  await supabase.rpc("expire_stale_pending_bookings");

  const { data: available } = await supabase.rpc("is_unit_available", {
    p_unit_id: data.unit_id,
    p_check_in: data.check_in,
    p_check_out: data.check_out,
  });
  if (!available) return { ok: false, error: "Not available for the selected dates" };

  const nights = Math.round(
    (new Date(data.check_out).getTime() - new Date(data.check_in).getTime()) / 86_400_000
  );
  // Same rule as online bookings: price in the Settings currency, store and charge cedis.
  const { data: settingsRow } = await supabase.from("property_settings").select("*").limit(1).maybeSingle();
  const pricing = pricingFromSettings(settingsRow);
  const priceTotal = nights * Number(unit.base_price_per_night);
  const totalAmount = toChargeAmount(priceTotal, pricing);
  if (totalAmount === null) {
    return { ok: false, error: "Prices are set to USD but there's no exchange rate. Add one in Settings first." };
  }
  const bookingCode = generateBookingCode();

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      booking_code: bookingCode,
      unit_id: data.unit_id,
      check_in: data.check_in,
      check_out: data.check_out,
      adults: data.adults,
      children: data.children,
      guest_name: data.guest_name,
      guest_email: data.guest_email,
      guest_phone: data.guest_phone,
      special_requests: data.special_requests,
      admin_notes: data.admin_notes,
      total_amount: totalAmount,
      currency: "GHS",
      status: "confirmed",
      payment_status: data.mark_as_paid ? "paid" : "unpaid",
      ...(pricing.currency === "USD"
        ? { display_currency: "USD", display_total: priceTotal, exchange_rate: pricing.usdToGhsRate }
        : {}),
    })
    .select()
    .single();

  if (error || !booking) {
    if (error?.code === "23P01") {
      return { ok: false, error: "Those dates were just booked by someone else." };
    }
    return { ok: false, error: error?.message ?? "Could not create booking" };
  }

  if (data.mark_as_paid && data.payment_method) {
    await supabase.from("payments").insert({
      booking_id: booking.id,
      amount: totalAmount,
      currency: "GHS",
      method: data.payment_method,
      status: "success",
      paid_at: new Date().toISOString(),
    });
  }

  await logAudit("booking.created_manually", "booking", booking.id, {
    booking_code: bookingCode, guest_email: data.guest_email, mark_as_paid: data.mark_as_paid,
  });

  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}


// ---------------------------------------------------------------------------
// Cancellations & refunds, moving a booking's dates, and recording payments
// ---------------------------------------------------------------------------

// Net money received for a booking: successful payments minus refund rows (stored negative).
function netPaid(payments: any[] | null): number {
  return (payments ?? [])
    .filter((p: any) => p.status === "success" || p.status === "refunded")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`;
}

function refreshBookingPages(code?: string) {
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/calendar");
  if (code) revalidatePath(`/portal/${code}`);
}

// Cancels a booking and/or refunds money, in one step.
//  - Cancelling frees the dates immediately.
//  - A refund can go back through Paystack automatically, or be recorded as one you paid
//    out yourself (cash / bank / Mobile Money). Refunds are admin-only; staff can still cancel.
//  - On an already-cancelled booking this works as "refund only" (for example a guest who
//    paid just after their hold expired).
export async function cancelBookingWithRefund(input: CancelRefundInput) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = cancelRefundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };

  const { bookingId, refundMethod, reason } = parsed.data;
  const refundAmount = refundMethod === "none" ? 0 : Math.round(parsed.data.refundAmount * 100) / 100;

  if (refundMethod !== "none" && !(await isAdmin())) {
    return { ok: false, error: "Only admins can issue refunds. Cancel without a refund, and an admin can refund it afterwards." };
  }

  const supabase = createServiceClient();

  // Check the database is ready BEFORE any money moves, so we can never refund at Paystack
  // and then fail to record it.
  const preflight = await supabase.from("bookings").select("cancelled_at, refunded_amount").eq("id", bookingId).maybeSingle();
  if (preflight.error) {
    const missing = preflight.error.code === "42703" || preflight.error.code === "PGRST204";
    return {
      ok: false,
      error: missing
        ? "The database is missing the cancellation columns. Run supabase/migration-portal-and-ops.sql in the Supabase SQL Editor, then try again."
        : preflight.error.message,
    };
  }

  const { data: booking } = await supabase.from("bookings").select("*, units(name)").eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found" };
  if (booking.status === "checked_out") {
    return { ok: false, error: "This stay is already completed, so it can't be cancelled." };
  }
  const alreadyClosed = booking.status === "cancelled" || booking.status === "no_show";
  if (alreadyClosed && refundMethod === "none") {
    return { ok: false, error: "This booking is already cancelled. Choose a refund method to record a refund." };
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, status, method, paystack_reference")
    .eq("booking_id", bookingId);
  const paid = netPaid(payments);

  if (refundMethod !== "none") {
    if (refundAmount <= 0) return { ok: false, error: "Enter a refund amount above 0, or choose “No refund”." };
    if (refundAmount > paid + 0.005) {
      return { ok: false, error: `You can refund at most ${money(paid, booking.currency)} (what's been paid, less earlier refunds).` };
    }
  }

  // Automatic Paystack refund against the original card / Mobile Money payment.
  if (refundMethod === "paystack") {
    const original = (payments ?? []).find(
      (p: any) => p.method === "paystack" && p.status === "success" && p.paystack_reference
    );
    if (!original || !original.paystack_reference) {
      return { ok: false, error: "There's no Paystack payment on this booking to refund automatically. Record it as a cash, bank or Mobile Money refund instead." };
    }
    try {
      await refundPaystackTransaction({
        reference: original.paystack_reference,
        amountInMajorUnits: refundAmount,
        note: reason || `Cancellation of ${booking.booking_code}`,
      });
    } catch (err: any) {
      return {
        ok: false,
        error: `Paystack couldn't process the refund: ${err.message}. Nothing was changed. You can record a manual refund instead.`,
      };
    }
  }

  if (refundMethod !== "none") {
    const { error: paymentError } = await supabase.from("payments").insert({
      booking_id: bookingId,
      amount: -refundAmount,
      currency: booking.currency,
      method: refundMethod,
      status: "refunded",
      paystack_reference: refundMethod === "paystack" ? `refund:${booking.booking_code}:${Date.now()}` : null,
      paid_at: new Date().toISOString(),
    });
    if (paymentError) {
      return {
        ok: false,
        error:
          refundMethod === "paystack"
            ? `The refund WAS sent to Paystack, but it couldn't be recorded here (${paymentError.message}). Record it manually as a refund so your books match. Do not refund again.`
            : paymentError.message,
      };
    }
  }

  const update: TablesUpdate<"bookings"> = {};
  if (!alreadyClosed) {
    update.status = "cancelled";
    update.cancelled_at = new Date().toISOString();
    update.cancellation_reason = reason || null;
  }
  if (refundMethod !== "none") {
    update.refunded_amount = Number(booking.refunded_amount ?? 0) + refundAmount;
    if (paid - refundAmount <= 0.005) update.payment_status = "refunded";
  }

  const { error: updateError } = await supabase.from("bookings").update(update).eq("id", bookingId);
  if (updateError) {
    return {
      ok: false,
      error:
        refundMethod === "none"
          ? updateError.message
          : `The refund was recorded, but updating the booking failed (${updateError.message}). Refresh and check its status. Do not refund again.`,
    };
  }

  const refund = refundMethod === "none" ? null : { amount: refundAmount, method: refundMethod };
  if (!alreadyClosed || refund) {
    await sendBookingCancelledEmail(booking, (booking as any).units?.name ?? "your residence", refund);
  }

  await logAudit(alreadyClosed ? "booking.refunded" : "booking.cancelled", "booking", bookingId, {
    booking_code: booking.booking_code, refundMethod, refundAmount, reason,
  });
  refreshBookingPages(booking.booking_code);
  return { ok: true };
}

// Moves a booking to new dates (and sets the new total), after checking the residence is
// free. The guest gets an email with the change.
export async function updateBookingDates(input: BookingDatesInput) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = bookingDatesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid dates" };
  const { bookingId, check_in, check_out, total_amount } = parsed.data;

  const supabase = createServiceClient();
  const { data: booking } = await supabase.from("bookings").select("*, units(name)").eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found" };

  if (["cancelled", "no_show", "checked_out"].includes(booking.status)) {
    return { ok: false, error: "Only active bookings can be moved." };
  }
  if (booking.status === "pending" && booking.payment_status === "unpaid") {
    return { ok: false, error: "This booking is still waiting for payment. Let it be paid (or cancel it) before changing its dates." };
  }
  if (
    booking.check_in === check_in &&
    booking.check_out === check_out &&
    Number(booking.total_amount) === total_amount
  ) {
    return { ok: false, error: "Nothing has changed." };
  }

  await supabase.rpc("expire_stale_pending_bookings");
  const { data: available } = await supabase.rpc("is_unit_available", {
    p_unit_id: booking.unit_id,
    p_check_in: check_in,
    p_check_out: check_out,
    p_exclude_booking_id: booking.id, // don't let the booking clash with itself
  });
  if (!available) return { ok: false, error: "Those dates aren't available for this residence." };

  const { data: payments } = await supabase.from("payments").select("amount, status").eq("booking_id", bookingId);
  const paid = netPaid(payments);
  const paymentStatus =
    booking.payment_status === "refunded"
      ? "refunded"
      : paid <= 0
        ? "unpaid"
        : paid + 0.005 >= total_amount
          ? "paid"
          : "partial";

  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ check_in, check_out, total_amount, payment_status: paymentStatus })
    .eq("id", bookingId)
    .select("*, units(name)")
    .single();
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Those dates were just booked by someone else." };
    return { ok: false, error: error.message };
  }

  await sendBookingChangedEmail(updated ?? booking, (booking as any).units?.name ?? "your residence");
  await logAudit("booking.dates_changed", "booking", bookingId, {
    booking_code: booking.booking_code,
    from: { check_in: booking.check_in, check_out: booking.check_out, total: booking.total_amount },
    to: { check_in, check_out, total: total_amount },
  });
  refreshBookingPages(booking.booking_code);
  return { ok: true };
}

// Records money received outside Paystack (cash, bank transfer, Mobile Money), e.g. the
// balance on a phone booking, or after dates were moved to a pricier stay.
export async function recordPayment(input: RecordPaymentInput) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment" };
  const { bookingId, method } = parsed.data;
  const amount = Math.round(parsed.data.amount * 100) / 100;

  const supabase = createServiceClient();
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found" };
  if (booking.status === "cancelled" || booking.status === "no_show") {
    return { ok: false, error: "This booking is cancelled, so a payment can't be recorded against it." };
  }

  const { data: payments } = await supabase.from("payments").select("amount, status").eq("booking_id", bookingId);
  const outstanding = Number(booking.total_amount) - netPaid(payments);
  if (amount > outstanding + 0.005) {
    return { ok: false, error: `That's more than the outstanding balance of ${money(Math.max(outstanding, 0), booking.currency)}.` };
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    booking_id: bookingId,
    amount,
    currency: booking.currency,
    method,
    status: "success",
    paid_at: new Date().toISOString(),
  });
  if (paymentError) return { ok: false, error: paymentError.message };

  const fullyPaid = outstanding - amount <= 0.005;
  const update: TablesUpdate<"bookings"> = { payment_status: fullyPaid ? "paid" : "partial" };
  if (fullyPaid && booking.status === "pending") update.status = "confirmed";

  const { error } = await supabase.from("bookings").update(update).eq("id", bookingId);
  if (error) {
    return { ok: false, error: `The payment was recorded, but updating the booking failed (${error.message}). Refresh and check it.` };
  }

  await logAudit("booking.payment_recorded", "booking", bookingId, {
    booking_code: booking.booking_code, amount, method, fullyPaid,
  });
  refreshBookingPages(booking.booking_code);
  return { ok: true };
}
