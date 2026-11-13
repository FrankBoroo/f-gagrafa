"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { createBookingSchema, type CreateBookingInput } from "@/lib/validations";
import { generateBookingCode } from "@/lib/booking/codes";
import { syncRooms } from "@/lib/airbnb/sync";
import { releaseStaleHolds } from "@/lib/booking/availability";
import { freeRoomsForType, tryRoomsInOrder } from "@/lib/booking/rooms";
import { calculateNights } from "@/lib/booking/dates";
import { unitRates } from "@/lib/booking/stay-price";
import { minNightsError, requiredMinNights, stayPriceForDates } from "@/lib/booking/special-prices";
import { specialsByUnitForStay, specialsForStay } from "@/lib/booking/special-prices-db";
import { initializePaystackTransaction } from "@/lib/payments/paystack";
import { sendAdminNewBookingNotification, sendAdminSystemAlert } from "@/lib/notify/email";
import { log } from "@/lib/logger";
import { checkPromoCode, claimPromoUse, releasePromoUse } from "@/lib/booking/promo";
import { checkFreeStay, freeStayNote, sendFreeStayConfirmations } from "@/lib/booking/free-booking";
import { canOfferDeposit, depositAmount } from "@/lib/booking/deposit";
import { pricingFromSettings, toChargeAmount } from "@/lib/booking/pricing";
import { isHoneypotTripped, isSubmittedTooFast, isRateLimited } from "@/lib/spam-protection";
import { siteUrl } from "@/lib/env";
import { isOverLimit, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { guestCountError, stayDatesError } from "@/lib/booking/stay-limits";
import { rememberCheckout } from "@/lib/checkout-session";
import type { Tables } from "@/types/database";

const AIRBNB_REFRESH_MS = 3000;

// Best effort: errors and a sync that never settles are both swallowed after 3 s. Rooms whose
// last sync failed are left to the scheduler, so a broken link never slows a booking.
async function refreshAirbnbCalendars(supabase: ReturnType<typeof createServiceClient>, unitId: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      syncRooms(supabase, { unitId, olderThanMinutes: 15, timeoutMs: AIRBNB_REFRESH_MS, skipFailing: true, now: new Date() }),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, AIRBNB_REFRESH_MS);
      }),
    ]);
  } catch (err) {
    log.warn("airbnb.sync.refresh_failed", { errorName: err instanceof Error ? err.name : "unknown" });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Preview only: the booking itself recomputes the discount from server-side prices.
export async function previewPromoCode(code: string, subtotal: number) {
  if (typeof code !== "string" || code.length > 40 || !Number.isFinite(subtotal) || subtotal < 0) {
    return { valid: false, error: "Invalid or inactive code" };
  }
  if (await isOverLimit("promo")) return { valid: false, error: RATE_LIMITED_MESSAGE };
  return checkPromoCode(code, subtotal);
}

type AvailabilityResult =
  | { ok: true; availability: Record<string, boolean>; minNights: Record<string, number | null> }
  | { ok: false; error: string };

// Powers the apartment picker: tells the guest, before they pick, which units
// are free for their dates. A type whose dates need a longer stay (a minimum set in
// Special prices) counts as unavailable, and `minNights` says how long. Read-only and advisory — the real, authoritative
// check still runs again inside createBookingAndInitializePayment, so a unit
// that gets booked between this call and payment is still caught there.
export async function checkUnitsAvailability(
  checkIn: string,
  checkOut: string
): Promise<AvailabilityResult> {
  if (typeof checkIn !== "string" || typeof checkOut !== "string") {
    return { ok: false, error: "Choose valid dates" };
  }
  const datesError = stayDatesError(checkIn, checkOut);
  if (datesError) return { ok: false, error: datesError };
  if (await isOverLimit("availability")) return { ok: false, error: RATE_LIMITED_MESSAGE };

  const supabase = createServiceClient();
  const [{ data: units }, specials] = await Promise.all([
    supabase.from("units").select("id").eq("is_active", true),
    specialsByUnitForStay(supabase, checkIn, checkOut),
  ]);
  const nights = calculateNights(checkIn, checkOut);

  const minNights: Record<string, number | null> = {};
  const entries = await Promise.all(
    (units ?? []).map(async (u: { id: string }) => {
      // Fail open, here and below: if a lookup itself errors, don't wrongly grey a unit out.
      // The payment-time check is the one that actually decides.
      const required = requiredMinNights(checkIn, checkOut, specials?.[u.id] ?? []);
      const tooShort = minNightsError(nights, required) !== null;
      minNights[u.id] = tooShort ? required : null;
      if (tooShort) return [u.id, false] as [string, boolean];
      const rooms = await freeRoomsForType(supabase, { unitId: u.id, checkIn, checkOut });
      return [u.id, rooms === null || rooms.length > 0] as [string, boolean];
    })
  );

  return { ok: true, availability: Object.fromEntries(entries), minNights };
}

interface ActionResult {
  ok: boolean;
  error?: string;
  unavailable?: boolean; // the apartment has no free room for these dates: send the guest back to choose
  authorization_url?: string;
  redirect_url?: string; // free stays: straight to the success page, no Paystack
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

  const datesError = stayDatesError(data.check_in, data.check_out);
  if (datesError) return { ok: false, error: datesError };

  const supabase = createServiceClient();

  const { data: unit } = await supabase
    .from("units")
    .select("id, name, base_price_per_night, monthly_price, is_active, max_guests")
    .eq("id", data.unit_id)
    .single();

  if (!unit || !unit.is_active) {
    return { ok: false, error: "This apartment is no longer available" };
  }
  const guestsError = guestCountError(data.adults, data.children, unit.max_guests);
  if (guestsError) return { ok: false, error: guestsError };

  if (await isRateLimited("bookings", data.guest_email)) {
    return { ok: false, error: "Too many booking attempts from this email recently — please try again shortly, or contact us for help." };
  }

  const nights = calculateNights(data.check_in, data.check_out);

  // Special prices and minimum stays for these dates. Without them the stay can't be priced.
  const specials = await specialsForStay(supabase, {
    unitId: data.unit_id,
    checkIn: data.check_in,
    checkOut: data.check_out,
  });
  if (specials === null) {
    return { ok: false, error: "We couldn't check the price for these dates. Please try again." };
  }
  const tooShort = minNightsError(nights, requiredMinNights(data.check_in, data.check_out, specials));
  if (tooShort) return { ok: false, error: tooShort };

  // Release unpaid checkouts that were abandoned, so a ghost hold can't block these dates.
  await releaseStaleHolds(supabase);

  // Quick best-effort look at this type's Airbnb calendars. It never changes the outcome.
  await refreshAirbnbCalendars(supabase, data.unit_id);

  const rooms = await freeRoomsForType(supabase, {
    unitId: data.unit_id,
    checkIn: data.check_in,
    checkOut: data.check_out,
  });

  if (rooms === null) {
    return { ok: false, error: "We couldn't check availability. Please try again." };
  }
  if (!rooms.length) {
    return { ok: false, unavailable: true, error: "This apartment is not available for the selected dates" };
  }

  // Prices (and fixed promo amounts) are in the Settings price currency. Read fresh here,
  // so the exchange rate is the one in force at the moment of booking.
  const { data: settingsRow } = await supabase.from("property_settings").select("*").limit(1).maybeSingle();
  const pricing = pricingFromSettings(settingsRow);

  const subtotal = stayPriceForDates({
    checkIn: data.check_in,
    checkOut: data.check_out,
    rates: unitRates(unit),
    specials,
  });

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

  // 100% off: nothing to charge, and Paystack rejects a zero amount. The booking is confirmed
  // on creation instead, once a use of the code is claimed (atomically, so a single-use code
  // can't give two free stays).
  const freeStay = checkFreeStay(chargeTotal, appliedPromoCode);
  if (freeStay === "invalid") {
    return { ok: false, error: "This apartment can't be booked online right now. Please contact us to book." };
  }
  const freePromo = freeStay === "free" ? appliedPromoCode : null;
  const isFree = freePromo !== null;
  if (freePromo && !(await claimPromoUse(freePromo))) {
    return { ok: false, error: "This code has reached its usage limit" };
  }

  // Optional deposit: pay part now, the rest at check-in. Decided here on the server, never
  // trusted from the browser: the percentage comes from Settings.
  let amountDueNow = chargeTotal;
  let depositDue: number | null = null;
  if (data.payment_option === "deposit" && !isFree) {
    const percent = Number(settingsRow?.deposit_percent ?? 0);
    if (!canOfferDeposit(percent)) {
      return { ok: false, error: "A down payment isn't available right now. Please pay in full." };
    }
    depositDue = depositAmount(chargeTotal, percent);
    if (depositDue <= 0 || depositDue >= chargeTotal) {
      return { ok: false, error: "A deposit isn't available for this booking. Please pay in full." };
    }
    amountDueNow = depositDue;
  }

  const bookingCode = generateBookingCode();

  const { data: booking, error } = await tryRoomsInOrder<Tables<"bookings">>(rooms.map((room) => room.id), (roomId) =>
    supabase
      .from("bookings")
      .insert({
        booking_code: bookingCode,
        unit_id: data.unit_id,
        room_id: roomId,
        room_confirmed: false,
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
        status: isFree ? "confirmed" : "pending",
        payment_status: isFree ? "paid" : "unpaid",
        ...(freePromo ? { admin_notes: freeStayNote(freePromo) } : {}),
        promo_code: appliedPromoCode,
        discount_amount: chargeDiscount,
        ...(depositDue !== null ? { deposit_amount: depositDue } : {}),
        // Only set for USD pricing, so cedi bookings keep working before migration-usd-pricing.sql runs.
        ...(pricing.currency === "USD"
          ? { display_currency: "USD", display_total: totalAmount, exchange_rate: pricing.usdToGhsRate }
          : {}),
      })
      .select()
      .single()
  );

  if (error || !booking) {
    if (freePromo) await releasePromoUse(freePromo);
    // 23P01 = the database's double-booking guard: another guest took these dates a moment ago.
    if (error?.code === "23P01") {
      return { ok: false, unavailable: true, error: "Sorry — those dates were just taken by another guest. Please choose different dates." };
    }
    if (depositDue !== null && (error?.code === "42703" || error?.code === "PGRST204")) {
      return { ok: false, error: "Deposits aren't available right now. Please pay in full." };
    }
    if (pricing.currency === "USD" && (error?.code === "42703" || error?.code === "PGRST204")) {
      return { ok: false, error: "Online booking is paused while we update our rates. Please contact us to book." };
    }
    log.error("booking.insert_failed", { unit_id: data.unit_id, check_in: data.check_in, check_out: data.check_out }, error);
    await sendAdminSystemAlert("booking.insert_failed", "A guest could not create a booking", {
      Apartment: unit.name,
      Dates: `${data.check_in} → ${data.check_out}`,
      "Database error": error?.code ?? "no row returned",
    });
    return { ok: false, error: "We couldn't create your booking. Please try again or contact us." };
  }

  // Fire this now (booking created), not on payment success — admin wants
  // to know about pending reservations too, not just paid ones.
  await sendAdminNewBookingNotification(booking, unit.name);

  if (isFree) {
    await sendFreeStayConfirmations(booking, unit.name);
    return { ok: true, redirect_url: `/booking/success?reference=${bookingCode}`, booking_code: bookingCode };
  }

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
        // Where Paystack sends the guest who closes the checkout: frees their dates at once.
        cancel_action: `${site}/booking/cancelled?reference=${bookingCode}`,
      },
    });

    await rememberCheckout(bookingCode);
    return { ok: true, authorization_url: transaction.authorization_url, booking_code: bookingCode };
  } catch (err: any) {
    // Nothing was charged and there is nothing to pay, so release the dates right
    // away; otherwise the guest's own retry would be blocked by this dead hold.
    log.error("payment.init_failed", { booking_code: bookingCode, amount: amountDueNow }, err);
    await sendAdminSystemAlert("payment.init_failed", "Paystack checkout could not be started", {
      "Booking code": bookingCode,
      Apartment: unit.name,
      Amount: `GHS ${amountDueNow}`,
      Note: "The booking was auto-cancelled. If this repeats, check the Paystack keys and status.",
    });
    await supabase
      .from("bookings")
      .update({ status: "cancelled", admin_notes: "Auto-cancelled: payment could not be started" })
      .eq("id", booking.id);
    return { ok: false, error: "We couldn't start the payment. Please try again in a moment." };
  }
}
