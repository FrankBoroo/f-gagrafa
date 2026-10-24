import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

// Cancels unpaid checkouts older than 30 minutes, so an abandoned hold can't block dates.
export async function releaseStaleHolds(supabase: Db): Promise<void> {
  await supabase.rpc("expire_stale_pending_bookings");
}

// Asks the database's is_unit_available(): no overlapping live booking or blocked dates,
// ignoring unpaid holds older than 30 minutes. null means the lookup itself failed, and the
// caller decides what that means (the bookings_no_overlap constraint is the final guard).
export async function isUnitAvailable(
  supabase: Db,
  stay: { unitId: string; checkIn: string; checkOut: string; excludeBookingId?: string }
): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("is_unit_available", {
    p_unit_id: stay.unitId,
    p_check_in: stay.checkIn,
    p_check_out: stay.checkOut,
    p_exclude_booking_id: stay.excludeBookingId,
  });
  return error ? null : Boolean(data);
}
