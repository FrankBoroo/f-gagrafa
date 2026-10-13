"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { grantPortalAccess, hasPortalAccess } from "@/lib/portal-session";
import { sendCancellationRequestAlert } from "@/lib/email";

const reviewSchema = z.object({
  booking_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

const MAX_FAILED_ATTEMPTS = 8; // per booking code, per 15 minutes

// Failed tries per booking code in the last 15 minutes. Fails open if the attempts
// table doesn't exist yet (migration not run) so guests are never locked out by a setup gap.
async function tooManyAttempts(supabase: any, code: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count, error } = await supabase
    .from("portal_access_attempts")
    .select("id", { count: "exact", head: true })
    .eq("booking_code", code)
    .eq("succeeded", false)
    .gte("created_at", since);
  if (error) return false;
  return (count ?? 0) >= MAX_FAILED_ATTEMPTS;
}

// Email addresses match case-insensitively; phone numbers match on their last 9
// digits so "+233 24 123 4567" and "024 123 4567" are treated as the same number.
function contactMatches(entered: string, booking: { guest_email?: string; guest_phone?: string | null }): boolean {
  const value = entered.trim();
  if (!value) return false;
  if (value.includes("@")) {
    return value.toLowerCase() === (booking.guest_email ?? "").trim().toLowerCase();
  }
  const digits = value.replace(/\D/g, "");
  const stored = (booking.guest_phone ?? "").replace(/\D/g, "");
  if (digits.length < 9 || stored.length < 9) return false;
  return digits.slice(-9) === stored.slice(-9);
}

// Proves the visitor is the guest: booking code + the email or phone on the booking.
// Every failure returns the same message so this can't be used to discover which codes exist.
export async function verifyPortalAccess(rawCode: string, contact: string) {
  const code = rawCode.trim().toUpperCase().slice(0, 30);
  if (!code || !contact.trim()) {
    return { ok: false as const, error: "Enter your booking code and the email or phone you booked with." };
  }

  const supabase = createServiceClient();

  if (await tooManyAttempts(supabase, code)) {
    return {
      ok: false as const,
      error: "Too many attempts for this booking. Please wait 15 minutes and try again, or contact us.",
    };
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("booking_code, guest_email, guest_phone")
    .eq("booking_code", code)
    .maybeSingle();

  const matched = Boolean(booking) && contactMatches(contact, booking);
  await supabase.from("portal_access_attempts").insert({ booking_code: code, succeeded: matched }); // best-effort

  if (!matched) {
    return {
      ok: false as const,
      error: "We couldn't match those details to a booking. Check your booking code and the email or phone you booked with.",
    };
  }

  await grantPortalAccess(booking.booking_code);
  return { ok: true as const, code: booking.booking_code as string };
}

// Guest portal access is by booking code, not Supabase auth, so this runs
// with the service-role client (same pattern as service requests) rather
// than relying on the `reviews` RLS insert policy, which expects auth.uid().
export async function submitReview(input: z.infer<typeof reviewSchema>) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid review" };
  }

  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, booking_code")
    .eq("id", parsed.data.booking_id)
    .single();

  if (!booking) return { ok: false, error: "Booking not found" };
  if (!(await hasPortalAccess(booking.booking_code))) {
    return { ok: false, error: "Please verify your booking before leaving a review." };
  }
  if (booking.status !== "checked_out") {
    return { ok: false, error: "Reviews can only be left after checkout" };
  }

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "You've already reviewed this stay" };

  const { error } = await supabase.from("reviews").insert({
    booking_id: booking.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    is_published: false,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/portal/${booking.booking_code}`);
  return { ok: true };
}

// Guests can't cancel and refund themselves — money moves only when a person approves it.
// This files a clearly-labelled request that lands in Admin → Service Requests and emails the team.
export async function requestCancellation(bookingId: string, reason: string) {
  const supabase = createServiceClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, booking_code, guest_name, check_in, check_out, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return { ok: false, error: "Booking not found" };
  if (!(await hasPortalAccess(booking.booking_code))) {
    return { ok: false, error: "Please verify your booking first." };
  }
  if (!["pending", "confirmed"].includes(booking.status)) {
    return { ok: false, error: "This booking can't be cancelled online — please contact us." };
  }

  const { data: existing } = await supabase
    .from("service_requests")
    .select("id")
    .eq("booking_id", booking.id)
    .like("description", "CANCELLATION REQUEST%")
    .in("status", ["pending", "in_progress"])
    .limit(1);
  if (existing && existing.length > 0) return { ok: true }; // already asked; don't pile up duplicates

  const cleanReason = (reason ?? "").trim().slice(0, 500);
  const { error } = await supabase.from("service_requests").insert({
    booking_id: booking.id,
    type: "other",
    description: `CANCELLATION REQUEST${cleanReason ? `: ${cleanReason}` : ""}`,
  });
  if (error) return { ok: false, error: error.message };

  await sendCancellationRequestAlert(booking, cleanReason);
  revalidatePath(`/portal/${booking.booking_code}`);
  return { ok: true };
}
