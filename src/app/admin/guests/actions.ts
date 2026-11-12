"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { getCurrentProfile, isStaff, UNAUTHORIZED } from "@/lib/auth";
import { guestKey } from "@/lib/admin/guests";

const notesSchema = z.object({
  bookingId: z.string().uuid("Guest not found"),
  notes: z.string().trim().max(2000, "Notes can be up to 2,000 characters."),
});

// Staff notes on a guest. The guest is addressed by one of their bookings, so no email
// travels in a URL; the notes are stored under the booking's lower-cased email.
export async function saveGuestNotes(input: { bookingId: string; notes: string }): Promise<{ ok: boolean; error?: string }> {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = notesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Could not save the notes" };

  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("guest_email, booking_code")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();
  const email = guestKey(booking?.guest_email);
  if (!booking || !email) return { ok: false, error: "Guest not found" };

  const profile = await getCurrentProfile();
  const { error } = await supabase.from("guest_notes").upsert(
    { email, notes: parsed.data.notes, updated_at: new Date().toISOString(), updated_by: profile?.id ?? null },
    { onConflict: "email" }
  );
  if (error) return { ok: false, error: "Could not save the notes. Please try again." };

  // The audit entry names the booking only: never the notes text or the email.
  await logAudit("guest.notes_saved", "booking", parsed.data.bookingId, { booking_code: booking.booking_code });
  revalidatePath(`/admin/guests/${parsed.data.bookingId}`);
  return { ok: true };
}
