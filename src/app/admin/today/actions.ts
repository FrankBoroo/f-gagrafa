"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isStaff, UNAUTHORIZED } from "@/lib/auth";

const id = z.string().uuid();

// Housekeeping tapped "Mark cleaned" on a room tile.
export async function markRoomCleaned(roomId: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  if (!id.safeParse(roomId).success) return { ok: false, error: "Room not found" };

  const supabase = createServiceClient();
  const { error } = await supabase.from("rooms").update({ last_cleaned_at: new Date().toISOString() }).eq("id", roomId);
  if (error) return { ok: false, error: error.message };

  await logAudit("room.cleaned", "room", roomId);
  revalidatePath("/admin");
  return { ok: true };
}

// A flagged payment (mismatch, paid after cancellation, paid but not confirmed) has been
// dealt with, so it leaves "Needs attention". The note on the booking stays.
export async function clearAttention(bookingId: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  if (!id.safeParse(bookingId).success) return { ok: false, error: "Booking not found" };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("bookings")
    .update({ attention_cleared_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) return { ok: false, error: error.message };

  await logAudit("booking.attention_cleared", "booking", bookingId);
  revalidatePath("/admin");
  return { ok: true };
}
