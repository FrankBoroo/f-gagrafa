"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { createBookingSchema, type CreateBookingInput } from "@/lib/validations";
import { generateBookingCode } from "@/lib/types";
import { initializePaystackTransaction } from "@/lib/paystack";
import { sendAdminNewBookingNotification } from "@/lib/email";
import { checkPromoCode } from "@/lib/promo";
import { canOfferDeposit, depositAmount } from "@/lib/deposit";
import { pricingFromSettings, toChargeAmount } from "@/lib/pricing";
import { isHoneypotTripped, isSubmittedTooFast, isRateLimited } from "@/lib/spam-protection";
import { siteUrl } from "@/lib/env";
import { isOverLimit, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";

// Preview only: the booking itself recomputes the discount from server-side prices.
export async function previewPromoCode(code: string, subtotal: number) {
  if (typeof code !== "string" || code.length > 40 || !Number.isFinite(subtotal) || subtotal < 0) {
    return { valid: false, error: "Invalid or inactive code" };
  }
  if (await isOverLimit("promo")) return { valid: false, error: RATE_LIMITED_MESSAGE };
  return checkPromoCode(code, subtotal);
}

type AvailabilityResult =
  | { ok: true; availability: Record<string, boolean> }
  | { ok: false; error: string };

// Powers the residence picker: tells the guest, before they pick, which units
// are free for their dates. Read-only and advisory — the real, authoritative
// check still runs again inside createBookingAndInitializePayment, so a unit
// that gets booked between this call and payment is still caught there.
export async function checkUnitsAvailability(
  checkIn: string,
  checkOut: string
): Promise<AvailabilityResult> {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(checkIn) || !dateRe.test(checkOut)) {
    return { ok: false, error: "Choose valid dates" };
  }

  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Choose valid dates" };
  }
  if (end <= start) return { ok: false, error: "Check-out must be after check-in" };
  if (checkIn < new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: "Check-in can't be in the past" };
  }
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (nights > 365) {
    return { ok: false, error: "Online bookings are limited to 365 nights — contact us for longer stays" };
  }
  if (await isOverLimit("availability")) return { ok: false, error: RATE_LIMITED_MESSAGE };

  const supabase = createServiceClient();
  const { data: units } = await supabase.from("units").select("id").eq("is_active", true);

  const entries = await Promise.all(
    (units ?? []).map(async (u: { id: string }) => {
      const { data, error } = await supabase.rpc("is_unit_available", {
        p_unit_id: u.id,
        p_check_in: checkIn,
        p_check_out: checkOut,
      });
      // Fail open: if the lookup itself errors, don't wrongly grey a unit out.
      // The payment-time check is the one that actually decides.
      return [u.id, error ? true : Boolean(data)] as [string, boolean];
    })
  );

  return { ok: true, availability: Object.fromEntries(entries) };
}

interface ActionResult {
  ok: boolean;
  error?: string;
  authorization_url?: string;
  booking_code?: string;
}

// Creates the booking row (pending/unpaid) and initializes the matching
// Paystack transaction in one call, so the client only needs one round trip
// before redirecting to Paystack's checkout.
export async function createBookingAndInitializePayment(
  input: CreateBookingInput
): Promise<ActionResult> {
  // Bots: fail with a generic, non-committal error rather than silently
  // "succeeding" like the contact form — a booking flow faking success
  // would leave a guest thinking they'd reserved something they hadn't.
  if (isHoneypotTripped(input.honeypot) || isSubmittedTooFast(input.renderedAt)) {
    return { ok: false, error: "Could not process this request. Please try again." };
  }

  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid booking details" };
  }
  const data = parsed.data;

  if (await isOverLimit("booking")) return { ok: false, error: RATE_LIMITED_MESSAGE };

  if (data.check_in < new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: "Check-in can't be in the past" };
  }

  const supabase = createServiceClient();

  const { data: unit } = await supabase
    .from("units")
    .select("id, name, base_price_per_night, is_active")
    .eq("id", data.unit_id)
    .single();

  if (!unit || !unit.is_active) {
    return { ok: false, error: "This residence is no longer available" };
  }

  if (await isRateLimited("bookings", "guest_email", data.guest_email)) {
    return { ok: false, error: "Too many booking attempts from this email recently — please try again shortly, or contact us for help." };
  }

  // Release unpaid checkouts that were abandoned, so a ghost hold can't block these dates.
  await supabase.rpc("expire_stale_pending_bookings");

  const { data: available } = await supabase.rpc("is_unit_available", {
    p_unit_id: data.unit_id,
    p_check_in: data.check_in,
    p_check_out: data.check_out,
  });

  if (!available) {
    return { ok: false, error: "This residence is not available for the selected dates" };
  }

  const nights = Math.round(
    (new Date(data.check_out).getTime() - new Date(data.check_in).getTime()) / 86_400_000
  );
  // Prices (and fixed promo amounts) are in the Settings price currency. Read fresh here,
  // so the exchange rate is the one in force at the moment of booking.
  const { data: settingsRow } = await supabase.from("property_settings").select("*").limit(1).maybeSingle();
  const pricing = pricingFromSettings(settingsRow);

  const subtotal = nights * Number(unit.base_price_per_night);

  let totalAmount = subtotal;
  let appliedPromoCode: string | null = null;
  let discountAmount = 0;

  if (data.promo_code) {
    const promoResult = await checkPromoCode(data.promo_code, subtotal);
    if (!promoResult.valid) {
      return { ok: false, error: promoResult.error ?? "Invalid promo code" };
    }
    appliedPromoCode = promoResult.code!;
    discountAmount = promoResult.discountAmount!;
    totalAmount = promoResult.finalAmount!;
  }

  // Everything from here on (stored total, deposit, Paystack charge) is in cedis.
  const chargeTotal = toChargeAmount(totalAmount, pricing);
  if (chargeTotal === null) {
    return { ok: false, error: "Online booking is paused while we update our rates. Please contact us to book." };
  }
  const chargeDiscount = toChargeAmount(discountAmount, pricing) ?? 0;

  // Optional deposit: pay part now, the rest at check-in. Decided here on the server, never
  // trusted from the browser: the percentage comes from Settings, and it's only offered when
  // check-in is far enough away.
  let amountDueNow = chargeTotal;
  let depositDue: number | null = null;
  if (data.payment_option === "deposit") {
    const percent = Number(settingsRow?.deposit_percent ?? 0);
    if (!canOfferDeposit(data.check_in, percent)) {
      return { ok: false, error: "A deposit isn't available for these dates. Please pay in full." };
    }
    depositDue = depositAmount(chargeTotal, percent);
    if (depositDue <= 0 || depositDue >= chargeTotal) {
      return { ok: false, error: "A deposit isn't available for this booking. Please pay in full." };
    }
    amountDueNow = depositDue;
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
      total_amount: chargeTotal,
      currency: "GHS",
      status: "pending",
      payment_status: "unpaid",
      promo_code: appliedPromoCode,
      discount_amount: chargeDiscount,
      ...(depositDue !== null ? { deposit_amount: depositDue } : {}),
      // Only set for USD pricing, so cedi bookings keep working before migration-usd-pricing.sql runs.
      ...(pricing.currency === "USD"
        ? { display_currency: "USD", display_total: totalAmount, exchange_rate: pricing.usdToGhsRate }
        : {}),
    })
    .select()
    .single();

  if (error || !booking) {
    // 23P01 = the database's double-booking guard: another guest took these dates a moment ago.
    if (error?.code === "23P01") {
      return { ok: false, error: "Sorry — those dates were just taken by another guest. Please choose different dates." };
    }
    if (depositDue !== null && (error?.code === "42703" || error?.code === "PGRST204")) {
      return { ok: false, error: "Deposits aren't available right now. Please pay in full." };
    }
    if (pricing.currency === "USD" && (error?.code === "42703" || error?.code === "PGRST204")) {
      return { ok: false, error: "Online booking is paused while we update our rates. Please contact us to book." };
    }
    console.error("booking insert failed", error);
    return { ok: false, error: "We couldn't create your booking. Please try again or contact us." };
  }

  // Fire this now (booking created), not on payment success — admin wants
  // to know about pending reservations too, not just paid ones.
  await sendAdminNewBookingNotification(booking, unit.name);

  // Booking code doubles as the Paystack reference — one less thing to track,
  // and it's what the success page and webhook both look bookings up by.
  try {
    const site = siteUrl();
    const transaction = await initializePaystackTransaction({
      email: data.guest_email,
      amountInMajorUnits: amountDueNow,
      reference: bookingCode,
      currency: "GHS",
      callbackUrl: `${site}/booking/success`,
      metadata: {
        booking_id: booking.id,
        booking_code: bookingCode,
        unit_name: unit.name,
        payment_option: data.payment_option,
        amount_due_now: amountDueNow,
      },
    });

    return { ok: true, authorization_url: transaction.authorization_url, booking_code: bookingCode };
  } catch (err: any) {
    // Nothing was charged and there is nothing to pay, so release the dates right
    // away; otherwise the guest's own retry would be blocked by this dead hold.
    console.error("Paystack initialization failed:", err);
    await supabase
      .from("bookings")
      .update({ status: "cancelled", admin_notes: "Auto-cancelled: payment could not be started" })
      .eq("id", booking.id);
    return { ok: false, error: "We couldn't start the payment. Please try again in a moment." };
  }
}
