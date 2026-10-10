"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  booking_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

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
