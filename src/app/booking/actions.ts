"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { createBookingSchema, type CreateBookingInput } from "@/lib/validations";
import { generateBookingCode } from "@/lib/types";
import { initializePaystackTransaction } from "@/lib/paystack";
import { sendAdminNewBookingNotification } from "@/lib/email";
import { checkPromoCode } from "@/lib/promo";
import { isHoneypotTripped, isSubmittedTooFast, isRateLimited } from "@/lib/spam-protection";

export async function previewPromoCode(code: string, subtotal: number) {
  return checkPromoCode(code, subtotal);
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
      total_amount: totalAmount,
      currency: "GHS",
      status: "pending",
      payment_status: "unpaid",
      promo_code: appliedPromoCode,
      discount_amount: discountAmount,
    })
    .select()
    .single();

  if (error || !booking) {
    return { ok: false, error: error?.message ?? "Could not create booking" };
  }

  // Fire this now (booking created), not on payment success — admin wants
  // to know about pending reservations too, not just paid ones.
  await sendAdminNewBookingNotification(booking, unit.name);

  // Booking code doubles as the Paystack reference — one less thing to track,
  // and it's what the success page and webhook both look bookings up by.
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const transaction = await initializePaystackTransaction({
      email: data.guest_email,
      amountInMajorUnits: totalAmount,
      reference: bookingCode,
      currency: "GHS",
      callbackUrl: `${siteUrl}/booking/success`,
      metadata: {
        booking_id: booking.id,
        booking_code: bookingCode,
        unit_name: unit.name,
      },
    });

    return { ok: true, authorization_url: transaction.authorization_url, booking_code: bookingCode };
  } catch (err: any) {
    // Booking exists but payment couldn't be started — leave it pending so
    // the guest (or an admin) can retry rather than losing the reservation.
    return {
      ok: false,
      error: err.message ?? "Could not start payment. Your reservation was saved as pending — please try again.",
      booking_code: bookingCode,
    };
  }
}
